import asyncio
import json
from typing import Dict, Any

class SSEBroadcaster:
    """Simple in-memory broadcaster for Server-Sent Events.

    NOTE: This is single-process only. For multi-instance deployments use
    Redis pub/sub or another external broker and replace the publish/subscribe
    hooks accordingly.
    """

    def __init__(self):
        # Track subscribers -> asyncio.Queue
        self._subs: Dict[int, asyncio.Queue] = {}
        self._next_id = 1
        self._lock = asyncio.Lock()

    async def subscribe(self) -> tuple[int, asyncio.Queue]:
        async with self._lock:
            sid = self._next_id
            self._next_id += 1
            q: asyncio.Queue = asyncio.Queue()
            self._subs[sid] = q
            return sid, q

    async def unsubscribe(self, sid: int):
        async with self._lock:
            q = self._subs.pop(sid, None)
            if q is not None:
                # drain queue
                try:
                    while not q.empty():
                        q.get_nowait()
                except Exception:
                    pass

    async def publish(self, event_name: str, payload: Any, event_id: str | None = None):
        data = {
            "event": event_name,
            "data": payload,
        }
        serialized = json.dumps(data, default=str)
        async with self._lock:
            for q in list(self._subs.values()):
                try:
                    q.put_nowait(serialized)
                except asyncio.QueueFull:
                    # drop if the subscriber is too slow
                    pass


# module-level singleton
_broadcaster = SSEBroadcaster()


def get_broadcaster() -> SSEBroadcaster:
    return _broadcaster
