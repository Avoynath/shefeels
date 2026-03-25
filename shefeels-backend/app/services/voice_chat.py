import os
import io
import base64
import httpx
import asyncio
import logging
import sys
import json
from io import BytesIO
from fastapi import HTTPException
from typing import Optional
from elevenlabs.client import ElevenLabs
from openai import OpenAI
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
from app.core.aws_s3 import get_s3_client, generate_presigned_url, upload_to_s3_file
from app.services.voice import store_voice_to_s3
from app.models.chat import ChatMessage
from app.models.character import Character
from app.models.character_media import CharacterMedia
from app.services.chat import (
    approximate_token_count,
    generate_structured_llm_response,
)
from app.services.schema import SCHEMA_CHAT
from app.schemas.image_job import ImageJobStatus
from app.services.image_jobs import image_job_store
from app.services.character_media import generate_filename_timestamped, generate_character_to_image_in_chat_prompt, generate_text_to_image, get_job

from app.services.aetherlab_service import AetherLabService
from app.services.ai_generation_logging import (
    create_ai_generation_log,
    update_ai_generation_log_success,
    update_ai_generation_log_failure
)
from app.core.database import AsyncSessionLocal
from datetime import datetime


def _parse_chat_response(llm_output: str) -> tuple[str, bool]:
    """Parse structured chat output into text and image intent."""
    if not llm_output:
        return "", False
    try:
        data = json.loads(llm_output)
    except Exception:
        return llm_output, False
    chat_output = data.get("chat_output", "")
    wants_image = str(data.get("generate_image", "false")).lower() == "true"
    return chat_output, wants_image


async def _download_url_as_bytes(url: str, headers: dict | None = None) -> bytes:
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()
        return resp.content


async def try_openai_whisper_fallback(audio_bytes: bytes) -> Optional[str]:
    """Fallback to OpenAI Whisper if ElevenLabs fails."""
    logger = logging.getLogger(__name__)
    try:
        api_key = settings.OPENAI_API_KEY
        logger.info("[STT] Attempting OpenAI Whisper fallback")
        client = OpenAI(api_key=api_key)
        
        # Whisper requires a file-like object with a name
        audio_file = io.BytesIO(audio_bytes)
        audio_file.name = "audio.mp3"
        
        transcript = client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            language="en"
        )
        if transcript and transcript.text:
            logger.info(f"[STT] OpenAI Whisper successfully transcribed: {len(transcript.text)} chars")
            return transcript.text.strip()
        return None
    except Exception as e:
        logger.error(f"[STT] OpenAI Whisper fallback failed: {e}")
        return None


async def try_openai_tts_fallback(text: str, gender: str = "female") -> Optional[bytes]:
    """Fallback to OpenAI TTS if ElevenLabs fails."""
    logger = logging.getLogger(__name__)
    try:
        api_key = settings.OPENAI_API_KEY   
        logger.info("[TTS] Attempting OpenAI TTS fallback")
        client = OpenAI(api_key=api_key)
        
        # Map gender to OpenAI voices
        # alloy, echo, fable, onyx, nova, shimmer
        voice = "nova" if gender.lower() == "female" else "onyx"
        if gender.lower() == "male": voice = "onyx"
        elif gender.lower() == "trans": voice = "shimmer"
        
        response = client.audio.speech.create(
            model="tts-1",
            voice=voice,
            input=text,
        )
        return response.content
    except Exception as e:
        logger.error(f"[TTS] OpenAI TTS fallback failed: {e}")
        return None


async def transcribe_audio_bytes(audio_bytes: bytes) -> Optional[str]:
    """
    Transcribe audio using ElevenLabs Speech-to-Text API.
    Returns transcript or None.
    """
    logger = logging.getLogger(__name__)

    try:
        # Get ElevenLabs API key from config
        api_key = settings.ELEVENLABS_API_KEY

        logger.info("[STT] Transcribing audio with ElevenLabs SDK")

        # Initialize ElevenLabs client
        client = ElevenLabs(api_key=api_key)

        # Create BytesIO from audio bytes for SDK
        audio_stream = io.BytesIO(audio_bytes)
        audio_stream.name = "audio.mp3"  # Set filename for SDK

        # Call ElevenLabs STT
        result = client.speech_to_text.convert(
            file=audio_stream,
            model_id="scribe_v1",
            language_code="eng",
            tag_audio_events=False,
            diarize=False,
        )

        # Extract transcript
        transcript = None
        if isinstance(result, dict):
            transcript = result.get("text")
        else:
            transcript = getattr(result, "text", None)

        if transcript and transcript.strip():
            logger.info(f"[STT] Successfully transcribed: {len(transcript)} chars")
            return transcript.strip()
        else:
            logger.warning("[STT] ElevenLabs returned empty transcript")
            return None

    except Exception as e:
        logger.warning(f"[STT] ElevenLabs failed: {e}. Trying OpenAI fallback.")
        return await try_openai_whisper_fallback(audio_bytes)


