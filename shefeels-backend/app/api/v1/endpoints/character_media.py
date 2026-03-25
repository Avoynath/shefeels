"""
Character endpoints for AI Friend Chatbot.
"""

import json
from fastapi import APIRouter, Request, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, delete, insert, cast, String
from app.schemas.character_media import ImageCreate
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.models.character_media import CharacterMedia
from app.models.character import Character
from app.models.user import User
from app.services.aetherlab_service import AetherLabService
from app.services.schema import (
    SCHEMA_PROMPT_GENERATION, 
)
from app.schemas.character import CharacterIdIn
from app.core.config import settings
from app.core.aws_s3 import upload_to_s3_file
from app.services.character_media import generate_filename_timestamped, generate_text_to_image, get_job, generate_character_prompt, generate_character_to_image_prompt, generate_text_to_image_prompt, generate_character_to_image_prompt_for_user_prompt
from app.core.aws_s3 import generate_presigned_url, generate_public_s3_url
from app.services.app_config import get_config_value_from_cache
from sqlalchemy.ext.asyncio import AsyncSession
import base64
from io import BytesIO
import asyncio
import requests
import httpx
import uuid

# from starlette.responses import JSONResponse
from typing import Any, Dict, List

# from starlette.datastructures import UploadFile
from starlette.datastructures import UploadFile as StarletteUploadFile
import os, re
import tempfile
from fastapi.responses import StreamingResponse
from app.services.subscription import check_user_wallet, deduhl_user_coins
from app.services.sse_broadcast import get_broadcaster
from app.services.ai_generation_logging import (
    create_ai_generation_log,
    update_ai_generation_log_success,
    update_ai_generation_log_failure
)
router = APIRouter()


async def _is_supported_media_url(url: str | None) -> bool:
    if not url:
        return False
    try:
        timeout = httpx.Timeout(5.0, connect=3.0)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=True) as client:
            response = await client.head(url)
            if response.status_code in (403, 405) or not (200 <= response.status_code < 300):
                response = await client.get(url)
        content_type = (response.headers.get("content-type") or "").lower()
        if response.status_code != 200:
            return False
        return content_type.startswith("image/")
    except Exception:
        return False


async def _resolve_face_reference_url(image_input_url: str | None, db_character: Character | None = None) -> str | None:
    """Choose the most reliable media URL for generation.

    In local/dev setups the private static character image often cannot be fetched,
    while public GIF/animated WebP assets still work. Prefer an explicit URL from the
    client first, then public character assets, then fall back to presigned static keys.
    """
    explicit = (image_input_url or "").strip() if image_input_url else None
    if explicit:
        candidate = explicit
        if not explicit.startswith(("http://", "https://")):
            try:
                candidate = await generate_presigned_url(explicit)
            except Exception:
                candidate = None
        if candidate and await _is_supported_media_url(candidate):
            return candidate

    if not db_character:
        return None

    # Prefer static character images for face-reference inputs.
    # Animated assets (gif/webp) are less reliable for face swap requests.
    signed_candidates = [
        getattr(db_character, "webp_image_url_s3", None),
        getattr(db_character, "image_url_s3", None),
    ]
    for key in signed_candidates:
        if not key:
            continue
        try:
            candidate = await generate_presigned_url(key)
            if await _is_supported_media_url(candidate):
                return candidate
        except Exception:
            continue

    public_candidates = [
        getattr(db_character, "animated_webp_url_s3", None),
        getattr(db_character, "gif_url_s3", None),
    ]
    for key in public_candidates:
        if not key:
            continue
        try:
            candidate = await generate_public_s3_url(key)
            if await _is_supported_media_url(candidate):
                return candidate
        except Exception:
            continue

    return None


