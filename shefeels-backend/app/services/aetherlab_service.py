
import httpx
from typing import Tuple, Dict, Any, Union
from app.core.config import settings
import json
import aiohttp

class AetherLabService:
    BASE_URL = "https://api.aetherlab.co/v1"

    @staticmethod
    def _get_api_key() -> str:
        if not settings.AETHERLAB_API_KEY:
            # Fallback or raise error? For now, let's assume it might be set, 
            # if not we might want to log a warning or fail securely (block).
            # The onboarding doc says "All API requests must include your API key".
            print("WARNING: AETHERLAB_API_KEY is not set.")
            return ""
        return settings.AETHERLAB_API_KEY

    @classmethod
    async def validate_prompt(
        cls, 
        user_prompt: str, 
        whitelisted_keywords: str = "", 
        blacklisted_keywords: str = ""
    ) -> Tuple[bool, dict]:
        """
        Validate a text prompt using AetherLab Prompt Guard.
        Returns: (is_compliant: bool, response_data: dict)
        """
        api_key = cls._get_api_key()
        if not api_key:
             # Fail secure? or fail open? 
             # "If Guardrails are unavailable, fail closed (block) for high‑risk use cases."
             return False, {"error": "Missing AetherLab API Key"}

        url = f"{cls.BASE_URL}/guardrails/prompt"
        headers = {
            "x-api-key": api_key,
            "Content-Type": "application/json"
        }
        
        # You might want to pull default policies from config if not provided
        # For now, we use defaults or passed values.
        # The prompt suggests we should construct these from our own policy.
        # We'll map them to empty strings if not provided, allowing the API (or caller) to define them.
        
        payload = {
            "input_type": "text",
            "user_prompt": user_prompt,
            "whitelisted_keyword": whitelisted_keywords,
            "blacklisted_keyword": blacklisted_keywords
        }

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, json=payload, timeout=10.0)
                
            if response.status_code == 200:
                data = response.json()
                # data structure: { "status": 200, "message": "...", "data": { "compliance_status": "Compliant", "avg_threat_level": ... } }
                result = data.get("data", {})
                is_compliant = result.get("compliance_status") == "Compliant"
                return is_compliant, result
            else:
                print(f"AetherLab Prompt Guard Error: {response.status_code} - {response.text}")
                return False, {"error": f"API Error {response.status_code}", "detail": response.text}
                
        except Exception as e:
            print(f"AetherLab Prompt Guard Exception: {e}")
            return False, {"error": str(e)}

    @classmethod
    async def validate_media(
        cls,
        image_input: Union[str, bytes],
        input_type: str = "url", # 'url', 'base64', 'file'
        whitelisted_keywords: str = "",
        blacklisted_keywords: str = ""
    ) -> Tuple[bool, dict]:
        """
        Validate an image using AetherLab Media Guard.
        image_input: URL string, base64 string, or bytes (for file upload).
        Returns: (is_compliant: bool, response_data: dict)
        """
        api_key = cls._get_api_key()
        if not api_key:
            return False, {"error": "Missing AetherLab API Key"}

        url = f"{cls.BASE_URL}/guardrails/media"
        # DO NOT set Content-Type here; httpx will set it with the correct boundary
        headers = {
            "x-api-key": api_key
        }
        
        try:
            # Force multipart/form-data by passing all fields in the 'files' parameter
            # as multipart/form-data parts.
            files = {
                'input_type': (None, input_type),
                'whitelisted_keyword': (None, whitelisted_keywords),
                'blacklisted_keyword': (None, blacklisted_keywords),
            }
            
            if input_type == 'file':
                # image_input is bytes
                files['image'] = ('image.jpg', image_input, 'image/jpeg')
            else:
                # image_input is a string (url or base64)
                files['image'] = (None, str(image_input))

            async with httpx.AsyncClient() as client:
                response = await client.post(url, headers=headers, files=files, timeout=15.0)
                
            if response.status_code == 200:
                data = response.json()
                result = data.get("data", {})
                is_compliant = result.get("compliance_status") == "Compliant"
                return is_compliant, result
            else:
                print(f"AetherLab Media Guard Error: {response.status_code} - {response.text}")
                return False, {"error": f"API Error {response.status_code}", "detail": response.text}
                 
        except Exception as e:
            print(f"AetherLab Media Guard Exception: {e}")
            return False, {"error": str(e)}
