from __future__ import annotations
from typing import Optional
import logging
import re

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.models.private_content import (
    MediaPack,
    MediaPackMedia,
    UserMediaPackAccess,
    CharacterMediaLike,
)
from app.models.character_media import CharacterMedia
from app.core.aws_s3 import generate_presigned_url
import asyncio
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.deps import get_current_user, get_current_user_optional
from app.models.user import User
from app.schemas.private_content import (
    PrivateContentRequest,
    PrivateContentListRequest,
    MediaPackRequest,
    MediaIdLike,
    ListMediaIdLike,
    MediaPackUnlockRequest,
)
from app.models.subscription import UserWallet, CoinTransaction
router = APIRouter()
logger = logging.getLogger(__name__)


async def _fetch_pack_like_counts(
    db: AsyncSession, pack_ids: list[str]
) -> dict[str, int]:
    """Return total likes per media pack for the provided pack ids."""
    unique_ids = list({pack_id for pack_id in pack_ids if pack_id})
    if not unique_ids:
        return {}

    stmt = (
        select(MediaPackMedia.media_pack_id, func.count(CharacterMediaLike.id))
        .join(
            CharacterMediaLike,
            CharacterMediaLike.character_media_id == MediaPackMedia.character_media_id,
        )
        .where(MediaPackMedia.media_pack_id.in_(unique_ids))
        .group_by(MediaPackMedia.media_pack_id)
    )
    results = await db.execute(stmt)
    return {pack_id: int(total_likes) for pack_id, total_likes in results.all()}


