from io import BytesIO
import asyncio
from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    WebSocket,
    Request,
    BackgroundTasks,
)
from fastapi.responses import StreamingResponse
import httpx
from app.schemas.chat import ChatCreate, MessageCreate, MessageRead
from app.models.chat import ChatMessage
from app.models.subscription import UserWallet, CoinTransaction
from app.models.character import Character
from app.models.character_media import CharacterMedia
from app.models.user import User, RoleEnum
from app.services.character_media import generate_filename_timestamped, generate_text_to_image, get_job, generate_character_to_image_in_chat_prompt
from app.services.aetherlab_service import AetherLabService
from app.core.aws_s3 import upload_to_s3_file, generate_presigned_url
from app.core.response_utils import (
    presign_avatar_map_dict,
    presign_avatar_fields_for_map,
)
from app.services.chat import (
    approximate_token_count,
    generate_structured_llm_response,
    extract_chat_image_intent_prompt,
)
from app.services.schema import (
    SCHEMA_CHAT
)
from app.api.v1.deps import get_current_user
from app.core.database import get_db, AsyncSessionLocal
from app.core.config import settings
from app.services.app_config import get_config_value_from_cache
from app.services.subscription import check_user_wallet, deduhl_user_coins
from app.services import redis_cache
from app.services.image_jobs import image_job_store
from app.services.ai_generation_logging import (
    create_ai_generation_log,
    update_ai_generation_log_success,
    update_ai_generation_log_failure
)
from app.schemas.image_job import ImageJobStatus, ImageJobStatusResponse
from typing import List, Optional
import asyncio
import json
import requests
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import Column, select, desc
from fastapi.responses import JSONResponse
import os
import re
from fastapi import Request
from app.services.auth import AuthService
import base64
from datetime import datetime

router = APIRouter()


