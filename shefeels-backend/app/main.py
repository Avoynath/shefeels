"""
FastAPI app factory for AI Friend Chatbot backend.
- Includes API routers, CORS, JWT, DB, and background tasks.
"""

import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from fastapi.responses import FileResponse
from pathlib import Path
import json
from datetime import datetime
from app.api.v1.deps_geo import ensure_geo_for_guest

from app.api.v1.endpoints import (
    auth,
    characters,
    chats,
    character_media,
    analytics,
    subscription,
    user,
    voice,
    pricing_promo,
    private_content,
    tagadapay,
    contact,
    promotional_config,
    generate_video,
)
from app.api.v1.endpoints import billing
from app.api.v1.endpoints.admin import (
    model_management,
    private_content_management,
    user_management,
    app_config_management,
    character_management,
    pricing_promo_management,
    dashboard,
    geo_analytics,
    contact_messages,
    ai_generation_logs,
    banner_management,
)
from app.services import app_config
from app.services import redis_cache
from app.core.database import get_db
from app.core.database import AsyncSessionLocal
from app.api.v1.endpoints import reporting
from sqlalchemy import text
import logging
import time
import sys
import traceback
import os
from starlette.responses import JSONResponse, PlainTextResponse
from sqlalchemy.exc import OperationalError

logging.basicConfig(level=logging.INFO)
logging.getLogger().setLevel(logging.INFO)

# DEBUG: write process id immediately so you can see which process is running
sys.stderr.write(f"app.main imported pid={os.getpid()}\n")
sys.stderr.flush()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Do not block startup with potentially slow DB queries. Instead, schedule
    # a background task to warm the DB connection pool and load small caches.
    async def _warm_and_cache():
        try:
            # pre-initialize redis client to avoid first-request connection latency
            try:
                await redis_cache.get_redis_client()
            except Exception:
                # best-effort
                pass

            async with AsyncSessionLocal() as db:
                # load config cache but do not block app startup
                await app_config.load_config_cache(db)
        except Exception:
            # Swallow errors here so startup still succeeds; cache may be empty
            # and endpoints should handle missing config gracefully.
            pass

    # schedule but don't await
    asyncio.create_task(_warm_and_cache())
    yield  # App is now running


