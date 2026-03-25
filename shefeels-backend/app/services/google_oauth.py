from google.oauth2 import id_token
from google.auth.transport import requests as grequests
from fastapi import HTTPException
from app.core.config import settings


def verify_google_id_token(token: str) -> dict:
    """Verify a Google ID token and return the payload.

    Raises HTTPException(400) if token is invalid.
    """
    try:
        # Verify the token using Google's libraries. This validates
        # signature, expiry and aud (audience) if provided.
        request = grequests.Request()
        payload = id_token.verify_oauth2_token(token, request)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid Google ID token: {e}")

    # Ensure audience matches our client id to avoid accepting tokens
    # intended for other clients.
    expected_aud = getattr(settings, "GOOGLE_CLIENT_ID", None)
    if expected_aud and payload.get("aud") != expected_aud:
        raise HTTPException(status_code=400, detail="Token audience mismatch")

    return payload