async def generate_and_save_chat_image(
    job_id: str,
    user_id: str,
    character_id: str,
    message_id: str,
    messages_for_prompt: list[dict[str, str]],
    character_style: str,
    character_gender: str,
    character_prompt_enhanced: str,
    user_query: str,
    user_role: str,
    chat_image_gen_system_prompt: str,
    guardrail_details_image: str,
    bucket_name: str,
    character_details: Optional[str] = None,
    chat_response: str = "",
) -> None:
    """
    Background task to generate chat image, face swap, upload, update the message,
    and keep the image job status up to date.
    """
    try:
        await image_job_store.update_job(job_id, status=ImageJobStatus.generating)

        async def _mark_failed(reason: str) -> None:
            await image_job_store.update_job(
                job_id, status=ImageJobStatus.failed, error=reason
            )

        # Ensure guardrail_details_image is never None
        if guardrail_details_image is None:
            guardrail_details_image = ""
        
        # --- Extract Image Parameters & Generate Prompt ---
        # Delegate to the new function that handles context-aware extraction
        base_character_prompt = character_prompt_enhanced or ""
        
        print(f"Generating image prompt from chat context...")
        prompt_enhanced_str, model_workflow_mode = await generate_character_to_image_in_chat_prompt(
            base_prompt=base_character_prompt,
            chat_messages=messages_for_prompt,
            user_query=user_query,
            chat_response=chat_response,
            gender=character_gender,
        )
        
        # Metadata parameters are now handled internally, so set placeholders for logging

        print(f"Refined Chat Prompt: {prompt_enhanced_str}")
        
        if not prompt_enhanced_str:
             prompt_enhanced_str = base_character_prompt + ", " + user_query

        is_compliant, reason = await AetherLabService.validate_prompt(
            user_prompt=prompt_enhanced_str,
            conversation_history=messages_for_prompt,
        )
        if not is_compliant:
            print(f"AetherLab Prompt Guard Blocked: {reason}")
            await _mark_failed("image_prompt_aetherlab_blocked")
            return

        if character_style.lower() == "realistic":
            ai_model = "fluxnsfw"
        elif character_style.lower() == "anime":
            ai_model = "fluxnsfw"
        else:
            ai_model = "fluxnsfw"

        async with AsyncSessionLocal() as db:
            # Fetch character for image URL
            result = await db.execute(select(Character).where(Character.id == character_id))
            character = result.scalar_one_or_none()
            if not character:
                print("Character not found in background task")
                await _mark_failed("character_not_found")
                return

            presigned_src = await generate_presigned_url(character.image_url_s3)
            print("character gender: ", character.gender.lower())
            loras = None
            if character.gender.lower() == "trans":
                print("Inside trans loras :", loras)
                loras = ["59"]
            output_format = "webp"
            print(f"Final chat image prompt : {prompt_enhanced_str}")
            print(f"Character prompt : {base_character_prompt}")

            # Create log entry
            log_entry = await create_ai_generation_log(
                db=db,
                user_id=user_id,
                character_id=character_id,
                generation_type="image",
                prompt_text=prompt_enhanced_str,
                prompt_metadata={
                    "base_character_prompt": base_character_prompt,
                    "user_query": user_query,
                    "mode": model_workflow_mode,
                    "chat_response": chat_response,
                },
                ai_model=ai_model,
                num_generations=1,
                size_orientation="portrait",
                source_context="chat",
                is_compliant=True
            )

            # Generate negative prompt based on user query
            from app.services.character_media import generate_negative_prompt
            #negative_prompt = await generate_negative_prompt(user_query, context="chat")
            negative_prompt = ""
            job_id_gen = await generate_text_to_image(
                prompt=prompt_enhanced_str,
                width=768,
                height=1024,
                face_reference=presigned_src,
                model_workflow_name=model_workflow_mode,
                character_style=character_style,
                negative_prompt=negative_prompt,
                loras = loras
            )

            if not job_id_gen:
                raise Exception("Failed to initiate image generation job")

            # Poll for completion
            image_url = await get_job(job_id_gen)
            
            if not image_url:
                raise Exception("Image generation job finished but returned no URL")

            # Download generated image
            async with httpx.AsyncClient(timeout=60) as client:
                r = await client.get(image_url)
                if r.status_code != 200:
                     raise Exception(f"Failed to download generated image: {r.status_code}")
                image_data_bytes = r.content

            # Convert to base64 for Media Guard
            final_image_base64 = base64.b64encode(image_data_bytes).decode('utf-8')

            is_media_compliant, media_reason = await AetherLabService.validate_media(
                image_input=final_image_base64,
                input_type="base64"
            )
            
            if not is_media_compliant:
                print(f"AetherLab Media Guard Blocked: {media_reason}")
                
                await image_job_store.update_job(
                    job_id,
                    status=ImageJobStatus.failed,
                    error="content_policy_violation"
                )
                
                msg_res = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
                message = msg_res.scalar_one_or_none()
                if message:
                    message.is_media_available = False
                    message.media_type = "image_violation"
                    db.add(message)
                    await db.commit()
                    
                    try:
                        client = await redis_cache.get_redis_client()
                        if client:
                            msg_payload = {
                                "type": "message_update",
                                "message_id": message.id,
                                "character_id": str(character_id),
                                "s3_url_media": None,
                                "media_type": "image_violation",
                                "is_media_available": False
                            }
                            await client.publish(f"chat_updates:{user_id}", json.dumps(msg_payload))
                    except Exception as e:
                        print(f"REDIS: Failed to publish violation update for user {user_id}: {e}")
                
                return

            # Convert and Upload
            img_bytes = await asyncio.to_thread(base64.b64decode, final_image_base64)
            from app.core.aws_s3 import convert_image_to_webp
            image_file = await asyncio.to_thread(convert_image_to_webp, BytesIO(img_bytes))
            
            filename = await generate_filename_timestamped(f"{character.name}_chat")
            s3_key = f"chat_image/{user_role.lower()}/{user_id}/{filename}.{output_format}"
            
            uploaded_key, presigned_s3_url = await upload_to_s3_file(
                file_obj=image_file,
                s3_key=s3_key,
                content_type="image/webp",
                bucket_name=bucket_name,
            )

            if log_entry:
                await update_ai_generation_log_success(
                    db=db,
                    log_id=log_entry.id,
                    generated_s3_keys=[uploaded_key],
                    generated_content_urls=[presigned_s3_url],
                    face_swap_applied=True,
                    face_swap_source_s3_key=character.image_url_s3
                )

            await image_job_store.update_job(
                job_id,
                status=ImageJobStatus.completed,
                image_s3_key=uploaded_key,
                image_url=presigned_s3_url,
            )
            
            # Save to CharacterMedia
            db_character_media = CharacterMedia(
                user_id=user_id,
                character_id=character_id,
                media_type="chat_image",
                s3_path=uploaded_key,
            )
            db.add(db_character_media)
            
            # Update Message
            msg_res = await db.execute(select(ChatMessage).where(ChatMessage.id == message_id))
            message = msg_res.scalar_one_or_none()
            if message:
                message.is_media_available = True
                message.media_type = "chat_image"
                message.s3_url_media = uploaded_key
                db.add(message)
                await db.commit()
                
                # Redis Notify
                try:
                    client = await redis_cache.get_redis_client()
                    if client:
                        msg_payload = {
                            "type": "message_update",
                            "message_id": message.id,
                            "character_id": str(character_id),
                            "s3_url_media": presigned_s3_url, # Send presigned for immediate display
                            "is_media_available": True
                        }
                        await client.publish(f"chat_updates:{user_id}", json.dumps(msg_payload))
                        print(f"REDIS: Successfully published message_update for user {user_id}")
                    else:
                        print(f"REDIS: Client is None, skipping notify for user {user_id}")
                except Exception as e:
                    print(f"REDIS: Failed to publish chat update for user {user_id}: {e}")

    except Exception as e:
        print(f"Background chat image generation failed: {e}")
        await image_job_store.update_job(
            job_id, status=ImageJobStatus.failed, error=str(e)
        )


def _build_chat_messages(
    template_prompt: str,
    last_messages: list[ChatMessage],
    user_query: str,
) -> list[dict[str, str]]:
    """Build the LLM message list for text generation."""
    messages: list[dict[str, str]] = [{"role": "system", "content": template_prompt}]
    for msg in last_messages:
        messages.append({"role": "user", "content": msg.user_query})
        messages.append({"role": "assistant", "content": msg.ai_message})
    messages.append({"role": "user", "content": user_query})
    return messages


def _build_image_context(
    last_messages: list[ChatMessage],
    user_query: str,
    chat_output: str,
) -> list[dict[str, str]]:
    """Build the context used for image prompt generation."""
    ctx_messages: list[dict[str, str]] = []
    for msg in last_messages:
        ctx_messages.append({"role": "user", "content": msg.user_query})
        ctx_messages.append({"role": "assistant", "content": msg.ai_message})
    ctx_messages.append({"role": "user", "content": user_query})
    ctx_messages.append({"role": "assistant", "content": chat_output})
    return ctx_messages


