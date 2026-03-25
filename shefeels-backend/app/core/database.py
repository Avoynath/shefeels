from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
 
from app.core.config import settings
import ssl

SQLALCHEMY_DATABASE_URL = settings.DATABASE_URL
print("SQLALCHEMY_DATABASE_URL:", SQLALCHEMY_DATABASE_URL)

# ssl_ctx = ssl.create_default_context()
# ssl_ctx.check_hostname = False
# ssl_ctx.verify_mode = ssl.CERT_NONE

# Use reasonable pool settings and turn off verbose SQL logging in production.
# Pool configuration optimized for production with SSE streaming:
# - pool_size: Core connections (increased from 5 to 10 for concurrent requests)
# - max_overflow: Additional connections during bursts (kept at 10)
# - pool_recycle: Recycle connections every hour to prevent stale connections
# - pool_pre_ping: Test connections before use to handle DB restarts gracefully
engine = create_async_engine(
    SQLALCHEMY_DATABASE_URL,
    echo=False,
    pool_pre_ping=True,
    future=True,
    # connect_args={"ssl": ssl_ctx},
    pool_size=10,  # Increased from 5 (normal request load)
    max_overflow=10,  # Keep at 10 (burst capacity)
    pool_recycle=3600,  # Recycle connections every hour
)

AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db():
    """Provide a database session for FastAPI dependencies.

    Use an explicit create/close pattern and guard the close call so
    we don't trigger an IllegalStateChangeError when teardown collides
    with an in-progress connection binding operation.
    """
    session: AsyncSession = AsyncSessionLocal()
    try:
        yield session
    finally:
        try:
            await session.close()
        except Exception:
            # Best-effort fallback if closing the async session fails while
            # the connection is being bound. Attempt to close internal sync
            # session if present, then continue silently.
            try:
                sync_sess = getattr(session, "sync_session", None)
                if sync_sess is not None:
                    sync_sess.close()
            except Exception:
                pass


# Backwards-compatible alias used by background tasks elsewhere in the codebase
# Some modules import `async_session_maker` expecting a sessionmaker factory
async_session_maker = AsyncSessionLocal
