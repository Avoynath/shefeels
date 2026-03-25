from fastapi import HTTPException
from app.services.app_config import get_config_value_from_cache
from app.core.aws_s3 import generate_presigned_url
import urllib.parse
import re
from typing import Optional
import base64
from PIL import Image
import io
import datetime
import aiohttp
import os
from pathlib import Path
import json
import httpx
import asyncio
from app.services.llm import generate_structured_llm_response
from app.services.schema import (
    SCHEMA_PROMPT_GENERATION,
    SCHEMA_PROMPT_MODEL_WORKFLOW_GENERATION,
    SCHEMA_CHARACTER_TO_IMAGE_GEN_PROMPT_IN_CHAT,
)
from app.services.prompts import (
    CHARACTER_PROMPT_SYSTEM_PROMPT,
    CHARACTER_PROMPT_SYSTEM_PROMPT_MALE_ANIME,
    CHARACTER_PROMPT_SYSTEM_PROMPT_TRANS_REALISTIC,
    get_character_to_image_system_prompt_in_chat,
    get_character_to_image_system_prompt,
    TEXT_TO_IMAGE_PROMPT_SYSTEM_PROMPT,
    get_character_system_prompt,
    GENERATE_NEGATIVE_PROMPT_SYSTEM,
)
from app.services.llm import generate_llm_response
from app.core.config import settings

########### IMAGE EDIT INSTRUCTION #############
# image_edit_instruction imported from prompts

# You can tweak these defaults to taste.
_DEFAULT_QUALITY_TAGS = (
    "highly detailed, sharp focus, clean edges, coherent anatomy, natural proportions, "
    "consistent identity across the image, no duplicates of the subject"
)


async def fetch_image_as_base64(s3_image_url: str) -> str:
    """
    Download an image from the given presigned S3 URL and return its base64 string.

    Args:
        s3_image_url (str): Presigned URL of the S3 image.

    Returns:
        str: Base64-encoded string of the image.

    Raises:
        ValueError: If the request fails or returns a non-200 status.
    """
    async with aiohttp.ClientSession() as session:
        async with session.get(s3_image_url) as response:
            if response.status != 200:
                raise ValueError(f"Failed to fetch image, status: {response.status}")
            image_bytes = await response.read()
            base64_str = base64.b64encode(image_bytes).decode("utf-8")
            return base64_str


async def generate_filename_timestamped(username: str) -> str:
    safe_username = username.replace(" ", "_").lower()
    # Use microseconds (%f), then truncate to milliseconds
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
    filename = f"{safe_username}_{timestamp}"
    return filename


async def get_job(job_id):
    url = f"https://api.beta.apimarketplace.com/v1/jobs/{job_id}"
    headers = {"accept": "application/json", "x-api-key": settings.SUGARLAB_API_KEY}

    wait_counter = 0
    image_generated = False
    presigned_image_url = None

    async with httpx.AsyncClient(timeout=30) as client:
        while True:
            response = await client.get(url, headers=headers)
            json_resp = response.json()
            print("job status:", json_resp["status"])
            if json_resp["status"] == "SUCCESS":
                image_generated = True
                presigned_image_url = json_resp["output"]["result"]
                print(presigned_image_url)
                break
            if json_resp["status"] == "PROCESSING":
                wait_counter = wait_counter + 1
                if wait_counter > 60:
                    break
                await asyncio.sleep(2)
                print("Job Status : ", json_resp["status"])
                continue
            if json_resp["status"] == "FAILED":
                break

    if image_generated == False:
        raise HTTPException(
            status_code=500, detail="Image generation failed due to an internal error."
        )

    return presigned_image_url


