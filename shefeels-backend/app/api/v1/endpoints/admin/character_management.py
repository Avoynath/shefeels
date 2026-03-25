from fastapi import APIRouter, Depends, HTTPException
import asyncio
from app.schemas.character import CharacterCreate
from app.api.v1.deps import get_db
from app.api.v1.deps import require_admin
from app.models.character import Character
from app.models.user import User
from app.schemas.character import CharacterCreate, CharacterRead
from app.api.v1.deps import get_current_user
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.aws_s3 import generate_presigned_url, delete_s3_object
from app.models.character_media import CharacterMedia
from app.services.app_config import get_config_value_from_cache
from typing import List, Dict, Optional, Any
from sqlalchemy import func, and_, or_
import urllib.parse

router = APIRouter()


@router.get("/get-all", dependencies=[Depends(require_admin)])
async def list_characters(
    db: AsyncSession = Depends(get_db),
    page: int = 1,
    per_page: int = 100,
    search: Optional[str] = None,
    created_by: Optional[str] = None,
    user_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    style: Optional[str] = None,
    gender: Optional[str] = None,
):
    """List characters with optional server-side filtering and pagination.

    Returns a JSON object: { items: [...], total: <int>, page: <int>, per_page: <int> }
    """
    # sanitize pagination params
    page = max(int(page or 1), 1)
    per_page = max(1, min(int(per_page or 100), 500))
    # Select explicit character columns and the user's role as creator_role.
    # Returning Pydantic models from the row._mapping avoids a manual Python loop that
    # re-attaches the role to each Character instance.
    base_select = select(
        Character.id,
        Character.user_id,
        Character.username,
        Character.bio,
        Character.name,
        Character.gender,
        Character.style,
        Character.ethnicity,
        Character.age,
        Character.eye_colour,
        Character.hair_style,
        Character.hair_colour,
        Character.body_type,
        Character.breast_size,
        Character.butt_size,
        Character.dick_size,
        Character.personality,
        Character.voice_type,
        Character.relationship_type,
        Character.clothing,
        Character.special_features,
        Character.privacy,
        Character.image_url_s3,
        Character.gif_url_s3,
        Character.updated_at,
        Character.created_at,
        Character.prompt_enhanced,
        Character.hobbies,
        User.role.label("creator_role"),
        User.email.label("email_id"),
    ).join(User, Character.user_id == User.id)

    # Build WHERE clauses from filters
    where_clauses = []
    if search:
        s = f"%{search}%"
        where_clauses.append(
            or_(
                Character.name.ilike(s),
                Character.style.ilike(s),
                Character.ethnicity.ilike(s),
                Character.username.ilike(s),
                User.email.ilike(s),
            )
        )
    if created_by:
        where_clauses.append(User.role == created_by)
    if user_id:
        where_clauses.append(Character.user_id == user_id)
    if start_date:
        try:
            where_clauses.append(Character.updated_at >= start_date)
        except Exception:
            pass
    if end_date:
        try:
            where_clauses.append(Character.updated_at <= end_date)
        except Exception:
            pass
    # Style filter: allow values like 'realistic', 'anime' or 'all'
    if style and style.lower() != 'all':
        try:
            where_clauses.append(func.lower(Character.style) == style.lower())
        except Exception:
            pass
    # Gender filter: allow 'male', 'female', 'trans' or 'all'
    if gender and gender.lower() != 'all':
        try:
            where_clauses.append(func.lower(Character.gender) == gender.lower())
        except Exception:
            pass

    if where_clauses:
        base_select = base_select.where(and_(*where_clauses))

    # total count
    count_stmt = (
        select(func.count())
        .select_from(Character)
        .join(User, Character.user_id == User.id)
    )
    if where_clauses:
        count_stmt = count_stmt.where(and_(*where_clauses))
    total_result = await db.execute(count_stmt)
    total = int(total_result.scalar() or 0)

    stmt = (
        base_select.order_by(Character.created_at.desc())
        .limit(per_page)
        .offset((page - 1) * per_page)
    )
    result = await db.execute(stmt)
    rows = result.all()
    items = []
    for row in rows:
        # Use row._mapping (dict) directly; IDs are strings in our DB schema
        mapping = dict(row._mapping)
        # Validate using the mapping/dict to avoid Pydantic string-type errors
        items.append(CharacterRead.model_validate(mapping))

    return {"items": items, "total": total, "page": page, "per_page": per_page}


