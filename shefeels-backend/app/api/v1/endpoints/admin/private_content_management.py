from fastapi import APIRouter, Depends, HTTPException,Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.schemas.private_content import PrivateContentPackCreateRequest
from app.api.v1.deps import get_db
from app.api.v1.deps import require_admin
from app.models.character import Character
from app.services.app_config import get_config_value_from_cache
from app.models.private_content import MediaPack, MediaPackMedia
from app.models.character_media import CharacterMedia
from app.schemas.private_content import PrivateContentRequest
from app.models.user import User, RoleEnum
from passlib.context import CryptContext
from app.api.v1.deps import get_current_user
from app.core.aws_s3 import generate_presigned_url, generate_public_s3_url
import asyncio
from fastapi.responses import JSONResponse
from sqlalchemy import delete, or_, func
from fastapi import UploadFile, File, Form
from app.core.aws_s3 import upload_to_s3_file
from app.services.character_media import generate_filename_timestamped
from app.models.character_media import CharacterMedia
from app.schemas.character import (
    CharacterCreate,
    CharacterRead,
    CharacterIdIn,
    CharacterEdit,
)
from app.services.ai_generation_logging import (
    create_ai_generation_log,
    update_ai_generation_log_success,
    update_ai_generation_log_failure,
)
from typing import List

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.post("/create-pack", dependencies=[Depends(require_admin)])
async def create_media_pack(
    payload: PrivateContentPackCreateRequest,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    print(f"Creating media pack with payload: {payload}")

    # validate character exists
    q = await db.execute(select(Character).where(Character.id == payload.character_id))
    character = q.scalars().first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # resolve thumbnail s3 path if thumbnail_image_id provided
    thumbnail_s3_path = None
    if payload.thumbnail_image_id:
        thumb_q = await db.execute(
            select(CharacterMedia).where(
                CharacterMedia.id == payload.thumbnail_image_id
            )
        )
        thumb = thumb_q.scalars().first()
        if not thumb:
            raise HTTPException(status_code=404, detail="Thumbnail image not found")
        thumbnail_s3_path = getattr(thumb, "s3_path", None)

    # validate media ids in bulk and compute counts
    num_images = 0
    num_videos = 0
    print(f"Validating media ids for new pack: {payload.list_media_ids}")
    if payload.list_media_ids:
        q_med = await db.execute(
            select(CharacterMedia).where(CharacterMedia.id.in_(payload.list_media_ids))
        )
        fetched_medias = q_med.scalars().all()
        fetched_ids = {m.id for m in fetched_medias}
        # check for any missing ids
        missing = [m_id for m_id in payload.list_media_ids if m_id not in fetched_ids]
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Media id not found: {missing[0]}"
            )

        for m in fetched_medias:
            mtype = (getattr(m, "media_type", "") or "").lower()
            if mtype == "image" or mtype == "chat_image":
                num_images += 1
            elif mtype == "video":
                num_videos += 1

    # create media pack with accurate counts
    pack = MediaPack(
        character_id=payload.character_id,
        created_by=current_user.id if current_user else None,
        name=payload.pack_name,
        description=payload.pack_description,
        price_tokens=payload.tokens,
        is_active=payload.is_active if payload.is_active is not None else True,
        thumbnail_s3_path=thumbnail_s3_path,
        num_images=num_images,
        num_videos=num_videos,
    )
    print(f"Creating media pack: {pack}")
    db.add(pack)
    # flush so pack.id is available for related rows
    await db.flush()

    # create media mapping rows (preserve order/duplicates from payload)
    if payload.list_media_ids:
        for media_id in payload.list_media_ids:
            print(f"Adding character_media_id {media_id} to pack_id {pack.id}")
            mapping = MediaPackMedia(media_pack_id=pack.id, character_media_id=media_id)
            db.add(mapping)

    await db.commit()
    # refresh pack to ensure any defaults/relationships are loaded
    await db.refresh(pack)

    return pack