async def generate_negative_prompt(user_request: str, context: str = "chat") -> str:
    """
    Generate a negative prompt using LLM based on the user's request.

    Args:
        user_request: The user's request/query
        context: Context type - "character_creation" or "chat"

    Returns:
        Generated negative prompt string
    """

    # For character creation, always use single character negative prompt
    if context == "character_creation":
        return "text, watermark, signature, username, artist name, character name, copyright, logo, title, subtitle, speech bubble, dialogue, caption, label, stamp, writing, letters, words, kanji, hiragana, katakana, multiple people, two girls, double character, duplicate, extra person, crowd, group, bad anatomy, bad hands, missing fingers, extra fingers, poorly drawn face, deformed, ugly, blurry, low quality, worst quality"

    # For chat images, use LLM to determine appropriate negative prompt
    messages = [
        {"role": "system", "content": GENERATE_NEGATIVE_PROMPT_SYSTEM},
        {"role": "user", "content": f"Request: {user_request}"},
    ]

    try:
        negative_prompt = await generate_llm_response(messages)
        if negative_prompt:
            return negative_prompt.strip()
    except Exception as e:
        print(f"Error generating negative prompt: {e}")

    # Fallback to base negative prompt
    return "text, watermark, signature, username, artist name, bad anatomy, bad hands, missing fingers, extra fingers, poorly drawn face, deformed, ugly, blurry, low quality, worst quality"


async def generate_text_to_image(
    prompt: str,
    width: int = 1024,
    height: int = 1536,
    face_reference: Optional[str] = None,
    model_workflow_name: str = "PRO",
    character_style: str = "realistic",
    negative_prompt: str | None = None,
    loras: list[str] | None = None,
):
    """
    Generate an image using text-to-image API.

    Args:
        prompt: The image generation prompt
        width: Image width in pixels
        height: Image height in pixels
        face_reference: Optional presigned URL for face reference (supported by all endpoints)
        model_workflow_name: Workflow mode - "PRO" or "ESSENTIAL" (for realistic only)
        character_style: Character style - "anime" or "realistic"
        negative_prompt: Optional negative prompt to exclude unwanted elements

    Returns:
        Job ID for the image generation task
    """
    json_body = {
        "prompt": prompt,
        "width": width,
        "height": height,
        "sync": False,
    }

    # Add negative prompt if provided
    if negative_prompt:
        json_body["negativePrompt"] = negative_prompt

    # Add face reference if provided (supported by both anime and realistic endpoints)
    if face_reference:
        json_body["faceReference"] = face_reference
    print("Loras input : ", loras)
    if loras:
        print("Inside loras if")
        json_body["loras"] = [{"loraId": lora, "weight": 1.0} for lora in loras]

    # Determine workflow based on character style
    if character_style.lower() == "anime":
        model_workflow = "hentai"
    else:
        # Realistic style
        if model_workflow_name == "ESSENTIAL":
            model_workflow = (
                "realistic-normal-essential-face"
                if face_reference
                else "realistic-normal-essential"
            )
        else:
            # Default to PRO
            model_workflow = (
                "realistic-normal-pro-face" if face_reference else "realistic-normal"
            )

    url = (
        f"https://api.beta.apimarketplace.com/v1/generators/txt2image/{model_workflow}"
    )

    headers = {
        "accept": "application/json",
        "content-type": "application/json",
        "x-api-key": settings.SUGARLAB_API_KEY,
    }
    print("Final Json : ", json_body)
    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(url, headers=headers, json=json_body)

    print(f"Image Gen Response: {response.text}")
    if response.status_code not in [200, 201]:
        raise HTTPException(
            status_code=500, detail=f"Image generation request failed: {response.text}"
        )

    return response.json()["id"]


