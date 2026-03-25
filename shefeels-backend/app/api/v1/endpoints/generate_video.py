from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.core.config import settings
from app.services.subscription import check_user_wallet, deduhl_user_coins
from app.services.generate_video import generate_video
from app.models.character import Character
from app.models.character_media import CharacterMedia
from app.services.character_media import generate_filename_timestamped
from app.core.aws_s3 import upload_to_s3_file, generate_presigned_url, generate_public_s3_url
from app.services.app_config import get_config_value_from_cache
from fastapi.responses import JSONResponse
import json
import random
import os
import tempfile
import httpx

# Load pose prompts from JSON file
pose_prompt_mapping_video = {}
import pathlib
_json_path = pathlib.Path(__file__).resolve().parents[3] / "core" / "video_pose_prompt_mapping.json"
with open(str(_json_path), "r") as f:
    pose_prompt_mapping_video = json.loads(f.read())


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


async def _resolve_video_source_url(video: "VideoCreate", character_obj: Character | None) -> str | None:
    if character_obj:
        # Prefer character-owned assets to avoid relying on stale/invalid frontend URLs.
        for key in [
            getattr(character_obj, "animated_webp_url_s3", None),
            getattr(character_obj, "gif_url_s3", None),
        ]:
            if not key:
                continue
            try:
                candidate = await generate_public_s3_url(key)
                if await _is_supported_media_url(candidate):
                    return candidate
            except Exception:
                continue

        for key in [
            getattr(character_obj, "webp_image_url_s3", None),
            getattr(character_obj, "image_url_s3", None),
        ]:
            if not key:
                continue
            try:
                candidate = await generate_presigned_url(key)
                if await _is_supported_media_url(candidate):
                    return candidate
            except Exception:
                continue

    explicit = (video.image_url or "").strip() if getattr(video, "image_url", None) else None
    if explicit:
        candidate = explicit
        if not explicit.startswith(("http://", "https://")):
            try:
                candidate = await generate_presigned_url(explicit)
            except Exception:
                candidate = None
        if candidate and await _is_supported_media_url(candidate):
            return candidate

    return None


class VideoCreate(BaseModel):
    character_id: str
    name: str
    prompt: Optional[str] = None
    duration: int = 5
    resolution: Optional[str] = None
    negative_prompt: Optional[str] = None
    image_url: Optional[str] = None
    pose_name: Optional[str] = None
    background_name: Optional[str] = None
    action_name: Optional[str] = None
    # Character attributes for prompt building
    character_name: Optional[str] = None
    character_age: Optional[int] = None
    character_gender: Optional[str] = None
    character_style: Optional[str] = None
    character_bio: Optional[str] = None
    character_ethnicity: Optional[str] = None
    character_body_type: Optional[str] = None
    character_eye_colour: Optional[str] = None
    character_hair_style: Optional[str] = None
    character_hair_colour: Optional[str] = None