@router.post(
    "/get-character-media", status_code=200, dependencies=[Depends(require_admin)]
)
async def get_character_media(
    payload: PrivateContentRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    character_id = payload.character_id
    # Fetch media for the current user with character information
    stmt = (
        select(CharacterMedia, Character)
        .outerjoin(Character, CharacterMedia.character_id == Character.id)
        .where(
            (CharacterMedia.user_id == user.id)
            & (CharacterMedia.character_id == character_id)
        )
        # Primary ordering: newest created_at first. Secondary ordering by id ensures
        # deterministic results when created_at values are identical.
        .order_by(CharacterMedia.created_at.desc(), CharacterMedia.id.desc())
    )
    result = await db.execute(stmt)
    media_with_characters = result.all()

    if not media_with_characters:
        raise HTTPException(status_code=404, detail="No media found")

    # Convert ORM objects to JSON-serializable dicts
    # Prepare lists for concurrent presigning
    media_serialized = []
    media_keys = []
    char_image_keys = []
    char_gif_keys = []
    pairs = []
    for media_obj, character_obj in media_with_characters:
        media_keys.append(getattr(media_obj, "s3_path", None))
        if character_obj is not None:
            # prefer explicit s3 path or image_url_s3; if it's a full URL it'll be left as-is later
            char_image_keys.append(
                getattr(character_obj, "image_url_s3", None)
                or getattr(character_obj, "image_url", None)
                or getattr(character_obj, "img", None)
            )
            # Also capture gif key if present
            char_gif_keys.append(getattr(character_obj, "gif_url_s3", None))
        else:
            char_image_keys.append(None)
            char_gif_keys.append(None)
        pairs.append((media_obj, character_obj))

    presigned_media = []
    presigned_chars = []
    if media_keys:
        presigned_media = await asyncio.gather(
            *[
                generate_presigned_url(k) if k else asyncio.sleep(0, result=None)
                for k in media_keys
            ]
        )
    if char_image_keys:
        presigned_chars = await asyncio.gather(
            *[
                (
                    generate_presigned_url(k)
                    if k
                    and not (
                        str(k).startswith("http://")
                        or str(k).startswith("https://")
                        or ".amazonaws.com/" in str(k)
                    )
                    else asyncio.sleep(0, result=None)
                )
                for k in char_image_keys
            ]
        )
    presigned_char_gifs = []
    if char_gif_keys:
        presigned_char_gifs = await asyncio.gather(
            *[
                (
                    generate_presigned_url(k)
                    if k
                    and not (
                        str(k).startswith("http://")
                        or str(k).startswith("https://")
                        or ".amazonaws.com/" in str(k)
                    )
                    else asyncio.sleep(0, result=None)
                )
                for k in char_gif_keys
            ]
        )

    for idx, (media_obj, character_obj) in enumerate(pairs):
        media_presigned = presigned_media[idx] if idx < len(presigned_media) else None
        char_presigned = presigned_chars[idx] if idx < len(presigned_chars) else None
        media_data = {
            "id": media_obj.id,
            "character_id": media_obj.character_id,
            "user_id": media_obj.user_id,
            "media_type": media_obj.media_type,
            "s3_path_gallery": media_presigned,
            "mime_type": media_obj.mime_type,
            "created_at": (
                media_obj.created_at.isoformat()
                if media_obj.created_at is not None
                else None
            ),
        }

        if character_obj:
            character_image_url = None
            if char_presigned:
                character_image_url = char_presigned
            else:
                character_image_url = getattr(
                    character_obj, "image_url", None
                ) or getattr(character_obj, "img", None)

            # Resolve presigned gif for this character (if any)
            presigned_gif = (
                presigned_char_gifs[idx]
                if presigned_char_gifs and idx < len(presigned_char_gifs)
                else None
            )
            gif_url_value = presigned_gif or getattr(character_obj, "gif_url_s3", None)

            media_data["character"] = {
                "id": character_obj.id,
                "name": character_obj.name,
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
                "gif_url_s3": gif_url_value,
            }

        media_serialized.append(media_data)

    # Provide backward-compatible keys so older frontend bundles that expect
    # `images` or `data` or `videos` still work.
    images_list = [m for m in media_serialized if m.get("media_type") == "image"]
    videos_list = [m for m in media_serialized if m.get("media_type") == "video"]
    # Backwards-compatibility: older frontends prefer `images`. If there are
    # image items, return `images` as a combined list of images followed by
    # videos so the gallery will display both. If there are no image items,
    # return `images: None` so very old bundles will fall back to `data`.
    if len(images_list) > 0:
        # Preserve original ordering relative to media_serialized where
        # possible: include media items from media_serialized that are
        # images or videos, preserving their original sort order.
        images_and_videos = [
            m for m in media_serialized if m.get("media_type") in ("image", "video")
        ]
        images_key = images_and_videos
    else:
        # No image items — return videos as `images` so older frontends that
        # only read `images` will still display recent videos.
        images_key = videos_list or []
    return JSONResponse(
        content={
            "message": "Media retrieved successfully",
            "media": media_serialized,
            "images": images_key,
            "videos": videos_list,
            "data": media_serialized,
        },
        status_code=200,
    )


@router.post("/add-media-to-pack", dependencies=[Depends(require_admin)])
async def add_media_to_pack(
    payload: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Add existing CharacterMedia ids to a MediaPack (admin only).
    Payload: { "pack_id": "<id>", "media_ids": ["id1","id2"] }
    """
    pack_id = payload.get("pack_id")
    media_ids = payload.get("media_ids") or []
    if not pack_id:
        raise HTTPException(status_code=400, detail="pack_id required")
    # validate pack exists
    q = await db.execute(select(MediaPack).where(MediaPack.id == pack_id))
    pack = q.scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    # validate media ids exist
    if media_ids:
        q2 = await db.execute(
            select(CharacterMedia).where(CharacterMedia.id.in_(media_ids))
        )
        fetched = q2.scalars().all()
        fetched_ids = {m.id for m in fetched}
        missing = [m for m in media_ids if m not in fetched_ids]
        if missing:
            raise HTTPException(
                status_code=404, detail=f"Media id not found: {missing[0]}"
            )

    # insert mapping rows
    for media_id in media_ids:
        mapping = MediaPackMedia(media_pack_id=pack_id, character_media_id=media_id)
        db.add(mapping)

    await db.commit()
    return JSONResponse(content={"detail": "media added to pack"}, status_code=200)


@router.post("/upload-media-and-add", dependencies=[Depends(require_admin)])
async def upload_media_and_add(
    file: UploadFile = File(...),
    pack_id: str | None = Form(None),
    character_id: str | None = Form(None),
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Upload a single file to S3, create CharacterMedia and optionally add it to a pack.
    Form fields: file, pack_id (optional), character_id (optional)
    """
    content_type = file.content_type or "application/octet-stream"
    # generate filename
    filename = await generate_filename_timestamped("admin_upload")
    ext = (content_type.split("/")[-1] or "bin").lower()
    if ext in ("jpeg", "pjpeg"):
        ext = "jpg"
    s3_key = f"admin_uploads/{current_user.id}/{filename}.{ext}"
    bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
    # upload
    s3_key, presigned = await upload_to_s3_file(
        file.file, s3_key=s3_key, content_type=content_type, bucket_name=bucket_name
    )

    # create CharacterMedia
    media_type = (
        "image"
        if content_type.startswith("image")
        else "video" if content_type.startswith("video") else "file"
    )
    db_media = CharacterMedia(
        user_id=current_user.id,
        character_id=character_id,
        media_type=media_type,
        s3_path=s3_key,
        mime_type=content_type,
    )
    db.add(db_media)
    await db.commit()
    await db.refresh(db_media)

    # optionally add to pack
    if pack_id:
        q = await db.execute(select(MediaPack).where(MediaPack.id == pack_id))
        pack = q.scalars().first()
        if not pack:
            raise HTTPException(status_code=404, detail="Pack not found")
        mapping = MediaPackMedia(media_pack_id=pack_id, character_media_id=db_media.id)
        db.add(mapping)
        await db.commit()

    return JSONResponse(
        content={"id": db_media.id, "s3_path": s3_key, "url": presigned},
        status_code=200,
    )


# @router.post("/generate-media-and-add", dependencies=[Depends(require_admin)])
# async def generate_media_and_add(
#     payload: dict,
#     current_user: User = Depends(require_admin),
#     db: AsyncSession = Depends(get_db),
# ):
#     """Generate images using the internal image generator and add results to a pack.
#     Payload: { pack_id, character_id, prompt, num_images }
#     """
#     pack_id = payload.get("pack_id")
#     character_id = payload.get("character_id")
#     prompt = payload.get("prompt") or ""
#     num_images = int(payload.get("num_images") or 1)
#     if not pack_id:
#         raise HTTPException(status_code=400, detail="pack_id required")

#     # validate pack exists
#     q = await db.execute(select(MediaPack).where(MediaPack.id == pack_id))
#     pack = q.scalars().first()
#     if not pack:
#         raise HTTPException(status_code=404, detail="Pack not found")

#     # generate images using service
#     # Use configured model and default orientation
#     ai_model = await get_config_value_from_cache("IMAGE_GEN_MODEL")
#     results = []

#     # Create AI generation log entry
#     log_entry = await create_ai_generation_log(
#         db=db,
#         user_id=current_user.id,
#         character_id=character_id,
#         generation_type="image",
#         prompt_text=prompt,
#         prompt_metadata={"pack_id": pack_id, "source": "admin_pack_generation"},
#         ai_model=ai_model or "xl_pornai",
#         num_generations=num_images,
#         size_orientation="portrait",
#         source_context="admin_pack_generation",
#         is_compliant=True,
#     )

#     try:
#         resp = await generate_image(prompt, num_images, None, "portrait", ai_model)
#         if resp.status_code != 200:
#             await update_ai_generation_log_failure(
#                 db=db,
#                 log_id=log_entry.id,
#                 error_message=f"Image generation API returned status {resp.status_code}",
#             )
#             raise HTTPException(status_code=502, detail="image generation failed")
#         json_resp = resp.json()
#         images_base64 = (
#             json_resp.get("data", {}).get("images_data") or json_resp.get("data") or []
#         )
#     except Exception as e:
#         await update_ai_generation_log_failure(
#             db=db, log_id=log_entry.id, error_message=str(e)
#         )
#         raise HTTPException(status_code=500, detail=str(e))

#     bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
#     created_ids = []
#     generated_s3_keys = []
#     generated_urls = []
#     for idx, b64 in enumerate(images_base64[:num_images]):
#         import base64
#         from io import BytesIO

#         img_bytes = base64.b64decode(b64)
#         fileobj = BytesIO(img_bytes)
#         filename = await generate_filename_timestamped(f"gen_{current_user.id}_{idx}")
#         s3_key = f"generated/{current_user.id}/{filename}.png"
#         s3_key, presigned = await upload_to_s3_file(
#             fileobj, s3_key=s3_key, content_type="image/png", bucket_name=bucket_name
#         )
#         db_media = CharacterMedia(
#             user_id=current_user.id,
#             character_id=character_id,
#             media_type="image",
#             s3_path=s3_key,
#             mime_type="image/png",
#         )
#         db.add(db_media)
#         await db.commit()
#         await db.refresh(db_media)
#         created_ids.append(db_media.id)
#         generated_s3_keys.append(s3_key)
#         generated_urls.append(presigned)
#         # add to pack mapping
#         mapping = MediaPackMedia(media_pack_id=pack_id, character_media_id=db_media.id)
#         db.add(mapping)
#         await db.commit()

#     # Update log with success
#     await update_ai_generation_log_success(
#         db=db,
#         log_id=log_entry.id,
#         generated_s3_keys=generated_s3_keys,
#         generated_content_urls=generated_urls,
#         face_swap_applied=False,
#     )

#     return JSONResponse(content={"created_ids": created_ids}, status_code=200)


@router.post("/update-pack", dependencies=[Depends(require_admin)])
async def update_media_pack(
    payload: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing media pack's metadata and its media mapping order.
    Payload: { pack_id, pack_name?, pack_description?, tokens?, thumbnail_image_id?, list_media_ids? }
    """
    pack_id = payload.get("pack_id")
    if not pack_id:
        raise HTTPException(status_code=400, detail="pack_id required")

    q = await db.execute(select(MediaPack).where(MediaPack.id == pack_id))
    pack = q.scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    # update simple fields
    if "pack_name" in payload:
        pack.name = payload.get("pack_name")
    if "pack_description" in payload:
        pack.description = payload.get("pack_description")
    if "tokens" in payload:
        try:
            pack.price_tokens = int(payload.get("tokens") or 0)
        except Exception:
            pack.price_tokens = 0

    # resolve thumbnail
    if payload.get("thumbnail_image_id"):
        thumb_id = payload.get("thumbnail_image_id")
        q2 = await db.execute(
            select(CharacterMedia).where(CharacterMedia.id == thumb_id)
        )
        thumb = q2.scalars().first()
        if not thumb:
            raise HTTPException(status_code=404, detail="Thumbnail image not found")
        pack.thumbnail_s3_path = getattr(thumb, "s3_path", None)

    # replace media mappings if list provided
    list_media_ids = payload.get("list_media_ids") or None
    if list_media_ids is not None:
        # validate provided ids exist
        if list_media_ids:
            q3 = await db.execute(
                select(CharacterMedia).where(CharacterMedia.id.in_(list_media_ids))
            )
            fetched = q3.scalars().all()
            fetched_ids = {m.id for m in fetched}
            missing = [m for m in list_media_ids if m not in fetched_ids]
            if missing:
                raise HTTPException(
                    status_code=404, detail=f"Media id not found: {missing[0]}"
                )

        # delete existing mappings for this pack
        await db.execute(
            delete(MediaPackMedia).where(MediaPackMedia.media_pack_id == pack_id)
        )
        # add new mappings preserving order
        if list_media_ids:
            for media_id in list_media_ids:
                mapping = MediaPackMedia(
                    media_pack_id=pack_id, character_media_id=media_id
                )
                db.add(mapping)

    # recompute counts
    # compute num_images/num_videos based on current mappings
    q_count = await db.execute(
        select(CharacterMedia)
        .join(MediaPackMedia, MediaPackMedia.character_media_id == CharacterMedia.id)
        .where(MediaPackMedia.media_pack_id == pack_id)
    )
    medias = q_count.scalars().all()
    num_images = 0
    num_videos = 0
    for m in medias:
        mtype = (getattr(m, "media_type", "") or "").lower()
        if mtype in ("image", "chat_image"):
            num_images += 1
        elif mtype == "video":
            num_videos += 1
    pack.num_images = num_images
    pack.num_videos = num_videos

    await db.commit()
    await db.refresh(pack)
    return JSONResponse(
        content={"detail": "pack updated", "pack": {"id": pack.id, "name": pack.name}},
        status_code=200,
    )


@router.post("/delete-pack", dependencies=[Depends(require_admin)])
async def delete_media_pack(
    payload: dict,
    current_user: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Delete a media pack and its mappings. Payload: { pack_id }"""
    pack_id = payload.get("pack_id")
    if not pack_id:
        raise HTTPException(status_code=400, detail="pack_id required")

    q = await db.execute(select(MediaPack).where(MediaPack.id == pack_id))
    pack = q.scalars().first()
    if not pack:
        raise HTTPException(status_code=404, detail="Pack not found")

    # delete mappings
    await db.execute(
        delete(MediaPackMedia).where(MediaPackMedia.media_pack_id == pack_id)
    )
    # delete pack
    await db.execute(delete(MediaPack).where(MediaPack.id == pack_id))
    await db.commit()

    return JSONResponse(content={"detail": "pack deleted"}, status_code=200)


@router.get("/fetch-private-content-characters")
async def list_characters(
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(
        default=None,
        description="Filter default characters by name or bio (case-insensitive partial match)",
    ),
    style: str | None = Query(default=None, description="Filter by style (realistic, anime)"),
    gender: str | None = Query(default=None, description="Filter by gender (male, female, trans)"),
):
    """List all default characters created by admin with pagination and filters (accessible without authentication)."""
    # admin_user_ids_result = await db.execute(
    #     select(User.id).where((User.role == RoleEnum.ADMIN) | (User.role == RoleEnum.SUPER_ADMIN))
    # )
    admin_user_ids_result = await db.execute(select(User.id).where(User.role.in_([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN])))

    admin_user_ids = [row[0] for row in admin_user_ids_result.fetchall()]

    stmt = (
        select(Character)
        .where(Character.user_id.in_(admin_user_ids))
        .order_by(Character.created_at.desc())
    )

    if search:
        try:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Character.name.ilike(term),
                    Character.bio.ilike(term),
                )
            )
        except Exception:
            # If building the search filter fails, fall back to the unfiltered query
            pass
    
    if style and style.lower() != 'all':
        stmt = stmt.where(func.lower(Character.style) == style.lower())
    
    if gender and gender.lower() != 'all':
        stmt = stmt.where(func.lower(Character.gender) == gender.lower())

    # Get total count before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * per_page
    stmt = stmt.limit(per_page).offset(offset)

    result = await db.execute(stmt)
    characters = result.scalars().all()

    # Parallelize presigned URL generation for all characters
    char_dicts = [CharacterRead.model_validate(c).model_dump() for c in characters]

    # Generate all presigned URLs in parallel for default (public) characters
    image_keys = [cd.get("image_url_s3") for cd in char_dicts]  # PNG
    webp_image_keys = [cd.get("webp_image_url_s3") for cd in char_dicts]  # static WebP
    gif_keys = [cd.get("gif_url_s3") for cd in char_dicts]
    animated_webp_keys = [cd.get("animated_webp_url_s3") for cd in char_dicts]

    presigned_images = await asyncio.gather(*[
        generate_presigned_url(s3_key=k) if (k and not str(k).startswith("http")) else asyncio.sleep(0, result=k) 
        for k in image_keys
    ])
    presigned_webp_images = await asyncio.gather(*[
        generate_presigned_url(s3_key=k) if (k and not str(k).startswith("http")) else asyncio.sleep(0, result=k) 
        for k in webp_image_keys
    ])
    presigned_gifs = await asyncio.gather(*[
        generate_public_s3_url(s3_key=k) if (k and not str(k).startswith("http")) else asyncio.sleep(0, result=k) 
        for k in gif_keys
    ])
    presigned_animated_webps = await asyncio.gather(*[
        generate_public_s3_url(s3_key=k) if (k and not str(k).startswith("http")) else asyncio.sleep(0, result=k) 
        for k in animated_webp_keys
    ])

    updated_characters = []
    for char_dict, p_img, p_webp_img, p_gif, p_anim_webp in zip(char_dicts, presigned_images, presigned_webp_images, presigned_gifs, presigned_animated_webps):
        if p_img:
            char_dict["image_url_s3"] = p_img
        if p_webp_img:
            char_dict["webp_image_url_s3"] = p_webp_img
        if p_gif:
            char_dict["gif_url_s3"] = p_gif
        if p_anim_webp:
            char_dict["animated_webp_url_s3"] = p_anim_webp
        updated_characters.append(char_dict)
    
    return {
        "items": updated_characters,
        "total": total,
        "page": page,
        "per_page": per_page,
    }