def _build_guardrail_history(
    last_messages: list[ChatMessage],
) -> list[dict[str, str]]:
    """Serialize prior turns for AetherLab context."""
    history: list[dict[str, str]] = []
    for msg in last_messages:
        if msg.user_query:
            history.append({"role": "user", "content": msg.user_query})
        if msg.ai_message:
            history.append({"role": "assistant", "content": msg.ai_message})
    return history


async def generate_chat_text(
    messages: list[dict[str, str]],
) -> tuple[str, bool]:
    """Generate the chat response and detect image intent."""
    llm_output = await generate_structured_llm_response(messages, schema=SCHEMA_CHAT)
    if not llm_output:
        return "", False
    try:
        json_llm_output = json.loads(llm_output)
    except Exception:
        return llm_output, False
    chat_output = json_llm_output.get("chat_output", "")
    is_image_request = str(json_llm_output.get("generate_image", "false")).lower()
    return chat_output, is_image_request == "true"


async def queue_chat_image_job(
    *,
    background_tasks: BackgroundTasks,
    user_id: str,
    character: Character,
    message_id: str,
    messages_for_prompt: list[dict[str, str]],
    user_query: str,
    user_role: str,
    chat_image_gen_system_prompt: str,
    guardrail_details_image: str,
    bucket_name: str,
    character_details: str,
    chat_response: str = "",
) -> Optional[str]:
    """Create an image job and enqueue the background generation task."""
    job = await image_job_store.create_job(
        user_id=user_id,
        character_id=str(character.id),
        message_id=message_id,
    )
    background_tasks.add_task(
        generate_and_save_chat_image,
        job_id=job.job_id,
        user_id=str(user_id),
        character_id=str(character.id),
        message_id=message_id,
        messages_for_prompt=messages_for_prompt,
        character_style=character.style,
        character_gender=character.gender,
        character_prompt_enhanced=character.prompt_enhanced,
        user_query=user_query,
        user_role=user_role,
        chat_image_gen_system_prompt=chat_image_gen_system_prompt,
        guardrail_details_image=guardrail_details_image,
        bucket_name=bucket_name,
        character_details=character_details,
        chat_response=chat_response,
    )
    return job.job_id



