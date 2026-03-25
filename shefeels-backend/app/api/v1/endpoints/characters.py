"""
Character endpoints for AI Friend Chatbot.
"""

import json
import asyncio
import time
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status, BackgroundTasks
import os
import re
from fastapi.responses import JSONResponse
from sqlalchemy import select, delete, insert, func, Integer, cast, or_
from app.schemas.character import (
    CharacterCreate,
    CharacterRead,
    CharacterIdIn,
    CharacterEdit,
)
from app.services.aetherlab_service import AetherLabService
from app.api.v1.deps import get_current_user
from app.core.database import get_db
from app.models.character import Character, CharacterStats
from app.models.chat import ChatMessage
from app.models.user import User, RoleEnum
from app.models.subscription import CoinTransaction
from app.models.usage_metrics import UsageMetrics
from app.core.config import settings
from app.core.aws_s3 import upload_to_s3_file, get_file_from_s3_url
from app.core.aws_s3 import generate_presigned_url, generate_public_s3_url, delete_s3_object, convert_and_upload_webp, get_s3_client
from app.services.character_media import (
    generate_text_to_image,
    get_job,
    generate_filename_timestamped,
    generate_character_prompt
)
from app.core.aws_s3 import generate_presigned_url
from app.services.app_config import get_config_value_from_cache
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Union
import base64
from io import BytesIO
import datetime
import logging
from app.services.subscription import check_user_wallet, deduhl_user_coins
from app.models.character_media import CharacterMedia
from app.services.voice_generation import (
    generate_voice_prompt_from_character_data,
    create_elevenlabs_voice,
)
from app.services.ai_generation_logging import (
    create_ai_generation_log,
    update_ai_generation_log_success,
    update_ai_generation_log_failure,
)
from app.services.chat import generate_structured_llm_response
from app.services.schema import (
    SCHEMA_CHARACTER_CREATION_SDXL,
    SCHEMA_CHARACTER_CREATION_IMAGE_ONLY,
    SCHEMA_CHARACTER_CREATION_METADATA_ONLY,
    SCHEMA_PROMPT_GENERATION
)
import requests
import httpx
from app.services.redis_cache import del_cached
from app.core import database as core_database

router = APIRouter()


async def finalize_character_background(
    character_id: str,
    user_input_text: str,
    image_s3_key: str,
    bucket_name: str,
    clean_username: str,
    prompt_enhanced_str: str,
    character_data: dict
):
    """
    Consolidated background task for non-blocking generation of:
    1. Metadata (Bio, Video Prompt, Personality) via LLM
    2. Voice Generation (Description + ElevenLabs)
    3. Video Generation (MP4)
    4. WebP Conversion
    """
    logger = logging.getLogger(__name__)
    logger.info(f"[BG-FINALIZE] Starting finalization for {character_id}")

    # 1. Metadata Generation (LLM Call 2) - Only if not already provided or if placeholder
    bio = character_data.get("bio")
    looking_for = character_data.get("looking_for")
    personality = character_data.get("personality_sliders") # Using the structured sliders if provided
    character_name = character_data.get("name")
    video_prompt = None

    is_placeholder_bio = bio and ("placeholder" in bio.lower() or "no public bio" in bio.lower())
    
    if not (bio and looking_for and character_name and character_name != "unnamed") or is_placeholder_bio:
        logger.info(f"[BG-FINALIZE] Metadata missing or placeholder bio detected, triggering LLM generation for {character_id}")
        system_prompt_metadata = f"""You are an expert storyteller and video prompt engineer.
Your goal is to create a rich bio and a highly specific video prompt for a character.

You MUST return output that conforms EXACTLY to the provided JSON schema.

CRITICAL RULES FOR VIDEO PROMPT (video_prompt):
1. **Length**: 50-60 words.
2. **Content**: A cinematic, slow-motion shot focusing on the character's face. Describe a captivating gaze, a gentle, natural smile, and subtle, elegant movements.
3. **Avoid Distortions**: Keep hand and body interactions simple. Focus on the character's aura.
4. **Style**: Cinematic, high quality, photorealistic.

CRITICAL RULES FOR BIO (bio):
1. **Length**: 50-60 words.
2. **Content**: Captivating summary of the character's life and allure. Use first-person or engaging third-person.

CRITICAL RULES FOR "YOU'RE LOOKING FOR" (looking_for):
1. **Length**: 3-6 words.
2. **Content**: A short, intriguing phrase about what a user might find in this character.
3. **Examples**: "A safe, non-judgemental space", "Thrilling late-night adventures", "Intellectual depth and wit".
"""
        messages_metadata = [
            {"role": "system", "content": system_prompt_metadata},
            {"role": "user", "content": user_input_text},
        ]

        try:
            llm_response_metadata = await generate_structured_llm_response(
                messages_metadata, SCHEMA_CHARACTER_CREATION_METADATA_ONLY
            )

            if llm_response_metadata:
                data = json.loads(llm_response_metadata)
                character_names = data.get("character_names", [])
                if character_names and len(character_names) > 0 and (not character_name or character_name == "unnamed"):
                    character_name = character_names[0]
                bio = data.get("bio")
                video_prompt = data.get("video_prompt")
                personality = data.get("personality")
                looking_for = data.get("looking_for")
                logger.info(f"[BG-FINALIZE] LLM generated name: {character_name}")
        except Exception as e:
            logger.error(f"[BG-FINALIZE] Error generating/parsing metadata: {e}")
    else:
        logger.info(f"[BG-FINALIZE] Metadata already present for {character_id}, skipping LLM generation.")
        # Fallback to a simple video prompt if we skip the main LLM call
        video_prompt = f"Cinematic slow-motion shot focusing on the face of {character_name}, captivating gaze, gentle smile, photorealistic, high quality."

    # 2. Update DB with Metadata (including LLM-generated name)
    async_session_maker = getattr(core_database, 'async_session_maker', core_database.AsyncSessionLocal)
    async with async_session_maker() as db:
        result = await db.execute(select(Character).where(Character.id == character_id))
        char = result.scalar_one_or_none()
        if char:
            if bio: char.bio = bio
            if video_prompt: char.video_prompt = video_prompt
            if personality: char.personality = personality
            if looking_for: char.looking_for = looking_for
            # Update name and username if LLM generated a name
            if character_name:
                char.name = character_name
                # Regenerate clean username from LLM name
                import re as _re
                llm_username = character_name.lower().replace(" ", "-")
                llm_username = _re.sub(r"[^a-z0-9-]+", "", llm_username)
                llm_username = _re.sub(r"-+", "-", llm_username).strip("-")
                if llm_username:
                    char.username = f"{llm_username}-{char.user_id}"
            await db.commit()
            logger.info(f"[BG-FINALIZE] Metadata updated for {character_id}")

    # 3. WebP Conversion
    try:
        webp_key = await convert_and_upload_webp(
            png_s3_key=image_s3_key,
            quality=85,
            bucket_name=bucket_name
        )
        if webp_key:
            async with async_session_maker() as db:
                result = await db.execute(select(Character).where(Character.id == character_id))
                char = result.scalar_one_or_none()
                if char:
                    char.webp_image_url_s3 = webp_key
                    await db.commit()
                    logger.info(f"[BG-FINALIZE] WebP saved for {character_id}")
    except Exception as e:
        logger.error(f"[BG-FINALIZE] WebP Error: {e}")

    # 4. Voice Generation
    try:
        voice_desc = await generate_voice_prompt_from_character_data(
            prompt_enhanced=prompt_enhanced_str,
            character_name=character_data.get('name'),
            character_age=character_data.get('age') or 25,
            character_gender=character_data.get('gender'),
            personality=personality or character_data.get('personality') or "friendly",
            voice_type=character_data.get('voice_type') or "Caring",
            bio=bio or character_data.get('bio'),
        )
        if voice_desc:
            new_voice_id = await create_elevenlabs_voice(
                voice_description=voice_desc,
                voice_name=f"{character_data.get('name')}_{clean_username}"[:20],
            )
            if new_voice_id:
                async with async_session_maker() as db:
                    result = await db.execute(select(Character).where(Character.id == character_id))
                    char = result.scalar_one_or_none()
                    if char:
                        char.generated_voice_id = new_voice_id
                        char.voice_prompt = voice_desc
                        await db.commit()
                        logger.info(f"[BG-FINALIZE] Voice updated for {character_id}")
    except Exception as e:
        logger.error(f"[BG-FINALIZE] Voice Error: {e}")

    # 5. Video Generation
    try:
        from app.services.gif_generation import generate_gif_for_character
        final_video_prompt = video_prompt or f"Cinematic slow motion portrait of {character_data.get('name')}"
        mp4_key = await generate_gif_for_character(
            character_id=character_id,
            image_s3_key=image_s3_key,
            bucket_name=bucket_name,
            video_prompt=final_video_prompt
        )
        if mp4_key:
            async with async_session_maker() as db:
                result = await db.execute(select(Character).where(Character.id == character_id))
                char = result.scalar_one_or_none()
                if char:
                    char.gif_url_s3 = mp4_key
                    char.animated_webp_url_s3 = None
                    await db.commit()
                    logger.info(f"[BG-FINALIZE] Video updated for {character_id}")
    except Exception as e:
        logger.error(f"[BG-FINALIZE] Video Error: {e}")

    logger.info(f"[BG-FINALIZE] Finished all tasks for {character_id}")