@router.post("/create-video")
async def create_video(
    request: Request,
    video: VideoCreate,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await check_user_wallet(db, user.id, "video", video_duration=int(video.duration))

    resolution = video.resolution or "480p"
    character_obj = None
    pose_name = video.pose_name
    duration_to_use = video.duration
    prompt = ""
    image_url = None

    if not video.character_id:
        raise HTTPException(status_code=400, detail="character_id is required for video generation")

    video_character_id = str(video.character_id)
    stmt = select(Character).where(Character.id == video_character_id)
    character = await db.execute(stmt)
    character_obj = character.scalar_one_or_none()
    if not character_obj:
        raise HTTPException(status_code=404, detail="Character not found")

    image_url = await _resolve_video_source_url(video, character_obj)

    # Use a pose-matched stored prompt when available, but don't block generation if it isn't.
    if pose_name and video_character_id:
        stmt = select(CharacterMedia).where(
            CharacterMedia.character_id == video_character_id,
            CharacterMedia.pose == pose_name,
        )
        result = await db.execute(stmt)
        rows = result.scalars().all()

        if rows:
            chosen = random.choice(rows)
            print(f"✅ Selected CharacterMedia id={chosen.id} for pose={pose_name}")
            prompt = chosen.settings or ""
            try:
                public_candidate = await generate_public_s3_url(chosen.s3_path)
                if await _is_supported_media_url(public_candidate):
                    image_url = public_candidate
                else:
                    signed_candidate = await generate_presigned_url(chosen.s3_path)
                    if await _is_supported_media_url(signed_candidate):
                        image_url = signed_candidate
            except Exception:
                pass

    try:
        if not image_url and video_character_id:
            fallback_stmt = (
                select(CharacterMedia)
                .where(
                    CharacterMedia.character_id == video_character_id,
                    CharacterMedia.media_type == "image",
                )
                .order_by(CharacterMedia.created_at.desc())
                .limit(1)
            )
            fallback_result = await db.execute(fallback_stmt)
            fallback_image = fallback_result.scalar_one_or_none()
            if fallback_image:
                try:
                    public_candidate = await generate_public_s3_url(fallback_image.s3_path)
                    if await _is_supported_media_url(public_candidate):
                        image_url = public_candidate
                    else:
                        signed_candidate = await generate_presigned_url(fallback_image.s3_path)
                        if await _is_supported_media_url(signed_candidate):
                            image_url = signed_candidate
                except Exception:
                    pass
                if not prompt:
                    prompt = fallback_image.settings or ""

        if not character_obj and (not video.prompt or not video.prompt.strip()):
            raise HTTPException(status_code=400, detail="No prompt provided for text-only video generation")

        print(f"🎬 Starting video generation (character_id={video.character_id}) duration {duration_to_use}s")

        # Build a robust prompt so upstream API never receives an empty string.
        prompt_parts: list[str] = []

        if video.pose_name:
            pose_prompt = (pose_prompt_mapping_video.get(video.pose_name, "") or "").strip()
            if pose_prompt:
                prompt_parts.append(pose_prompt)
            else:
                # If pose is unknown in mapping, still turn it into useful text.
                prompt_parts.append(f"cinematic {video.pose_name} pose")

        if prompt and prompt.strip():
            prompt_parts.append(prompt.strip())

        if video.prompt and video.prompt.strip():
            prompt_parts.append(video.prompt.strip())

        if not prompt_parts:
            char_name = (getattr(character_obj, "name", None) or "character").strip()
            char_style = (getattr(character_obj, "style", None) or "realistic").strip()
            prompt_parts.append(
                f"Cinematic {char_style} portrait video of {char_name}, subtle motion, natural expression, high quality"
            )

        prompt = ", ".join([p for p in prompt_parts if p]).strip().strip(",")

        if not prompt:
            raise HTTPException(status_code=400, detail="No prompt could be constructed for video generation")

        if not image_url:
            # Some environments return 403 for S3 URLs from server-side callers.
            # Fall back to prompt-only generation instead of failing the request.
            print("⚠️ No usable first frame URL found. Falling back to prompt-only video generation.")

        negative_prompt = "extra woman, extra female, additional girl, second girl, duplicate woman, cloned woman"
        job_id = await generate_video(
            prompt=prompt,
            duration=duration_to_use,
            image_url=image_url,
            negative_prompt=negative_prompt,
        )
        print(f"✅ Video generation job created with ID: {job_id}")

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Exception during video generation: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Video generation error: {str(e)}")

    # Background task: poll job, download video, upload to S3, save DB record
    async def process_video_background():
        try:
            from app.services.character_media import get_job
            import httpx

            print(f"🔄 Background task started: polling video job {job_id}...")
            video_url = await get_job(job_id)
            print(f"✅ Job {job_id} complete. Video URL: {video_url}")

            print(f"🔄 Downloading video from {video_url[:100]}...")
            async with httpx.AsyncClient(timeout=300) as client:
                r = await client.get(video_url)
                r.raise_for_status()
                video_data = r.content

            user_role = (user.role if user else "USER").lower()
            user_id_str = str(user.id)

            filename = await generate_filename_timestamped(video.name)
            video_s3_key = f"video/{user_role}/{user_id_str}/{filename}.mp4"
            bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")

            # Save to temp file
            tmp_video = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            with tmp_video as f:
                f.write(video_data)

            print(f"✅ Video downloaded to temp file: {tmp_video.name}")

            # Re-encode to H.264 for universal browser compatibility
            import subprocess
            try:
                import imageio_ffmpeg
                ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            except ImportError:
                ffmpeg_exe = "ffmpeg"

            tmp_h264 = tempfile.NamedTemporaryFile(delete=False, suffix=".mp4")
            tmp_h264.close()
            try:
                ffmpeg_cmd = [
                    ffmpeg_exe, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", tmp_video.name,
                    "-c:v", "libx264",
                    "-preset", "medium",
                    "-crf", "23",
                    "-pix_fmt", "yuv420p",
                    "-c:a", "aac",
                    "-movflags", "+faststart",
                    tmp_h264.name,
                ]
                print(f"🔄 Re-encoding video to H.264 using: {ffmpeg_exe}")
                result = subprocess.run(ffmpeg_cmd, capture_output=True, text=True, timeout=300)
                if result.returncode == 0:
                    print(f"✅ Video re-encoded to H.264: {tmp_h264.name}")
                    old_tmp = tmp_video.name
                    tmp_video = type("obj", (object,), {"name": tmp_h264.name})()
                    try:
                        os.remove(old_tmp)
                    except Exception:
                        pass
                else:
                    print(f"⚠️ ffmpeg re-encode failed (rc={result.returncode}): {result.stderr}")
                    try:
                        os.remove(tmp_h264.name)
                    except Exception:
                        pass
            except FileNotFoundError:
                print("⚠️ ffmpeg binary not found. Uploading original video.")
                try:
                    os.remove(tmp_h264.name)
                except Exception:
                    pass
            except subprocess.TimeoutExpired:
                print("⚠️ ffmpeg re-encode timed out. Uploading original video.")
                try:
                    os.remove(tmp_h264.name)
                except Exception:
                    pass

            # Upload to S3
            with open(tmp_video.name, "rb") as vf:
                s3_key, presigned_s3_url = await upload_to_s3_file(
                    file_obj=vf,
                    s3_key=video_s3_key,
                    content_type="video/mp4",
                    bucket_name=bucket_name,
                )

            print(f"✅ Video uploaded to S3: {s3_key}")

            # Create DB record
            from app.core.database import AsyncSessionLocal
            async with AsyncSessionLocal() as bg_db:
                db_character_media = CharacterMedia(
                    user_id=user.id,
                    character_id=video.character_id,
                    media_type="video",
                    s3_path=s3_key,
                    mime_type="video/mp4",
                    pose=video.pose_name,
                )
                bg_db.add(db_character_media)
                await bg_db.commit()
                await bg_db.refresh(db_character_media)

                print(f"✅ Video saved to database: ID {db_character_media.id}")

                # Deduct coins
                await deduhl_user_coins(
                    request=request,
                    db=bg_db,
                    user_id=user.id,
                    character_id=video.character_id,
                    media_type="video",
                    video_duration=duration_to_use,
                )
                print(f"✅ Coins deducted for video generation")

                # Clean up temp file
                try:
                    if os.path.exists(tmp_video.name):
                        os.remove(tmp_video.name)
                        print(f"🗑️ Temp file cleaned up")
                except Exception as cleanup_error:
                    print(f"⚠️ Failed to clean up temp file: {cleanup_error}")

        except Exception as e:
            print(f"❌ Background video processing failed: {e}")
            import traceback
            traceback.print_exc()
            try:
                if os.path.exists(tmp_video.name):
                    os.remove(tmp_video.name)
            except Exception:
                pass
            raise

    # Spawn background task (fire and forget)
    import asyncio
    asyncio.create_task(process_video_background())

    return JSONResponse(
        status_code=200,
        content={
            "message": "Video generation started successfully",
            "video_url": None,
            "job_id": job_id,
            "status": "processing",
            "info": "Video is being processed and will be available in your gallery shortly",
        },
    )
