# app/core/security.py
import datetime, uuid
from passlib.context import CryptContext
from jose import jwt
from app.core.config import settings
from secrets import token_urlsafe

pwd_ctx = CryptContext(schemes=["bcrypt_sha256", "bcrypt"], deprecated="auto")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return pwd_ctx.verify(plain, hashed)
    except ValueError:
        # protect the app from bcrypt backend errors (e.g. long password or incompatible bcrypt)
        import logging

        logging.exception("bcrypt/backend error during password verification")
        return False


def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)


def create_access_token(sub: str, minutes: int = 10080) -> str:
    exp = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        minutes=minutes
    )
    to_encode = {"exp": exp, "sub": sub}
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm="HS256")


def create_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, hashed_token)"""
    raw = str(uuid.uuid4())
    return raw, pwd_ctx.hash(raw)


def create_reset_code() -> tuple[str, str]:
    """Return (raw_code, bcrypt_hash)."""
    raw = token_urlsafe(32)
    return raw, pwd_ctx.hash(raw)
