"""Redis-backed cache with optional in-memory fallback.

Provides simple get/set with ttl and a convenience API for presigned URL caching.
"""
from typing import Optional
import os
import logging
from app.core.config import settings

try:
    import redis.asyncio as redis_async
except Exception:  # pragma: no cover - optional dep
    redis_async = None

from time import time

logger = logging.getLogger("app.redis_cache")

# in-memory fallback
_local_store: dict[str, tuple[str, float]] = {}


def _in_memory_get(key: str) -> Optional[str]:
    ent = _local_store.get(key)
    if not ent:
        return None
    value, expires = ent
    if time() > expires:
        _local_store.pop(key, None)
        return None
    return value


def _in_memory_set(key: str, value: str, ttl: int):
    _local_store[key] = (value, time() + ttl)


REDIS_URL = settings.REDIS_URL if settings.REDIS_URL else "redis://localhost:6379/0"
_redis_client = None
_REDIS_UNAVAILABLE = object()


async def get_redis_client():
    global _redis_client
    if _redis_client is _REDIS_UNAVAILABLE:
        return None
    if _redis_client is not None:
        #logger.info("Redis client is available")
        return _redis_client
    if redis_async is None:
        logger.warning("redis.asyncio not available, using in-memory fallback")
        _redis_client = _REDIS_UNAVAILABLE
        return None
    # Try to create and verify the client once. If it fails, mark unavailable.
    client = redis_async.from_url(REDIS_URL)
    try:
        # verify connection once to avoid repeated attempts on every operation
        #logger.info("Redis client is available.. pinging")
        await client.ping()
    except Exception as e:
        logger.warning("Redis unavailable, using in-memory fallback: %s", e)
        _redis_client = _REDIS_UNAVAILABLE
        try:
            await client.close()
        except Exception:
            pass
        return None
    _redis_client = client
    return _redis_client


async def get_cached(key: str) -> Optional[str]:
    client = await get_redis_client()
    if client is None:
        return _in_memory_get(key)
    try:
        val = await client.get(key)
        if val is None:
            return None
        return val.decode() if isinstance(val, (bytes, bytearray)) else val
    except Exception as e:
        logger.warning("Redis get failed: %s", e)
        return _in_memory_get(key)


async def set_cached(key: str, value: str, ttl: int = 300) -> None:
    client = await get_redis_client()
    if client is None:
        _in_memory_set(key, value, ttl)
        return
    try:
        await client.set(key, value, ex=ttl)
    except Exception as e:
        logger.warning("Redis set failed: %s", e)
        _in_memory_set(key, value, ttl)


async def get_presigned(key: str) -> Optional[str]:
    return await get_cached(f"presigned:{key}")


async def set_presigned(key: str, url: str, ttl: int = 3600) -> None:
    await set_cached(f"presigned:{key}", url, ttl=ttl)


async def del_cached(key: str) -> None:
    """Delete a cached key (works with Redis or in-memory fallback)."""
    client = await get_redis_client()
    if client is None:
        try:
            _local_store.pop(key, None)
        except Exception:
            pass
        return
    try:
        await client.delete(key)
    except Exception as e:
        logger.warning("Redis delete failed: %s", e)
        try:
            _local_store.pop(key, None)
        except Exception:
            pass