async def synthesize_voice_clone(
    text: str, voice_id: str | None, username: str | None, gender: str = "female"
) -> Optional[bytes]:
    """Call ElevenLabs TTS API using SDK and return MP3 bytes (or None). Falls back to AWS Polly on failure."""
    logger = logging.getLogger(__name__)

    async def try_polly_fallback(text: str, gender: str) -> Optional[bytes]:
        try:
            logger.info("[TTS] Attempting fallback to AWS Polly")
            import boto3
            # Map gender to Polly Neural voices
            voice_map = {
                "male": "Matthew",
                "female": "Joanna",
                "trans": "Joanna" # Default to female-sounding for trans for now, or use non-binary if available
            }
            # Normalize gender
            g = (gender or "female").lower()
            polly_voice = voice_map.get(g, "Joanna")
            if "male" in g: polly_voice = "Matthew"
            
            # Helper to run blocking boto3 call in thread
            def _call_polly():
                # Boto3 will pick up credentials from env vars or config automatically if set in env,
                # but we should explicit use our config cache if variables are different.
                # Assuming standard AWS_ env vars are used by app.
                # If not, we might need to fetch them.
                # Checking get_s3_client suggests we might need to manually auth if env vars aren't auto.
                # But typically boto3.client("polly") works if AWS_ACCESS_KEY_ID etc are exported.
                from app.core.config import settings
                client = boto3.client(
                    "polly",
                    region_name=settings.AWS_REGION or "us-east-1",
                    aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                    aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY
                )
                resp = client.synthesize_speech(
                    Text=text,
                    OutputFormat='mp3',
                    VoiceId=polly_voice,
                    Engine='neural'
                )
                if "AudioStream" in resp:
                    return resp["AudioStream"].read()
                return None

            # Attempt getting creds from cache if needed, but let's try standard boto3 env first or assume 
            # environment is set up like S3. However, get_s3_client uses aoto3/aiobotocore usually?
            # Let's use run_in_executor
            loop = asyncio.get_event_loop()
            return await loop.run_in_executor(None, _call_polly)

        except Exception as e:
            logger.warning(f"[TTS] AWS Polly fallback failed: {e}")
            # Final fallback to OpenAI TTS
            return await try_openai_tts_fallback(text, gender)

    try:
        # Get ElevenLabs API key and model from config
        api_key = settings.ELEVENLABS_API_KEY
        model_id = await get_config_value_from_cache("ELEVENLABS_MODEL_ID")
        if not model_id:
            model_id = "eleven_flash_v2_5"

        # Use provided voice_id or fall back to default
        if not voice_id:
            logger.warning("[TTS] No voice_id provided, using default")
            voice_id = "EXAVITQu4vr4xnSDxMaL"  # Sarah - Default ElevenLabs voice

        logger.info(
            f"[TTS] Synthesizing with ElevenLabs SDK: voice_id={voice_id}, model={model_id}, text_len={len(text or '')}"
        )

        # Initialize ElevenLabs client
        client = ElevenLabs(api_key=api_key)

        # Call TTS API with streaming
        # Wrapping in executor not strictly needed if client is sync but fast, 
        # but ElevenLabs client is sync. Should strictly run in thread?
        # The original code didn't. Let's stick minimize changes but wrap in thread if it blocks?
        # actually original code had 'audio_generator = ...' which is sync.
        
        def _call_eleven():
            gen = client.text_to_speech.convert(
                text=text,
                voice_id=voice_id,
                model_id=model_id,
                output_format="mp3_44100_128",
            )
            # Collect bytes
            b = b""
            for chunk in gen:
                if chunk: b += chunk
            return b

        loop = asyncio.get_event_loop()
        audio_bytes = await loop.run_in_executor(None, _call_eleven)

        if not audio_bytes:
            logger.error("[TTS] ElevenLabs returned empty audio")
            # Try fallback
            return await try_polly_fallback(text, gender)

        logger.info(f"[TTS] Successfully synthesized audio: {len(audio_bytes)} bytes")
        return audio_bytes

    except Exception as e:
        logger.exception(f"[TTS] Failed to synthesize voice with ElevenLabs: {e}")
        # FALLBACK
        return await try_polly_fallback(text, gender)