@router.post("/create-image")
async def create_image(
    request: Request,
    image: ImageCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Proxy endpoint to forward an image edit request to Lightspeed's image/edit API.
    - Uploads the provided image to S3 so we have a stored source copy.
    - Calls the external API with the presigned URL (or S3 key) as 'images'.
    - Returns the upstream JSON response to the client.
    """
    await check_user_wallet(db, user.id, "image")
    # positive_prompt = await get_config_value_from_cache("IMAGE_POSITIVE_PROMPT")
    # negative_prompt = await get_config_value_from_cache("IMAGE_NEGATIVE_PROMPT")

    print("=" * 80)
    print("CHARACTER IMAGE GENERATION - USING STORED JSON PROMPT")
    print(f"character_id: {image.character_id}")
    print("=" * 80)
    # Load system prompt and guardrail config values. These can be missing
    # in some deployments, so coerce to empty strings and handle safely.
    
    if image.character_id:
        # messages.append({"role": "system", "content": image_to_image_prompt})
        stmt = select(Character).where(Character.id == image.character_id)
        result = await db.execute(stmt)
        db_character = result.scalar_one_or_none()
        if not db_character:
            raise HTTPException(status_code=404, detail="Character not found")

        
        # Use prompt_enhanced if available, else fallback to prompt
        base_prompt = db_character.prompt_enhanced or db_character.prompt
        
        if not image.outfit and not image.pose and not image.action and not image.accessories:
             final_prompt_tuple = await generate_character_to_image_prompt_for_user_prompt(
                  base_prompt=base_prompt,
                  user_prompt=image.prompt
             )
        else:
             # Generate the full character prompt using the new LLM-based function
             final_prompt_tuple = await generate_character_to_image_prompt(
                base_prompt=base_prompt,
                outfit=image.outfit,
                pose=image.pose,
                action=image.action,
                accessories=image.accessories
             )
        # Unpack tuple: (final_prompt_string, mode)
        final_prompt = final_prompt_tuple[0]
        
        print(f"Final Image to Image Character Prompt: {final_prompt}")

        # # AetherLab Prompt Guard
        # is_compliant, reason = await AetherLabService.validate_prompt(final_prompt)
        # if not is_compliant:
        #      if "error" in reason:
        #          print(f"AetherLab Service Error: {reason.get('error')}")
        #          raise HTTPException(status_code=503, detail="Content safety check unavailable. Please try again later.")
             
        #      # Extract rationale if available
        #      detail_msg = reason.get('rationale', 'Content Policy Violation')
        #      raise HTTPException(status_code=400, detail=f"Image generation is not compliant: {detail_msg}")

        async def generate_and_process(idx: int):
            log_entry = None
            try:
                # Create AI generation log entry
                log_entry = await create_ai_generation_log(
                    db=db,
                    user_id=user.id,
                    character_id=image.character_id,
                    generation_type="image",
                    prompt_text=final_prompt,
                    prompt_metadata={
                        "outfit": image.outfit,
                        "pose": image.pose,
                        "action": image.action,
                        "base_character_id": image.character_id
                    },
                    ai_model="fluxnsfw",
                    num_generations=1,
                    size_orientation="portrait",
                    source_context="character_media",
                    is_compliant=True
                )

                # Prepare face reference URL
                face_ref_url = await _resolve_face_reference_url(image.image_s3_url, db_character)
                if not face_ref_url and image.character_id:
                    fallback_stmt = (
                        select(CharacterMedia)
                        .where(
                            CharacterMedia.character_id == image.character_id,
                            CharacterMedia.media_type == "image",
                        )
                        .order_by(CharacterMedia.created_at.desc())
                        .limit(1)
                    )
                    fallback_result = await db.execute(fallback_stmt)
                    fallback_image = fallback_result.scalar_one_or_none()
                    if fallback_image:
                        try:
                            # Only use fallback when URL is actually fetchable; otherwise skip face reference.
                            candidate = await generate_presigned_url(fallback_image.s3_path)
                            if await _is_supported_media_url(candidate):
                                face_ref_url = candidate
                        except Exception:
                            face_ref_url = None

                # Generate Image
                jid = await generate_text_to_image(
                    prompt=final_prompt,
                    width=1024,
                    height=1536,
                    face_reference=face_ref_url,
                    character_style=db_character.style
                )
                
                p_url = await get_job(jid)
                
                # Download generated image
                async with httpx.AsyncClient(timeout=60) as client:
                    r = await client.get(p_url)
                    
                if r.status_code != 200:
                     raise HTTPException(status_code=500, detail=f"Failed to download generated image: {r.status_code}")
                
                image_data_bs4 = r.content
                
                # Convert to base64 for moderation
                base64_data = base64.b64encode(image_data_bs4).decode('utf-8')

                # # AetherLab Media Guard check
                # is_media_compliant, media_reason = await AetherLabService.validate_media(
                #     image_input=base64_data,
                #     input_type="base64"
                # )
                # if not is_media_compliant:
                #     print(f"AetherLab Media Guard Blocked: {media_reason}")
                #     if log_entry:
                #         await update_ai_generation_log_failure(
                #             db=db,
                #             log_id=log_entry.id,
                #             error_message="Content Policy Violation (Media Guard)"
                #         )
                #     raise HTTPException(status_code=400, detail="Generated image violated content policy")

                # Convert to WebP
                from app.core.aws_s3 import convert_image_to_webp
                image_file = convert_image_to_webp(BytesIO(image_data_bs4))

                # Upload to S3
                user_role = (user.role if user else "USER").lower()
                user_id = str(user.id)
                current_name = f"{image.name or 'generated'}_image_{idx}"
                filename = await generate_filename_timestamped(current_name)
                s3_key = f"image/{user_role}/{user_id}/{filename}.webp" # Force webp ext

                bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
                s3_key, presigned_s3_url = await upload_to_s3_file(
                    file_obj=image_file,
                    s3_key=s3_key,
                    content_type="image/webp",
                    bucket_name=bucket_name,
                )
                
                # Update log success
                if log_entry:
                    await update_ai_generation_log_success(
                        db=db,
                        log_id=log_entry.id,
                        generated_s3_keys=[s3_key],
                        generated_content_urls=[presigned_s3_url],
                        face_swap_applied=bool(face_ref_url),
                        face_swap_source_s3_key=image.image_s3_url or db_character.image_url_s3
                    )
                
                return {"s3_key": s3_key, "url": presigned_s3_url}

            except Exception as e:
                print(f"Error in generation task {idx}: {e}")
                if log_entry:
                     await update_ai_generation_log_failure(
                        db=db,
                        log_id=log_entry.id,
                        error_message=str(e)
                    )
                raise e

        tasks = [generate_and_process(i) for i in range(int(image.num_images))]
        results = await asyncio.gather(*tasks)
    else:

        async def generate_parallel_images(idx: int):
            """
            Generate image using modified character prompt (no initial image)
            """
            print(f"\n--- PROCESSING IMAGE {idx} ---")
            log_entry = None
            try:
                user_prompt = image.prompt
                # AetherLab Prompt Guard
                # is_compliant, reason = await AetherLabService.validate_prompt(user_prompt)
                # if not is_compliant:
                #     if "error" in reason:
                #         print(f"AetherLab Service Error: {reason.get('error')}")
                #         raise HTTPException(status_code=503, detail="Content safety check unavailable. Please try again later.")

                #     detail_msg = reason.get('rationale', 'Content Policy Violation')
                #     raise HTTPException(status_code=400, detail=f"Image generation is not compliant: {detail_msg}")
                
                orientation = "portrait"
                final_prompt = await generate_text_to_image_prompt(image.prompt)
                print(f"Final image prompt for index {idx}: {final_prompt}")
                
                # Create AI generation log entry before generation
                log_entry = await create_ai_generation_log(
                    db=db,
                    user_id=user.id,
                    character_id=None,  # No specific character for text-to-image
                    generation_type="image",
                    prompt_text=final_prompt,
                    prompt_metadata={
                        "prompt_type": "text_to_image_enhanced",
                        "original_prompt": image.prompt
                    },
                    ai_model="fluxnsfw",
                    num_generations=1,
                    size_orientation=orientation,
                    source_context="character_media_text_to_image",
                    is_compliant=True
                )
                
                # Generate Image
                jid = await generate_text_to_image(
                    prompt=final_prompt,
                    width=1024,
                    height=1536,
                    face_reference=None
                )

                p_url = await get_job(jid)

                # Download generated image
                async with httpx.AsyncClient(timeout=60) as client:
                    r = await client.get(p_url)

                if r.status_code != 200:
                    print(f"ERROR: Image download failed at index {idx}")
                    if log_entry:
                        await update_ai_generation_log_failure(
                            db=db,
                            log_id=log_entry.id,
                            error_message=f"Image download returned status {r.status_code}"
                        )
                    raise HTTPException(
                        status_code=500, detail=f"Image download failed at index {idx}"
                    )

                generated_image_base64 = base64.b64encode(r.content).decode('utf-8')
                print("Generated image base64")

                # AetherLab Media Guard check
                # is_media_compliant, media_reason = await AetherLabService.validate_media(
                #     image_input=generated_image_base64,
                #     input_type="base64"
                # )
                # if not is_media_compliant:
                #     print(f"AetherLab Media Guard Blocked (Text-to-Image): {media_reason}")

                #     if "error" in media_reason:
                #         print(f"AetherLab Service Error: {media_reason.get('error')}")
                #         raise HTTPException(status_code=503, detail="Content safety check unavailable. Please try again later.")

                #     if log_entry:
                #         await update_ai_generation_log_failure(
                #             db=db,
                #             log_id=log_entry.id,
                #             error_message="Content Policy Violation (Media Guard)"
                #         )
                #     raise HTTPException(status_code=400, detail="Generated image violated content policy")

                # Convert final image to bytes
                img_bytes = base64.b64decode(generated_image_base64)
                # Convert to WebP
                from app.core.aws_s3 import convert_image_to_webp
                image_file = convert_image_to_webp(BytesIO(img_bytes))

                user_role = (user.role if user else "USER").lower()
                user_id = str(user.id)
                current_name = f"{image.name}_image_{idx}"
                filename = await generate_filename_timestamped(current_name)
                # Use webp extension
                s3_key = f"image/{user_role}/{user_id}/{filename}.webp"
                bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
                s3_key, presigned_s3_url = await upload_to_s3_file(
                    file_obj=image_file,
                    s3_key=s3_key,
                    content_type="image/webp",
                    bucket_name=bucket_name,
                )
                
                # Update log entry with successful generation
                if log_entry:
                    await update_ai_generation_log_success(
                        db=db,
                        log_id=log_entry.id,
                        generated_s3_keys=[s3_key],
                        generated_content_urls=[presigned_s3_url],
                        face_swap_applied=False
                    )

                return {"s3_key": s3_key, "url": presigned_s3_url}
            except Exception as e:
                if log_entry:
                    await update_ai_generation_log_failure(
                        db=db,
                        log_id=log_entry.id,
                        error_message=str(e)
                    )
                raise

        # run generation + face swap + s3 upload concurrently
        tasks = [generate_parallel_images(i) for i in range(image.num_images)]
        results = await asyncio.gather(*tasks)
    list_presigned_images = []
    for r in results:
        db_character_media = CharacterMedia(
            user_id=user.id,
            character_id=image.character_id,
            media_type="image",
            s3_path=r["s3_key"],
            pose=image.pose,
            settings=final_prompt if image.character_id else (image.prompt or None),
        )
        db.add(db_character_media)
        await db.commit()
        await db.refresh(db_character_media)
        list_presigned_images.append(r["url"])

        await deduhl_user_coins(request, db, user.id, image.character_id, "image")
    return JSONResponse(
        content={
            "message": "Images created successfully",
            "image_paths": list_presigned_images,
        },
        status_code=200,
    )


@router.get("/events")
async def events(request: Request, user=Depends(get_current_user)):
    """SSE endpoint that streams media.created events.

    Requires authentication (re-uses get_current_user). Clients should use an
    EventSource connected to this endpoint. For production multi-instance
    deployments, replace the in-memory broadcaster with Redis pub/sub.
    """
    broadcaster = get_broadcaster()

    sid, queue = await broadcaster.subscribe()

    async def event_generator():
        try:
            # Send a simple welcome/comment
            yield "event: connected\n"
            yield f'data: {{"message":"connected"}}\n\n'
            while True:
                if await request.is_disconnected():
                    break
                try:
                    item = await asyncio.wait_for(queue.get(), timeout=15.0)
                except asyncio.TimeoutError:
                    # send a ping comment to keep connection alive
                    yield ": ping\n\n"
                    continue
                # item is already a JSON string from broadcaster
                # We want to send standard SSE fields: id (optional), event, data
                try:
                    obj = item
                    # item is serialized JSON with event/data
                    parsed = obj
                    # write as a data line containing the serialized object
                    yield f"data: {parsed}\n\n"
                except Exception:
                    # on error, skip
                    continue
        finally:
            await broadcaster.unsubscribe(sid)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.get("/get-users-character-media", status_code=200)
async def get_users_character_images(
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    # Fetch media for the current user with character information
    stmt = (
        select(CharacterMedia, Character)
        .outerjoin(Character, CharacterMedia.character_id == Character.id)
        .where(CharacterMedia.user_id == user.id)
        # Primary ordering: newest created_at first. Secondary ordering by id ensures
        # deterministic results when created_at values are identical.
        .order_by(CharacterMedia.created_at.desc(), CharacterMedia.id.desc())
    )
    result = await db.execute(stmt)
    media_with_characters = result.all()
    # Helpful debug info to aid troubleshooting when clients report missing media
    try:
        uid = getattr(user, "id", None)
    except Exception:
        uid = None
    # print(f"get-users-character-chat-media: user={uid} character_id={cid} result_count={len(media_with_characters)}")

    # Return an empty list instead of 404 to make the endpoint robust for clients
    # that expect an empty response when no media exists. This also avoids
    # surfacing a 404 for legitimate (but empty) results.
    if not media_with_characters:
        return JSONResponse(
            content={"message": "No media found", "media": []}, status_code=200
        )

    # Parallelize presigned URL generation for all media and character images
    media_s3_paths = [media_obj.s3_path for media_obj, _ in media_with_characters]
    char_s3_paths = [
        (
            character_obj.image_url_s3
            if character_obj
            and hasattr(character_obj, "image_url_s3")
            and character_obj.image_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]
    # Also gather character gif paths if present
    char_gif_paths = [
        (
            character_obj.gif_url_s3
            if character_obj
            and hasattr(character_obj, "gif_url_s3")
            and character_obj.gif_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]

    # Generate all presigned URLs in parallel: media -> char images -> char gifs
    all_s3_paths = media_s3_paths + [p for p in char_s3_paths if p] + [g for g in char_gif_paths if g]
    presigned_urls = await asyncio.gather(
        *[
            generate_presigned_url(path) if path else asyncio.sleep(0, result=None)
            for path in all_s3_paths
        ]
    )

    # Split results back into media and character URLs
    media_presigned = presigned_urls[: len(media_s3_paths)]
    char_presigned_dict = {}
    char_gif_presigned_dict = {}
    char_idx = len(media_s3_paths)
    # assign image presigned URLs
    for i, path in enumerate(char_s3_paths):
        if path:
            char_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1
    # assign gif presigned URLs
    for i, gpath in enumerate(char_gif_paths):
        if gpath:
            char_gif_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1

    # Convert ORM objects to JSON-serializable dicts
    media_serialized = []
    for idx, (media_obj, character_obj) in enumerate(media_with_characters):
        media_data = {
            "id": media_obj.id,
            "character_id": media_obj.character_id,
            "user_id": media_obj.user_id,
            "media_type": media_obj.media_type,
            "s3_path_gallery": media_presigned[idx],
            "mime_type": media_obj.mime_type,
            "created_at": (
                media_obj.created_at.isoformat()
                if media_obj.created_at is not None
                else None
            ),
        }

        # Add character data for video thumbnails
        if character_obj:
            character_image_url = char_presigned_dict.get(idx)
            if not character_image_url:
                if hasattr(character_obj, "image_url") and character_obj.image_url:
                    character_image_url = character_obj.image_url
                elif hasattr(character_obj, "img") and character_obj.img:
                    character_image_url = character_obj.img

            presigned_gif = char_gif_presigned_dict.get(idx)
            gif_value = presigned_gif or (character_obj.gif_url_s3 if hasattr(character_obj, "gif_url_s3") else None)
            media_data["character"] = {
                "id": character_obj.id,
                "name": character_obj.name,
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
                "gif_url_s3": gif_value,
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


@router.post("/get-users-character-chat-media", status_code=200)
async def get_users_character_images(
    character: CharacterIdIn,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Fetch media for the current user with character information
    # coerce character id to string because DB stores character IDs as VARCHAR
    try:
        cid = str(character.character_id)
    except Exception:
        # invalid id -- return empty result for robustness
        return JSONResponse(
            content={"message": "No media found", "media": []}, status_code=200
        )

    stmt = (
        select(CharacterMedia, Character)
        .outerjoin(Character, CharacterMedia.character_id == Character.id)
        .where(CharacterMedia.user_id == user.id)
        .where(CharacterMedia.character_id == cid)
        .where(
            (CharacterMedia.media_type == "chat_image")
            | (CharacterMedia.media_type == "chat_video")
        )
        .order_by(CharacterMedia.created_at.desc())
    )
    result = await db.execute(stmt)
    media_with_characters = result.all()

    if not media_with_characters:
        raise HTTPException(status_code=404, detail="No media found")

    # Parallelize presigned URL generation
    media_s3_paths = [media_obj.s3_path for media_obj, _ in media_with_characters]
    char_s3_paths = [
        (
            character_obj.image_url_s3
            if character_obj
            and hasattr(character_obj, "image_url_s3")
            and character_obj.image_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]
    # Also collect gif paths
    char_gif_paths = [
        (
            character_obj.gif_url_s3
            if character_obj
            and hasattr(character_obj, "gif_url_s3")
            and character_obj.gif_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]

    all_s3_paths = media_s3_paths + [p for p in char_s3_paths if p] + [g for g in char_gif_paths if g]
    presigned_urls = await asyncio.gather(
        *[
            generate_presigned_url(path) if path else asyncio.sleep(0, result=None)
            for path in all_s3_paths
        ]
    )

    media_presigned = presigned_urls[: len(media_s3_paths)]
    char_presigned_dict = {}
    char_gif_presigned_dict = {}
    char_idx = len(media_s3_paths)
    for i, path in enumerate(char_s3_paths):
        if path:
            char_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1
    for i, gpath in enumerate(char_gif_paths):
        if gpath:
            char_gif_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1

    # Convert ORM objects to JSON-serializable dicts
    media_serialized = []
    for idx, (media_obj, character_obj) in enumerate(media_with_characters):
        media_data = {
            "id": media_obj.id,
            "character_id": media_obj.character_id,
            "user_id": media_obj.user_id,
            "media_type": media_obj.media_type,
            "s3_path_gallery": media_presigned[idx],
            "mime_type": media_obj.mime_type,
            "created_at": (
                media_obj.created_at.isoformat()
                if media_obj.created_at is not None
                else None
            ),
        }

        # Add character data for video thumbnails
        if character_obj:
            character_image_url = char_presigned_dict.get(idx)
            if not character_image_url:
                if hasattr(character_obj, "image_url") and character_obj.image_url:
                    character_image_url = character_obj.image_url
                elif hasattr(character_obj, "img") and character_obj.img:
                    character_image_url = character_obj.img

            presigned_gif = char_gif_presigned_dict.get(idx)
            gif_value = presigned_gif or (character_obj.gif_url_s3 if hasattr(character_obj, "gif_url_s3") else None)
            media_data["character"] = {
                "id": character_obj.id,
                "name": character_obj.name,
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
                "gif_url_s3": gif_value,
            }

        media_serialized.append(media_data)

    return JSONResponse(
        content={"message": "Media retrieved successfully", "media": media_serialized},
        status_code=200,
    )


@router.get("/get-character-media", status_code=200)
async def get_character_media(
    character_id: int | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get media items for a specific character (requires authentication). If `character_id` is omitted
    return an empty list to avoid request validation errors (422) from clients that
    call this endpoint without the required query parameter.
    """
    # If no character_id provided, return empty result rather than raising 422
    if character_id is None:
        return JSONResponse(
            content={
                "message": "No character_id provided",
                "media": [],
                "images": [],
                "videos": [],
                "data": [],
            },
            status_code=200,
        )
    """Get media items for a specific character (public). Returns same shape as other media endpoints."""
    stmt = (
        select(CharacterMedia, Character)
        .outerjoin(Character, CharacterMedia.character_id == Character.id)
        .where(CharacterMedia.character_id == character_id)
        # Ensure deterministic ordering by adding id DESC as a secondary key.
        .order_by(CharacterMedia.created_at.desc(), CharacterMedia.id.desc())
    )
    result = await db.execute(stmt)
    media_with_characters = result.all()

    # Return empty list rather than 404 to simplify frontend handling
    if not media_with_characters:
        return JSONResponse(
            content={
                "message": "No media found",
                "media": [],
                "images": [],
                "videos": [],
                "data": [],
            },
            status_code=200,
        )

    # Parallelize presigned URL generation
    media_s3_paths = [media_obj.s3_path for media_obj, _ in media_with_characters]
    char_s3_paths = [
        (
            character_obj.image_url_s3
            if character_obj
            and hasattr(character_obj, "image_url_s3")
            and character_obj.image_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]
    char_gif_paths = [
        (
            character_obj.gif_url_s3
            if character_obj
            and hasattr(character_obj, "gif_url_s3")
            and character_obj.gif_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]

    all_s3_paths = media_s3_paths + [p for p in char_s3_paths if p] + [g for g in char_gif_paths if g]
    presigned_urls = await asyncio.gather(
        *[
            generate_presigned_url(path) if path else asyncio.sleep(0, result=None)
            for path in all_s3_paths
        ]
    )

    media_presigned = presigned_urls[: len(media_s3_paths)]
    char_presigned_dict = {}
    char_gif_presigned_dict = {}
    char_idx = len(media_s3_paths)
    for i, path in enumerate(char_s3_paths):
        if path:
            char_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1
    for i, gpath in enumerate(char_gif_paths):
        if gpath:
            char_gif_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1

    media_serialized = []
    for idx, (media_obj, character_obj) in enumerate(media_with_characters):
        media_data = {
            "id": media_obj.id,
            "character_id": media_obj.character_id,
            "user_id": media_obj.user_id,
            "media_type": media_obj.media_type,
            "s3_path_gallery": media_presigned[idx],
            "mime_type": media_obj.mime_type,
            "created_at": (
                media_obj.created_at.isoformat()
                if media_obj.created_at is not None
                else None
            ),
        }

        # Add character thumbnail info when available
        if character_obj:
            character_image_url = char_presigned_dict.get(idx)
            if not character_image_url:
                if hasattr(character_obj, "image_url") and character_obj.image_url:
                    character_image_url = character_obj.image_url
                elif hasattr(character_obj, "img") and character_obj.img:
                    character_image_url = character_obj.img

            presigned_gif = char_gif_presigned_dict.get(idx)
            gif_value = presigned_gif or (character_obj.gif_url_s3 if hasattr(character_obj, "gif_url_s3") else None)
            media_data["character"] = {
                "id": character_obj.id,
                "name": character_obj.name,
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
                "gif_url_s3": gif_value,
            }

        media_serialized.append(media_data)

    images_list = [m for m in media_serialized if m.get("media_type") == "image"]
    videos_list = [m for m in media_serialized if m.get("media_type") == "video"]
    if len(images_list) > 0:
        images_and_videos = [
            m for m in media_serialized if m.get("media_type") in ("image", "video")
        ]
        images_key = images_and_videos
    else:
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


@router.get("/download-proxy")
async def download_proxy(url: str, name: str | None = None):
    filename = name or "download.bin"

    async def body_iter():
        try:
            async with httpx.AsyncClient(follow_redirects=True, timeout=None) as client:
                # Open and KEEP the stream INSIDE the generator
                async with client.stream("GET", url) as r:
                    # raise if 4xx/5xx before we start yielding
                    r.raise_for_status()
                    async for chunk in r.aiter_bytes():
                        yield chunk
        except Exception as e:
            # Do NOT re-raise from inside the generator; just end the stream.
            print("download-proxy stream error:", e)

    headers = {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": f'attachment; filename="{filename}"',
        # Add Cache-Control as you like; CORS is typically handled by middleware
        "Cache-Control": "no-store",
    }
    return StreamingResponse(body_iter(), headers=headers)


@router.get("/get-default-character-media", status_code=200)
async def get_default_character_media(
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Fetch media uploaded by users with role 'ADMIN' (case-insensitive)
    # Include character information for video thumbnails
    stmt = (
        select(CharacterMedia, Character)
        .join(User, CharacterMedia.user_id == User.id)
        .outerjoin(Character, CharacterMedia.character_id == Character.id)
        # User.role is an ENUM in Postgres; cast to text before calling lower()
        .where(func.lower(cast(User.role, String)) == "admin" or func.lower(cast(User.role, String)) == "super_admin")
        .order_by(CharacterMedia.created_at.desc())
    )
    result = await db.execute(stmt)
    media_with_characters = result.all()

    if not media_with_characters:
        raise HTTPException(status_code=404, detail="No media found")

    # Parallelize presigned URL generation
    media_s3_paths = [media_obj.s3_path for media_obj, _ in media_with_characters]
    char_s3_paths = [
        (
            character_obj.image_url_s3
            if character_obj
            and hasattr(character_obj, "image_url_s3")
            and character_obj.image_url_s3
            else None
        )
        for _, character_obj in media_with_characters
    ]

    all_s3_paths = media_s3_paths + [p for p in char_s3_paths if p]
    presigned_urls = await asyncio.gather(
        *[
            generate_presigned_url(path) if path else asyncio.sleep(0, result=None)
            for path in all_s3_paths
        ]
    )

    media_presigned = presigned_urls[: len(media_s3_paths)]
    char_presigned_dict = {}
    char_idx = len(media_s3_paths)
    for i, path in enumerate(char_s3_paths):
        if path:
            char_presigned_dict[i] = presigned_urls[char_idx]
            char_idx += 1

    # Convert ORM objects to JSON-serializable dicts
    media_serialized = []
    for idx, (media_obj, character_obj) in enumerate(media_with_characters):
        media_data = {
            "id": media_obj.id,
            "character_id": media_obj.character_id,
            "user_id": media_obj.user_id,
            "media_type": media_obj.media_type,
            "s3_path_gallery": media_presigned[idx],
            "mime_type": media_obj.mime_type,
            "created_at": (
                media_obj.created_at.isoformat()
                if media_obj.created_at is not None
                else None
            ),
        }

        # Add character data for video thumbnails
        if character_obj:
            character_image_url = char_presigned_dict.get(idx)
            if not character_image_url:
                if hasattr(character_obj, "image_url") and character_obj.image_url:
                    character_image_url = character_obj.image_url
                elif hasattr(character_obj, "img") and character_obj.img:
                    character_image_url = character_obj.img

            media_data["character"] = {
                "id": character_obj.id,
                "name": character_obj.name,
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
            }

        media_serialized.append(media_data)

    # Provide backward-compatible keys so older frontend bundles that expect
    # `images` or `data` or `videos` still work.
    images_list = [m for m in media_serialized if m.get("media_type") == "image"]
    videos_list = [m for m in media_serialized if m.get("media_type") == "video"]
    if len(images_list) > 0:
        images_and_videos = [
            m for m in media_serialized if m.get("media_type") in ("image", "video")
        ]
        images_key = images_and_videos
    else:
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
