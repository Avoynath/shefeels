# app/api/v1/deps_geo.py
"""
Optimized geo-session dependency with non-blocking session creation and geo resolution.

Key optimizations:
1. Session creation moved to background (fire-and-forget)
2. Session existence cached in Redis to avoid DB queries on every request
3. Geo resolution completely decoupled from request flow
"""
from typing import Optional
from uuid import uuid4
from datetime import timedelta, datetime, timezone
import asyncio

from app.core.database import AsyncSessionLocal

from fastapi import Request, Response, Depends, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.services.geo import resolve_geo
from app.models.geo import IpLocationCache
from app.models.geo import VisitSession
from app.services.geo import get_client_ip_from_headers
from app.services.user_geo import upsert_user_ip_history
from app.services.redis_cache import get_cached, set_cached
import json
import logging

logger = logging.getLogger(__name__)

SESSION_COOKIE = "vsid"
COOKIE_MAX_AGE = int(timedelta(days=90).total_seconds())

# Redis cache TTLs
SESSION_VALID_TTL = 3600  # 1 hour - cache session existence
GEO_CACHE_TTL = 86400     # 24 hours - cache geo data


async def _cache_session_valid(vsid: str) -> None:
    """Mark a session as valid in Redis cache."""
    try:
        await set_cached(f"session_valid:{vsid}", "1", ttl=SESSION_VALID_TTL)
    except Exception:
        pass


async def _is_session_valid_cached(vsid: str) -> Optional[bool]:
    """
    Check if session is valid from Redis cache.
    Returns True if cached as valid, None if not in cache (needs DB check).
    """
    try:
        cached = await get_cached(f"session_valid:{vsid}")
        if cached == "1":
            return True
    except Exception:
        pass
    return None


async def _get_geo_from_cache(ip: str) -> dict:
    """Get geo data from Redis cache only (no DB fallback in critical path)."""
    try:
        if not ip:
            return {}
        redis_key = f"geo:ip:{ip}"
        cached_geo = await get_cached(redis_key)
        if cached_geo:
            return json.loads(cached_geo)
    except Exception:
        pass
    return {}


async def _background_create_session(
    vsid: str,
    ip: Optional[str],
    user_agent: Optional[str],
    utm_source: Optional[str],
    utm_medium: Optional[str],
    utm_campaign: Optional[str],
    referrer: Optional[str],
) -> None:
    """
    Background task to create VisitSession and resolve geo.
    Completely decoupled from request flow.
    """
    try:
        async with AsyncSessionLocal() as db:
            # Check if session was already created (race condition prevention)
            existing = await db.get(VisitSession, vsid)
            if existing:
                # Already exists, just cache validity and return
                await _cache_session_valid(vsid)
                return

            # Get geo data if available (from cache or resolve)
            geo = {}
            if ip:
                # Try cache first
                geo = await _get_geo_from_cache(ip)
                if not geo:
                    # Resolve geo (this may take time, but we're in background)
                    try:
                        geo = await resolve_geo(ip, db)
                    except Exception:
                        geo = {}

            # Create the session
            sess = VisitSession(
                id=vsid,
                user_id=None,
                first_ip=ip,
                first_country_code=geo.get("country_code"),
                first_city=geo.get("city"),
                user_agent=user_agent,
                utm_source=utm_source,
                utm_medium=utm_medium,
                utm_campaign=utm_campaign,
                referrer=referrer,
            )
            try:
                db.add(sess)
                await db.commit()
                # Cache session as valid
                await _cache_session_valid(vsid)
                logger.debug(f"Background session created: {vsid}")
            except Exception as e:
                await db.rollback()
                logger.warning(f"Background session creation failed: {e}")
    except Exception as e:
        logger.warning(f"Background session task failed: {e}")


async def _background_resolve_geo(ip: str, vsid: Optional[str]) -> None:
    """
    Background task to resolve geo and update session if needed.
    """
    try:
        async with AsyncSessionLocal() as db:
            # Resolve geo
            geo = await resolve_geo(ip, db)
            
            # Update VisitSession if it exists and needs geo
            if vsid and geo:
                sess = await db.get(VisitSession, vsid)
                if sess and (not sess.first_country_code or not sess.first_city):
                    sess.first_country_code = geo.get("country_code") or sess.first_country_code
                    sess.first_city = geo.get("city") or sess.first_city
                    db.add(sess)
                    await db.commit()
    except Exception as e:
        logger.debug(f"Background geo resolve failed: {e}")