async def generate_character_prompt(
    personality: str | None = None,
    clothing: str | None = None,
    background: str | None = None,
    gender: str | None = None,
    ethnicity: str | None = None,
    age: int | None = None,
    hair_colour: str | None = None,
    hair_style: str | None = None,
    body_type: str | None = None,
    breast_size: str | None = None,
    eye_colour: str | None = None,
    skin_tone: str | None = None,
    style: str | None = None,
    butt_size: str | None = None,
    dick_size: str | None = None,
    special_features: str | None = None,
    hobbies: str | None = None,
    framing: str = "Three Quarter High Quality portrait",
) -> str:
    """
    Generate a character prompt using LLM with few-shot examples.

    Gender-specific rules:
    - Female: breast_size, butt_size (no dick_size)
    - Male: dick_size only (no breast_size, butt_size)
    - Trans: all three (breast_size, butt_size, dick_size) + uses "Futanari" for anime

    Args:
        framing: Image framing (default: "Three Quarter High Quality portrait" for character creation)
                 For chat images, this can be dynamic based on the prompt
    """

    # Build input string for LLM
    tags = []

    # Framing
    if framing:
        tags.append(framing)

    # Style
    if style.lower() == "anime":
        tags.append("ANIME_V2,-style")
    else:
        tags.append(f"{style.capitalize()},-style")

    # Gender - use Futanari for trans anime
    gender_lower = gender.lower() if gender else ""
    if gender:
        if gender_lower == "trans":
            if style and style.lower() == "anime":
                tags.append("Futanari")
            else:
                tags.append("TRANS adult")
        elif gender_lower in ["female", "male"]:
            tags.append(f"{gender.upper()} adult")
        else:
            tags.append(gender)

    # Age
    if age:
        tags.append(f"{age} year old,-age")

    # Ethnicity
    if ethnicity:
        tags.append(ethnicity)

    # Eye color
    if eye_colour:
        tags.append(f"{eye_colour} eye color,-eyes")

    # Hair
    if hair_colour and hair_style:
        tags.append(f"{hair_colour}-{hair_style},-hair")
    elif hair_colour:
        tags.append(f"{hair_colour} hair,-hair")
    elif hair_style:
        tags.append(f"{hair_style} hair,-hair")

    # Body type
    if body_type:
        tags.append(f"{body_type},-body")

    # Breast size (Female and Trans only)
    if breast_size and gender_lower in ["female", "trans"]:
        cleavage_map = {
            "flat": "Flat chest",
            "small": "Modest cleavage",
            "medium": "Moderate cleavage",
            "large": "Ample cleavage",
            "huge": "Massive cleavage",
            "xl": "Massive cleavage",
        }
        cleavage_term = cleavage_map.get(
            breast_size.lower(), f"{breast_size.capitalize()} cleavage"
        )
        tags.append(f"{cleavage_term},-boobs")

    # Butt size (Female and Trans only)
    if butt_size and gender_lower in ["female", "trans"]:
        tags.append(f"{butt_size.capitalize()} butt,-butt")

    # # Dick size (Male and Trans only)
    # if dick_size and gender_lower in ["male", "trans"]:
    #     tags.append(f"{dick_size.capitalize()} dick,-dick")

    # Special features
    if special_features:
        tags.append(special_features)

    # Personality
    if personality:
        tags.append(f"{personality} personality")

    # Background
    if background:
        tags.append(f"in {background}")

    # Clothing
    if clothing:
        tags.append(f"wearing {clothing}")

    # Hobbies
    if hobbies:
        tags.append(f"enjoys {hobbies}")

    # Skin tone
    if skin_tone:
        tags.append(f"{skin_tone} skin color,-skin")

    # Join input tags
    input_prompt = ", ".join(tags)

    print(f"Input prompt: {input_prompt}")
    # Use LLM to generate the final prompt
    if gender_lower == "male" and style.lower() == "anime":
        system_prompt = CHARACTER_PROMPT_SYSTEM_PROMPT_MALE_ANIME
    elif gender_lower == "trans" and style.lower() == "realistic":
        system_prompt = CHARACTER_PROMPT_SYSTEM_PROMPT_TRANS_REALISTIC
    else:
        system_prompt = CHARACTER_PROMPT_SYSTEM_PROMPT
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Input: {input_prompt}"},
    ]

    try:
        generated_prompt = await generate_llm_response(messages)
        if generated_prompt:
            return generated_prompt.strip()
    except Exception as e:
        print(f"Error generating character prompt with LLM: {e}")
        # Fallback to input prompt if LLM fails
        return input_prompt

    return input_prompt


async def generate_text_to_image_prompt(prompt: str) -> str:
    """
    Generate a high-quality text-to-image prompt based on a user's raw prompt,
    using few-shot examples to match the desired style (SugarLabs type).
    """
    system_prompt = TEXT_TO_IMAGE_PROMPT_SYSTEM_PROMPT

    user_input = f"User Request: {prompt}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]

    try:
        # Re-using SCHEMA_PROMPT_GENERATION as it returns {"prompt": "str"} which matches our need.
        response = await generate_structured_llm_response(
            messages, SCHEMA_PROMPT_GENERATION
        )
        if response:
            data = json.loads(response)
            return data.get("prompt", "")
    except Exception as e:
        print(f"Error generating text-to-image prompt: {e}")
        # Fallback to the original prompt if LLM fails
        return prompt

    return prompt


