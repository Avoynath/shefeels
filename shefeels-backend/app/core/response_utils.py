from typing import Optional, Dict, Iterable
from app.core.aws_s3 import generate_presigned_url
import asyncio
import logging

logger = logging.getLogger("app.response_utils")


async def _presign_if_needed(url_or_key: Optional[str]) -> Optional[str]:
    """
    If the value looks like a full URL (http/https), return as-is.
    If it's falsy, return None.
    Otherwise assume it's an S3 key and return a presigned URL.
    """
    if not url_or_key:
        return None
    try:
        s = str(url_or_key).strip()
        if s.startswith("http://") or s.startswith("https://"):
            return s
        # Already looks like an S3 URL with domain
        if ".amazonaws.com/" in s:
            return s
        # Otherwise treat as S3 key and generate presigned URL
        try:
            presigned = await generate_presigned_url(s3_key=s)
            return presigned
        except Exception as e:
            logger.debug("Failed to presign key %s: %s", s, e)
            return None
    except Exception as e:
        logger.debug("_presign_if_needed error: %s", e)
        return None


async def presign_avatar_fields_for_map(
    obj_map: Iterable[Dict],
    key_names: Iterable[str] = (
        "image_url_s3",
        "image_url",
        "profile_image_url",
        "avatar",
        "presigned_image_url_s3",
    ),
) -> None:
    """
    Mutates objects in `obj_map` in-place. For each dict in the iterable,
    look for any of the `key_names` and replace string S3 keys with presigned URLs.

    This function is safe to call with lists of small dicts (e.g., payloads).
    """
    tasks = []
    pointers = []
    for obj in obj_map:
        for key in key_names:
            if key in obj and obj.get(key):
                # schedule presign
                tasks.append(_presign_if_needed(obj.get(key)))
                pointers.append((obj, key))
    if not tasks:
        return
    results = await asyncio.gather(*tasks)
    for (obj, key), value in zip(pointers, results):
        try:
            obj[key] = value
        except Exception:
            pass


async def presign_avatar_map_dict(
    d: Dict[str, Optional[str]],
) -> Dict[str, Optional[str]]:
    """Presign values in a simple dict mapping (e.g., char_id -> url).
    Returns a new dict with presigned URLs where applicable.
    """
    if not d:
        return d
    keys = list(d.keys())
    tasks = [_presign_if_needed(d[k]) for k in keys]
    results = await asyncio.gather(*tasks)
    out = {k: v for k, v in zip(keys, results)}
    return out
