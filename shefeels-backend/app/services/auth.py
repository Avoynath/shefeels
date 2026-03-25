"""
AuthService: Handles user authentication, JWT, password hashing.
"""

from jose import jwt, JWTError
from app.core.config import settings
from app.models.user import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

class AuthService:
    @staticmethod
    async def get_user_from_token(token: str, db: AsyncSession) -> User | None:
        try:
            payload = jwt.decode(
                token,
                settings.JWT_SECRET,
                algorithms=[settings.JWT_ALGORITHM]
            )
            user_id = payload.get("sub")
            if not user_id:
                return None
            # users.id is a string (32-char hex). Avoid casting to int.
            result = await db.execute(select(User).where(User.id == str(user_id)))
            user = result.scalar_one_or_none()
            return user
        except JWTError:
            return None