@router.post("/get-pack")
async def get_private_content_pack(
    request: PrivateContentListRequest,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    character_ids = request.character_ids or []

    # Retrieve all private content packs for the given character and include whether
    # the current user has access to each pack. We left-join UserMediaPackAccess
    # using both media_pack_id and the current user's id so that if there's no row
    # the joined value will be None (access == False).

    # If no character ids provided, return empty mapping
    if not character_ids:
        return []

    # Fetch all packs for the provided character ids and include access info
    # Fetch all packs for the provided character ids
    if user:
        # Include access info if user is logged in
        stmt = (
            select(MediaPack, UserMediaPackAccess)
            .outerjoin(
                UserMediaPackAccess,
                (UserMediaPackAccess.media_pack_id == MediaPack.id)
                & (UserMediaPackAccess.user_id == user.id),
            )
            .where(MediaPack.character_id.in_(character_ids))
        )
        result = await db.execute(stmt)
        rows = result.all()
    else:
        # Fetch packs only (guests have no access)
        stmt = select(MediaPack).where(MediaPack.character_id.in_(character_ids))
        result = await db.execute(stmt)
        # Manually pair with None for access_row
        rows = [(r[0], None) for r in result.all()]

    # Prepare like counts for all packs
    pack_ids = [pack.id for pack, _ in rows]
    pack_like_counts = await _fetch_pack_like_counts(db, pack_ids)

    # Build pack objects and collect thumbnail keys
    packs_by_char: dict[str, list[MediaPack]] = {cid: [] for cid in character_ids}
    thumbnail_keys: list[str | None] = []
    packs_ordered: list[MediaPack] = []
    for pack, access_row in rows:
        if user and (user.role.lower() == "admin" or user.role.lower() == "super_admin"):
            setattr(pack, "access", True)
        else:
            setattr(pack, "access", bool(access_row))
        total_likes = pack_like_counts.get(pack.id, 0)
        setattr(pack, "total_likes", total_likes)
        packs_by_char.setdefault(pack.character_id, []).append(pack)
        packs_ordered.append(pack)
        thumbnail_keys.append(getattr(pack, "thumbnail_s3_path", None))

    # Generate presigned thumbnails concurrently for all packs
    if thumbnail_keys:
        presigned_list = await asyncio.gather(
            *[
                generate_presigned_url(k) if k else asyncio.sleep(0, result=None)
                for k in thumbnail_keys
            ]
        )
        for p, presigned in zip(packs_ordered, presigned_list):
            try:
                setattr(p, "presigned_thumbnail_s3_path", presigned)
            except Exception:
                pass

    # For packs without thumbnails, fetch the first media item from each pack
    packs_without_thumbnail = [p for p in packs_ordered if not getattr(p, "presigned_thumbnail_s3_path", None)]
    if packs_without_thumbnail:
        # Fetch first media for each pack without thumbnail
        pack_ids_without_thumb = [p.id for p in packs_without_thumbnail]
        stmt = (
            select(MediaPackMedia.media_pack_id, CharacterMedia.s3_path)
            .join(CharacterMedia, CharacterMedia.id == MediaPackMedia.character_media_id)
            .where(MediaPackMedia.media_pack_id.in_(pack_ids_without_thumb))
            .distinct(MediaPackMedia.media_pack_id)
        )
        result = await db.execute(stmt)
        pack_first_media = {pack_id: s3_path for pack_id, s3_path in result.all()}

        # Presign these fallback thumbnails
        fallback_keys = [pack_first_media.get(p.id) for p in packs_without_thumbnail]
        fallback_presigned = await asyncio.gather(
            *[
                generate_presigned_url(k) if k else asyncio.sleep(0, result=None)
                for k in fallback_keys
            ]
        )

        # Update packs with fallback thumbnails
        for p, presigned_fallback in zip(packs_without_thumbnail, fallback_presigned):
            if presigned_fallback:
                try:
                    setattr(p, "presigned_thumbnail_s3_path", presigned_fallback)
                except Exception:
                    pass

    # Return list of dicts mapping character_id -> packs
    response = []
    for cid in character_ids:
        response.append({cid: packs_by_char.get(cid, [])})

    return response

@router.get("/get-characters-with-packs")
async def get_characters_with_packs(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # Retrieve all unique character IDs that have media packs
    stmt = select(MediaPack.character_id).distinct()
    result = await db.execute(stmt)
    character_ids = [row[0] for row in result.all()]
    return {"character_ids": character_ids}

@router.get("/pack-by-slug/{slug}")
async def get_pack_by_slug(
    slug: str,
    user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    """
    Get media pack by slug (e.g., 'vacation-photos-5a2b9c3d').
    Extracts the short ID from the slug and finds matching pack.
    Authentication optional (guests can view).
    """

    # Extract short ID from slug (last segment after hyphens)
    parts = slug.split("-")
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid slug format")

    short_id = parts[-1]

    # Validate short ID format (alphanumeric, 8+ chars)
    if not short_id or not re.match(r"^[a-z0-9]{8,}$", short_id, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid slug format")

    # Find pack where ID starts with short_id
    # Find pack where ID starts with short_id
    stmt = select(MediaPack, UserMediaPackAccess)
    
    if user:
         stmt = stmt.outerjoin(
            UserMediaPackAccess,
            (UserMediaPackAccess.media_pack_id == MediaPack.id)
            & (UserMediaPackAccess.user_id == user.id),
        )
    else:
        # Avoid join if no user, but we need to match the select structure
        # We can't easily do (MediaPack, None) directly in select without a join
        # For a single row fetch, it's easier to branch or just use outerjoin on false
        # But let's just use the query structure and handle result
        pass

    # Actually for single row fetch it is cleaner to just branch completely
    if user:
         stmt = (
            select(MediaPack, UserMediaPackAccess)
            .outerjoin(
                UserMediaPackAccess,
                (UserMediaPackAccess.media_pack_id == MediaPack.id)
                & (UserMediaPackAccess.user_id == user.id),
            )
            .where(MediaPack.id.like(f"{short_id}%"))
        )
         result = await db.execute(stmt)
         row = result.first()
    else:
         stmt = select(MediaPack).where(MediaPack.id.like(f"{short_id}%"))
         result = await db.execute(stmt)
         pack_only = result.scalars().first()
         row = (pack_only, None) if pack_only else None



    if not row:
        raise HTTPException(status_code=404, detail="Pack not found")

    pack, access_row = row

    # Attach access info
    if user and (user.role.lower() == "admin" or user.role.lower() == "super_admin"):
        setattr(pack, "access", True)
    else:
        setattr(pack, "access", bool(access_row))

    presigned = await generate_presigned_url(getattr(pack, "thumbnail_s3_path", None))
    setattr(pack, "presigned_thumbnail_s3_path", presigned)

    pack_like_counts = await _fetch_pack_like_counts(db, [pack.id])
    setattr(pack, "total_likes", pack_like_counts.get(pack.id, 0))

    return pack


@router.post("/get-media-in-pack")
async def get_media_in_pack(
    payload: MediaPackRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pack_id = payload.pack_id
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Retrieve all media for the given pack id and the associated character media
    stmt = (
        select(MediaPackMedia, CharacterMediaLike, CharacterMedia)
        .join(MediaPack, MediaPack.id == MediaPackMedia.media_pack_id)
        .join(CharacterMedia, CharacterMedia.id == MediaPackMedia.character_media_id)
        .outerjoin(
            CharacterMediaLike,
            (CharacterMediaLike.character_media_id == MediaPackMedia.character_media_id)
            & (CharacterMediaLike.user_id == user.id),
        )
        .where(MediaPackMedia.media_pack_id == pack_id)
    )

    result = await db.execute(stmt)
    rows = result.all()

    # Prepare lists for concurrent presigning
    packs: list[MediaPackMedia] = []
    media_keys: list[str | None] = []
    char_image_keys: list[str | None] = []
    char_gif_keys: list[str | None] = []
    rows_list = []
    for media_pack_media, like_row, char_media in rows:
        setattr(media_pack_media, "liked", bool(like_row))
        s3_path = getattr(char_media, "s3_path", None)
        setattr(media_pack_media, "s3_path", s3_path)
        setattr(media_pack_media, "mime_type", getattr(char_media, "mime_type", None))
        rows_list.append((media_pack_media, char_media))
        media_keys.append(s3_path)
        # prefer explicit s3 path fields for character image if available
        char_img_key = None
        if char_media is not None:
            char_img_key = (
                getattr(char_media, "s3_path", None)
                or getattr(char_media, "image_url_s3", None)
                or getattr(char_media, "image_url", None)
            )
            char_gif_key = getattr(char_media, "gif_url_s3", None)
        char_image_keys.append(char_img_key)
        char_gif_keys.append(char_gif_key if 'char_gif_key' in locals() else None)

    presigned_media = []
    presigned_chars = []
    presigned_char_gifs = []
    if media_keys:
        presigned_media = await asyncio.gather(
            *[
                generate_presigned_url(k) if k else asyncio.sleep(0, result=None)
                for k in media_keys
            ]
        )
    if char_image_keys:
        # Only presign keys that look like S3 keys; leave full URLs untouched
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

    final = []
    for idx, (media_pack_media, char_media) in enumerate(rows_list):
        media_presigned = presigned_media[idx] if idx < len(presigned_media) else None
        char_presigned = presigned_chars[idx] if idx < len(presigned_chars) else None
        try:
            setattr(media_pack_media, "presigned_s3_path", media_presigned)
        except Exception:
            pass

        character_image_url = None
        if char_presigned:
            character_image_url = char_presigned
        else:
            if char_media:
                character_image_url = getattr(char_media, "image_url", None) or getattr(
                    char_media, "img", None
                )
        presigned_gif = presigned_char_gifs[idx] if presigned_char_gifs and idx < len(presigned_char_gifs) else None
        gif_value = presigned_gif or (getattr(char_media, "gif_url_s3", None) if char_media else None)

        if char_media:
            media_pack_media.character = {
                "id": char_media.id,
                "name": getattr(char_media, "name", None),
                "image_url_s3": character_image_url,
                "image_url": character_image_url,
                "img": character_image_url,
                "gif_url_s3": gif_value,
            }

        final.append(media_pack_media)

    return final


@router.post("/unlock-pack")
async def unlock_media_pack(
    request: Request,
    payload: MediaPackUnlockRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    coins = await db.execute(select(UserWallet).where(UserWallet.user_id == user.id))
    coins = coins.scalars().first()
    if coins:
        coin_balance = coins.coin_balance
    else:
        coin_balance = 0
    if coin_balance < payload.coin:
        raise HTTPException(status_code=402, detail="Insufficient coins. Please purchase more coins to continue.")

    pack_id = payload.pack_id
    # Check if the user already has access
    q = await db.execute(
        select(UserMediaPackAccess).where(
            (UserMediaPackAccess.user_id == user.id)
            & (UserMediaPackAccess.media_pack_id == pack_id)
        )
    )
    access = q.scalars().first()
    if access:
        raise HTTPException(status_code=400, detail="Pack already unlocked")

    # Create access record
    access_record = UserMediaPackAccess(user_id=user.id, media_pack_id=pack_id)
    db.add(access_record)
    
    # Deduct coins
    if coins:
        coins.coin_balance -= payload.coin
        db.add(coins)
    
    await db.commit()
    
    tx = CoinTransaction(
        user_id=user.id,
        transaction_type="debit",
        coins=payload.coin,
        source_type="private-content",
        period_start=None,
        period_end=None,
        character_id=payload.character_id,
        ip=getattr(request.state, "client_ip", None),
        country_code=(getattr(request.state, "geo", {}) or {}).get("country_code"),
        city=(getattr(request.state, "geo", {}) or {}).get("city"),
        visitor_session_id=getattr(request.state, "visitor_session_id", None),
    )
    db.add(tx)
    await db.commit()
    return {"is_pack_access": True, "detail": "Pack unlocked successfully"}


@router.post("/like-media")
async def like_media(
    payload: MediaIdLike,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    media_id = payload.id
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Check if the user has already liked this media
    q = await db.execute(
        select(CharacterMediaLike).where(
            (CharacterMediaLike.user_id == user.id)
            & (CharacterMediaLike.character_media_id == media_id)
        )
    )
    like = q.scalars().first()
    if like:
        raise HTTPException(status_code=400, detail="Media already liked")

    # Create like record
    like_record = CharacterMediaLike(user_id=user.id, character_media_id=media_id)
    db.add(like_record)
    await db.commit()

    return {"detail": "Media liked successfully"}


@router.post("/check-media-liked")
async def check_media_liked(
    payload: ListMediaIdLike,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    list_media_id = payload.media_ids or []

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # If empty list provided, return empty results
    if not list_media_id:
        return {"likes": []}

    # Fetch all likes for this user for the provided media ids in one query
    q = await db.execute(
        select(CharacterMediaLike.character_media_id).where(
            (CharacterMediaLike.user_id == user.id)
            & (CharacterMediaLike.character_media_id.in_(list_media_id))
        )
    )
    liked_ids = set(q.scalars().all())

    # Return list of objects mapping id -> liked status
    results = [{"id": m_id, "is_liked": (m_id in liked_ids)} for m_id in list_media_id]
    return {"likes": results}