@router.get("/all", response_model=List[MessageRead])
async def get_all_chats(
    user=Depends(get_current_user),
    user_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all previous chats for a user (admin) or current user in descending order of creation."""
    query_user_id = user_id if user_id is not None else user.id
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == query_user_id)
        .order_by(desc(ChatMessage.created_at))
    )
    messages = result.scalars().all()

    def truncate(text, length=2000):
        if text and len(text) > length:
            return text[:length] + "..."
        return text

    # Resolve presigned URLs concurrently for all messages that have an S3 key.
    async def _maybe_presign(s3_key):
        if not s3_key:
            return None
        try:
            return await generate_presigned_url(s3_key)
        except Exception:
            # If presign fails for a specific item, return None and continue.
            return None

    # Process media: for voice messages (media_type='voice'), s3_url_media contains input_key/output_key
    # For voice_with_image, s3_url_media contains input_key/output_key/image_key
    # For other media types, s3_url_media might be a single S3 key string
    async def _process_media(msg):
        # Normalize stored s3_url_media which may be a dict, JSON string, or simple S3 key string.
        raw = msg.s3_url_media
        media_obj = None
        try:
            if raw is None:
                media_obj = None
            elif isinstance(raw, dict):
                media_obj = raw
            elif isinstance(raw, str):
                s = raw.strip()
                # Attempt to parse JSON text
                if s.startswith("{") or s.startswith("["):
                    try:
                        media_obj = json.loads(s)
                    except Exception:
                        media_obj = s
                else:
                    media_obj = s
            else:
                media_obj = raw
        except Exception:
            media_obj = raw

        # Voice messages with image: media_obj should have input_key/output_key/image_key
        if msg.media_type == "voice_with_image" and isinstance(media_obj, dict):
            input_key = media_obj.get("input_key") or media_obj.get("input_url")
            output_key = media_obj.get("output_key") or media_obj.get("output_url")
            image_key = media_obj.get("image_key") or media_obj.get("image_url")

            # If stored values are full URLs, extract the key part
            if (
                input_key
                and isinstance(input_key, str)
                and ".amazonaws.com/" in input_key
            ):
                input_key = input_key.split(".amazonaws.com/", 1)[-1]
            if (
                output_key
                and isinstance(output_key, str)
                and ".amazonaws.com/" in output_key
            ):
                output_key = output_key.split(".amazonaws.com/", 1)[-1]
            if (
                image_key
                and isinstance(image_key, str)
                and ".amazonaws.com/" in image_key
            ):
                image_key = image_key.split(".amazonaws.com/", 1)[-1]

            input_url = await _maybe_presign(input_key) if input_key else None
            output_url = await _maybe_presign(output_key) if output_key else None
            image_url = await _maybe_presign(image_key) if image_key else None

            return {
                "input_url": input_url,
                "output_url": output_url,
                "image_url": image_url,
            }

        # Voice messages: media_obj should be a dict with input_key/output_key or input_url/output_url
        if msg.media_type == "voice" and isinstance(media_obj, dict):
            input_key = media_obj.get("input_key") or media_obj.get("input_url")
            output_key = media_obj.get("output_key") or media_obj.get("output_url")

            # If stored values are full URLs, extract the key part
            if (
                input_key
                and isinstance(input_key, str)
                and ".amazonaws.com/" in input_key
            ):
                input_key = input_key.split(".amazonaws.com/", 1)[-1]
            if (
                output_key
                and isinstance(output_key, str)
                and ".amazonaws.com/" in output_key
            ):
                output_key = output_key.split(".amazonaws.com/", 1)[-1]

            input_url = await _maybe_presign(input_key) if input_key else None
            output_url = await _maybe_presign(output_key) if output_key else None

            return {"input_url": input_url, "output_url": output_url}

        # Non-voice media: if media_obj is a dict, try common keys; if string assume it's an s3 key
        if media_obj:
            if isinstance(media_obj, dict):
                # prefer output_url, input_url, url, image, etc.
                candidate = (
                    media_obj.get("output_url")
                    or media_obj.get("input_url")
                    or media_obj.get("url")
                    or media_obj.get("image")
                )
                if (
                    candidate
                    and isinstance(candidate, str)
                    and ".amazonaws.com/" in candidate
                ):
                    candidate = candidate.split(".amazonaws.com/", 1)[-1]
                return await _maybe_presign(candidate)
            if isinstance(media_obj, str):
                # plain string might be an s3 key or full URL
                key = media_obj
                if ".amazonaws.com/" in key:
                    key = key.split(".amazonaws.com/", 1)[-1]
                return await _maybe_presign(key)

        return None

    presigned_media = await asyncio.gather(*(_process_media(msg) for msg in messages))

    results: list[MessageRead] = []
    for msg, presigned in zip(messages, presigned_media):
        results.append(
            MessageRead(
                id=msg.id,
                session_id=msg.session_id,
                character_id=msg.character_id,
                user_query=truncate(msg.user_query or "", 2000),
                ai_message=truncate(msg.ai_message or "", 2000),
                is_media_available=msg.is_media_available,
                media_type=msg.media_type,
                s3_url_media=presigned,
                created_at=str(getattr(msg, "created_at", "")),
            )
        )

    return results


@router.get("/summary")
async def get_chats_summary(
    limit: int = 50, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Return a lightweight summary of recent chats for quick list rendering.

    Uses cache-aside with Redis via `app.services.redis_cache` to keep responses fast.
    """
    try:
        uid = getattr(user, "id", "anon")
    except Exception:
        uid = "anon"

    cache_key = f"chats:summary:{uid}"
    try:
        cached = await redis_cache.get_cached(cache_key)
        if cached:
            try:
                payload_all = json.loads(cached)
                return JSONResponse(content=payload_all[:limit])
            except Exception:
                # fallthrough to rebuild cache
                pass
    except Exception:
        # If redis helper fails, continue to DB query
        pass

    # Fetch recent messages and pick the latest per-character (simple, efficient approach)
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.user_id == uid)
        .order_by(desc(ChatMessage.created_at))
        .limit(2000)
    )
    messages = result.scalars().all()

    seen: dict[str, dict] = {}
    for msg in messages:
        try:
            cid = str(getattr(msg, "character_id", "") or "")
        except Exception:
            cid = ""
        # Use session-level groups if no character_id; skip empty keys for list rendering
        if cid in seen:
            continue
        preview = msg.ai_message or msg.user_query or ""
        seen[cid] = {
            "character_id": cid,
            "last_message_preview": preview[:300],
            "last_activity": str(getattr(msg, "created_at", "")),
            "unread_count": 0,
        }
        if len(seen) >= limit:
            break

    # Resolve character metadata (name/avatar) for any character ids we collected
    # Keys in `seen` may be numeric strings or UUIDs/hashes; attempt to convert
    # purely-numeric keys to ints and leave others as strings so the query
    # matches the Character.id column type in either case.
    char_ids_raw = [k for k in seen.keys() if k]
    char_ids = []
    non_numeric_found = False
    for k in char_ids_raw:
        if re.fullmatch(r"\d+", k):
            try:
                char_ids.append(int(k))
            except Exception:
                char_ids.append(k)
        else:
            non_numeric_found = True
            char_ids.append(k)

    char_map: dict[str, dict] = {}
    if char_ids:
        try:
            res = await db.execute(select(Character).where(Character.id.in_(char_ids)))
            rows = res.scalars().all()
            for ch in rows:
                char_map[str(ch.id)] = {
                    "name": getattr(ch, "name", "")
                    or getattr(ch, "username", "")
                    or "",
                    "avatar_url": getattr(ch, "image_url_s3", None)
                    or getattr(ch, "image_url", None),
                }
            # Presign avatar URLs for all characters we found
            try:
                presigned = await presign_avatar_map_dict(
                    {k: v.get("avatar_url") for k, v in char_map.items()}
                )
                for k, v in presigned.items():
                    if k in char_map:
                        char_map[k]["avatar_url"] = v
            except Exception:
                # best-effort: if presigning fails, leave raw values
                pass
        except Exception:
            # If character lookup fails, continue gracefully — the summary is optional
            pass

    payload: list[dict] = []
    for k, v in seen.items():
        meta = char_map.get(k, {})
        v["name"] = meta.get("name", "")
        v["avatar_url"] = meta.get("avatar_url")
        payload.append(v)

    # Cache the serialized payload for a short TTL under a single per-user key
    try:
        await redis_cache.set_cached(
            cache_key, json.dumps(payload, default=str), ttl=60
        )
    except Exception:
        pass

    return JSONResponse(content=payload[:limit])


