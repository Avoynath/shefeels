import httpx
import asyncio

import requests
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
import tiktoken
import json
import re
from typing import Any, Union
from app.services.llm import generate_structured_llm_response, client


async def clean_model_output(text: str) -> str:
    """
    Keep only the content after the *</think>*
    and strip junk like analysis, commentary, etc.
    """
    splitted_text = text.split("</think>")
    if len(splitted_text) > 1:
        text = splitted_text[-1]
        text = text.strip()
        return text


async def extract_chat_image_intent_prompt(text: str) -> str:
    # Handle None or non-string inputs
    if text is None or not isinstance(text, str):
        print(
            f"[WARNING] extract_chat_image_intent_prompt received invalid input: {type(text)}"
        )
        return "", False, ""

    chat_output = ""
    is_image_request = False
    image_prompt = ""
    
    # Try to parse as JSON first (most common case)
    try:
        dict_output = json.loads(text)
        chat_output = dict_output.get("chat_output", "")
        is_image_request = dict_output.get("generate_image", "false")
        image_prompt = dict_output.get("image_prompt", "")
    except (json.JSONDecodeError, ValueError):
        # Fallback for non-JSON responses
        chat_output = (
            text.replace("chat_output:", "")
            .strip()
            .replace("generate_image:", "")
            .strip()
            .replace("image_prompt:", "")
            .strip()
        )
        is_image_request = "false"
        image_prompt = ""
    
    # Convert generate_image string to boolean
    if "true" in str(is_image_request).lower():
        is_image_request = True
    else:
        is_image_request = False
    
    return chat_output, is_image_request, image_prompt




async def approximate_token_count(messages: list) -> int:
    """
    Approximate token count for a list of messages (dicts with 'role' and 'content').
    Uses cl100k_base encoding (default for GPT-3.5/4).
    """
    encoding = tiktoken.get_encoding("cl100k_base")
    total_tokens = 0
    for msg in messages:
        total_tokens += len(encoding.encode(msg["content"]))

    return total_tokens