@router.put("/{character_id}/edit", dependencies=[Depends(require_admin)])
async def edit_character(
    character_id: str,
    character_data: CharacterCreate,
    db: AsyncSession = Depends(get_db),
):
    # Normalize path parameter to string to avoid integer/VARCHAR mismatches
    character_id = str(character_id)
    from sqlalchemy import bindparam, String

    stmt = select(Character).where(Character.id == bindparam("cid", type_=String))
    result = await db.execute(stmt, {"cid": character_id})
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Image generation/polling removed in this admin endpoint (functionality handled elsewhere).

    # Update all fields from character_data
    for field, value in character_data.model_dump().items():
        setattr(character, field, value)
    await db.commit()
    await db.refresh(character)
    return {"detail": f"Character {character_id} has been updated"}


@router.post("/{character_id}/delete", dependencies=[Depends(require_admin)])
async def delete_character(character_id: str, db: AsyncSession = Depends(get_db)):
    """
    Delete a character and all related data.
    
    Requires admin or super_admin role (enforced by require_admin dependency).
    
    Database CASCADE deletes handle:
    - character_media (CASCADE)
    - chat_messages (CASCADE)
    - character_stats (CASCADE)
    - media_packs (CASCADE)
    - ai_generation_logs (SET NULL - keeps logs but removes character reference)
    - coin_transactions (SET NULL - keeps transaction history but removes character reference)
    """
    stmt = select(Character).where(Character.id == character_id)
    result = await db.execute(stmt)
    character = result.scalar_one_or_none()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Collect all S3 keys to delete (best-effort cleanup)
    s3_keys_to_delete = []

    # Main character images
    if getattr(character, "image_url_s3", None):
        s3_keys_to_delete.append(character.image_url_s3)
    if getattr(character, "gif_url_s3", None):
        s3_keys_to_delete.append(character.gif_url_s3)
    if getattr(character, "webp_image_url_s3", None):
        s3_keys_to_delete.append(character.webp_image_url_s3)
    if getattr(character, "animated_webp_url_s3", None):
        s3_keys_to_delete.append(character.animated_webp_url_s3)

    # Collect CharacterMedia S3 paths before cascade delete removes them
    try:
        media_rows = await db.execute(
            select(CharacterMedia).where(CharacterMedia.character_id == character.id)
        )
        media_items = media_rows.scalars().all()
        for m in media_items:
            if getattr(m, "s3_path", None):
                s3_keys_to_delete.append(m.s3_path)
    except Exception:
        pass

    # Delete the character record - CASCADE will handle related tables:
    # - character_media
    # - chat_messages  
    # - character_stats
    # - media_packs (and media_pack_media via nested cascade)
    # SET NULL will be applied to:
    # - ai_generation_logs.character_id
    # - coin_transactions.character_id
    await db.delete(character)
    await db.commit()

    # Clean up S3 files (best-effort, after DB commit succeeds)
    deleted_s3_count = 0
    for s3_key in s3_keys_to_delete:
        try:
            await delete_s3_object(s3_key)
            deleted_s3_count += 1
        except Exception:
            pass  # Best-effort S3 cleanup

    return {
        "detail": f"Character {character_id} and all related data have been deleted",
        "s3_files_cleaned": deleted_s3_count,
    }


@router.post("/presigned-urls-by-ids", dependencies=[Depends(require_admin)])
async def get_presigned_urls_by_ids(payload: Dict[str, str]):
    """
    Accepts a JSON object mapping ids to S3 values (either full S3 URLs or S3 keys).
    Returns a mapping of the same ids to generated pre-signed GET URLs.
    Example request body: {"1": "s3://bucket/path/to/object", "2": "https://bucket.s3.amazonaws.com/path/to/obj"}
    """
    if not payload:
        raise HTTPException(status_code=400, detail="Payload cannot be empty")

    # Resolve bucket name once to help parse URLs that include the bucket in the path
    # bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")

    # Batch presign all provided values concurrently
    result = {}
    items = list(payload.items())
    if not items:
        return result

    keys = [v for _, v in items]
    presigned_list = await asyncio.gather(
        *[
            generate_presigned_url(s3_key=k) if k else asyncio.sleep(0, result=None)
            for k in keys
        ]
    )

    for (id_key, _), presigned in zip(items, presigned_list):
        try:
            try:
                result[int(id_key)] = presigned
            except Exception:
                result[id_key] = presigned
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate presigned url for id {id_key}: {e}",
            )

    return result