async def ensure_geo_session(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    OPTIMIZED: Non-blocking session creation and geo resolution.
    
    - Session ID generated immediately, cookie set immediately
    - DB insert happens in background (fire-and-forget)
    - Geo resolution happens in background
    - Request continues immediately
    """
    # Skip for OPTIONS requests (CORS preflight)
    if request.method == "OPTIONS":
        request.state.client_ip = None
        request.state.visitor_session_id = None
        request.state.geo = {}
        return

    # 1) Extract the real client IP
    ip = get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )

    # 2) Fast geo lookup from cache only (no DB in critical path)
    geo = await _get_geo_from_cache(ip) if ip else {}

    # 3) Handle visitor session
    vsid: Optional[str] = request.cookies.get(SESSION_COOKIE)
    need_background_create = False

    if vsid:
        # Check Redis cache first for session validity
        is_valid = await _is_session_valid_cached(vsid)
        if is_valid:
            # Session known valid, skip DB check entirely
            pass
        else:
            # Check DB and cache result (quick lookup)
            try:
                sess = await db.get(VisitSession, vsid)
                if sess:
                    # Cache for future requests
                    await _cache_session_valid(vsid)
                else:
                    # Session missing from DB, need to recreate
                    need_background_create = True
            except Exception:
                # On DB error, assume invalid and recreate
                need_background_create = True
    else:
        # No cookie, generate new session ID
        vsid = uuid4().hex[:32]
        need_background_create = True

    # 4) If we need a new session, set cookie immediately and create in background
    if need_background_create:
        # Set cookie immediately (no waiting for DB)
        response.set_cookie(
            key=SESSION_COOKIE,
            value=vsid,
            max_age=COOKIE_MAX_AGE,
            httponly=True,
            samesite="Lax",
            secure=(request.url.scheme == "https"),
        )
        
        # Schedule background session creation (fire-and-forget)
        try:
            asyncio.create_task(_background_create_session(
                vsid=vsid,
                ip=ip,
                user_agent=request.headers.get("user-agent"),
                utm_source=request.query_params.get("utm_source"),
                utm_medium=request.query_params.get("utm_medium"),
                utm_campaign=request.query_params.get("utm_campaign"),
                referrer=request.headers.get("referer"),
            ))
        except Exception:
            # If task creation fails, try BackgroundTasks as fallback
            try:
                background_tasks.add_task(
                    _background_create_session,
                    vsid,
                    ip,
                    request.headers.get("user-agent"),
                    request.query_params.get("utm_source"),
                    request.query_params.get("utm_medium"),
                    request.query_params.get("utm_campaign"),
                    request.headers.get("referer"),
                )
            except Exception:
                pass

    # 5) Schedule background geo resolution if cache miss
    if ip and not geo:
        try:
            asyncio.create_task(_background_resolve_geo(ip, vsid))
        except Exception:
            try:
                background_tasks.add_task(_background_resolve_geo, ip, vsid)
            except Exception:
                pass

    # 6) Set request state immediately (no waiting)
    request.state.client_ip = ip
    request.state.geo = geo
    request.state.visitor_session_id = vsid


async def ensure_geo_for_guest(
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    OPTIMIZED: Lightweight dependency for guest users.
    
    - Fast-path for existing sessions (Redis cache check)
    - No DB queries for returning visitors with valid cached session
    - Background geo resolution only when needed
    """
    # Skip for OPTIONS requests
    if request.method == "OPTIONS":
        request.state.client_ip = None
        request.state.visitor_session_id = None
        request.state.geo = {}
        return

    # Extract client IP
    ip = get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )
    
    # Set lightweight state immediately
    request.state.client_ip = ip
    request.state.geo = {}
    
    vsid: Optional[str] = request.cookies.get(SESSION_COOKIE)
    request.state.visitor_session_id = vsid

    if vsid:
        # FAST PATH: Check Redis cache for session validity
        is_valid = await _is_session_valid_cached(vsid)
        
        if is_valid:
            # Session known valid - get geo from cache and return immediately
            if ip:
                request.state.geo = await _get_geo_from_cache(ip)
                # If geo cache miss, schedule background resolution
                if not request.state.geo:
                    try:
                        asyncio.create_task(_background_resolve_geo(ip, vsid))
                    except Exception:
                        pass
            return
        
        # Cache miss - need to verify session in DB (once)
        try:
            session_exists = await db.get(VisitSession, vsid)
            if session_exists:
                # Cache for future requests
                await _cache_session_valid(vsid)
                
                # Get geo from cache
                if ip:
                    request.state.geo = await _get_geo_from_cache(ip)
                    if not request.state.geo:
                        try:
                            asyncio.create_task(_background_resolve_geo(ip, vsid))
                        except Exception:
                            pass
                return
        except Exception:
            # DB error - fall through to session creation
            pass

    # No valid session found - delegate to full session creation
    await ensure_geo_session(request, response, background_tasks, db)


async def bind_session_to_user(
    request: Request,
    user_id: str,
    db: AsyncSession,
):
    """Bind a visitor session to a user after login/signup."""
    vsid = getattr(request.state, "visitor_session_id", None)
    if not vsid:
        return
    
    try:
        sess = await db.get(VisitSession, vsid)
        if sess and not sess.user_id:
            sess.user_id = user_id
            await db.commit()
            
            # Update user IP history in background
            if sess.first_ip:
                try:
                    asyncio.create_task(_background_update_user_ip_history(
                        user_id,
                        sess.first_ip,
                        sess.first_country_code,
                        sess.first_city,
                    ))
                except Exception:
                    # Fallback to synchronous if task creation fails
                    try:
                        await upsert_user_ip_history(
                            db,
                            user_id,
                            sess.first_ip,
                            sess.first_country_code,
                            sess.first_city,
                        )
                    except Exception:
                        pass
    except Exception as e:
        logger.debug(f"bind_session_to_user failed: {e}")


async def _background_update_user_ip_history(
    user_id: str,
    ip: str,
    country_code: Optional[str],
    city: Optional[str],
) -> None:
    """Background task to update user IP history."""
    try:
        async with AsyncSessionLocal() as db:
            await upsert_user_ip_history(db, user_id, ip, country_code, city)
    except Exception as e:
        logger.debug(f"Background user IP history update failed: {e}")
