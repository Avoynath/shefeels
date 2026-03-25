"""Minimal OneSignal helper service.

Usage:
 - Set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY in the environment for sending.
 - Call send_notification(title, message). This uses httpx (already in requirements).
"""
import os
from typing import Any, Dict, Optional
import httpx

ONESIGNAL_APP_ID = os.getenv("ONESIGNAL_APP_ID")
ONESIGNAL_API_KEY = os.getenv("ONESIGNAL_API_KEY")
ONESIGNAL_ENDPOINT = "https://onesignal.com/api/v1/notifications"


async def send_notification(
    title: str, message: str, include_segments: Optional[list] = None
) -> Dict[str, Any]:
    """Send a simple notification via OneSignal REST API.

    Returns the parsed JSON response on success. Raises httpx.HTTPError on failure.
    """
    if include_segments is None:
        include_segments = ["Subscribed Users"]

    if not ONESIGNAL_APP_ID or not ONESIGNAL_API_KEY:
        raise RuntimeError("ONESIGNAL_APP_ID and ONESIGNAL_API_KEY must be set in environment")

    payload = {
        "app_id": ONESIGNAL_APP_ID,
        "headings": {"en": title},
        "contents": {"en": message},
        "included_segments": include_segments,
    }

    headers = {
        "Authorization": f"Basic {ONESIGNAL_API_KEY}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.post(ONESIGNAL_ENDPOINT, json=payload, headers=headers)
        r.raise_for_status()
        return r.json()
