"""
Dependency overrides for authentication and roles.
"""

from sqlalchemy.future import select
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from app.services.auth import AuthService
from app.models.user import User
from app.models.user import RoleEnum
from app.core.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)
) -> User:
    user = await AuthService.get_user_from_token(token, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
        )
    return user


oauth2_scheme_optional = OAuth2PasswordBearer(
    tokenUrl="/api/v1/auth/login", auto_error=False
)


async def get_current_user_optional(
    token: str = Depends(oauth2_scheme_optional), db: AsyncSession = Depends(get_db)
) -> User | None:
    if not token:
        return None
    user = await AuthService.get_user_from_token(token, db)
    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not (current_user.role == RoleEnum.ADMIN or current_user.role == RoleEnum.SUPER_ADMIN):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Require Admin Role",
        )
    return current_user


# async def get_headers_api() -> dict[str, str]:
#     """
#     Return headers for sending RUNPOD SERVERLESS API REQUEST.

#     Returns
#     -------
#     dict[str, str]
#         Headers including authorization token.
#     """
#     # Fail fast if API token isn't configured so callers get a clear error
#     api_token = (settings.API_TOKEN or "").strip()
#     if not api_token:
#         # Raise an HTTPException so endpoints return a helpful 502/500 instead of failing silently
#         raise HTTPException(
#             status_code=502, detail="Chat API token not configured on server"
#         )

#     headers = {
#         "Content-Type": "application/json",
#         # Use API-Key header expected by the external provider. Masking is handled by not logging the full token.
#         "API-Key": api_token,
#     }
#     # try:
#     #     # Log presence/length of token (masked) to help debug runtime env issues without exposing secrets
#     #     print(f"get_headers_api: API token present (length={len(api_token)})")
#     #     print("API token (masked): " + api_token[:4] + "..." + api_token[-4:])
#     # except Exception:
#     #     pass
#     return headers


async def check_admin(user_id: int, db: AsyncSession):
    admin = await db.execute(select(User).where(User.id == user_id))
    admin = admin.scalars().first()
    if admin and (admin.role.lower() == "admin" or admin.role.lower() == "super_admin"):
        return True


async def require_active_subscription(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Dependency to enforce that user has an active subscription.

    Checks:
    - Subscription exists for user
    - Status is 'active'
    - current_period_end is in the future

    Raises:
        HTTPException 403: If user does not have active subscription

    Returns:
        Subscription model instance if active
    """
    from app.models.subscription import Subscription
    from datetime import datetime

    stmt = select(Subscription).where(Subscription.user_id == current_user.id)
    result = await db.execute(stmt)
    subscription = result.scalars().first()

    now = datetime.utcnow()
    is_active = (
        subscription
        and subscription.status == "active"
        and subscription.current_period_end
        and subscription.current_period_end > now
    )

    if not is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You need an active subscription to access this feature.",
        )

    return subscription