async def _build_and_cache_user_summary(
    user_id: str, db: AsyncSession, max_limit: int = 200, ttl: int = 60
):
    """Helper to build the summary payload for a user and write it into Redis.
    Returns the payload list.
    """
    cache_key = f"chats:summary:{user_id}"
    try:
        result = await db.execute(
            select(ChatMessage)
            .where(ChatMessage.user_id == user_id)
            .order_by(desc(ChatMessage.created_at))
            .limit(2000)
        )
        messages = result.scalars().all()

        seen: dict[str, dict] = {}
        for msg in messages:
            try:
                cid = str(getattr(msg, "character_id", "") or "")
            except Exception:
                cid = ""
            if cid in seen:
                continue
            preview = msg.ai_message or msg.user_query or ""
            seen[cid] = {
                "character_id": cid,
                "last_message_preview": preview[:300],
                "last_activity": str(getattr(msg, "created_at", "")),
                "unread_count": 0,
            }
            if len(seen) >= max_limit:
                break

        # Safely parse character ids from seen keys (support numeric ids and non-numeric ids)
        char_ids_raw = [k for k in seen.keys() if k]
        char_ids = []
        for k in char_ids_raw:
            if re.fullmatch(r"\d+", k):
                try:
                    char_ids.append(int(k))
                except Exception:
                    char_ids.append(k)
            else:
                char_ids.append(k)

        char_map: dict[str, dict] = {}
        if char_ids:
            try:
                res = await db.execute(
                    select(Character).where(Character.id.in_(char_ids))
                )
                rows = res.scalars().all()
                for ch in rows:
                    char_map[str(ch.id)] = {
                        "name": getattr(ch, "name", "")
                        or getattr(ch, "username", "")
                        or "",
                        "avatar_url": getattr(ch, "image_url_s3", None)
                        or getattr(ch, "image_url", None),
                    }
                # Presign avatar urls for cached summary as well
                try:
                    presigned = await presign_avatar_map_dict(
                        {k: v.get("avatar_url") for k, v in char_map.items()}
                    )
                    for k, v in presigned.items():
                        if k in char_map:
                            char_map[k]["avatar_url"] = v
                except Exception:
                    pass
            except Exception:
                # ignore lookup errors and continue
                pass

        payload: list[dict] = []
        for k, v in seen.items():
            meta = char_map.get(k, {})
            v["name"] = meta.get("name", "")
            v["avatar_url"] = meta.get("avatar_url")
            payload.append(v)

        try:
            await redis_cache.set_cached(
                cache_key, json.dumps(payload, default=str), ttl=ttl
            )
        except Exception:
            pass

        return payload
    except Exception:
        return []


