import json
import asyncio
from typing import AsyncGenerator
import redis.asyncio as aioredis
from app.core.config import settings

_REDIS: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _REDIS
    if _REDIS is None:
        url = getattr(settings, "REDIS_URL", "redis://localhost:6379/0")
        _REDIS = aioredis.from_url(url, decode_responses=True)
    return _REDIS


async def publish_wallet_update(user_id: str, payload: dict) -> None:
    """Publish a wallet update message to Redis channel for the given user."""
    try:
        r = await get_redis()
        channel = f"wallet:{user_id}"
        await r.publish(channel, json.dumps(payload))
    except Exception:
        # Best-effort publish; swallow errors so callers (webhooks) are not blocked
        return


async def subscribe_wallet(user_id: str) -> AsyncGenerator[str, None]:
    """Async generator that yields raw message strings published to the user's wallet channel."""
    r = await get_redis()
    pubsub = r.pubsub()
    channel = f"wallet:{user_id}"
    await pubsub.subscribe(channel)
    try:
        async for message in pubsub.listen():
            # Message types: subscribe, message, etc.
            if not message:
                continue
            mtype = message.get("type")
            if mtype == "message":
                data = message.get("data")
                if isinstance(data, bytes):
                    try:
                        data = data.decode()
                    except Exception:
                        data = None
                if data is not None:
                    yield data
    finally:
        try:
            await pubsub.unsubscribe(channel)
        except Exception:
            pass
        try:
            await pubsub.close()
        except Exception:
            pass