async def process_voice_chat(
    user, audio_bytes: bytes, character_id: str | int | None, session_id: str | None
):
    """Orchestrate: transcribe -> chat -> synthesize voice -> store -> persist ChatMessage.
    Returns voice payload plus image intent metadata for async image generation.
    """
    logger = logging.getLogger(__name__)
    # 1) Store input audio to S3
    input_s3_url = None
    input_s3_key = None
    try:
        bucket = await get_config_value_from_cache("AWS_BUCKET_NAME")
        import uuid
        import datetime as dt_module

        input_name = str(uuid.uuid4())
        folder_date = dt_module.date.today().isoformat()
        user_id = str(getattr(user, "id", "anon"))
        # Store to S3 and extract the key from the returned URL
        direct_url = await store_voice_to_s3(
            "voice", input_name, audio_bytes, user_id, folder_date, "input", bucket
        )
        # Extract S3 key from URL (format: https://bucket.s3.amazonaws.com/key)
        if direct_url:
            input_s3_key = (
                direct_url.split(".amazonaws.com/", 1)[-1]
                if ".amazonaws.com/" in direct_url
                else None
            )
            if input_s3_key:
                # Generate pre-signed URL for secure access
                input_s3_url = await generate_presigned_url(
                    input_s3_key, expires_in=7200
                )
    except Exception:
        logger.exception("process_voice_chat: failed to store input audio to S3")
    else:
        logger.info("process_voice_chat: input_s3_url=%s", input_s3_url)

    # 2) transcribe
    transcript = await transcribe_audio_bytes(audio_bytes)
    logger.info(
        f"[STT] Transcription result: '{transcript[:200] if transcript else None}'..."
    )
    logger.info("process_voice_chat: transcription=%s", transcript)

    # If transcription failed, synthesize a helpful user query for the LLM so the model can
    # apologize/ask for clarification instead of receiving a blank user turn.
    if not transcript or not str(transcript).strip():
        logger.warning(
            "process_voice_chat: STT produced no text; using fallback user_query for LLM"
        )
        # Helpful fallback prompt so the assistant can respond meaningfully
        transcript = None

    # 3) build chat payload using existing chat generation with full character context
    chat_url = await get_config_value_from_cache("CHAT_GEN_URL")
    api_username = await get_config_value_from_cache("PRIVATE_CLOUD_API_USERNAME")

    # Retrieve character and conversation history from DB (close session after fetching)
    voice_id = None
    character = None
    messages = []
    user_query = (
        transcript
        if transcript
        else (
            "I attempted to send a voice message but transcription failed. "
            "Please ask me to repeat or ask a short clarifying question so I can respond."
        )
    )

    async with AsyncSessionLocal() as db:
        # fetch character with full details for context
        if character_id:
            try:
                from sqlalchemy import select
                from app.models.character import Character as CharModel

                r = await db.execute(
                    select(CharModel).where(CharModel.id == str(character_id))
                )
                character = r.scalar_one_or_none()
                if character:
                    # Use generated_voice_id if available
                    voice_id = getattr(character, "generated_voice_id", None)
                    if not voice_id:
                        logger.warning(
                            f"process_voice_chat: character {character_id} has no generated_voice_id, will use default"
                        )
                    else:
                        logger.info(
                            f"process_voice_chat: using character's generated voice: {voice_id}"
                        )
            except Exception:
                logger.exception("process_voice_chat: failed to fetch character")
                pass

        # Build character context (same as text chat)
        if character:
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

        # Build system prompt with character context and guardrails
        from app.services.app_config import get_config_value_from_cache as _g

        is_sfw = False
        base_system_prompt = (
            await _g("CHAT_GEN_PROMPT_NSFW")
            if not is_sfw
            else await _g("CHAT_GEN_PROMPT_SFW")
        )
        guardrail_details_image = await _g("IMAGE_GEN_GUARDRAIL") or ""

        system_prompt = base_system_prompt or "You are a helpful assistant."
        # Replace character placeholders
        system_prompt = (
            system_prompt.replace("replace_character_name", name)
            .replace("replace_character_bio", bio)
            .replace("replace_character_gender", gender)
            .replace("replace_character_details", json_character_details)
            .replace("{guardrail_details_image}", guardrail_details_image)
            .replace("replace_character_age", str(age))
        )

        # Add timestamp context (use current UTC time as fallback)
        formatted_client_time = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S UTC")
        for token in [
            "replace_client_timestamp",
            "{client_timestamp}",
            "{{client_timestamp}}",
            "replace_client_time",
            "{client_time}",
            "{{client_time}}",
        ]:
            system_prompt = system_prompt.replace(token, formatted_client_time)

        # Build messages history
        messages.append({"role": "system", "content": system_prompt})

        # last N messages
        try:
            from sqlalchemy import select, desc
            from app.models.chat import ChatMessage as ChatModel

            limit = int(await _g("CHAT_HISTORY_LIMIT") or 10)
            q = await db.execute(
                select(ChatModel)
                .where(ChatMessage.session_id == (session_id or ""))
                .order_by(desc(ChatModel.id))
                .limit(limit)
            )
            last = q.scalars().all()
            last = list(reversed(last))
            for msg in last:
                messages.append({"role": "user", "content": msg.user_query})
                messages.append({"role": "assistant", "content": msg.ai_message or ""})
        except Exception:
            pass

        messages.append({"role": "user", "content": user_query})
    # DB session closed here

    # 4) Call LLM with structured output to detect intent (including image generation)
    logger.info("process_voice_chat: calling LLM with structured output schema")
    try:
        llm_output = await generate_structured_llm_response(
            messages, schema=SCHEMA_CHAT
        )
        logger.info(f"process_voice_chat: LLM output: {llm_output}")

        # Extract chat response and image intent
        chat_response_text, is_image_request = _parse_chat_response(llm_output)
        logger.info(
            f"process_voice_chat: chat_output='{chat_response_text[:100] if chat_response_text else None}' "
            f"is_image_request={is_image_request}"
        )
    except Exception as e:
        logger.exception(f"process_voice_chat: LLM call failed: {e}")
        # Fallback to simple response
        chat_response_text = "Sorry, I didn't catch that. Could you say it again?"
        is_image_request = False

    # If chat produced no text, provide a friendly fallback reply so TTS has non-empty text
    if not chat_response_text or not str(chat_response_text).strip():
        logger.warning(
            "process_voice_chat: chat produced empty response; using fallback assistant text for TTS"
        )
        chat_response_text = "Sorry, I didn't catch that. Could you say it again?"

    # 5) Image generation is handled asynchronously by the API layer.
    image_s3_key = None
    image_presigned_url = None
    wants_image = bool(is_image_request and character)

    # 6) Synthesize voice (TTS)
    # Ensure we have a valid voice id
    if not voice_id or not str(voice_id).isalnum() or len(str(voice_id)) < 10:
        logger.warning(
            "process_voice_chat: invalid or missing voice_id=%s, assigning gender-based default",
            voice_id
        )
        # Selection of high-quality ElevenLabs default voices (verified real voice IDs)
        GENDER_VOICE_MAP = {
            "female": "EXAVITQu4vr4xnSDxMaL",  # Sarah - Mature, Reassuring, Confident
            "male": "IKne3meq5aSn9XLyUdCD",    # Charlie - Deep, Confident, Energetic
            "trans": "Xb7hH8MSUJpSbSDYk0k2"   # Alice - Clear, Engaging Educator
        }
        g_low = (gender or "female").lower().strip()
        # Match exact gender (avoid "male" matching "female")
        if g_low == "female" or "woman" in g_low or "girl" in g_low:
            voice_id = GENDER_VOICE_MAP["female"]
        elif g_low == "male" or "man" in g_low or "boy" in g_low:
            voice_id = GENDER_VOICE_MAP["male"]
        elif "trans" in g_low or "non-binary" in g_low or "nonbinary" in g_low:
            voice_id = GENDER_VOICE_MAP["trans"]
        else:
            # Default to female if uncertain
            voice_id = GENDER_VOICE_MAP["female"]
        
        logger.info(f"process_voice_chat: using default voice_id={voice_id} for gender={gender}")

    # synthesize voice clone (only call if we have non-empty assistant text)
    mp3_bytes = await synthesize_voice_clone(chat_response_text, voice_id, api_username, gender=gender or "female")
    logger.info(
        "process_voice_chat: synthesized mp3_bytes present=%s size=%s",
        bool(mp3_bytes),
        len(mp3_bytes) if mp3_bytes else 0,
    )

    if mp3_bytes is None:
        logger.error("process_voice_chat: TTS failed or returned no audio")
        raise HTTPException(status_code=502, detail="tts_failed")

    # 7) Store output mp3 to S3
    output_s3_url = None
    output_s3_key = None
    try:
        if mp3_bytes:
            bucket = await get_config_value_from_cache("AWS_BUCKET_NAME")
            # create a filename
            import uuid
            import datetime as dt_module

            output_name = str(uuid.uuid4())
            folder_date = dt_module.date.today().isoformat()
            user_id = str(getattr(user, "id", "anon"))
            # Store to S3 and extract the key from the returned URL
            direct_url = await store_voice_to_s3(
                "voice",
                output_name,
                mp3_bytes,
                user_id,
                folder_date,
                "output",
                bucket,
            )
            # Extract S3 key from URL
            if direct_url:
                output_s3_key = (
                    direct_url.split(".amazonaws.com/", 1)[-1]
                    if ".amazonaws.com/" in direct_url
                    else None
                )
                if output_s3_key:
                    # Generate pre-signed URL for secure access
                    output_s3_url = await generate_presigned_url(
                        output_s3_key, expires_in=7200
                    )
            
            # Update AI generation log with success (voice + image if generated)
            if 'log_entry' in locals() and log_entry:
                try:
                    generated_keys = []
                    if output_s3_key:
                        generated_keys.append(output_s3_key)
                    if 'image_s3_key' in locals() and image_s3_key:
                        generated_keys.append(image_s3_key)
                    
                    if generated_keys:
                        async with AsyncSessionLocal() as db_log:
                            await update_ai_generation_log_success(
                                db=db_log,
                                log_id=log_entry.id,
                                generated_s3_keys=generated_keys,
                                generated_content_urls=[output_s3_url, image_presigned_url] if 'image_presigned_url' in locals() and image_presigned_url else [output_s3_url],
                                face_swap_applied='original_character_base64' in locals() and bool(original_character_base64),
                            )
                            await db_log.commit()
                except Exception as log_err:
                    logger.warning(f"Failed to update AI generation log: {log_err}")
    except Exception:
        logger.exception("process_voice_chat: failed to store output mp3 to S3")
    else:
        logger.info("process_voice_chat: output_s3_url=%s", output_s3_url)

    # 8) Create JSON structure for s3_url_media
    # Store S3 KEYS (not pre-signed URLs) so we can re-generate fresh URLs when loading chat history
    # For voice messages with images, store both voice keys and image key
    media_keys = None
    if input_s3_key or output_s3_key or image_s3_key:
        media_keys = {
            "input_key": input_s3_key,
            "output_key": output_s3_key,
        }
        if image_s3_key:
            media_keys["image_key"] = image_s3_key

    # 9) Persist ChatMessage - open new DB session
    message_id = None
    async with AsyncSessionLocal() as db:
        try:
            # Determine media type based on what was generated
            media_type = None
            if image_s3_key and (input_s3_key or output_s3_key):
                media_type = "voice_with_image"
            elif image_s3_key:
                media_type = "chat_image"
            elif input_s3_key or output_s3_key:
                media_type = "voice"

            cm = ChatMessage(
                session_id=session_id
                or f"session-{int(asyncio.get_event_loop().time())}",
                user_id=str(getattr(user, "id", "")),
                character_id=str(character_id) if character_id is not None else None,
                user_query=user_query,
                ai_message=chat_response_text or "",
                debug_ai_message=chat_response_text or None,
                transcription=transcript,  # Store STT transcription
                is_media_available=bool(media_keys),
                media_type=media_type,
                s3_url_media=media_keys,  # Store S3 keys, not pre-signed URLs
            )
            logger.info(
                "process_voice_chat: saving ChatMessage (user=%s session=%s) transcription=%s ai_response=%s media=%s",
                getattr(user, "id", ""),
                session_id,
                repr(transcript[:100] if transcript else None),
                repr(chat_response_text[:100] if chat_response_text else None),
                media_keys,
            )
            db.add(cm)
            await db.commit()
            message_id = getattr(cm, "id", None)
            logger.info(
                "process_voice_chat: saved ChatMessage id=%s with transcription=%s ai_message=%s image=%s",
                getattr(cm, "id", None),
                bool(transcript),
                bool(chat_response_text),
                bool(image_s3_key),
            )
        except Exception:
            logger.exception("process_voice_chat: failed to persist ChatMessage")

    # Structured summary log for observability
    try:
        logger.info(
            "voice-turn: session=%s user=%s char=%s has_transcript=%s input_len=%s output_len=%s has_image=%s",
            session_id,
            getattr(user, "id", None),
            character_id,
            bool(transcript),
            len(audio_bytes) if audio_bytes else 0,
            len(mp3_bytes) if mp3_bytes else 0,
            bool(image_s3_key),
        )
    except Exception:
        # non-fatal logging failure
        logger.exception("process_voice_chat: failed while logging summary")

    # Return voice URLs and image URL for frontend rendering
    result = {
        "input_url": input_s3_url,
        "output_url": output_s3_url,
        "transcript": transcript,
    }
    if image_presigned_url:
        result["image_url"] = image_presigned_url
    else:
        result["image_url"] = None

    image_request = {
        "wants_image": wants_image,
        "message_id": message_id,
        "user_query": user_query,
        "chat_response_text": chat_response_text,
        "transcript": transcript,
        "character_id": str(character_id) if character_id is not None else None,
    }

    return result, image_request


