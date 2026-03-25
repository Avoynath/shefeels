"""Simple in-memory TTL cache for small values (not for production durability).

Used for caching short-lived things like presigned URLs or small config values.
This is intentionally minimal; for production use Redis or Memcached.
"""
from time import time
from typing import Any, Optional

_store: dict[str, tuple[Any, float]] = {}


def set_cache(key: str, value: Any, ttl: float = 60.0) -> None:
    """Set a key with TTL in seconds."""
    _store[key] = (value, time() + ttl)


def get_cache(key: str) -> Optional[Any]:
    ent = _store.get(key)
    if not ent:
        return None
    value, expires = ent
    if time() > expires:
        try:
            del _store[key]
        except KeyError:
            pass
        return None
    return value


def clear_cache() -> None:
    _store.clear()