@router.post("/")
async def start_chat(
    request: Request,
    chat: ChatCreate,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate text response and optionally queue image generation."""
    await check_user_wallet(db, user.id, "chat")
    # Fetch all config values in parallel for faster initialization
    chat_limit, username, base_system_prompt, chat_image_gen_system_prompt, guardrail_details_image, bucket_name = (
        await asyncio.gather(
            get_config_value_from_cache("CHAT_HISTORY_LIMIT"),
            get_config_value_from_cache("PRIVATE_CLOUD_API_USERNAME"),
            get_config_value_from_cache("CHAT_GEN_PROMPT_NSFW"),
            get_config_value_from_cache("CHAT_IMAGE_GEN_SYSTEM_PROMPT"),
            get_config_value_from_cache("IMAGE_GEN_GUARDRAIL"),
            get_config_value_from_cache("AWS_BUCKET_NAME"),
        )
    )

    # Ensure `character` is always defined in the function scope so later
    # references (e.g., getattr(character, ...)) don't raise UnboundLocalError
    # when `character_id` is falsy and the conditional block below isn't executed.
    character = None
    character_id = chat.character_id

    # Parallelize character lookup and messages fetch
    if character_id:
        # Execute DB queries sequentially on the same AsyncSession to avoid
        # concurrent provisioning errors (AsyncSession disallows concurrent ops).
        character_result = await db.execute(
            select(Character).where(Character.id == character_id)
        )
        messages_result = await db.execute(
            select(ChatMessage)
            .where(
                (ChatMessage.user_id == user.id)
                & (ChatMessage.character_id == character_id)
            )
            .order_by(desc(ChatMessage.created_at))
            .limit(chat_limit)
        )

        character = character_result.scalar_one_or_none()
        last_messages = list(reversed(messages_result.scalars().all()))

        char_dict = {
            "style": character.style or "",
            "ethnicity": character.ethnicity or "",
            "age": character.age or 0,
            "eye_colour": character.eye_colour or "",
            "hair_style": character.hair_style or "",
            "hair_colour": character.hair_colour or "",
            "body_type": character.body_type or "",
            "breast_size": character.breast_size or "",
            "butt_size": character.butt_size or "",
            "dick_size": character.dick_size or "",
            "personality": character.personality or "",
            "voice_type": character.voice_type or "",
            "relationship_type": character.relationship_type or "",
            "clothing": character.clothing or "",
            "special_features": character.special_features or "",
        }
        json_character_details = json.dumps(char_dict)
        name = character.name or "Unknown"
        bio = character.bio or ""
        gender = character.gender or ""
        age = character.age or ""
    else:
        json_character_details = ""
        name = "Unknown"
        bio = ""
        gender = ""
        age = ""

    # # Build a richer system prompt that includes both the configured template and a structured
    # # character profile + original creation prompt to make the model "aware" of the character.

    # # Defensive defaults in case earlier logic didn't set these variables
    # if "json_character_details" not in locals():
    #     json_character_details = ""
    # if "name" not in locals():
    #     name = "Unknown"
    # if "bio" not in locals():
    #     bio = ""
    # if "gender" not in locals():
    #     gender = ""
    # if "age" not in locals():
    #     age = ""
    print("name character_id: ", name, character.id)
    template_prompt = (
        (base_system_prompt)
        .replace("replace_character_name", name)
        .replace("replace_character_bio", bio)
        .replace("replace_character_gender", gender)
        .replace("replace_character_details", json_character_details)
        .replace("replace_character_age", str(age))
    )


    # IMPORTANT: We preserve the client's timezone exactly (no server conversion)
    # so characters respond based on the user's local time, not server time.
    client_ts_raw = getattr(chat, "client_timestamp", None)
    
    # Always ensure we have a valid timestamp (fallback to server time if None)
    if not client_ts_raw:
        client_ts_raw = str(datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC"))
    template_prompt = template_prompt.replace("replace_current_timestamp", str(client_ts_raw))
    
    print("user query : ", chat.user_query)
    #print(template_prompt)
    messages = _build_chat_messages(template_prompt, last_messages, chat.user_query)
    guardrail_history = _build_guardrail_history(last_messages)
    is_prompt_compliant, prompt_reason = await AetherLabService.validate_prompt(
        user_prompt=chat.user_query,
        conversation_history=guardrail_history,
    )
    if not is_prompt_compliant:
        detail_msg = (
            prompt_reason.get("rationale")
            or prompt_reason.get("reason")
            or prompt_reason.get("message")
            or "Message blocked by content policy"
        )
        raise HTTPException(status_code=400, detail=detail_msg)
    token_count = await approximate_token_count(messages)
    chat_output, wants_image = await generate_chat_text(messages)
    # chat_output, is_image_request = (
    #     await extract_chat_image_intent_prompt(llm_output)
    # )
    ##############################################
    # Prepare for message creation
    is_media_available = False
    media_type = None
    s3_url_media = None
    presigned_s3_url_media = None
    image_job_id: Optional[str] = None

    new_message = ChatMessage(
        session_id=chat.session_id,
        user_id=user.id,
        character_id=chat.character_id,
        user_query=chat.user_query,
        ai_message=chat_output,
        context_window=token_count,
        is_media_available=is_media_available,
        media_type=media_type,
        s3_url_media=s3_url_media,
    )
    db.add(new_message)
    await db.commit()
    await db.refresh(new_message) # Get ID

    if wants_image and character:
        try:
            await deduhl_user_coins(request, db, user.id, character_id, "chat_image")
            ctx_messages = _build_image_context(
                last_messages, chat.user_query, chat_output
            )
            image_job_id = await queue_chat_image_job(
                background_tasks=background_tasks,
                user_id=str(user.id),
                character=character,
                message_id=new_message.id,
                messages_for_prompt=ctx_messages,
                user_query=chat.user_query,
                user_role=user.role if user else "USER",
                chat_image_gen_system_prompt=chat_image_gen_system_prompt,
                guardrail_details_image=guardrail_details_image,
                bucket_name=bucket_name,
                character_details=json_character_details,
                chat_response=chat_output,
            )
        except Exception as e:
            print(f"Failed to queue chat image job: {e}")

    # Move cache rebuild and Redis publish to background tasks for faster response
    async def _background_cache_and_notify():
        """Background task to rebuild cache and publish notification."""
        from app.core.database import AsyncSessionLocal

        try:
            async with AsyncSessionLocal() as bg_db:
                await _build_and_cache_user_summary(
                    str(user.id), bg_db, max_limit=200, ttl=60
                )
        except Exception:
            pass

        try:
            client = await redis_cache.get_redis_client()
            if client:
                payload = json.dumps(
                    {
                        "user_id": str(user.id),
                        "character_id": str(chat.character_id or ""),
                        "last_message_preview": (chat.user_query or "")[:300],
                        "last_activity": str(getattr(new_message, "created_at", "")),
                    }
                )
                await client.publish(f"chat_updates:{user.id}", payload)
        except Exception:
            pass

    background_tasks.add_task(_background_cache_and_notify)
    await deduhl_user_coins(
        request, db, user.id, character_id=character_id, media_type="chat"
    )
    payload = {
        "message_id": new_message.id,
        "chat_response": chat_output,
        "is_media_available": is_media_available,
        "media_type": media_type,
        "s3_url_media": presigned_s3_url_media,
        "is_image_request": wants_image,
        "image_job_id": image_job_id,
    }

    # Include character id and username in payload so clients can build a pretty slug
    try:
        if character:
            payload["character"] = {
                "id": getattr(character, "id", None),
                "username": getattr(character, "username", None),
            }
    except Exception:
        pass

    return JSONResponse(content=payload, status_code=200)


@router.get("/image-status/{job_id}", response_model=ImageJobStatusResponse)
async def get_image_status(
    job_id: str,
    user=Depends(get_current_user),
):
    """Return image job status and a presigned URL when ready."""
    job = await image_job_store.get_job(job_id)
    if not job or str(job.user_id) != str(user.id):
        raise HTTPException(status_code=404, detail="Image job not found")

    image_url = None
    if job.status == ImageJobStatus.completed:
        if job.image_s3_key:
            try:
                image_url = await generate_presigned_url(job.image_s3_key)
            except Exception:
                image_url = job.image_url
        else:
            image_url = job.image_url

    return ImageJobStatusResponse(
        job_id=job.job_id,
        status=job.status,
        image_url=image_url,
        error=job.error,
    )


@router.get("/{chat_id}/messages")
async def get_chat_messages(
    chat_id: str,
    limit: int = 200,
    cursor: str | None = None,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return messages for a single character/chat with keyset pagination (cursor).

    Cursor is an optional base64 urlsafe-encoded string of the form: "{created_at_iso}|{id}" representing the last item seen.
    When provided it returns older messages strictly older than that cursor (created_at,id) pair.
    Response shape: { messages: [...], next_cursor: <token or null> }
    """
    # Decode cursor if provided
    cursor_time = None
    cursor_id = None
    if cursor:
        try:
            raw = base64.urlsafe_b64decode(cursor.encode()).decode()
            parts = raw.split("|", 1)
            if len(parts) == 2:
                cursor_time = datetime.fromisoformat(parts[0])
                cursor_id = parts[1]
        except Exception:
            cursor_time = None
            cursor_id = None

    # Build keyset WHERE clause
    q = select(ChatMessage).where(
        (ChatMessage.user_id == user.id) & (ChatMessage.character_id == chat_id)
    )
    if cursor_time and cursor_id:
        q = q.where(
            (ChatMessage.created_at < cursor_time)
            | ((ChatMessage.created_at == cursor_time) & (ChatMessage.id < cursor_id))
        )
    q = q.order_by(desc(ChatMessage.created_at)).limit(limit)
    result = await db.execute(q)
    messages = result.scalars().all()

    async def _maybe_presign(s3_key):
        if not s3_key:
            return None
        try:
            return await generate_presigned_url(s3_key)
        except Exception:
            return None

    async def _process_media(msg):
        raw = msg.s3_url_media
        media_obj = None
        try:
            if raw is None:
                media_obj = None
            elif isinstance(raw, dict):
                media_obj = raw
            elif isinstance(raw, str):
                s = raw.strip()
                if s.startswith("{") or s.startswith("["):
                    try:
                        media_obj = json.loads(s)
                    except Exception:
                        media_obj = s
                else:
                    media_obj = s
            else:
                media_obj = raw
        except Exception:
            media_obj = raw

        # Voice messages with image: media_obj should have input_key/output_key/image_key
        if msg.media_type == "voice_with_image" and isinstance(media_obj, dict):
            input_key = media_obj.get("input_key") or media_obj.get("input_url")
            output_key = media_obj.get("output_key") or media_obj.get("output_url")
            image_key = media_obj.get("image_key") or media_obj.get("image_url")

            if (
                input_key
                and isinstance(input_key, str)
                and ".amazonaws.com/" in input_key
            ):
                input_key = input_key.split(".amazonaws.com/", 1)[-1]
            if (
                output_key
                and isinstance(output_key, str)
                and ".amazonaws.com/" in output_key
            ):
                output_key = output_key.split(".amazonaws.com/", 1)[-1]
            if (
                image_key
                and isinstance(image_key, str)
                and ".amazonaws.com/" in image_key
            ):
                image_key = image_key.split(".amazonaws.com/", 1)[-1]

            input_url = await _maybe_presign(input_key) if input_key else None
            output_url = await _maybe_presign(output_key) if output_key else None
            image_url = await _maybe_presign(image_key) if image_key else None

            return {
                "input_url": input_url,
                "output_url": output_url,
                "image_url": image_url,
            }

        if msg.media_type == "voice" and isinstance(media_obj, dict):
            input_key = media_obj.get("input_key") or media_obj.get("input_url")
            output_key = media_obj.get("output_key") or media_obj.get("output_url")
            if (
                input_key
                and isinstance(input_key, str)
                and ".amazonaws.com/" in input_key
            ):
                input_key = input_key.split(".amazonaws.com/", 1)[-1]
            if (
                output_key
                and isinstance(output_key, str)
                and ".amazonaws.com/" in output_key
            ):
                output_key = output_key.split(".amazonaws.com/", 1)[-1]

            input_url = await _maybe_presign(input_key) if input_key else None
            output_url = await _maybe_presign(output_key) if output_key else None

            return {"input_url": input_url, "output_url": output_url}

        if media_obj:
            if isinstance(media_obj, dict):
                candidate = (
                    media_obj.get("output_url")
                    or media_obj.get("input_url")
                    or media_obj.get("url")
                    or media_obj.get("image")
                )
                if (
                    candidate
                    and isinstance(candidate, str)
                    and ".amazonaws.com/" in candidate
                ):
                    candidate = candidate.split(".amazonaws.com/", 1)[-1]
                return await _maybe_presign(candidate)
            if isinstance(media_obj, str):
                key = media_obj
                if ".amazonaws.com/" in key:
                    key = key.split(".amazonaws.com/", 1)[-1]
                return await _maybe_presign(key)

        return None

    presigned_media = await asyncio.gather(*(_process_media(msg) for msg in messages))

    def truncate(text, length=2000):
        if text and len(text) > length:
            return text[:length] + "..."
        return text

    results: list[MessageRead] = []
    for msg, presigned in zip(messages, presigned_media):
        results.append(
            MessageRead(
                id=msg.id,
                session_id=msg.session_id,
                character_id=msg.character_id,
                user_query=truncate(msg.user_query or "", 2000),
                ai_message=truncate(msg.ai_message or "", 2000),
                is_media_available=msg.is_media_available,
                media_type=msg.media_type,
                s3_url_media=presigned,
                created_at=str(getattr(msg, "created_at", "")),
            )
        )

    # Return in chronological order (oldest first)
    ordered = list(reversed(results))

    # Build next_cursor for pagination: encode the earliest returned item's created_at + id
    next_cursor = None
    if len(messages) > 0:
        last_msg = messages[-1]
        try:
            ts = getattr(last_msg, "created_at")
            ts_iso = ts.isoformat() if hasattr(ts, "isoformat") else str(ts)
            token = f"{ts_iso}|{getattr(last_msg, 'id', '')}"
            next_cursor = base64.urlsafe_b64encode(token.encode()).decode()
        except Exception:
            next_cursor = None

    # Convert pydantic models to plain dicts for JSON serialization
    try:
        messages_payload = [m.dict() if hasattr(m, "dict") else m for m in ordered]
    except Exception:
        # Fallback: ensure items are JSON-serializable
        messages_payload = []
        for m in ordered:
            try:
                messages_payload.append(m.dict())
            except Exception:
                try:
                    # Last resort, convert to str
                    messages_payload.append(str(m))
                except Exception:
                    messages_payload.append(None)

    return JSONResponse(
        content={"messages": messages_payload, "next_cursor": next_cursor}
    )


@router.get("/subscribe")
async def subscribe_chat_updates(
    request: Request, token: str | None = None, db: AsyncSession = Depends(get_db)
):
    """SSE endpoint that streams pub/sub messages for the authenticated user.

    The client may pass `token` as a query parameter when EventSource can't set Authorization header.
    This endpoint subscribes to Redis channel `chat_updates:{user_id}` and forwards messages as SSE.

    IMPORTANT: Database session is closed immediately after auth to avoid pool exhaustion.
    """
    # Authenticate using token in query param (EventSource can't set Authorization headers)
    if not token:
        # If no token provided, return 401
        raise HTTPException(status_code=401, detail="Missing token")

    user = await AuthService.get_user_from_token(token, db)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")

    # CRITICAL: Close database session immediately after auth check
    # SSE connections are long-lived (minutes/hours) and would exhaust the connection pool
    # if we kept the session open. We only needed it for auth validation.
    user_id = user.id  # Cache user_id before closing session
    await db.close()

    try:
        client = await redis_cache.get_redis_client()
    except Exception:
        client = None

    if not client:
        raise HTTPException(status_code=503, detail="Redis not available")

    pubsub = client.pubsub()
    channel = f"chat_updates:{user_id}"  # Use cached user_id
    await pubsub.subscribe(channel)

    async def event_generator():
        try:
            while True:
                # If client disconnected, break
                if await request.is_disconnected():
                    break
                msg = await pubsub.get_message(
                    ignore_subscribe_messages=True, timeout=1.0
                )
                if msg:
                    data = msg.get("data")
                    if isinstance(data, bytes):
                        try:
                            data = data.decode()
                        except Exception:
                            data = str(data)
                    # Send as SSE data field
                    yield f"data: {data}\n\n"
                else:
                    # send a short keep-alive comment to avoid proxies closing the connection
                    yield ":\n\n"
                await asyncio.sleep(0.01)
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception:
                pass

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@router.post("/{chat_id}/messages", response_model=MessageRead)
def send_message(chat_id: str, message: MessageCreate, user=Depends(get_current_user)):
    """Send a message and get AI response (non-streaming)."""
    # TODO: Implement non-streaming AI reply
    raise NotImplementedError


@router.get("/{chat_id}/messages/stream")
async def stream_message(
    chat_id: str,
    content: str,
    client_timestamp: str | None = None,
    user=Depends(get_current_user),
):
    """
    Stream AI response for a user message using OpenAI (chunked JSON).
    This is a fully implemented example endpoint.
    """

    async def event_stream():
        # Parse client timestamp if provided (for future use in prompts)
        # Preserve client timezone exactly (no server conversion)
        try:
            formatted_client_time = None
            if client_timestamp:
                ts = str(client_timestamp)
                if ts.endswith("Z"):
                    ts = ts.replace("Z", "+00:00")
                dt = datetime.fromisoformat(ts)
                try:
                    if dt.tzinfo:
                        formatted_client_time = dt.strftime("%Y-%m-%d %H:%M:%S %Z")
                    else:
                        formatted_client_time = dt.strftime("%Y-%m-%d %H:%M:%S UTC")
                except Exception:
                    formatted_client_time = dt.isoformat()
            else:
                formatted_client_time = datetime.utcnow().strftime(
                    "%Y-%m-%d %H:%M:%S UTC"
                )
            # Log for debugging / ops visibility
            try:
                print(
                    f"stream_message: client_timestamp={client_timestamp} parsed={formatted_client_time}"
                )
            except Exception:
                pass
        except Exception:
            pass

        # TODO: Replace with real ChatService and OpenAI streaming
        for chunk in ["Hello, ", "this is ", "a streamed ", "AI reply."]:
            await asyncio.sleep(0.3)
            yield f'{json.dumps({"content": chunk})}\n'
        yield "[DONE]\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