def _normalize_choice_field(value: str | None) -> str | None:
    """
    Normalize fields that may accidentally contain asset paths or filenames
    (e.g. "../../assets/.../Indian.png"). Return the basename without extension
    and trimmed whitespace. If input is empty/None, return as-is.
    """
    if not value:
        return value
    try:
        # If it looks like a path, extract the basename
        base = os.path.basename(value)
        # Remove extension if present
        name, _ext = os.path.splitext(base)
        name = name.strip()
        # Replace underscores/hyphens with spaces for nicer display
        name = name.replace("_", " ").replace("-", " ").strip()
        return name
    except Exception:
        return value


@router.post("/create")
async def create_character(
    request: Request,
    character: CharacterCreate,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new AI friend character and generate its image."""
    logger = logging.getLogger(__name__)
    await check_user_wallet(db, user.id, "character")
    positive_prompt = await get_config_value_from_cache("IMAGE_POSITIVE_PROMPT")
    negative_prompt = await get_config_value_from_cache("IMAGE_NEGATIVE_PROMPT")
    print("character gender: ", character.gender.lower())
    loras = None
    if character.gender.lower() == "trans":
        print("Inside trans loras :", loras)
        loras = ["59"]
    if character.gender.lower() == "male" and character.style.lower() == "anime":
        framing="Front facing anime male, three quarter body shot, looking at viewer, cinematic portrait, high quality"
    elif character.gender.lower() == "trans" and character.style.lower() == "realistic":
        framing="Front facing Others, three quarter body shot, looking at viewer, cinematic portrait, high quality"
    else:
        framing="Front facing, three quarter body shot, looking at viewer, cinematic portrait, high quality, selfie style, seductive smile, happy expression, inviting, detailed skin, masterpiece, instagram influencer"
        
    
    text_prompt = await generate_character_prompt(
        personality = character.personality,
        clothing = character.clothing,
        background = character.background,
        gender=character.gender,
        ethnicity=character.ethnicity,
        age=character.age,
        hair_colour=character.hair_colour,
        hair_style=character.hair_style,
        body_type=character.body_type,
        breast_size=character.breast_size,
        eye_colour=character.eye_colour,
        style=character.style,
        butt_size=character.butt_size,
        dick_size=character.dick_size,
        special_features=character.special_features,
        hobbies=character.hobbies,
        framing=framing
    )
    prompt_json = text_prompt

    # Use placeholder name if not provided
    char_name = character.name or "unnamed"

    print(f"\n--- [CREATE-CHAR] GENERATED IMAGE PROMPT for {char_name} ---")
    print(text_prompt)
    print("------------------------------------------------------------\n")

    user_input_text = f"""
    Character Name: {char_name}
    Age: {character.age}
    Gender: {character.gender}
    Ethnicity: {character.ethnicity}
    Realism/Style: {character.style}
    Body Type: {character.body_type}
    Breast Size: {character.breast_size}
    Eye Color: {character.eye_colour}
    Hair Style: {character.hair_style}
    Hair Color: {character.hair_colour}
    Clothing: {character.clothing}
    Special Features: {character.special_features}
    Background: {character.background}
    Personality: {character.personality}
    Bio: {character.bio}
    Hobbies: {character.hobbies}
    """

    # Skip LLM enhancement as per strict rule-based requirement (but now using LLM prompt gen which is better)
    prompt_enhanced_str = text_prompt
    final_prompt = text_prompt
    
#     print(f"\n--- [CREATE-CHAR] GENERATED IMAGE PROMPT for {character.name} ---")
#     print(final_prompt)
#     print("------------------------------------------------------------\n")

    
    # AetherLab Prompt Guard
    # is_compliant, reason = await AetherLabService.validate_prompt(final_prompt)
    # if not is_compliant:
    #     if "error" in reason:
    #         raise HTTPException(status_code=503, detail="Content safety check unavailable.")
    #     detail_msg = reason.get('rationale', 'Content Policy Violation')
    #     raise HTTPException(status_code=400, detail=f"Character prompt blocked: {detail_msg}")

    ai_model = "sugarlab"

    # 3. Generate Character Image (Blocking)
    logger.info("[IMAGE GEN] Starting blocking image generation")
    
    # Create AI generation log entry BEFORE generation
    log_entry = await create_ai_generation_log(
        db=db,
        user_id=user.id,
        character_id=None,  # Character not created yet
        generation_type="image",
        prompt_text=final_prompt,
        prompt_metadata={
            "name": character.name,
            "bio": character.bio,
            "hobbies": character.hobbies,
            "gender": character.gender,
            "style": character.style,
            "ethnicity": character.ethnicity,
            "age": character.age,
            "personality": character.personality,
            "clothing": character.clothing,
            "background": character.background,
        },
        ai_model=ai_model,
        num_generations=1,
        size_orientation="portrait",
        source_context="character_creation",
        is_compliant=True
    )

    try:
        # Async generation flow
        # Character creation always uses single character negative prompt
        character_creation_negative_prompt = "text, watermark, signature, username, artist name, character name, copyright, logo, title, subtitle, speech bubble, dialogue, caption, label, stamp, writing, letters, words, kanji, hiragana, katakana, multiple people, two girls, double character, duplicate, extra person, crowd, group, bad anatomy, bad hands, missing fingers, extra fingers, poorly drawn face, deformed, ugly, blurry, low quality, worst quality"
        
        jid = await generate_text_to_image(
            prompt=final_prompt,
            character_style=character.style or "realistic",
            negative_prompt=character_creation_negative_prompt,
            loras = loras
        )
        p_url = await get_job(jid)
        
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.get(p_url)
            
        if r.status_code != 200:
             raise HTTPException(status_code=500, detail=f"Failed to download generated image: {r.status_code}")
             
        image_data_bs4 = r.content
        
        # Convert to base64 for moderation (mimicking previous flow)
        base64_data = base64.b64encode(image_data_bs4).decode('utf-8')
        
        # Convert to WebP
        from app.core.aws_s3 import convert_image_to_webp
        image_file = convert_image_to_webp(BytesIO(image_data_bs4))
        
        # AetherLab Media Guard
        # is_media_compliant, media_reason = await AetherLabService.validate_media(
        #     image_input=base64_data,
        #     input_type="base64"
        # )
        # if not is_media_compliant:
        #     print(f"AetherLab Media Guard Blocked (Character Creation): {media_reason}")
            
        #     if "error" in media_reason:
        #          print(f"AetherLab Service Error: {media_reason.get('error')}")
        #          raise HTTPException(status_code=503, detail="Content safety check unavailable. Please try again later.")

        #     if log_entry:
        #         await update_ai_generation_log_failure(
        #             db=db,
        #             log_id=log_entry.id,
        #             error_message="Content Policy Violation (Media Guard)"
        #         )
        #     raise HTTPException(status_code=400, detail="Generated character image violated content policy")
            
    except Exception as e:
        logger.error(f"[IMAGE GEN] Error: {e}")
        if log_entry:
            await update_ai_generation_log_failure(
                db=db,
                log_id=log_entry.id,
                error_message=f"Image generation failed: {str(e)}"
            )
        raise HTTPException(status_code=500, detail=f"Image generation failed: {str(e)}")

    # Handle voice prompt result (moved to background)
    # if isinstance(voice_description, Exception):
    #     logger.warning(
    #         f"[PARALLEL] Voice prompt generation failed: {voice_description}"
    #     )
    #     voice_description = None
    # else:
    #     logger.info(
    #         f"[VOICE GEN] Generated voice description for {character.name}: {voice_description[:100] if voice_description else 'None'}..."
    #     )

    file_extension = "webp" # Changed from png
    file_type = "character_image"
    # 4. Save image to S3 storage
    user_role = (user.role if user else "USER").lower()
    user_id = str(user.id)
    filename = await generate_filename_timestamped(char_name)
    s3_key = f"{file_type}/{user_role}/{user_id}/{filename}.{file_extension}"
    bucket_name = await get_config_value_from_cache("AWS_BUCKET_NAME")
    s3_key, presigned_s3_url = await upload_to_s3_file(
        file_obj=image_file,
        s3_key=s3_key,
        content_type="image/webp",
        bucket_name=bucket_name,
    )
    
    # Update log entry with successful generation
    if log_entry:
        await update_ai_generation_log_success(
            db=db,
            log_id=log_entry.id,
            generated_s3_keys=[s3_key],
            generated_content_urls=[presigned_s3_url],
            face_swap_applied=False,
        )

    # Generate clean username for chat URLs (not timestamped)
    clean_username = char_name.lower().replace(" ", "-")
    clean_username = re.sub(r"[^a-z0-9-]+", "", clean_username)
    clean_username = re.sub(r"-+", "-", clean_username).strip("-")

    # Ensure username is not empty and add user ID for uniqueness
    if not clean_username:
        clean_username = f"character-{user.id}"
    else:
        clean_username = f"{clean_username}-{user.id}"

    # 5. Save character to DB with initial data
    import random
    GENDER_VOICE_MAP = {
        "female": ["EXAVITQu4vr4xnSDxMaL", "FGY2WhTYpPnrIDTdsKH5", "cgSgspJ2msm6clMCkdW9"],
        "male": ["IKne3meq5aSn9XLyUdCD", "JBFqnCBsd6RMkjVDRZzb", "TX3LPaxmHKxFdv7VOQHJ"],
        "trans": ["Xb7hH8MSUJpSbSDYk0k2", "SAz9YHcvj6GT2YYXdXww", "EXAVITQu4vr4xnSDxMaL"]
    }
    g_low = (character.gender or "female").lower().strip()
    if g_low == "female" or "woman" in g_low or "girl" in g_low:
        voice_list = GENDER_VOICE_MAP["female"]
    elif g_low == "male" or "man" in g_low or "boy" in g_low:
        voice_list = GENDER_VOICE_MAP["male"]
    elif "trans" in g_low or "non-binary" in g_low or "nonbinary" in g_low:
        voice_list = GENDER_VOICE_MAP["trans"]
    else:
        voice_list = GENDER_VOICE_MAP["female"]
    
    generated_voice_id = random.choice(voice_list)

    db_character = Character(
        username=clean_username,
        bio=character.bio,
        hobbies=character.hobbies,
        user_id=user.id,
        name=char_name,
        gender=character.gender,
        age=character.age,
        ethnicity=_normalize_choice_field(character.ethnicity),
        style=character.style,
        body_type=character.body_type,
        hair_colour=character.hair_colour,
        hair_style=character.hair_style,
        clothing=character.clothing,
        eye_colour=character.eye_colour,
        breast_size=character.breast_size,
        butt_size=character.butt_size,
        dick_size=character.dick_size,
        personality=character.personality,
        voice_type=character.voice_type,
        relationship_type=character.relationship_type,
        special_features=_normalize_choice_field(character.special_features),
        prompt=prompt_json,
        prompt_enhanced=prompt_enhanced_str,
        generated_voice_id=generated_voice_id,
        image_url_s3=s3_key,
        privacy=character.privacy,
        looking_for=character.looking_for,
        onlyfans_url=character.onlyfans_url,
        fanvue_url=character.fanvue_url,
        tiktok_url=character.tiktok_url,
        instagram_url=character.instagram_url,
    )

    db.add(db_character)
    await db.commit()
    await db.refresh(db_character)
    
    await deduhl_user_coins(request, db, user.id, db_character.id, "character")

    try:
        await del_cached(f"characters:fetch-loggedin:{user.id}")
        await del_cached("characters:fetch-default")
    except Exception:
        pass

    # Pass character metadata as a dict for the background task
    char_data_dict = {
        "name": char_name,
        "bio": character.bio, # Pass existing bio if any
        "looking_for": character.looking_for, # Pass existing trait if any
        "age": character.age,
        "gender": character.gender,
        "personality": character.personality, # This is the full prompt string
        "personality_sliders": character.personality, # Fallback
        "ethnicity": character.ethnicity,
        "style": character.style,
        "clothing": character.clothing,
        "background": character.background,
        "special_features": character.special_features,
        "voice_type": character.voice_type,
        "bio": character.bio
    }

    # Consolidated Background Task (Bio, Video, Voice, WebP)
    background_tasks.add_task(
        finalize_character_background,
        character_id=str(db_character.id),
        user_input_text=user_input_text,
        image_s3_key=s3_key,
        bucket_name=bucket_name,
        clean_username=clean_username,
        prompt_enhanced_str=prompt_enhanced_str,
        character_data=char_data_dict
    )
    
    return JSONResponse(
        content={
            "message": "Character created successfully. Media and metadata are being generated in the background.",
            "image_path": presigned_s3_url,
            "id": str(db_character.id),
            "name": db_character.name,
            "username": db_character.username,
            "sdxl_prompt": final_prompt,
            "background_processing": True
        },
        status_code=status.HTTP_201_CREATED,
    )


@router.post("/edit-by-id")
async def edit_character(
    character: CharacterEdit,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Edit an existing character by its ID."""

    is_admin = user.role.lower() in ["admin", "super_admin"]
    
    if is_admin:
        result = await db.execute(
            select(Character).where(Character.id == character.character_id)
        )
    else:
        result = await db.execute(
            select(Character).where(
                Character.id == character.character_id, Character.user_id == user.id
            )
        )
    
    db_character = result.scalars().first()
    if not db_character:
        raise HTTPException(status_code=404, detail="Character not found")

    # Update fields only if they are provided in the request
    if character.name is not None:
        db_character.name = character.name
    if character.username is not None:
        db_character.username = character.username
    if character.bio is not None:
        db_character.bio = character.bio
    if character.gender is not None:
        db_character.gender = character.gender
    if character.style is not None:
        db_character.style = character.style
    if character.ethnicity is not None:
        db_character.ethnicity = character.ethnicity
    if character.age is not None:
        db_character.age = character.age
    if character.eye_colour is not None:
        db_character.eye_colour = character.eye_colour
    if character.hair_style is not None:
        db_character.hair_style = character.hair_style
    if character.hair_colour is not None:
        db_character.hair_colour = character.hair_colour
    if character.body_type is not None:
        db_character.body_type = character.body_type
    if character.breast_size is not None:
        db_character.breast_size = character.breast_size
    if character.butt_size is not None:
        db_character.butt_size = character.butt_size
    if character.dick_size is not None:
        db_character.dick_size = character.dick_size
    if character.personality is not None:
        db_character.personality = character.personality
    if character.voice_type is not None:
        db_character.voice_type = character.voice_type
    if character.relationship_type is not None:
        db_character.relationship_type = character.relationship_type
    if character.clothing is not None:
        db_character.clothing = character.clothing
    if character.special_features is not None:
        db_character.special_features = character.special_features
    if character.background is not None:
        db_character.background = character.background
    if character.privacy is not None:
        db_character.privacy = character.privacy
    if character.onlyfans_url is not None:
        db_character.onlyfans_url = character.onlyfans_url
    if character.fanvue_url is not None:
        db_character.fanvue_url = character.fanvue_url
    if character.tiktok_url is not None:
        db_character.tiktok_url = character.tiktok_url
    if character.instagram_url is not None:
        db_character.instagram_url = character.instagram_url

    await db.commit()
    await db.refresh(db_character)
    # Invalidate cached default characters in case admin edited a default
    try:
        await del_cached(f"characters:fetch-loggedin:{db_character.user_id}")
        await del_cached("characters:fetch-default")
    except Exception:
        pass
    return JSONResponse(
        content={"message": "Character updated successfully"}, status_code=200
    )


@router.post("/fetch-loggedin-user", response_model=List[CharacterRead])
async def list_characters(
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """List all characters for the logged-in user."""
    cache_key = f"characters:fetch-loggedin:{user.id}"
    
    from app.services.redis_cache import get_cached, set_cached
    cached_data = await get_cached(cache_key)
    if cached_data:
        try:
            return json.loads(cached_data)
        except Exception:
            pass

    result = await db.execute(
        select(Character)
        .where(Character.user_id == user.id)
        .order_by(Character.created_at.desc())
    )
    characters = result.scalars().all()

    # Parallelize presigned URL generation for all characters (image, webp_image, gif, animated_webp)
    char_dicts = [CharacterRead.model_validate(c).model_dump() for c in characters]
    
    # Get all S3 keys (keep both PNG and WebP separate)
    image_keys = [cd.get("image_url_s3") for cd in char_dicts]  # PNG
    webp_image_keys = [cd.get("webp_image_url_s3") for cd in char_dicts]  # static WebP
    gif_keys = [cd.get("gif_url_s3") for cd in char_dicts]
    animated_webp_keys = [cd.get("animated_webp_url_s3") for cd in char_dicts]

    # Generate all presigned URLs in parallel per field
    # If the stored value already looks like a full URL (starts with http),
    # do not attempt to presign it again — just pass it through.
    # For gif/animated webp, use public URLs since they have public-read ACL
    
    # Optimization: Re-use S3 client and bucket name for bulk signing
    s3_c = await get_s3_client()
    bucket_nm = await get_config_value_from_cache("AWS_BUCKET_NAME")

    presigned_images = []
    presigned_webp_images = []
    presigned_gifs = []
    presigned_animated_webps = []
    
    # Iterate and decide between presigned or public URL
    # We'll build lists of coroutines or immediate values
    
    for cd in char_dicts:
        is_public = cd.get("privacy") == "public"
        
        # Image (PNG)
        if cd.get("image_url_s3"):
            if is_public:
                presigned_images.append(generate_public_s3_url(cd.get("image_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("image_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_images.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_images.append(asyncio.sleep(0, result=k))
        else:
            presigned_images.append(asyncio.sleep(0, result=None))

        # WebP Image
        if cd.get("webp_image_url_s3"):
            if is_public:
                 presigned_webp_images.append(generate_public_s3_url(cd.get("webp_image_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("webp_image_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_webp_images.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_webp_images.append(asyncio.sleep(0, result=k))
        else:
            presigned_webp_images.append(asyncio.sleep(0, result=None))

        # GIF
        if cd.get("gif_url_s3"):
            # GIFs are usually public anyway, but let's be consistent
            if is_public:
                 presigned_gifs.append(generate_public_s3_url(cd.get("gif_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("gif_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_gifs.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_gifs.append(asyncio.sleep(0, result=k))
        else:
            presigned_gifs.append(asyncio.sleep(0, result=None))
            
        # Animated WebP
        if cd.get("animated_webp_url_s3"):
            if is_public:
                 presigned_animated_webps.append(generate_public_s3_url(cd.get("animated_webp_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("animated_webp_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_animated_webps.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_animated_webps.append(asyncio.sleep(0, result=k))
        else:
            presigned_animated_webps.append(asyncio.sleep(0, result=None))

    presigned_images = await asyncio.gather(*presigned_images)
    presigned_webp_images = await asyncio.gather(*presigned_webp_images)
    presigned_gifs = await asyncio.gather(*presigned_gifs)
    presigned_animated_webps = await asyncio.gather(*presigned_animated_webps)

    # Update character dicts with presigned URLs
    updated_characters = []
    for char_dict, p_img, p_webp_img, p_gif, p_anim_webp in zip(char_dicts, presigned_images, presigned_webp_images, presigned_gifs, presigned_animated_webps):
        if p_img:
            char_dict["image_url_s3"] = p_img
        if p_webp_img:
            char_dict["webp_image_url_s3"] = p_webp_img
        if p_gif:
            char_dict["gif_url_s3"] = p_gif
        if p_anim_webp:
            char_dict["animated_webp_url_s3"] = p_anim_webp
            
        # Helper to ensure dates are serializable
        if "created_at" in char_dict and isinstance(char_dict["created_at"], datetime.datetime):
             char_dict["created_at"] = char_dict["created_at"].isoformat()
        if "updated_at" in char_dict and isinstance(char_dict["updated_at"], datetime.datetime):
             char_dict["updated_at"] = char_dict["updated_at"].isoformat()
             
        updated_characters.append(char_dict)
        
    try:
        await set_cached(cache_key, json.dumps(updated_characters), ttl=3600)
    except Exception as e:
        print(f"Failed to cache fetch-loggedin-user: {e}")
        
    return updated_characters


@router.get("/fetch-default")
async def list_characters(
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1, description="Page number"),
    per_page: int = Query(default=20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(
        default=None,
        description="Filter default characters by name or bio (case-insensitive partial match)",
    ),
    style: str | None = Query(default=None, description="Filter by style (realistic, anime)"),
    gender: str | None = Query(default=None, description="Filter by gender (male, female, trans)"),
):
    """List all default characters created by admin with pagination and filters (accessible without authentication)."""
    
    # Check cache first
    # Create a unique cache key based on all parameters
    cache_key = f"characters:fetch-default:{page}:{per_page}:{search or 'none'}:{style or 'none'}:{gender or 'none'}"
    
    from app.services.redis_cache import get_cached, set_cached

    def _is_absolute_media_url(value: str | None) -> bool:
        if not value:
            return True
        if not isinstance(value, str):
            return False
        return value.startswith("http://") or value.startswith("https://") or value.startswith("data:") or value.startswith("blob:")

    def _is_expired_presigned_url(value: str | None) -> bool:
        if not value or not isinstance(value, str):
            return False
        if "X-Amz-Date=" not in value:
            return False
        try:
            from urllib.parse import urlparse, parse_qs

            qs = parse_qs(urlparse(value).query)
            amz_date = (qs.get("X-Amz-Date") or [None])[0]
            amz_expires = (qs.get("X-Amz-Expires") or [None])[0]

            if amz_date and amz_expires and len(amz_date) == 16 and amz_date.endswith("Z"):
                signed_at = datetime.datetime.strptime(amz_date, "%Y%m%dT%H%M%SZ").replace(tzinfo=datetime.timezone.utc)
                expires_at = signed_at.timestamp() + int(amz_expires)
                return time.time() >= expires_at

            # Some S3-compatible providers expose unix epoch via `Expires`.
            epoch_expires = (qs.get("Expires") or [None])[0]
            if epoch_expires and str(epoch_expires).isdigit():
                return time.time() >= int(epoch_expires)
        except Exception:
            return False
        return False

    def _is_cached_payload_valid(payload: dict) -> bool:
        if not isinstance(payload, dict):
            return False
        items = payload.get("items")
        if not isinstance(items, list):
            return False

        media_keys = ("image_url_s3", "webp_image_url_s3", "gif_url_s3", "animated_webp_url_s3")
        for item in items:
            if not isinstance(item, dict):
                return False
            for key in media_keys:
                media_val = item.get(key)
                if media_val and (not _is_absolute_media_url(media_val) or _is_expired_presigned_url(media_val)):
                    return False
        return True

    cached_data = await get_cached(cache_key)
    if cached_data:
        try:
            parsed = json.loads(cached_data)
            if _is_cached_payload_valid(parsed):
                return parsed
        except Exception:
            # If cache is corrupted, proceed to fetch fresh data
            pass

    stmt = (
        select(Character)
        .join(User)
        .where(User.role.in_([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]))
        .order_by(Character.created_at.desc())
    )

    if search:
        try:
            term = f"%{search.strip()}%"
            stmt = stmt.where(
                or_(
                    Character.name.ilike(term),
                    Character.bio.ilike(term),
                )
            )
        except Exception:
            # If building the search filter fails, fall back to the unfiltered query
            pass
    
    if style and style.lower() != 'all':
        stmt = stmt.where(func.lower(Character.style) == style.lower())
    
    if gender and gender.lower() != 'all':
        stmt = stmt.where(func.lower(Character.gender) == gender.lower())

    # Get total count before pagination
    count_stmt = select(func.count()).select_from(stmt.subquery())
    total_result = await db.execute(count_stmt)
    total = total_result.scalar() or 0

    # Apply pagination
    offset = (page - 1) * per_page
    stmt = stmt.limit(per_page).offset(offset)

    result = await db.execute(stmt)
    characters = result.scalars().all()

    # Parallelize presigned URL generation for all characters
    char_dicts = [CharacterRead.model_validate(c).model_dump() for c in characters]

    # Optimization: Re-use S3 client and bucket name for bulk signing
    s3_c = await get_s3_client()
    bucket_nm = await get_config_value_from_cache("AWS_BUCKET_NAME")

    # Generate all presigned URLs in parallel for default (public) characters
    image_keys = [cd.get("image_url_s3") for cd in char_dicts]  # PNG
    webp_image_keys = [cd.get("webp_image_url_s3") for cd in char_dicts]  # static WebP
    gif_keys = [cd.get("gif_url_s3") for cd in char_dicts]
    animated_webp_keys = [cd.get("animated_webp_url_s3") for cd in char_dicts]

    presigned_images = []
    presigned_webp_images = []
    presigned_gifs = []
    presigned_animated_webps = []

    for cd in char_dicts:
        is_public = cd.get("privacy") == "public"

        # Image (PNG)
        if cd.get("image_url_s3"):
            if is_public:
                presigned_images.append(generate_public_s3_url(cd.get("image_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("image_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_images.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_images.append(asyncio.sleep(0, result=k))
        else:
            presigned_images.append(asyncio.sleep(0, result=None))

        # WebP Image
        if cd.get("webp_image_url_s3"):
            if is_public:
                 presigned_webp_images.append(generate_public_s3_url(cd.get("webp_image_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("webp_image_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_webp_images.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_webp_images.append(asyncio.sleep(0, result=k))
        else:
            presigned_webp_images.append(asyncio.sleep(0, result=None))

        # GIF
        if cd.get("gif_url_s3"):
            if is_public:
                 presigned_gifs.append(generate_public_s3_url(cd.get("gif_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("gif_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_gifs.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_gifs.append(asyncio.sleep(0, result=k))
        else:
            presigned_gifs.append(asyncio.sleep(0, result=None))
            
        # Animated WebP
        if cd.get("animated_webp_url_s3"):
            if is_public:
                 presigned_animated_webps.append(generate_public_s3_url(cd.get("animated_webp_url_s3"), bucket_name=bucket_nm))
            else:
                 k = cd.get("animated_webp_url_s3")
                 if k and not str(k).startswith("http"):
                     presigned_animated_webps.append(generate_presigned_url(s3_key=k, client=s3_c, bucket_name=bucket_nm))
                 else:
                     presigned_animated_webps.append(asyncio.sleep(0, result=k))
        else:
            presigned_animated_webps.append(asyncio.sleep(0, result=None))

    presigned_images = await asyncio.gather(*presigned_images)
    presigned_webp_images = await asyncio.gather(*presigned_webp_images)
    presigned_gifs = await asyncio.gather(*presigned_gifs)
    presigned_animated_webps = await asyncio.gather(*presigned_animated_webps)

    updated_characters = []
    for char_dict, p_img, p_webp_img, p_gif, p_anim_webp in zip(char_dicts, presigned_images, presigned_webp_images, presigned_gifs, presigned_animated_webps):
        if p_img:
            char_dict["image_url_s3"] = p_img
        if p_webp_img:
            char_dict["webp_image_url_s3"] = p_webp_img
        if p_gif:
            char_dict["gif_url_s3"] = p_gif
        if p_anim_webp:
            char_dict["animated_webp_url_s3"] = p_anim_webp
        
        # Helper to ensure dates are serializable
        if "created_at" in char_dict and isinstance(char_dict["created_at"], datetime.datetime):
             char_dict["created_at"] = char_dict["created_at"].isoformat()
        if "updated_at" in char_dict and isinstance(char_dict["updated_at"], datetime.datetime):
             char_dict["updated_at"] = char_dict["updated_at"].isoformat()

        updated_characters.append(char_dict)
    
    response_data = {
        "items": updated_characters,
        "total": total,
        "page": page,
        "per_page": per_page,
    }

    # Cache the result for 5 minutes (300 seconds)
    # We serialize the entire dict to JSON for storage
    try:
        await set_cached(cache_key, json.dumps(response_data), ttl=3600)
    except Exception as e:
        print(f"Failed to cache characters response: {e}")

    return response_data


@router.get("/fetch-by-id/{character_id}")
async def get_character(
    character_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get character details."""
    # character ids are stored as strings in the DB models; coerce incoming
    # path param to string to avoid SQL type mismatch errors
    character_id = str(character_id)
    print(f"Fetching character with ID: {character_id} for user ID: {user.id}")
    result = await db.execute(
        select(Character).where(Character.id == character_id)
    )
    character = result.scalars().first()
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    character_dict = CharacterRead.model_validate(character).model_dump()
    # Ensure all datetime values serialize cleanly for JSON responses
    for key, value in list(character_dict.items()):
        if isinstance(value, datetime.datetime):
            character_dict[key] = value.isoformat()
    # Presign image and webp_image, use public URL for gif and animated webp if present
    character_dict["presigned_image_url_s3"] = None
    if character_dict.get("image_url_s3"):
        character_dict["presigned_image_url_s3"] = await generate_presigned_url(
            s3_key=character_dict["image_url_s3"]
        )
    if character_dict.get("webp_image_url_s3"):
        character_dict["webp_image_url_s3"] = await generate_presigned_url(
            s3_key=character_dict["webp_image_url_s3"]
        )
    # Add public URLs for gif and animated webp (they have public-read ACL)
    if character_dict.get("gif_url_s3"):
        character_dict["gif_url_s3"] = await generate_public_s3_url(s3_key=character_dict["gif_url_s3"])
    if character_dict.get("animated_webp_url_s3"):
        character_dict["animated_webp_url_s3"] = await generate_public_s3_url(s3_key=character_dict["animated_webp_url_s3"])
    return JSONResponse(content={"character": character_dict}, status_code=200)


@router.get("/by-slug/{slug}")
async def get_character_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    """
    Get character by slug (e.g., 'luna-guide-9f3b12a4').
    Extracts the short ID from the slug and finds matching character.
    Public endpoint - no auth required.
    """
    # Extract short ID from slug (last segment after hyphens)
    parts = slug.split("-")
    if not parts:
        raise HTTPException(status_code=400, detail="Invalid slug format")

    short_id = parts[-1]

    # Validate short ID format (alphanumeric, 8+ chars)
    if not short_id or not re.match(r"^[a-z0-9]{8,}$", short_id, re.IGNORECASE):
        raise HTTPException(status_code=400, detail="Invalid slug format")

    # Find character where ID starts with short_id
    # Using LIKE with pattern matching for efficient DB query
    result = await db.execute(
        select(Character).where(Character.id.like(f"{short_id}%"))
    )
    character = result.scalars().first()

    if not character:
        raise HTTPException(status_code=404, detail="Character not found")

    character_dict = CharacterRead.model_validate(character).model_dump()

    # Generate presigned URLs for images (both PNG and WebP)
    if character_dict.get("image_url_s3"):
        character_dict["image_url_s3"] = await generate_presigned_url(
            s3_key=character_dict["image_url_s3"]
        )
    if character_dict.get("webp_image_url_s3"):
        character_dict["webp_image_url_s3"] = await generate_presigned_url(
            s3_key=character_dict["webp_image_url_s3"]
        )
    # Generate public URLs for gif and animated webp
    if character_dict.get("gif_url_s3"):
        character_dict["gif_url_s3"] = await generate_public_s3_url(
            s3_key=character_dict["gif_url_s3"]
        )
    if character_dict.get("animated_webp_url_s3"):
        character_dict["animated_webp_url_s3"] = await generate_public_s3_url(
            s3_key=character_dict["animated_webp_url_s3"]
        )

    # Convert datetime fields to ISO format
    if "created_at" in character_dict and isinstance(
        character_dict["created_at"], datetime.datetime
    ):
        character_dict["created_at"] = character_dict["created_at"].isoformat()
    if "updated_at" in character_dict and isinstance(
        character_dict["updated_at"], datetime.datetime
    ):
        character_dict["updated_at"] = character_dict["updated_at"].isoformat()

    return JSONResponse(content={"character": character_dict}, status_code=200)


@router.get("/fetch-by-user-id/{user_id}")
async def get_characters_by_user_id(
    user_id: str, user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """Get all characters for a given user_id (admin or public use)."""
    # user ids are string-based in our models; coerce to string
    user_id = str(user_id)
    print(f"Fetching characters for user ID: {user_id}")
    result = await db.execute(select(Character).where(Character.user_id == user_id))
    characters = result.scalars().all()
    # Build dicts and collect S3 keys to generate presigned URLs in parallel
    char_dicts = [CharacterRead.model_validate(c).model_dump() for c in characters]
    
    # Get all S3 keys (keep both PNG and WebP separate)
    image_keys = [cd.get("image_url_s3") for cd in char_dicts]
    webp_image_keys = [cd.get("webp_image_url_s3") for cd in char_dicts]
    gif_keys = [cd.get("gif_url_s3") for cd in char_dicts]
    animated_webp_keys = [cd.get("animated_webp_url_s3") for cd in char_dicts]

    # Generate all presigned URLs concurrently to reduce wall-clock latency
    presigned_images = await asyncio.gather(*[
        generate_presigned_url(s3_key=k) if k else asyncio.sleep(0, result=None) 
        for k in image_keys
    ])
    presigned_webp_images = await asyncio.gather(*[
        generate_presigned_url(s3_key=k) if k else asyncio.sleep(0, result=None) 
        for k in webp_image_keys
    ])
    presigned_gifs = await asyncio.gather(*[
        generate_public_s3_url(s3_key=k) if k else asyncio.sleep(0, result=None) 
        for k in gif_keys
    ])
    presigned_animated_webps = await asyncio.gather(*[
        generate_public_s3_url(s3_key=k) if k else asyncio.sleep(0, result=None) 
        for k in animated_webp_keys
    ])

    output = []
    for char_dict, p_img, p_webp_img, p_gif, p_anim_webp in zip(char_dicts, presigned_images, presigned_webp_images, presigned_gifs, presigned_animated_webps):
        if p_img:
            char_dict["image_url_s3"] = p_img
        if p_webp_img:
            char_dict["webp_image_url_s3"] = p_webp_img
        if p_gif:
            char_dict["gif_url_s3"] = p_gif
        if p_anim_webp:
            char_dict["animated_webp_url_s3"] = p_anim_webp

        # Convert datetimes to ISO format for JSON
        if "created_at" in char_dict and isinstance(
            char_dict["created_at"], datetime.datetime
        ):
            char_dict["created_at"] = char_dict["created_at"].isoformat()
        if "updated_at" in char_dict and isinstance(
            char_dict["updated_at"], datetime.datetime
        ):
            char_dict["updated_at"] = char_dict["updated_at"].isoformat()

        output.append({"character": char_dict})

    return JSONResponse(content={"characters": output}, status_code=200)


@router.post("/delete/{character_id}")
async def delete_character_by_user(
    character_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allow a logged-in user to delete one of their own characters."""
    # Ensure character exists and belongs to the current user
    # if admin role, allow deletion of any character
    # ensure we compare string IDs to string columns in the DB
    character_id = str(character_id)
    if user.role.lower() == "admin" or user.role.lower() == "super_admin":
        result = await db.execute(select(Character).where(Character.id == character_id))
    else:
        result = await db.execute(
            select(Character).where(
                Character.id == character_id, Character.user_id == user.id
            )
        )
    character = result.scalars().first()
    if not character:
        # If not found, return 404 to avoid leaking whether the id exists for other users
        raise HTTPException(status_code=404, detail="Character not found")

    # Attempt to delete main character image from S3 (best-effort)
    try:
        s3_key = getattr(character, "image_url_s3", None)
        if s3_key:
            await delete_s3_object(s3_key)
    except Exception:
        pass

    # Delete any CharacterMedia objects and their S3 files
    try:
        media_rows = await db.execute(
            select(CharacterMedia).where(CharacterMedia.character_id == character.id)
        )
        media_items = media_rows.scalars().all()
        for m in media_items:
            try:
                if getattr(m, "s3_path", None):
                    await delete_s3_object(m.s3_path)
            except Exception:
                pass
    except Exception:
        pass

    # Remove CharacterMedia records
    try:
        await db.execute(
            delete(CharacterMedia).where(CharacterMedia.character_id == character.id)
        )
        await db.commit()
    except Exception as e:
        # best-effort: if media records cannot be removed, log the error
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete character media for character {character_id} {e}",
        )

    # Remove dependent chat messages referencing this character to satisfy foreign key
    try:
        # Use a single DELETE statement for efficiency
        await db.execute(
            delete(ChatMessage).where(ChatMessage.character_id == character.id)
        )
        await db.commit()
    except Exception as e:
        # best-effort: if chat messages cannot be removed, raise a clear error so admin can inspect
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete chat messages referencing character {character_id}: {e}",
        )

    # Remove coin transactions referencing this character
    try:
        await db.execute(
            delete(CoinTransaction).where(CoinTransaction.character_id == character.id)
        )
        await db.commit()
    except Exception as e:
        # best-effort: if coin transactions cannot be removed, raise a clear error so admin can inspect
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete coin transactions referencing character {character_id}: {e}",
        )

    # Remove CharacterStats records referencing this character
    try:
        await db.execute(
            delete(CharacterStats).where(CharacterStats.character_id == character.id)
        )
        await db.commit()
    except Exception as e:
        # best-effort: if character stats cannot be removed, raise a clear error so admin can inspect
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete character stats referencing character {character_id}: {e}",
        )

    # Remove usage metrics referencing this character
    try:
        await db.execute(
            delete(UsageMetrics).where(UsageMetrics.character_id == character.id)
        )
        await db.commit()
    except Exception as e:
        # best-effort: if usage metrics cannot be removed, raise a clear error
        raise HTTPException(
            status_code=500,
            detail=f"Failed to delete usage metrics referencing character {character_id}: {e}",
        )

    # Finally delete the character record
    await db.delete(character)
    await db.commit()
    
    try:
        from app.services.redis_cache import del_cached
        await del_cached(f"characters:fetch-loggedin:{character.user_id}")
        await del_cached("characters:fetch-default")
    except Exception:
        pass

    return {
        "detail": f"Character {character_id} and related chat messages, media have been deleted"
    }


@router.get("/message-count")
async def get_character_message_count(db: AsyncSession = Depends(get_db)):
    """Return message counts for all characters as a JSON list of
    {"character_id": <id>, "count_message": <count>}.
    Includes characters with zero messages.
    """
    # Left join characters with chat messages so characters with zero
    # messages are included with count 0.
    result = await db.execute(
        select(Character.id, func.count(ChatMessage.id).label("count"))
        .outerjoin(ChatMessage, ChatMessage.character_id == Character.id)
        .group_by(Character.id)
    )

    rows = result.fetchall()
    counts = []
    for row in rows:
        char_id = row[0]
        cnt = int(row[1]) if row[1] is not None else 0
        counts.append({"character_id": char_id, "count_message": cnt})

    return JSONResponse(content=counts, status_code=200)


@router.post("/likes-message-count")
async def get_characters_stats(
    character_ids: List[Union[int, str]], db: AsyncSession = Depends(get_db)
):
    """Return message counts and likes for the provided character IDs.

    Request body: JSON array of character IDs, e.g. [1,2,4]
    Response: list of {"character_id": id, "message_count": n, "likes_count": m}
    """
    if not character_ids:
        return JSONResponse(content=[], status_code=200)

    # Normalize incoming IDs to strings because character IDs are stored
    # as strings (VARCHAR) in the database. Accept numeric or string input
    # from clients but always use string binds so SQL types match.
    normalized_ids: List[str] = []
    for cid in character_ids:
        try:
            # Keep original if already a string; otherwise coerce to string
            normalized_ids.append(str(cid))
        except Exception:
            # skip invalid ids
            continue

    if not normalized_ids:
        # Nothing valid to query
        return JSONResponse(content=[], status_code=200)

    # Get message counts per character (including zero)
    # ChatMessage.character_id is a string column; use string binds.
    msg_stmt = (
        select(ChatMessage.character_id, func.count(ChatMessage.id).label("count"))
        .where(ChatMessage.character_id.in_(normalized_ids))
        .group_by(ChatMessage.character_id)
    )
    msg_result = await db.execute(msg_stmt)
    msg_rows = {row[0]: int(row[1]) for row in msg_result.fetchall()}

    # Aggregate likes from CharacterStats table grouped by character_id
    stats_stmt = (
        select(
            CharacterStats.character_id,
            func.coalesce(func.sum(cast(CharacterStats.liked, Integer)), 0).label(
                "likes_sum"
            ),
        )
        # character_id in CharacterStats is stored as string; use string binds
        .where(CharacterStats.character_id.in_(normalized_ids)).group_by(
            CharacterStats.character_id
        )
    )
    stats_result = await db.execute(stats_stmt)
    stats_rows = {row[0]: {"likes": int(row[1])} for row in stats_result.fetchall()}

    output = []
    for cid in normalized_ids:
        stats_for_c = stats_rows.get(cid, {"likes": 0})
        output.append(
            {
                "character_id": cid,
                "message_count": msg_rows.get(cid, 0),
                "likes_count": stats_for_c.get("likes", 0),
            }
        )

    return JSONResponse(content=output, status_code=200)


@router.post("/like-status-by-user")
async def get_character_like_status(
    payload: dict,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return whether the logged-in user has liked specific characters.

    Accepts either a JSON object with key `character_ids`:
      {"character_ids": [character_id_1,character_id_2,character_id_3]}

    Returns a list of {"character_id": id, "is_liked": bool} in the
    same order as the provided IDs.
    """
    # Support both payload formats (object with `character_ids` or raw list)
    ids = []
    if isinstance(payload, dict) and "character_ids" in payload:
        ids = payload.get("character_ids") or []
    elif isinstance(payload, list):
        ids = payload
    elif isinstance(payload, dict) and "character_id" in payload:
        # backward-compatibility for single-id payloads
        ids = [payload.get("character_id")]
    else:
        return JSONResponse(content=[], status_code=200)

    # Normalize incoming IDs to strings to match DB storage
    normalized_ids = []
    for cid in ids:
        try:
            normalized_ids.append(str(cid))
        except Exception:
            continue

    if not normalized_ids:
        return JSONResponse(content=[], status_code=200)

    # Fetch any existing like records for this user and the requested IDs
    result = await db.execute(
        select(CharacterStats.character_id, CharacterStats.liked).where(
            (CharacterStats.user_id == user.id)
            & CharacterStats.character_id.in_(normalized_ids)
        )
    )
    rows = result.fetchall()
    liked_map = {str(r[0]): bool(r[1]) for r in rows}

    # Preserve input order in output
    output = []
    for cid in normalized_ids:
        output.append({"character_id": cid, "is_liked": liked_map.get(cid, False)})

    return JSONResponse(content=output, status_code=200)


@router.post("/like")
async def like_character(
    payload: CharacterIdIn,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Allow a logged-in user to 'like' a character."""
    # Coerce incoming id to string to match DB column type
    character_id = str(payload.character_id)
    # Check if character exists and can be accessed by the user
    # Allow access if the character belongs to the requesting user,
    # is public, or was created by an admin user.
    admin_user_ids_result = await db.execute(
        select(User.id).where(User.role.in_([RoleEnum.ADMIN, RoleEnum.SUPER_ADMIN]))
    )
    admin_user_ids = [row[0] for row in admin_user_ids_result.fetchall()]

    result = await db.execute(
        select(Character).where(
            (Character.id == character_id)
            & or_(
                Character.user_id == user.id,
                Character.privacy == "public",
                Character.user_id.in_(admin_user_ids),
            )
        )
    )
    character = result.scalars().first()
    if not character:
        raise HTTPException(
            status_code=404, detail="Character not found or inaccessible"
        )

    # Check if the user has already liked this character
    existing_like_result = await db.execute(
        select(CharacterStats).where(
            (CharacterStats.user_id == user.id)
            & (CharacterStats.character_id == character_id)
        )
    )
    existing_like = existing_like_result.scalars().first()
    if existing_like:
        raise HTTPException(status_code=400, detail="Character already liked by user")
    # Record the like in CharacterStats table
    new_like = CharacterStats(user_id=user.id, character_id=character_id, liked=True)
    db.add(new_like)
    await db.commit()

    return JSONResponse(
        content={"detail": f"Character {character_id} liked"}, status_code=200
    )


@router.post("/my-character-ids")
async def get_my_character_ids(
    user=Depends(get_current_user),
    user_id: str = None,
    db: AsyncSession = Depends(get_db),
):
    """Get all previous chats for a user (admin) or current user in descending order of creation."""
    query_user_id = user_id if user_id is not None else user.id
    # Only return chats that are associated with characters created by the query user.
    # This lets a user see chats for their own characters (even if the chat messages were
    # sent by other users).
    q_chars = await db.execute(
        select(Character.id).where(Character.user_id == query_user_id)
    )
    char_ids = q_chars.scalars().all()

    return {"character_ids": char_ids}
@router.post("/generate-metadata-preview")
async def generate_metadata_preview(
    request: Request,
    user=Depends(get_current_user),
):
    """
    Generate a name, bio, and "looking for" trait based on partial character data.
    Used for early pre-population in the frontend character creation flow.
    """
    logger = logging.getLogger(__name__)
    body = await request.json()
    character_data = body.get("character_data", {})
    
    # 1. Prepare Prompt
    user_input_text = f"""
CHARACTER DATA:
- Gender: {character_data.get('gender')}
- Style: {character_data.get('style')}
- Ethnicity: {character_data.get('ethnicity')}
- Age: {character_data.get('age')}
- Personality: {character_data.get('personality', 'Friendly')}
- Bio: {character_data.get('bio', '')}
- Relationship: {character_data.get('relationship_type', 'Stranger')}
- Clothing: {character_data.get('clothing', '')}
- Background: {character_data.get('background', '')}
- Special Features: {character_data.get('special_features', '')}
"""

    system_prompt_metadata = f"""You are an expert storyteller and character designer.
Your goal is to create a rich bio and 10 fitting names for an AI character.

You MUST return output that conforms EXACTLY to the provided JSON schema.

CRITICAL RULES FOR BIO (bio):
1. **Length**: 50-60 words.
2. **Content**: Captivating summary of the character's life and allure. Use first-person or engaging third-person.

CRITICAL RULES FOR "YOU'RE LOOKING FOR" (looking_for):
1. **Length**: 3-6 words.
2. **Content**: A short, intriguing phrase about what a user might find in this character.
3. **Examples**: "A safe, non-judgemental space", "Thrilling late-night adventures", "Intellectual depth and wit".
"""
    messages_metadata = [
        {"role": "system", "content": system_prompt_metadata},
        {"role": "user", "content": user_input_text},
    ]

    try:
        llm_response_metadata = await generate_structured_llm_response(
            messages_metadata, SCHEMA_CHARACTER_CREATION_METADATA_ONLY
        )
        if llm_response_metadata:
            return json.loads(llm_response_metadata)
    except Exception as e:
        logger.error(f"[PRE-GENERATE] Error generating metadata: {e}")
        raise HTTPException(status_code=500, detail="Failed to pre-generate character metadata")

    return JSONResponse(content={"error": "LLM failed"}, status_code=500)


@router.post("/{character_id}/generate-bio")
async def generate_character_bio(
    character_id: str,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Manually generate a new bio and "looking for" trait for an existing character.
    """
    logger = logging.getLogger(__name__)
    
    # 1. Fetch character
    result = await db.execute(select(Character).where(Character.id == character_id))
    char = result.scalar_one_or_none()
    
    if not char:
        raise HTTPException(status_code=404, detail="Character not found")
        
    # Check permissions (owner or admin)
    if char.user_id != user.id and user.role.lower() not in ["admin", "super_admin"]:
        raise HTTPException(status_code=403, detail="Not authorized to edit this character")

    # 2. Prepare Context for LLM
    user_input_text = f"""
CHARACTER DATA:
- Name: {char.name}
- Gender: {char.gender}
- Style: {char.style}
- Ethnicity: {char.ethnicity}
- Age: {char.age}
- Personality: {char.personality}
- Relationship: {char.relationship_type}
- Clothing: {char.clothing}
- Special Features: {char.special_features}
"""

    system_prompt_metadata = f"""You are an expert storyteller and character designer.
Your goal is to create a rich, captivating bio and a 'looking for' trait for an AI character.

You MUST return output that conforms EXACTLY to the provided JSON schema.

CRITICAL RULES FOR BIO (bio):
1. **Length**: 50-60 words.
2. **Content**: Captivating summary of the character's life and allure. Use first-person or engaging third-person.

CRITICAL RULES FOR "YOU'RE LOOKING FOR" (looking_for):
1. **Length**: 3-6 words.
2. **Content**: A short, intriguing phrase about what a user might find in this character.
"""
    messages_metadata = [
        {"role": "system", "content": system_prompt_metadata},
        {"role": "user", "content": user_input_text},
    ]

    try:
        llm_response_metadata = await generate_structured_llm_response(
            messages_metadata, SCHEMA_CHARACTER_CREATION_METADATA_ONLY
        )
        
        if llm_response_metadata:
            data = json.loads(llm_response_metadata)
            bio = data.get("bio")
            looking_for = data.get("looking_for")
            
            if bio:
                char.bio = bio
            if looking_for:
                char.looking_for = looking_for
                
            await db.commit()
            await db.refresh(char)
            
            # Invalidate cache
            try:
                from app.services.redis_cache import del_cached
                await del_cached(f"characters:fetch-loggedin:{char.user_id}")
                await del_cached("characters:fetch-default")
            except Exception:
                pass
                
            return {
                "message": "Bio generated and saved successfully",
                "bio": char.bio,
                "looking_for": char.looking_for
            }
            
    except Exception as e:
        logger.error(f"[MANUAL-GEN-BIO] Error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate bio: {str(e)}")

    raise HTTPException(status_code=500, detail="LLM failed to return a response")