def create_app() -> FastAPI:
    app = FastAPI(
        title="AI Friend Chatbot API",
        version="1.0.0",
        debug=False,  # disable debug in deployed environments for speed/security
        lifespan=lifespan,
        # Use a lightweight guest-level geo dependency that avoids
        # triggering the full geo resolution on every request.
        dependencies=[Depends(ensure_geo_for_guest)],
    )

    # NOTE: For development / testing it's convenient to allow a broad set of origins.
    # In production you should restrict `allow_origins` or `allow_origin_regex` to the
    # specific trusted frontends. We use `allow_origin_regex` here to ensure the
    # CORS middleware responds with an Access-Control-Allow-Origin header for
    # requests coming from Vercel-hosted frontends and other https origins.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            "http://127.0.0.1:5173",
            "http://localhost:5173",
            "http://localhost:5174",
            "http://127.0.0.1:5174",
            # local dev frontend on alternate port (explicitly allow during debugging)
            "http://13.48.108.119:6789",
            "http://16.16.118.93:5173",
            "https://pornily-frontend.vercel.app",
            "https://pornily-frontend-triple-minds-projects.vercel.app",
            "https://pornily-frontend-git-main-triple-minds-projects.vercel.app",
            "https://pornily-frontend-n26xi6k4q-triple-minds-projects.vercel.app",
            "https://pornily-frontend-1iglq47c9-piplusthetas-projects.vercel.app",
            "https://pornily-frontend-rho.vercel.app",
            # Added new Vercel frontend domains
            "https://tripleminds-frontend-k5lg7mdnz-piplusthetas-projects.vercel.app",
            "https://tripleminds-frontend.vercel.app",
        ],
        # Allow origins matching this regex (useful when the deployed frontend hostname
        # may change or include preview URLs). Remove or tighten in production.
        allow_origin_regex=r"^https?://.*",
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.add_middleware(
        SessionMiddleware, secret_key=os.getenv("JWT_SECRET_KEY", "supersecret")
    )

    # Mount static files for email assets
    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/static", StaticFiles(directory=static_dir), name="static")

    # Fallback middleware: ensure CORS headers are present even when an endpoint
    # raises an exception or the response path somehow bypasses CORSMiddleware.
    # This helps debugging dev setups (raw IP + ports) where the browser blocks
    # the request for missing Access-Control-Allow-Origin header. In production
    # prefer configuring a proper domain and TLS certificate and tightening origins.
    @app.middleware("http")
    async def _ensure_cors_headers(request, call_next):
        from starlette.responses import JSONResponse

        origin = request.headers.get("origin")
        try:
            response = await call_next(request)
        except Exception as exc:
            # Return a JSON error with CORS headers so the browser can see the response
            headers = {
                "Access-Control-Allow-Origin": origin or "*",
                "Access-Control-Allow-Credentials": "true",
                "Access-Control-Allow-Headers": "Authorization,Content-Type",
                "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            }
            # print("Exception in _ensure_cors_headers:", exc)
            # sys.stderr.write(f"Exception in _ensure_cors_headers: {exc}\n")
            # sys.stderr.flush()
            logging.exception("Unhandled exception in _ensure_cors_headers")
            if app.debug:
                raise
            return JSONResponse(
                status_code=500, content={"detail": str(exc)}, headers=headers
            )

        # If CORSMiddleware didn't add the header for some reason, add a permissive fallback.
        # Use the request Origin when available to avoid wildcard-with-credentials issues.
        if origin and not response.headers.get("access-control-allow-origin"):
            response.headers["Access-Control-Allow-Origin"] = origin
            response.headers["Access-Control-Allow-Credentials"] = "true"

        return response

    # Routers
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(user.router, prefix="/api/v1/user", tags=["auth"])
    app.include_router(
        characters.router, prefix="/api/v1/characters", tags=["characters"]
    )
    app.include_router(
        character_media.router, prefix="/api/v1/characters/media", tags=["characters"]
    )
    app.include_router(
        generate_video.router, prefix="/api/v1/characters/media", tags=["video"]
    )
    app.include_router(chats.router, prefix="/api/v1/chats", tags=["chats"])
    app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
    app.include_router(contact.router, prefix="/api/v1/support", tags=["support"])
    app.include_router(promotional_config.router, prefix="/api/v1", tags=["config"])
    app.include_router(
        subscription.router, prefix="/api/v1/subscription", tags=["stripe"]
    )
    app.include_router(
        pricing_promo.router, prefix="/api/v1/subscription", tags=["stripe"]
    )
    app.include_router(tagadapay.router, prefix="/api/v1/tagada", tags=["tagadapay"])
    app.include_router(billing.router, prefix="/api/v1", tags=["billing"])
    app.include_router(voice.router, prefix="/api/v1/voice", tags=["voice"])
    app.include_router(
        private_content.router,
        prefix="/api/v1/private-content",
        tags=["private-content"],
    )
    app.include_router(reporting.router, prefix="/api/v1", tags=["reporting"])
    app.include_router(
        user_management.router, prefix="/api/v1/admin/users", tags=["admin"]
    )
    app.include_router(
        app_config_management.router, prefix="/api/v1/admin/configs", tags=["admin"]
    )
    app.include_router(
        model_management.router, prefix="/api/v1/admin/models", tags=["admin"]
    )
    app.include_router(
        character_management.router, prefix="/api/v1/admin/characters", tags=["admin"]
    )
    app.include_router(
        pricing_promo_management.router, prefix="/api/v1/admin/pricing", tags=["admin"]
    )
    app.include_router(
        dashboard.router, prefix="/api/v1/admin/dashboard", tags=["admin"]
    )
    app.include_router(
        geo_analytics.router, prefix="/api/v1/admin/dashboard", tags=["admin"]
    )
    app.include_router(
        private_content_management.router,
        prefix="/api/v1/admin/private-content",
        tags=["admin"],
    )
    app.include_router(
        contact_messages.router,
        prefix="/api/v1/admin",
        tags=["admin"],
    )
    app.include_router(
        ai_generation_logs.router,
        prefix="/api/v1/admin",
        tags=["admin"],
    )
    app.include_router(
        banner_management.router,
        prefix="/api/v1/admin",
        tags=["admin"],
    )

    logger = logging.getLogger("app.performance")
    logging.basicConfig(level=logging.INFO)

    def _is_db_connection_error(exc: Exception) -> bool:
        # Check for common connection errors from asyncpg / SQLAlchemy
        if exc is None:
            return False
        # direct socket errors
        if isinstance(exc, ConnectionRefusedError):
            return True
        # SQLAlchemy wraps DBAPI errors in OperationalError
        if isinstance(exc, OperationalError):
            return True
        # inspect __cause__ / __context__ chain for underlying errors
        cause = getattr(exc, "__cause__", None) or getattr(exc, "__context__", None)
        if isinstance(cause, ConnectionRefusedError):
            return True
        if cause is not None and "Connection refused" in str(cause):
            return True
        return False

    @app.middleware("http")
    async def log_slow_requests(request, call_next):
        start = time.monotonic()
        try:
            response = await call_next(request)
        except Exception as exc:
            logger.exception("Unhandled exception in request")
            # ALWAYS print full traceback to stderr so it appears in the terminal
            import traceback as _traceback

            _traceback.print_exc(file=sys.stderr)
            sys.stderr.flush()
            elapsed_ms = (time.monotonic() - start) * 1000
            if elapsed_ms > 100:
                logger.warning(
                    "Slow request (error) %s %s %.1fms",
                    request.method,
                    request.url.path,
                    elapsed_ms,
                )
            # If this looks like a DB connection error, return 503 for this request
            if _is_db_connection_error(exc):
                logger.warning("Database connection error detected: %s", exc)
                return JSONResponse(
                    status_code=503, content={"detail": "database unavailable"}
                )
            # otherwise re-raise for default handling/logging
            raise
        elapsed_ms = (time.monotonic() - start) * 1000
        if elapsed_ms > 100:
            logger.warning(
                "Slow request %s %s %.1fms",
                request.method,
                request.url.path,
                elapsed_ms,
            )
        return response

    @app.get("/health", include_in_schema=False)
    async def health():
        return PlainTextResponse("ok", status_code=200)

    @app.get("/ready")
    async def ready():
        try:

            async def _ping_db():
                async with AsyncSessionLocal() as session:
                    await session.execute(text("SELECT 1"))

            await asyncio.wait_for(_ping_db(), timeout=2.0)
            # Optionally require Redis to be available for readiness checks.
            # Set REQUIRE_REDIS=1 (or true/yes) in the environment to enable.
            try:
                require_redis = os.getenv("REQUIRE_REDIS", "").lower() in (
                    "1",
                    "true",
                    "yes",
                )
            except Exception:
                require_redis = False

            if require_redis:
                try:
                    # use the shared redis_cache helper which verifies connectivity
                    client = await redis_cache.get_redis_client()
                    if client is None:
                        logger.warning(
                            "Readiness failed: Redis required but unavailable"
                        )
                        raise HTTPException(status_code=503, detail="redis unavailable")
                except HTTPException:
                    raise
                except Exception as exc:
                    logger.warning("Redis readiness check failed: %s", exc)
                    raise HTTPException(status_code=503, detail="redis unavailable")

            return {"ready": True}
        except Exception as exc:
            logger.warning("Readiness check failed: %s", exc)
            raise HTTPException(status_code=503, detail="not ready")

    @app.get("/ping")
    async def ping():
        print("PING ENDPOINT CALLED")
        return {"message": "pong"}

    @app.get("/api/v1/bootstrap")
    async def bootstrap():
        """
        Return a tiny bootstrap payload used by the client to render chrome immediately.
        - Cached in Redis (or in-memory fallback) for a short TTL so responses are ~10-50ms.
        - Contains server time, a small public config map, and feature flags placeholder.
        """
        CACHE_KEY = "bootstrap:v1"

        async def _populate_cache():
            # compute payload and store into cache (best-effort)
            payload = {
                "serverTime": datetime.utcnow().isoformat() + "Z",
                "config": {},
                "featureFlags": {},
            }
            try:
                async with AsyncSessionLocal() as db:
                    await app_config.ensure_config_loaded(db)
                    for key in ("AWS_BUCKET_NAME", "PUBLIC_SITE_TITLE", "head_scripts", "body_scripts"):
                        try:
                            val = await app_config.get_config_value_from_cache(key)
                            payload["config"][key] = val
                        except Exception:
                            payload["config"][key] = None
            except Exception:
                # best-effort only
                pass

            try:
                # shorter TTL so updates propagate quickly; use 30s
                await redis_cache.set_cached(CACHE_KEY, json.dumps(payload), ttl=30)
            except Exception:
                pass

            return payload

        # 1) Fast path: cached value exists -> return immediately and refresh in background
        try:
            cached = await redis_cache.get_cached(CACHE_KEY)
            if cached:
                # Schedule a background refresh but don't await it (stale-while-revalidate)
                try:
                    asyncio.create_task(_populate_cache())
                except Exception:
                    pass
                return json.loads(cached)
        except Exception:
            # If cache lookup fails, we'll try a short DB fetch below
            pass

        # 2) Cache miss: try a short, non-blocking DB-backed fill (bound the time spent)
        try:
            payload = await asyncio.wait_for(_populate_cache(), timeout=0.20)
            return payload
        except asyncio.TimeoutError:
            # If DB/cache slow, return a minimal skeleton payload immediately and populate in background
            try:
                asyncio.create_task(_populate_cache())
            except Exception:
                pass
            return {
                "serverTime": datetime.utcnow().isoformat() + "Z",
                "config": {},
                "featureFlags": {},
            }
        except Exception:
            # On any other error, return minimal payload and schedule background refresh
            try:
                asyncio.create_task(_populate_cache())
            except Exception:
                pass
            return {
                "serverTime": datetime.utcnow().isoformat() + "Z",
                "config": {},
                "featureFlags": {},
            }

    async def _do_warmup_task():
        """Background warmup task: prime DB connection and load small caches."""
        try:
            async with AsyncSessionLocal() as db:
                # lightweight DB touch
                await db.execute(text("SELECT 1"))
                # populate config cache
                try:
                    await app_config.load_config_cache(db)
                except Exception:
                    pass
        except Exception:
            # swallow - this is a best-effort background warmup
            pass

    @app.post("/internal/warmup")
    async def internal_warmup(request: Request):
        """
        Trigger a background warmup. Protected by `WARMUP_TOKEN` env or restricted to localhost when unset.
        This returns immediately with 202 and runs warming tasks in background.
        """
        token = os.getenv("WARMUP_TOKEN")
        # If a token is configured, require it via header `X-Warmup-Token`.
        if token:
            if request.headers.get("X-Warmup-Token") != token:
                raise HTTPException(status_code=403, detail="forbidden")
        else:
            # otherwise only allow from localhost to avoid abuse
            client_ip = None
            if request.client:
                client_ip = request.client.host
            if client_ip not in ("127.0.0.1", "::1"):
                raise HTTPException(status_code=403, detail="forbidden")

        # schedule background warmup and return immediately
        asyncio.create_task(_do_warmup_task())
        from starlette.responses import JSONResponse

        return JSONResponse(status_code=202, content={"status": "warming"})

    @app.get("/OneSignalSDKWorker.js")
    async def onesignal_worker():
        """Serve the OneSignal service worker from repo/frontend public or fallback to repo root worker dir.

        This ensures the worker is available at https://<your-domain>/OneSignalSDKWorker.js
        """
        # Resolve repository root (two parents above this file -> repo root)
        repo_root = Path(__file__).resolve().parents[2]
        # Prefer frontend public copy if present (recommended)
        candidate = repo_root.joinpath("hl-frontend", "public", "OneSignalSDKWorker.js")
        if not candidate.exists():
            # fallback to the packaged directory in repo root
            candidate = repo_root.joinpath(
                "OneSignalSDK-v16-ServiceWorker", "OneSignalSDKWorker.js"
            )
        if not candidate.exists():
            raise HTTPException(status_code=404, detail="OneSignal worker not found")

        return FileResponse(
            str(candidate),
            media_type="application/javascript",
            headers={"Service-Worker-Allowed": "/"},
        )

    @app.post("/internal/onesignal/test")
    async def internal_onesignal_test(request: Request):
        """Simple admin-protected endpoint to send a test OneSignal notification.

        Security: if ADMIN_NOTIFICATION_TOKEN is set in env, require header X-Admin-Token to match it.
        If not set, only allow requests from localhost.
        Body JSON: {"title": "..", "message": ".."}
        """
        token = os.getenv("ADMIN_NOTIFICATION_TOKEN")
        if token:
            if request.headers.get("X-Admin-Token") != token:
                raise HTTPException(status_code=403, detail="forbidden")
        else:
            client_ip = None
            if request.client:
                client_ip = request.client.host
            if client_ip not in ("127.0.0.1", "::1"):
                raise HTTPException(status_code=403, detail="forbidden")

        body = await request.json()
        title = body.get("title", "Test")
        message = body.get("message", "This is a test notification")

        try:
            from app.services import onesignal as onesignal_service

            result = await onesignal_service.send_notification(
                title=title, message=message
            )
            return {"status": "ok", "result": result}
        except Exception as exc:
            logging.exception("Failed to send test notification")
            raise HTTPException(status_code=500, detail=str(exc))

    @app.exception_handler(Exception)
    async def _global_exception_handler(request: Request, exc: Exception):
        # DEBUG: show which process hit the global handler
        sys.stderr.write(f"Global exception handler pid={os.getpid()}\n")
        sys.stderr.flush()
        # Ensure the full traceback is written to stderr and logged.
        sys.stderr.write("Unhandled exception (global handler):\n")
        traceback.print_exc(file=sys.stderr)
        sys.stderr.flush()
        logging.exception("Unhandled exception caught by global handler")
        # In debug mode re-raise so uvicorn prints the full traceback and the process shows it.
        if app.debug:
            raise exc
        from starlette.responses import JSONResponse

        return JSONResponse(
            status_code=500, content={"detail": "internal server error"}
        )

    return app


app = create_app()