async def generate_character_to_image_prompt(
    base_prompt: str,
    outfit: str | None = None,
    pose: str | None = None,
    action: str | None = None,
    accessories: str | None = None,
    background: str | None = None,
) -> tuple[str, str]:
    """
    Generate a new image prompt for an existing character, retaining their core identity
    (face, body, hair) from base_prompt but modifying outfit, pose, action, accessories, and background.
    Also classifies the intent as 'PRO' or 'ESSENTIAL' based on specific NSFW keywords.
    """

    system_prompt = await get_character_to_image_system_prompt(base_prompt)

    user_input = f"""
    **New Attributes to Apply:**
    - Outfit: {outfit or "Random outfit"}
    - Pose: {pose or "Random pose"}
    - Action: {action or "Random action"}
    - Accessories: {accessories or "Random accessories"}
    - Background: {background or "Random background"}
    """

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_input},
    ]

    try:
        response = await generate_structured_llm_response(
            messages, SCHEMA_PROMPT_MODEL_WORKFLOW_GENERATION
        )
        if response:
            data = json.loads(response)
            return data.get("prompt", ""), data.get("mode", "PRO")
    except Exception as e:
        print(f"Error generating character to image prompt: {e}")
        # Fallback: simple concatenation if LLM fails
        parts = [base_prompt]
        if outfit:
            parts.append(f"wearing {outfit}")
        if pose:
            parts.append(pose)
        if action:
            parts.append(action)
        if accessories:
            parts.append(f"with {accessories}")
        if background:
            parts.append(f"in {background}")
        return ", ".join(parts), "PRO"

    return base_prompt, "PRO"


async def generate_character_to_image_in_chat_prompt(
    base_prompt: str,
    chat_messages: list[dict[str, str]],
    user_query: str,
    chat_response: str,
    gender: str = None,
) -> tuple[str, str]:
    """
    Generate an image prompt by extracting intent from the full chat context
    (including the AI's last response) and applying it to the base character prompt.
    Returns: (prompt_string, mode)
    """

    extract_system_prompt = await get_character_to_image_system_prompt_in_chat(
        base_prompt, gender
    )

    # Add the current user query and guardrail context if not already in messages (messages_for_prompt usually includes them)
    # logic in chats.py _build_image_context includes them.

    user_content = f"User Query : {user_query}\nChat Response : {chat_response}"
    extract_messages = [
        {"role": "system", "content": extract_system_prompt},
        {"role": "user", "content": user_content},
    ]

    llm_response_raw = await generate_structured_llm_response(
        extract_messages, schema=SCHEMA_CHARACTER_TO_IMAGE_GEN_PROMPT_IN_CHAT
    )

    prompt = None
    mode_extracted = "PRO"

    if llm_response_raw:
        try:
            data = json.loads(llm_response_raw)
            prompt = data.get("prompt")
            mode_extracted = data.get("mode", "PRO")

            print(
                f"Extracted Prompt and Mode: Prompt='{prompt}', Mode='{mode_extracted}'"
            )
        except Exception as e:
            print(f"Error parsing extraction response: {e}")

    return prompt, mode_extracted


async def generate_character_to_image_prompt_for_user_prompt(
    base_prompt: str, user_prompt: str
) -> tuple[str, str]:
    """
    Generate an image prompt by extracting intent from the user prompt
    and applying it to the base character prompt.
    Returns: (prompt_string, mode)
    """

    extract_system_prompt = await get_character_to_image_system_prompt(base_prompt)

    user_content = f"User Request: {user_prompt}"

    extract_messages = [
        {"role": "system", "content": extract_system_prompt},
        {"role": "user", "content": user_content},
    ]

    llm_response_raw = await generate_structured_llm_response(
        extract_messages, schema=SCHEMA_CHARACTER_TO_IMAGE_GEN_PROMPT_IN_CHAT
    )

    prompt = user_prompt  # Fallback
    mode_extracted = "PRO"

    if llm_response_raw:
        try:
            data = json.loads(llm_response_raw)
            prompt = data.get("prompt", prompt)
            mode_extracted = data.get("mode", "PRO")

            print(
                f"Extracted Prompt and Mode: Prompt='{prompt}', Mode='{mode_extracted}'"
            )
        except Exception as e:
            print(f"Error parsing extraction response: {e}")

    return prompt, mode_extracted
