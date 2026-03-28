
from __future__ import annotations

from typing import Any, Iterable, Tuple, Union

import httpx

from app.core.config import settings

class AetherLabService:
    BASE_URL = "https://api.aetherlab.co/v1"

    @staticmethod
    def _get_api_key() -> str:
        if not settings.AETHERLAB_API_KEY:
            print("WARNING: AETHERLAB_API_KEY is not set.")
            return ""
        return settings.AETHERLAB_API_KEY

    @classmethod
    def _build_headers(cls) -> dict[str, str]:
        api_key = cls._get_api_key()
        if not api_key:
            return {}
        # Send both current and legacy auth headers so the integration remains
        # compatible with either Aether endpoint generation.
        return {
            "Authorization": f"Bearer {api_key}",
            "x-api-key": api_key,
        }

    @staticmethod
    def _normalize_history(
        conversation_history: Iterable[dict[str, Any]] | None,
    ) -> list[dict[str, str]]:
        normalized: list[dict[str, str]] = []
        if not conversation_history:
            return normalized

        for item in conversation_history:
            if not isinstance(item, dict):
                continue
            role = str(item.get("role") or "").strip().lower()
            content = str(item.get("content") or "").strip()
            if not role or not content:
                continue
            normalized.append({"role": role, "content": content})
        return normalized

    @classmethod
    def _history_text(
        cls,
        conversation_history: Iterable[dict[str, Any]] | None,
    ) -> str:
        parts: list[str] = []
        for item in cls._normalize_history(conversation_history):
            parts.append(f"{item['role']}: {item['content']}")
        return "\n".join(parts)

    @staticmethod
    def _extract_result_payload(data: dict[str, Any]) -> dict[str, Any]:
        if not isinstance(data, dict):
            return {}
        nested = data.get("data")
        if isinstance(nested, dict):
            return nested
        result = data.get("result")
        if isinstance(result, dict):
            return result
        return data

    @classmethod
    def _extract_compliance(
        cls, response_data: dict[str, Any]
    ) -> tuple[bool, dict[str, Any]]:
        result = cls._extract_result_payload(response_data)

        compliance_status = str(result.get("compliance_status") or "").strip().lower()
        if compliance_status:
            return compliance_status == "compliant", result

        for key in ("is_compliant", "compliant", "allowed", "approved", "safe"):
            value = result.get(key)
            if isinstance(value, bool):
                return value, result

        decision = str(result.get("decision") or result.get("status") or "").strip().lower()
        if decision:
            if decision in {"allow", "allowed", "approved", "safe", "compliant", "pass", "passed"}:
                return True, result
            if decision in {"block", "blocked", "deny", "denied", "unsafe", "non_compliant", "reject", "rejected"}:
                return False, result

        return True, result

    @classmethod
    async def _post_json(
        cls,
        path: str,
        payload: dict[str, Any],
        timeout: float = 10.0,
    ) -> httpx.Response:
        headers = cls._build_headers()
        headers["Content-Type"] = "application/json"
        async with httpx.AsyncClient() as client:
            return await client.post(
                f"{cls.BASE_URL}{path}",
                headers=headers,
                json=payload,
                timeout=timeout,
            )

    @classmethod
    async def validate_prompt(
        cls, 
        user_prompt: str, 
        whitelisted_keywords: str = "", 
        blacklisted_keywords: str = "",
        conversation_history: Iterable[dict[str, Any]] | None = None,
    ) -> Tuple[bool, dict]:
        """
        Validate a text prompt using AetherLab Prompt Guard.
        Returns: (is_compliant: bool, response_data: dict)
        """
        if not cls._get_api_key():
            return True, {"skipped": True, "reason": "missing_api_key"}

        normalized_history = cls._normalize_history(conversation_history)
        history_text = cls._history_text(normalized_history)
        payload_v1 = {
            "content": user_prompt,
            "input_type": "text",
            "user_prompt": user_prompt,
            "conversation_history": normalized_history,
            "context": {
                "conversation_history": normalized_history,
                "conversation_history_text": history_text,
            },
            "whitelisted_keyword": whitelisted_keywords,
            "blacklisted_keyword": blacklisted_keywords,
        }
        payload_legacy = {
            "input_type": "text",
            "user_prompt": user_prompt,
            "conversation_history": normalized_history,
            "conversation_history_text": history_text,
            "whitelisted_keyword": whitelisted_keywords,
            "blacklisted_keyword": blacklisted_keywords,
        }

        try:
            response = await cls._post_json("/validate", payload_v1, timeout=10.0)
            if response.status_code == 200:
                return cls._extract_compliance(response.json())

            if response.status_code not in {400, 404, 405, 422}:
                print(f"AetherLab Validate Error: {response.status_code} - {response.text}")
                return True, {
                    "skipped": True,
                    "error": f"API Error {response.status_code}",
                    "detail": response.text,
                }

            response = await cls._post_json("/guardrails/prompt", payload_legacy, timeout=10.0)
            if response.status_code == 200:
                return cls._extract_compliance(response.json())

            print(f"AetherLab Prompt Guard Error: {response.status_code} - {response.text}")
            return True, {
                "skipped": True,
                "error": f"API Error {response.status_code}",
                "detail": response.text,
            }
        except Exception as e:
            print(f"AetherLab Prompt Guard Exception: {e}")
            return True, {"skipped": True, "error": str(e)}

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
        if not cls._get_api_key():
            return True, {"skipped": True, "reason": "missing_api_key"}

        try:
            headers = cls._build_headers()
            files = {
                "input_type": (None, input_type),
                "whitelisted_keyword": (None, whitelisted_keywords),
                "blacklisted_keyword": (None, blacklisted_keywords),
            }

            if input_type == "file":
                files["image"] = ("image.jpg", image_input, "image/jpeg")
            else:
                files["image"] = (None, str(image_input))

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f"{cls.BASE_URL}/guardrails/media",
                    headers=headers,
                    files=files,
                    timeout=15.0,
                )

            if response.status_code == 200:
                return cls._extract_compliance(response.json())

            print(f"AetherLab Media Guard Error: {response.status_code} - {response.text}")
            return True, {
                "skipped": True,
                "error": f"API Error {response.status_code}",
                "detail": response.text,
            }
        except Exception as e:
            print(f"AetherLab Media Guard Exception: {e}")
            return True, {"skipped": True, "error": str(e)}
