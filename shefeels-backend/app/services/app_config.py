from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.app_config import AppConfig
from app.core.config import settings
from fastapi import HTTPException
import uuid
from app.services import redis_cache


_config_cache = None


async def invalidate_config_cache(name: str | None = None) -> None:
    """Invalidate cached config values.

    - Clears in-process cache (this worker)
    - Best-effort removes Redis key(s) so other workers refetch
    """
    global _config_cache
    _config_cache = None

    try:
        if name:
            await redis_cache.del_cached(f"config:{name}")
        # Also invalidate the bootstrap payload cache so frontend gets updates immediately
        await redis_cache.del_cached("bootstrap:v1")
    except Exception:
        pass

async def load_config_cache(db: AsyncSession):
    global _config_cache
    result = await db.execute(select(AppConfig))
    configs = result.scalars().all()
    _config_cache = {c.parameter_name: c.parameter_value for c in configs}
    # populate Redis so other processes/requests can read config quickly
    try:
        for k, v in _config_cache.items():
            try:
                await redis_cache.set_cached(f"config:{k}", v, ttl=60 * 60 * 24)
            except Exception:
                # best-effort; don't fail startup if Redis is unavailable
                pass
    except Exception:
        pass

async def ensure_config_loaded(db: AsyncSession):
    """Load the config cache if it's not already loaded."""
    global _config_cache
    if _config_cache is None:
        await load_config_cache(db)

async def get_config_value_from_cache(name: str) -> str | None:
    """Return a config value or None if not present. Does NOT raise on empty cache."""
    # Fast-path: try Redis first (shared cache across processes)
    try:
        val = await redis_cache.get_cached(f"config:{name}")
        if val is not None:
            return val
    except Exception:
        pass

    # Fallback to in-process cache populated at startup
    if _config_cache is None:
        return None
    return _config_cache.get(name)

def generate_id() -> str:
    """Return a random 32-character hex string (uuid4.hex).

    Use this as the default factory for SQLAlchemy String PKs.
    """
    return uuid.uuid4().hex
