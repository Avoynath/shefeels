"""
In-memory or Redis-backed store for background image generation jobs.
"""
from __future__ import annotations

import asyncio
import time
from datetime import datetime, timezone
from typing import Optional

from app.schemas.image_job import ImageJob, ImageJobStatus
from app.services import redis_cache
from app.services.app_config import generate_id


class ImageJobStore:
    """Async-safe job store with Redis fallback when available."""

    def __init__(self, ttl_seconds: int = 60 * 60 * 24) -> None:
        self._ttl_seconds = ttl_seconds
        self._lock = asyncio.Lock()
        self._jobs: dict[str, ImageJob] = {}
        self._expirations: dict[str, float] = {}

    def _job_key(self, job_id: str) -> str:
        return f"image_job:{job_id}"

    async def _use_redis(self) -> bool:
        client = await redis_cache.get_redis_client()
        return client is not None

    async def create_job(
        self,
        user_id: str,
        character_id: Optional[str] = None,
        message_id: Optional[str] = None,
    ) -> ImageJob:
        """Create a new queued job and persist it to the backing store."""
        now = datetime.now(timezone.utc)
        job = ImageJob(
            job_id=generate_id(),
            user_id=str(user_id),
            status=ImageJobStatus.queued,
            created_at=now,
            updated_at=now,
            character_id=character_id,
            message_id=message_id,
        )
        await self._save(job)
        return job

    async def get_job(self, job_id: str) -> Optional[ImageJob]:
        """Fetch a job by id, returning None if missing or expired."""
        if await self._use_redis():
            raw = await redis_cache.get_cached(self._job_key(job_id))
            if not raw:
                return None
            try:
                return ImageJob.parse_raw(raw)
            except Exception:
                return None

        async with self._lock:
            job = self._jobs.get(job_id)
            if not job:
                return None
            expires_at = self._expirations.get(job_id)
            if expires_at and time.time() > expires_at:
                self._jobs.pop(job_id, None)
                self._expirations.pop(job_id, None)
                return None
            return job

    async def update_job(
        self,
        job_id: str,
        status: Optional[ImageJobStatus] = None,
        image_s3_key: Optional[str] = None,
        image_url: Optional[str] = None,
        error: Optional[str] = None,
    ) -> Optional[ImageJob]:
        """Update an existing job. Returns the updated job or None."""
        job = await self.get_job(job_id)
        if not job:
            return None
        if status is not None:
            job.status = status
        if image_s3_key is not None:
            job.image_s3_key = image_s3_key
        if image_url is not None:
            job.image_url = image_url
        if error is not None:
            job.error = error
        job.updated_at = datetime.now(timezone.utc)
        await self._save(job)
        return job

    async def _save(self, job: ImageJob) -> None:
        if await self._use_redis():
            await redis_cache.set_cached(
                self._job_key(job.job_id), job.json(), ttl=self._ttl_seconds
            )
            return

        async with self._lock:
            self._jobs[job.job_id] = job
            self._expirations[job.job_id] = time.time() + self._ttl_seconds


image_job_store = ImageJobStore()