async def generate_voice_chat_image(
    *,
    job_id: str,
    user_id: str,
    character_id: str,
    message_id: str,
    user_query: str,
    chat_response_text: str,
    transcript: Optional[str],
    user_role: str,
) -> None:
    """Background task to generate a voice chat image and update job status."""
    logger = logging.getLogger(__name__)
    await image_job_store.update_job(job_id, status=ImageJobStatus.generating)

    try:
        from sqlalchemy import select

        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Character).where(Character.id == str(character_id))
            )
            character = result.scalar_one_or_none()

        if not character:
            await image_job_store.update_job(
                job_id, status=ImageJobStatus.failed, error="character_not_found"
            )
            return

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

        guardrail_details_image = await get_config_value_from_cache(
            "IMAGE_GEN_GUARDRAIL"
        ) or ""
        
        # AetherLab Prompt Guard (disabled)
        # is_compliant, reason = await AetherLabService.validate_prompt(user_prompt=user_query)
        # if not is_compliant:
        #     await image_job_store.update_job(
        #         job_id,
        #         status=ImageJobStatus.failed,
        #         error="image_prompt_aetherlab_blocked",
        #     )
        #     return

        character_style = character.style or "realistic"
        if character_style.lower() == "realistic":
            ai_model = "xl_pornai"
        elif character_style.lower() == "anime":
            ai_model = "xl_anime"
        else:
            ai_model = "xl_pornai"

        # Build context for extraction
        chat_messages = []
        # Use transcript if available as it is the rigorous input
        actual_input = transcript if transcript else user_query
        chat_messages.append({"role": "user", "content": actual_input})
        if chat_response_text:
             chat_messages.append({"role": "assistant", "content": chat_response_text})

        base_character_prompt = character.prompt_enhanced or ""
        
        prompt_enhanced_str, model_workflow_mode = await generate_character_to_image_in_chat_prompt(
            base_prompt=base_character_prompt,
            chat_messages=chat_messages,
            user_query=actual_input,
            chat_response=chat_response_text
        )
        
        clothing = "extracted_from_chat_context"
        settings = "extracted_from_chat_context"

        if not prompt_enhanced_str:
            prompt_enhanced_str = base_character_prompt + ", " + user_query

        log_entry = None
        async with AsyncSessionLocal() as db_log:
            log_entry = await create_ai_generation_log(
                db=db_log,
                user_id=user_id,
                character_id=character_id,
                generation_type="voice",
                prompt_text=user_query,
                prompt_metadata={
                    "transcript": transcript,
                    "image_prompt": prompt_enhanced_str,
                    "clothing": clothing,
                    "settings": settings,
                    "ai_response": chat_response_text,
                    "mode": model_workflow_mode
                },
                ai_model=ai_model,
                num_generations=1,
                size_orientation="portrait",
                source_context="voice_chat",
                is_compliant=True,
            )
            await db_log.commit()
            await db_log.refresh(log_entry)

        # from app.services.character_media import generate_image (Removed, using generate_text_to_image)

        try:
             # Pre-fetch source for face reference if using PRO mode
             presigned_src = await generate_presigned_url(character.image_url_s3)
             
             # Generate negative prompt based on user query
             from app.services.character_media import generate_negative_prompt
             negative_prompt = await generate_negative_prompt(user_query, context="chat")

             job_id_gen = await generate_text_to_image(
                prompt=prompt_enhanced_str,
                width=768,
                height=1024,
                face_reference=presigned_src,
                model_workflow_name=model_workflow_mode,
                character_style=character_style,
                negative_prompt=negative_prompt
             )
             
             if not job_id_gen:
                  raise Exception("Failed to get job_id from generate_text_to_image")
             
             # Poll for completion
             image_url = await get_job(job_id_gen)
             if not image_url:
                  raise Exception("Job finished but returned no image URL")
                  
             # Download the image to get bytes/base64 for subsequent processing
             async with httpx.AsyncClient(timeout=60) as client:
                r = await client.get(image_url)
                if r.status_code != 200:
                     raise Exception(f"Failed to download generated image: {r.status_code}")
                image_bytes = r.content
                
             generated_image_base64 = base64.b64encode(image_bytes).decode("utf-8")

        except Exception as e:
            logger.exception(f"Image generation failed: {e}")
            if log_entry:
                async with AsyncSessionLocal() as db_log:
                    await update_ai_generation_log_failure(
                        db=db_log,
                        log_id=log_entry.id,
                        error_message=str(e),
                    )
                    await db_log.commit()
            await image_job_store.update_job(
                job_id,
                status=ImageJobStatus.failed,
                error=f"image_generation_failed:{str(e)}",
            )
            return

        # Continuing with existing logic (base64 data handling)
        # We derived generated_image_base64, so we can link back to existing flow.
        
        # Original code had:
        # if isinstance(base64_data, bytes): ...
        # Since we just encoded it, we know it is str.
        
        # Face swap is now handled directly by generate_text_to_image
        final_image_base64 = generated_image_base64

        img_bytes = await asyncio.to_thread(base64.b64decode, final_image_base64)
        image_file = BytesIO(img_bytes)

        filename = await generate_filename_timestamped(
            f"{character.name}_voice_chat"
        )
        output_format = "jpeg"
        s3_key = (
            f"chat_image/{user_role.lower()}/{user_id}/{filename}.{output_format}"
        )

        bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
        image_s3_key, image_presigned_url = await upload_to_s3_file(
            file_obj=image_file,
            s3_key=s3_key,
            content_type="image/jpeg",
            bucket_name=bucket_name,
        )
        if image_s3_key and not image_presigned_url:
            try:
                image_presigned_url = await generate_presigned_url(image_s3_key)
            except Exception:
                image_presigned_url = None

        if log_entry:
            async with AsyncSessionLocal() as db_log:
                await update_ai_generation_log_success(
                    db=db_log,
                    log_id=log_entry.id,
                    generated_s3_keys=[image_s3_key],
                    generated_content_urls=[image_presigned_url],
                    face_swap_applied=True,
                    face_swap_source_s3_key=character.image_url_s3,
                )
                await db_log.commit()

        async with AsyncSessionLocal() as db:
            db_character_media = CharacterMedia(
                user_id=user_id,
                character_id=character.id if character else None,
                media_type="chat_image",
                s3_path=image_s3_key,
            )
            db.add(db_character_media)

            message = None
            msg_res = await db.execute(
                select(ChatMessage).where(ChatMessage.id == message_id)
            )
            message = msg_res.scalar_one_or_none()
            if message:
                media_obj = message.s3_url_media
                if isinstance(media_obj, str):
                    try:
                        media_obj = json.loads(media_obj)
                    except Exception:
                        media_obj = {"image_key": image_s3_key}
                if not isinstance(media_obj, dict):
                    media_obj = {}
                media_obj["image_key"] = image_s3_key
                message.s3_url_media = media_obj
                if media_obj.get("input_key") or media_obj.get("output_key"):
                    message.media_type = "voice_with_image"
                else:
                    message.media_type = "chat_image"
                message.is_media_available = True
                db.add(message)

            await db.commit()

        await image_job_store.update_job(
            job_id,
            status=ImageJobStatus.completed,
            image_s3_key=image_s3_key,
            image_url=image_presigned_url,
        )
    except Exception as exc:
        logger.exception("generate_voice_chat_image: failed")
        await image_job_store.update_job(
            job_id, status=ImageJobStatus.failed, error=str(exc)
        )
