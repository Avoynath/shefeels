"""
Auth endpoints for signup, login, refresh.
"""


import asyncio

from fastapi import (
    APIRouter,
    Depends,
    HTTPException,
    status,
    Request,
    Response,
    BackgroundTasks,
)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, insert, update

# from sqlalchemy.future import select
from fastapi.responses import RedirectResponse, HTMLResponse
from sqlalchemy.exc import IntegrityError
from app.api.v1.deps_geo import bind_session_to_user
from app.core.database import AsyncSessionLocal
from app.schemas.user import UserCreate
from app.models.subscription import UserWallet, Subscription
from app.models.geo import UserIpHistory
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    SocialLoginRequest,
    SetPasswordRequest,
    ForgotPasswordRequest,
    ResetPasswordConfirm,
    ChangePasswordRequest,
    MessageResponse,
)
from app.models.user import User, UserProfile
from app.models.refresh_token import RefreshToken
from app.models.email_verification import EmailVerification
from app.models.user import UserActivation
from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.core.templates import templates
from app.core.config import settings
from app.services.email import send_email
from app.services.app_config import get_config_value_from_cache
from passlib.context import CryptContext
import uuid
from fastapi.responses import JSONResponse
from secrets import token_urlsafe
import secrets
import string
from passlib.hash import bcrypt
import datetime

from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_password,
)

from app.services.google_oauth import verify_google_id_token
from app.models.oauth_identity import OAuthIdentity
import httpx
from urllib.parse import urlencode
import re
from app.models.user import UserProfile
from app.models.user import User
from app.models.password_reset import PasswordReset
from app.core.security import create_reset_code, hash_password, verify_password
from app.core.config import settings
from app.core.templates import templates
from app.services.email import send_email
from app.services.geo import get_client_ip_from_headers
from app.services.user_geo import upsert_user_ip_history
from app.schemas.auth import ForgotPasswordRequest

COOKIE_NAME = "refresh_token"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter()


# ──────────────────────────────────────────────────────────────────────────
@router.post("/password-reset/request")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(User).where(User.email == payload.email.lower())
    user: User | None = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        # don't reveal existence
        return {"message": "If the e-mail exists, password was sent to email."}
    # ✅ HARD-CODED: Always use the canonical API host
    canonical_api_host = settings.BACKEND_URL
    api_endpoint = "v1"
    link_ttl_hours = int(await get_config_value_from_cache("SIGNUP_EMAIL_EXPIRY"))
    company_address = await get_config_value_from_cache("ADDRESS")
    support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
    app_name = await get_config_value_from_cache("APP_NAME")
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=link_ttl_hours
    )

    # create a reset audit row (optional) and also generate a one-time password
    raw_token, hashed = create_reset_code()
    reset = PasswordReset(
        user_id=user.id,
        code_hash=hashed,
        expires_at=expires_at,
    )
    db.add(reset)
    await db.commit()

    # generate a strong random password (alphanumeric + symbols)
    def _generate_strong_password(length: int = 10) -> str:
        alphabet = string.ascii_letters + string.digits + "!@#$%^&*()-_=+"
        while True:
            pwd = "".join(secrets.choice(alphabet) for _ in range(length))
            if (
                any(c.islower() for c in pwd)
                and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$%^&*()-_=+" for c in pwd)
            ):
                return pwd

    new_password = _generate_strong_password(10)

    # update user's password in DB before sending the email
    user.hashed_password = hash_password(new_password)
    # Auto-verify the user since we are sending them a working password to their email
    user.is_email_verified = True
    await db.commit()

    reset_url = (
        f"{canonical_api_host}/api/{api_endpoint}/auth/reset-password?"
        f"uid={reset.id}&token={raw_token}"
    )
    html = templates.get_template("reset_password.html").render(
        full_name=user.full_name or "Explorer",
        support_email=support_email,
        app_name=app_name,
        company_address=company_address,
        password=new_password,
        year=datetime.datetime.now(datetime.timezone.utc).year,
        backend_url=reset_url,
    )
    await send_email(
        subject=f"{app_name} - Your New Password",
        to=[user.email],
        html=html,
    )
    return {"message": "If the e-mail exists, password was sent to email."}


# ──────────────────────────────────────────────────────────────────────────
@router.post("/password-reset/confirm")
async def reset_password(
    payload: ResetPasswordConfirm,
    db: AsyncSession = Depends(get_db),
):
    # 1. Find pending reset row
    stmt = (
        select(PasswordReset, User)
        .join(User)
        .where(
            PasswordReset.id
            == payload.uid,  # uuid.UUID(payload.token.split(".")[0] or "0"*32),  # safety
            User.email == payload.email.lower(),
            PasswordReset.consumed_at.is_(None),
            PasswordReset.expires_at > datetime.datetime.now(datetime.timezone.utc),
        )
    )
    row = (await db.execute(stmt)).one_or_none()
    if not row:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    pr: PasswordReset
    user: User
    pr, user = row

    # 2. Verify token
    if not pwd_context.verify(payload.token, pr.code_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    # 3. Update user password
    user.hashed_password = hash_password(payload.new_password)
    pr.consumed_at = datetime.datetime.now(datetime.timezone.utc)

    # 4. Invalidate all refresh tokens
    await db.execute(
        update(User)
        .where(User.id == user.id)
        .values(hashed_password=user.hashed_password)
    )
    await db.commit()
    return JSONResponse(
        content={"message": "Password updated. Please log in"}, status_code=200
    )


@router.post("/signup")
async def signup(
    request: Request,
    user: UserCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    try:
        # Log DB connection info to detect deployment/DB mismatch
        try:
            db_host = db.bind.url.host if hasattr(db, 'bind') and hasattr(db.bind.url, 'host') else "unknown"
            db_name = db.bind.url.database if hasattr(db, 'bind') and hasattr(db.bind.url, 'database') else "unknown"
            print(f"[SIGNUP] DB: {db_host}/{db_name}")
        except Exception as e:
            print(f"[SIGNUP] Could not extract DB info: {e}")
        
        print("[DEBUG] Start signup endpoint")
        print("[DEBUG] Hashing password")
        hashed_pw = pwd_context.hash(user.password)
        full_name = (user.email).split("@")[0].replace(".", " ")
        user_email = user.email.lower()
        print("[DEBUG] Creating User object")
        # Handle existing user with this email
        stmt_user = select(User).where(User.email == user_email)
        existing_user: User | None = (await db.execute(stmt_user)).scalar_one_or_none()
        
        if existing_user:
            if existing_user.is_email_verified:
                print("[DEBUG] User already verified")
                raise HTTPException(status_code=400, detail="Email already registered. Please sign in.")
            
            # Unverified user - clean up to allow fresh signup
            print(f"[DEBUG] Found unverified User {existing_user.id}; cleaning up for re-signup")
            
            # Delete any existing verification tokens
            await db.execute(delete(EmailVerification).where(EmailVerification.user_id == existing_user.id))
            
            # Delete IP history to avoid FK constraints
            try:
                await db.execute(delete(UserIpHistory).where(UserIpHistory.user_id == existing_user.id))
            except Exception:
                pass
                
            await db.delete(existing_user)
            await db.commit()

        # Auto-verify on signup: skip email verification to reduce friction
        db_user = User(
            email=user.email,
            hashed_password=hashed_pw,
            full_name=full_name,
            is_active=True,
            is_email_verified=True,
        )
        print("[DEBUG] Adding user to DB session")
        db.add(db_user)
        try:
            await db.commit()
        except IntegrityError:
            print("[DEBUG] IntegrityError: Email already registered")
            await db.rollback()
            raise HTTPException(status_code=400, detail="Email already registered")
        print("[DEBUG] Refreshing user from DB")
        await db.refresh(db_user)
        print("[DEBUG] User created with id:", db_user.id)
        user_id = db_user.id

        # Create UserProfile immediately (previously done during email verification)
        stmt_profile = select(UserProfile).where(UserProfile.user_id == user_id)
        profile = (await db.execute(stmt_profile)).scalar_one_or_none()
        if not profile:
            new_profile = UserProfile(
                user_id=user_id,
                full_name=full_name,
                email_id=user.email,
            )
            db.add(new_profile)

        # Create UserWallet with signup coin reward immediately
        stmt_wallet = select(UserWallet).where(UserWallet.user_id == user_id)
        user_wallet = (await db.execute(stmt_wallet)).scalar_one_or_none()
        if not user_wallet:
            user_wallet = UserWallet(user_id=user_id)
            user_wallet.coin_balance = int(
                await get_config_value_from_cache("SIGNUP_COIN_REWARD")
            )
            db.add(user_wallet)
        await db.commit()

        # Generate access + refresh tokens (same as login flow)
        access_token = create_access_token(str(user_id))
        raw_refresh, hashed_refresh = create_refresh_token()
        login_expiry_in_days = int(await get_config_value_from_cache("LOGIN_EXPIRY"))
        expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
            days=login_expiry_in_days
        )
        await db.execute(
            insert(RefreshToken).values(
                user_id=user_id,
                token_hash=hashed_refresh,
                user_agent=request.headers.get("user-agent"),
                ip_address=getattr(request.state, "client_ip", None),
                expires_at=expires_at,
            )
        )
        await db.commit()

        # Send welcome email in background (no verification needed)
        try:
            company_address = await get_config_value_from_cache("ADDRESS")
            support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
            app_name = await get_config_value_from_cache("APP_NAME")
            canonical_api_host = settings.BACKEND_URL
            dashboard_url = settings.FRONTEND_URL

            html = templates.get_template("welcome_email.html").render(
                full_name=(full_name or "Explorer"),
                dashboard_url=dashboard_url,
                year=datetime.datetime.now(datetime.timezone.utc).year,
                app_name=app_name,
                support_email=support_email,
                company_address=company_address,
                backend_url=canonical_api_host,
            )
            background_tasks.add_task(
                send_email,
                subject=f"Welcome to {app_name}!",
                to=[user.email],
                html=html,
            )
        except Exception as e:
            print(f"[SIGNUP] Failed to schedule welcome email: {e}")

        # Session binding and IP history
        ip = getattr(request.state, "client_ip", None) or get_client_ip_from_headers(
            request.headers, request.client.host if request.client else None
        )
        geo = getattr(request.state, "geo", {}) or {}
        if not geo and ip:
            try:
                from app.models.geo import IpLocationCache

                rec = await db.get(IpLocationCache, ip)
                if rec:
                    geo = {"country_code": rec.country_code, "city": rec.city}
            except Exception:
                geo = {}

        async def _bg_bind_and_ip(user_id, ip_addr, country_code, city, req):
            try:
                async with AsyncSessionLocal() as bg_db:
                    await bind_session_to_user(req, user_id, bg_db)
                    await upsert_user_ip_history(
                        bg_db, user_id, ip_addr, country_code, city
                    )
            except Exception:
                return

        try:
            background_tasks.add_task(
                _bg_bind_and_ip,
                db_user.id,
                ip,
                geo.get("country_code"),
                geo.get("city"),
                request,
            )
        except Exception:
            await bind_session_to_user(request, db_user.id, db)
            await upsert_user_ip_history(
                db, db_user.id, ip, geo.get("country_code"), geo.get("city")
            )

        # Build user data dict (same shape as login response)
        coin_balance = user_wallet.coin_balance if user_wallet else 0
        user_data = {
            "id": db_user.id,
            "email": db_user.email,
            "full_name": str(full_name),
            "is_active": True,
            "is_email_verified": True,
            "subscription_status": "free",
            "coin_balance": coin_balance,
            "created_at": str(db_user.created_at) if db_user.created_at else None,
            "updated_at": str(db_user.updated_at) if db_user.updated_at else None,
        }

        return JSONResponse(
            content={
                "access_token": access_token,
                "token_type": "bearer",
                "user": user_data,
            },
            status_code=201,
        )
    except HTTPException:
        # Re-raise HTTPException so FastAPI returns proper status code
        raise
    except Exception as e:
        import traceback

        print("[ERROR] Internal server error in signup:", e)
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Internal server error")


@router.post("/resend-verification")
async def resend_verification(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Regenerate and resend an email verification token for an existing unverified user.
    This endpoint is intentionally conservative: if a live, unexpired token exists
    we won't create a duplicate — we instruct the user to check their inbox.
    """
    email = payload.email.lower()
    stmt = select(User).where(User.email == email)
    user: User | None = (await db.execute(stmt)).scalar_one_or_none()
    if not user:
        # Do not reveal whether the account exists. Return a generic message.
        return JSONResponse(
            content={"message": "If an account exists, a verification email was sent."},
            status_code=200,
        )
    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    now = datetime.datetime.now(datetime.timezone.utc)
    stmt_ev = select(EmailVerification).where(
        EmailVerification.user_id == user.id,
        EmailVerification.consumed_at.is_(None),
    )
    existing_ev: EmailVerification | None = (
        await db.execute(stmt_ev)
    ).scalar_one_or_none()
    if existing_ev:
        # If it's very recent (e.g. within 30 seconds), maybe rate limit? 
        # For now, allowing it is better for debugging and fixing broken links.
        print(f"[DEBUG] Replacing existing EmailVerification for user {user.id}")
        await db.delete(existing_ev)
        await db.commit()

    # Remove any expired/unused verification rows for this user
    if existing_ev:
        try:
            await db.delete(existing_ev)
            await db.commit()
        except Exception:
            await db.rollback()

    # Create new verification token
    raw_token = token_urlsafe(32)
    tok_hash = bcrypt.hash(raw_token)
    signup_expiry_hours = int(
        await get_config_value_from_cache("SIGNUP_EMAIL_EXPIRY")
    )
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        hours=signup_expiry_hours
    )
    email_ver = EmailVerification(
        user_id=user.id,
        code_hash=tok_hash,
        sent_to_email=user.email,
        expires_at=expires_at,
    )
    db.add(email_ver)
    await db.commit()

    # ✅ HARD-CODED: Always use the canonical API host
    canonical_api_host = settings.BACKEND_URL
    api_version = "v1"

    verify_url = (
        f"{canonical_api_host}/api/{api_version}/auth/verify-email?token={raw_token}"
        f"&uid={email_ver.id}"
    )
    print(f"[RESEND] ✅ Verification URL: {verify_url}")
    company_address = await get_config_value_from_cache("ADDRESS")
    support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
    app_name = await get_config_value_from_cache("APP_NAME")
    # Determine a public logo URL for emails
    logo_url = f"{canonical_api_host}/static/Branding%20with%20text.png"
    html = templates.get_template("verify_email.html").render(
        app_name=app_name,
        link_ttl_hours=signup_expiry_hours,
        support_email=support_email,
        company_address=company_address,
        full_name=(user.full_name or (user.email.split("@")[0].replace(".", " "))),
        verify_link=verify_url,
        year=datetime.datetime.now(datetime.timezone.utc).year,
        logo_url=logo_url,
    )

    background_tasks.add_task(
        send_email,
        subject="Please verify your email",
        to=[user.email],
        html=html,
    )

    return JSONResponse(content={"message": "Verification email sent"}, status_code=200)


@router.get("/verify-email")
async def verify_email(
    request: Request,
    uid: str,
    token: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db)
):
    now = datetime.datetime.now(datetime.timezone.utc)
    
    # ✅ SAFETY LOG: Track DB connection to detect deployment/DB mismatch
    try:
        db_url = str(db.bind.url) if hasattr(db, 'bind') else "unknown"
        db_host = db.bind.url.host if hasattr(db, 'bind') and hasattr(db.bind.url, 'host') else "unknown"
        db_name = db.bind.url.database if hasattr(db, 'bind') and hasattr(db.bind.url, 'database') else "unknown"
        print(f"[VERIFY] ✅ DB: {db_host}/{db_name}")
        print(f"[VERIFY] ✅ DATABASE_URL from settings: {settings.DATABASE_URL[:50]}...")
    except Exception as e:
        print(f"[VERIFY] Could not extract DB info: {e}")
    
    print(f"[VERIFY] Request received: uid={uid}, token_len={len(token)}, now={now}")
    
    stmt = select(EmailVerification).where(
        EmailVerification.id == uid,
        EmailVerification.consumed_at.is_(None),
        EmailVerification.expires_at > now,
    )
    ev: EmailVerification | None = (await db.execute(stmt)).scalar_one_or_none()
    
    if not ev:
        # Check if row exists at all (without filters) to distinguish the failure reason
        stmt_any = select(EmailVerification).where(EmailVerification.id == uid)
        ev_any = (await db.execute(stmt_any)).scalar_one_or_none()
        
        if not ev_any:
            print(f"[VERIFY] ❌ No EmailVerification row exists for uid={uid}")
        elif ev_any.consumed_at is not None:
            print(f"[VERIFY] ❌ EmailVerification already consumed at {ev_any.consumed_at} for uid={uid}")
        elif ev_any.expires_at <= now:
            print(f"[VERIFY] ❌ EmailVerification expired at {ev_any.expires_at} (now={now}) for uid={uid}")
        else:
            print(f"[VERIFY] ❌ EmailVerification exists but failed filter for uid={uid}")
        
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    
    # Log hash details for debugging truncation issues
    hash_len = len(ev.code_hash) if ev.code_hash else 0
    print(f"[VERIFY] Found EmailVerification: user_id={ev.user_id}, hash_len={hash_len}, expires_at={ev.expires_at}")
    
    # Verify token with detailed error handling
    try:
        token_valid = bcrypt.verify(token, ev.code_hash)
    except Exception as e:
        print(f"[VERIFY] ❌ bcrypt.verify exception: {e}, hash_len={hash_len}")
        raise HTTPException(status_code=400, detail="Invalid or expired link")
    
    if not token_valid:
        print(f"[VERIFY] ❌ Token mismatch for uid={uid}, hash_len={hash_len}")
        raise HTTPException(status_code=400, detail="Invalid or expired link")

    print(f"[DEBUG] EmailVerification successful for user {ev.user_id}")

    # mark consumed + activate user
    ev.consumed_at = datetime.datetime.now(datetime.timezone.utc)
    user = await db.get(User, ev.user_id)
    user.is_email_verified = True
    # ensure a UserProfile exists for this user (create if missing)
    stmt_profile = select(UserProfile).where(UserProfile.user_id == user.id)
    profile = (await db.execute(stmt_profile)).scalar_one_or_none()
    if not profile:
        full_name = (
            user.full_name or (user.email.split("@")[0].replace(".", " "))
            if user.email
            else None
        )
        new_profile = UserProfile(
            user_id=user.id,
            full_name=full_name,
            email_id=user.email,
        )
        db.add(new_profile)
    await db.commit()

    # --- Send Welcome Email ---
    try:
        support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
        company_address = await get_config_value_from_cache("ADDRESS")
        app_name = await get_config_value_from_cache("APP_NAME")
        dashboard_url = settings.FRONTEND_URL

        html = templates.get_template("welcome_email.html").render(
            full_name=(user.full_name or "Explorer"),
            dashboard_url=dashboard_url,
            year=datetime.datetime.now(datetime.timezone.utc).year,
            app_name=app_name,
            support_email=support_email,
            company_address=company_address,
            backend_url=settings.BACKEND_URL,
        )
        
        background_tasks.add_task(
            send_email,
            subject=f"Welcome to {app_name}!",
            to=[user.email],
            html=html,
        )
    except Exception as e:
        print(f"[ERROR] Failed to schedule welcome email: {e}")



    """
    Get the user's coin balance.
    """
    stmt = select(UserWallet).where(UserWallet.user_id == user.id)
    result = await db.execute(stmt)
    user_wallet = result.scalar_one_or_none()
    if not user_wallet:
        user_wallet = UserWallet(user_id=user.id)
        user_wallet.coin_balance = int(
            await get_config_value_from_cache("SIGNUP_COIN_REWARD")
        )
        db.add(user_wallet)
    await db.commit()

    ### --- AUTO-LOGIN LOGIC ---
    access_token = create_access_token(str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token()
    login_expiry_in_days = int(await get_config_value_from_cache("LOGIN_EXPIRY"))
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=login_expiry_in_days
    )
    await db.execute(
        insert(RefreshToken).values(
            user_id=user.id,
            token_hash=hashed_refresh,
            user_agent=None,
            ip_address=None,
            expires_at=expires_at,
        )
    )
    await db.commit()
    
    await bind_session_to_user(request, user.id, db)

    ip = getattr(request.state, "client_ip", None) or get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )
    geo = getattr(request.state, "geo", {}) or {}
    if not geo and ip:
        try:
            from app.models.geo import IpLocationCache

            rec = await db.get(IpLocationCache, ip)
            if rec:
                geo = {"country_code": rec.country_code, "city": rec.city}
        except Exception:
            geo = {}

    await upsert_user_ip_history(
        db, user.id, ip, geo.get("country_code"), geo.get("city")
    )
    # If the visitor session is already bound to a different user, create
    # a fresh VisitSession for this newly-verified user so dashboard/analytics
    # associate geo/visits with the correct account.
    new_vsid: str | None = None
    try:
        from app.models.geo import VisitSession
        from app.api.v1.deps_geo import SESSION_COOKIE

        vsid = getattr(request.state, "visitor_session_id", None)
        if vsid:
            sess = await db.get(VisitSession, vsid)
            if sess and sess.user_id and sess.user_id != user.id:
                # existing session belongs to another user — create a new one
                new_vsid = uuid.uuid4().hex[:32]
                new_sess = VisitSession(
                    id=new_vsid,
                    user_id=user.id,
                    first_ip=ip,
                    first_country_code=geo.get("country_code"),
                    first_city=geo.get("city"),
                    user_agent=request.headers.get("user-agent"),
                    utm_source=request.query_params.get("utm_source"),
                    utm_medium=request.query_params.get("utm_medium"),
                    utm_campaign=request.query_params.get("utm_campaign"),
                    referrer=request.headers.get("referer"),
                )
                db.add(new_sess)
                await db.commit()
        else:
            # No visitor session present: create one bound to this user so
            # future analytics are associated correctly.
            new_vsid = uuid.uuid4().hex[:32]
            new_sess = VisitSession(
                id=new_vsid,
                user_id=user.id,
                first_ip=ip,
                first_country_code=geo.get("country_code"),
                first_city=geo.get("city"),
                user_agent=request.headers.get("user-agent"),
                utm_source=request.query_params.get("utm_source"),
                utm_medium=request.query_params.get("utm_medium"),
                utm_campaign=request.query_params.get("utm_campaign"),
                referrer=request.headers.get("referer"),
            )
            db.add(new_sess)
            await db.commit()
    except Exception:
        # Best-effort: do not fail the request if session creation fails
        new_vsid = None

    frontend_url = settings.FRONTEND_URL
    COOKIE_MAX_AGE = int(await get_config_value_from_cache("LOGIN_EXPIRY")) * 60 * 60 * 24
    
    # Create HTML response that sets token in localStorage and redirects
    # For local development where ports differ, we also append the token to the URL fragment
    # so the frontend can catch it and store it in its own localStorage.
    redirect_url = f"{frontend_url}/login#access_token={access_token}"
    
    html_content = f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Verified | {app_name}</title>
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
        <style>
            :root {{
                --primary: #27C460;
                --primary-glow: rgba(39, 196, 96, 0.4);
                --bg: #000000;
                --card-bg: rgba(18, 18, 18, 0.8);
            }}
            * {{ margin: 0; padding: 0; box-sizing: border-box; }}
            body {{
                font-family: 'Inter', sans-serif;
                background-color: var(--bg);
                background-image: 
                    radial-gradient(circle at 20% 20%, rgba(39, 196, 96, 0.08) 0%, transparent 40%),
                    radial-gradient(circle at 80% 80%, rgba(39, 196, 96, 0.08) 0%, transparent 40%);
                height: 100vh;
                display: flex;
                align-items: center;
                justify-content: center;
                color: white;
                overflow: hidden;
            }}
            .container {{
                position: relative;
                z-index: 10;
                width: 100%;
                max-width: 440px;
                padding: 20px;
            }}
            .card {{
                background: var(--card-bg);
                backdrop-filter: blur(24px);
                -webkit-backdrop-filter: blur(24px);
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 32px;
                padding: 56px 32px;
                text-align: center;
                box-shadow: 0 24px 64px rgba(0, 0, 0, 0.6);
                animation: slideUp 0.8s cubic-bezier(0.16, 1, 0.3, 1);
            }}
            @keyframes slideUp {{
                from {{ opacity: 0; transform: translateY(30px) scale(0.95); }}
                to {{ opacity: 1; transform: translateY(0) scale(1); }}
            }}
            .icon-box {{
                width: 88px;
                height: 88px;
                background: rgba(39, 196, 96, 0.1);
                border-radius: 28px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin: 0 auto 32px;
                position: relative;
                border: 1px solid rgba(39, 196, 96, 0.2);
            }}
            .checkmark {{
                color: var(--primary);
                font-size: 44px;
                line-height: 1;
                filter: drop-shadow(0 0 10px var(--primary-glow));
            }}
            h1 {{
                font-size: 32px;
                font-weight: 700;
                margin-bottom: 12px;
                letter-spacing: -0.03em;
            }}
            p {{
                color: rgba(255, 255, 255, 0.6);
                font-size: 16px;
                line-height: 1.6;
                margin-bottom: 40px;
            }}
            .loading-container {{
                margin-top: 24px;
            }}
            .loading-bar {{
                width: 100%;
                height: 6px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
                overflow: hidden;
                margin-bottom: 12px;
            }}
            .progress {{
                width: 0%;
                height: 100%;
                background: linear-gradient(90deg, var(--primary), #34D399);
                box-shadow: 0 0 15px var(--primary-glow);
                animation: progress 2s cubic-bezier(0.4, 0, 0.2, 1) forwards;
            }}
            @keyframes progress {{
                from {{ width: 0%; }}
                to {{ width: 100%; }}
            }}
            .redirect-text {{
                font-size: 12px;
                font-weight: 700;
                color: var(--primary);
                text-transform: uppercase;
                letter-spacing: 0.1em;
                opacity: 0.8;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="card">
                <div class="icon-box">
                    <span class="checkmark">✓</span>
                </div>
                <h1>Verified!</h1>
                <p>Welcome to {app_name}. Your account is now active and ready for use.</p>
                
                <div class="loading-container">
                    <div class="loading-bar">
                        <div class="progress"></div>
                    </div>
                    <div class="redirect-text">Redirecting you home...</div>
                </div>
            </div>
        </div>
        
        <script>
            // Ensure clean state
            localStorage.clear();
            sessionStorage.clear();
            
            // Store the token securely
            localStorage.setItem('hl_token', '{access_token}');
            
            // Redirect after a short delay for the animation to play
            setTimeout(() => {{
                window.location.href = '{redirect_url}';
            }}, 2200);
        </script>
    </body>
    </html>
    """
    
    response = HTMLResponse(content=html_content, status_code=200)
    
    # First, delete any existing refresh_token cookie to prevent cross-account issues
    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=not settings.DEBUG,
        samesite="lax",
    )
    
    # Then set the new refresh token for this user
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="lax",
        path="/",
    )
    # If we created a fresh VisitSession for this user, update the visitor
    # session cookie so future requests are correctly associated.
    if new_vsid:
        try:
            from app.api.v1.deps_geo import SESSION_COOKIE

            response.delete_cookie(
                key=SESSION_COOKIE,
                path="/",
                secure=not settings.DEBUG,
                samesite="Lax",
            )
            response.set_cookie(
                key=SESSION_COOKIE,
                value=new_vsid,
                max_age=COOKIE_MAX_AGE,
                httponly=True,
                secure=(request.url.scheme == "https"),
                samesite="Lax",
                path="/",
            )
        except Exception:
            pass
    return response


@router.get("/activate-user")
async def activate_user(uid: str, token: str, db: AsyncSession = Depends(get_db)):
    """
    Validates the activation link and redirects to the frontend to set a password.
    """
    try:
        stmt = select(UserActivation).where(
            UserActivation.id == uid,
            UserActivation.consumed_at.is_(None),
            UserActivation.expires_at > datetime.datetime.now(datetime.timezone.utc),
        )
        activation: UserActivation | None = (
            await db.execute(stmt)
        ).scalar_one_or_none()

        if not activation or not verify_password(token, activation.token_hash):
            frontend_url = (
                await get_config_value_from_cache("FRONTEND_URL")
                or settings.FRONTEND_URL
            )
            error_url = f"{frontend_url}/activation-failed"
            return RedirectResponse(url=error_url)

        frontend_url = (
            await get_config_value_from_cache("FRONTEND_URL") or settings.FRONTEND_URL
        )
        redirect_url = f"{frontend_url}/users/set-password?uid={uid}&token={token}"
        print(f"[DEBUG] Redirecting to: {redirect_url}")
        return RedirectResponse(url=redirect_url)

    except Exception as e:
        await db.rollback()
        print(f"[ERROR] User activation link validation failed: {e}")
        try:
            frontend_url = (
                await get_config_value_from_cache("FRONTEND_URL")
                or settings.FRONTEND_URL
            )
            fatal_error_url = f"{frontend_url}/activation-error"
            return RedirectResponse(url=fatal_error_url)
        except Exception as cache_e:
            print(f"Failed to get frontend_url from cache: {cache_e}")
            return JSONResponse(
                status_code=500,
                content={
                    "detail": "A critical error occurred during activation link validation."
                },
            )


@router.post("/set-password")
async def set_password_after_activation(
    req: SetPasswordRequest, db: AsyncSession = Depends(get_db)
):
    """
    Sets the user's password and activates their account after email validation.
    """
    try:
        stmt = select(UserActivation).where(
            UserActivation.id == req.uid,
            UserActivation.consumed_at.is_(None),
            UserActivation.expires_at > datetime.datetime.now(datetime.timezone.utc),
        )
        activation: UserActivation | None = (
            await db.execute(stmt)
        ).scalar_one_or_none()

        if not activation or not verify_password(req.token, activation.token_hash):
            raise HTTPException(
                status_code=400, detail="Invalid or expired activation link."
            )

        user = await db.get(User, activation.user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found.")

        user.hashed_password = hash_password(req.password)
        user.is_active = True
        user.is_email_verified = True
        activation.consumed_at = datetime.datetime.now(datetime.timezone.utc)

        await db.commit()

        return {"message": f"User {user.email} activated successfully."}

    except Exception as e:
        await db.rollback()
        print(f"[ERROR] Setting password after activation failed: {e}")
        raise HTTPException(status_code=500, detail="An unexpected error occurred.")


@router.post("/login", response_model=LoginResponse)
async def login(
    req: LoginRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    # 1. locate user
    stmt = select(User).where(User.email == req.email.lower())
    user: User | None = (await db.execute(stmt)).scalar_one_or_none()

    if not user or not verify_password(req.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )

    if not user.is_email_verified:
        raise HTTPException(status_code=403, detail="E-mail not verified")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is blocked or inactive")
    # 2. create tokens
    access_token = create_access_token(str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token()

    # 3. OPTIONAL: rotate -- delete any expired tokens for this user
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.expires_at < datetime.datetime.now(datetime.timezone.utc),
        )
    )
    ip_for_tokens = getattr(
        request.state, "client_ip", None
    ) or get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )
    # 4. insert new refresh row
    login_expiry_in_days = int(await get_config_value_from_cache("LOGIN_EXPIRY"))
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=login_expiry_in_days
    )
    await db.execute(
        insert(RefreshToken).values(
            user_id=user.id,
            token_hash=hashed_refresh,
            user_agent=request.headers.get("user-agent"),
            ip_address=ip_for_tokens,
            expires_at=expires_at,
        )
    )
    await db.commit()
    COOKIE_MAX_AGE = (
        int(await get_config_value_from_cache("LOGIN_EXPIRY")) * 60 * 60 * 24
    )

    # 5. send cookie (HttpOnly, Secure in prod)
    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="none",
        path="/",
    )

    # include serialized user details in the response
    # ensure we never return None for full_name (UserRead.full_name is required)
    full_name = user.full_name or (
        user.email.split("@")[0].replace(".", " ") if user.email else ""
    )

    # Normalize role to return the underlying value or name (avoid Enum representation like 'RoleEnum.ADMIN')
    try:
        role_value = (
            getattr(user.role, "value", None)
            or getattr(user.role, "name", None)
            or str(user.role)
        )
    except Exception:
        role_value = str(user.role)

    # Execute all user data queries in parallel for faster response
    subscription_stmt = select(Subscription).where(Subscription.user_id == user.id)
    wallet_stmt = select(UserWallet).where(UserWallet.user_id == user.id)
    location_stmt = (
        select(UserIpHistory.location_country_code, UserIpHistory.location_city)
        .where(UserIpHistory.user_id == user.id)
        .order_by(UserIpHistory.last_seen_at.desc())
        .limit(1)
    )

    # Execute sequentially to avoid AsyncSession concurrent-operation errors
    subs_result = await db.execute(subscription_stmt)
    wallet_result = await db.execute(wallet_stmt)
    location_result = await db.execute(location_stmt)

    subs = subs_result.scalar_one_or_none()
    subscription_status = "free"
    if subs and subs.status == "active":
        subscription_status = "active"

    wallet = wallet_result.scalar_one_or_none()
    coin_balance = wallet.coin_balance if wallet else 0

    location_result = location_result.first()
    country, city = (
        (location_result[0], location_result[1]) if location_result else (None, None)
    )

    user_data = {
        "id": user.id,
        "email": user.email,
        "full_name": str(full_name),
        "role": role_value,
        "is_active": bool(user.is_active),
        "is_email_verified": bool(user.is_email_verified),
        "subscription_status": subscription_status,
        "coin_balance": coin_balance,
        "country": country,
        "city": city,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

    # Parallelize session binding and IP history operations
    ip = getattr(request.state, "client_ip", None)
    geo = getattr(request.state, "geo", {}) or {}
    # Use cached DB geo if fast-path empty so login isn't blocked by resolution
    if not geo and ip:
        try:
            from app.models.geo import IpLocationCache

            rec = await db.get(IpLocationCache, ip)
            if rec:
                geo = {"country_code": rec.country_code, "city": rec.city}
        except Exception:
            geo = {}

    print(f"[DEBUG] Logging IP history for user {user.id}, IP: {ip}, Geo: {geo}")

    # Bind or rotate visitor session if needed (same logic as verify-email/oauth)
    new_vsid: str | None = None
    try:
        from app.models.geo import VisitSession
        
        vsid = getattr(request.state, "visitor_session_id", None)
        if vsid:
            sess = await db.get(VisitSession, vsid)
            if sess and sess.user_id and sess.user_id != user.id:
                # existing session belongs to another user — create new VisitSession
                new_vsid = uuid.uuid4().hex[:32]
                new_sess = VisitSession(
                    id=new_vsid,
                    user_id=user.id,
                    first_ip=ip,
                    first_country_code=geo.get("country_code"),
                    first_city=geo.get("city"),
                    user_agent=request.headers.get("user-agent"),
                    utm_source=request.query_params.get("utm_source"),
                    utm_medium=request.query_params.get("utm_medium"),
                    utm_campaign=request.query_params.get("utm_campaign"),
                    referrer=request.headers.get("referer"),
                )
                db.add(new_sess)
                await db.commit()
            else:
                # session exists and is either unbound or already bound to this user
                await bind_session_to_user(request, user.id, db)
        else:
            # No visitor session — bind will be no-op; create a new one
            new_vsid = uuid.uuid4().hex[:32]
            new_sess = VisitSession(
                id=new_vsid,
                user_id=user.id,
                first_ip=ip,
                first_country_code=geo.get("country_code"),
                first_city=geo.get("city"),
                user_agent=request.headers.get("user-agent"),
                utm_source=request.query_params.get("utm_source"),
                utm_medium=request.query_params.get("utm_medium"),
                utm_campaign=request.query_params.get("utm_campaign"),
                referrer=request.headers.get("referer"),
            )
            db.add(new_sess)
            await db.commit()
    except Exception:
        new_vsid = None

    await upsert_user_ip_history(
        db, user.id, ip, geo.get("country_code"), geo.get("city")
    )

    # If we created a fresh VisitSession, update the response to set the new vsid cookie
    if new_vsid:
        try:
            from app.api.v1.deps_geo import SESSION_COOKIE, COOKIE_MAX_AGE as GEO_COOKIE_MAX
            
            response.delete_cookie(
                key=SESSION_COOKIE,
                path="/",
                secure=not settings.DEBUG,
                samesite="Lax",
            )
            response.set_cookie(
                key=SESSION_COOKIE,
                value=new_vsid,
                max_age=GEO_COOKIE_MAX,
                httponly=True,
                secure=(request.url.scheme == "https"),
                samesite="Lax",
                path="/",
            )
        except Exception:
            pass

    # Checkout Champ reconciliation removed. If migrating to a new payment
    # provider, add background reconciliation logic here as needed.

    return LoginResponse(access_token=access_token, user=user_data)


@router.get("/google/callback")
async def google_callback(code: str | None = None, state: str | None = None, request: Request = None, response: Response = None, db: AsyncSession = Depends(get_db)):
    """Handle Google OAuth2 authorization code callback.

    Exchanges the authorization code for tokens, verifies the ID token,
    then links/creates a local user and sets the refresh cookie before
    redirecting the browser back to the frontend.
    """
    if not code:
        raise HTTPException(status_code=400, detail="Missing authorization code")

    # Build redirect_uri that must match what was registered in Google Console.
    # Use the shared helper so the same exact redirect URI is used during
    # both the authorization request and the token exchange.
    redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URL

    token_endpoint = "https://oauth2.googleapis.com/token"
    client_id = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET
    if not client_id or not client_secret:
        raise HTTPException(status_code=500, detail="Google client id/secret not configured")

    async with httpx.AsyncClient() as client:
        data = {
            "code": code,
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        }
        resp = await client.post(token_endpoint, data=data, headers={"Accept": "application/json"})
        try:
            token_response = resp.json()
        except Exception:
            raise HTTPException(status_code=500, detail="Failed to parse token response from Google")

    if resp.status_code != 200 or "id_token" not in token_response:
        raise HTTPException(status_code=400, detail=f"Failed to exchange code: {token_response}")

    id_token_str = token_response["id_token"]
    # Verify id_token and extract payload
    gpayload = verify_google_id_token(id_token_str)

    provider = "google"
    provider_user_id = gpayload.get("sub")
    email = gpayload.get("email")
    full_name = gpayload.get("name") or (email.split("@")[0].replace('.', ' ') if email else None)
    avatar = gpayload.get("picture")

    # 1. Check for existing OAuth identity
    stmt = select(OAuthIdentity).where(
        OAuthIdentity.provider == provider,
        OAuthIdentity.provider_user_id == provider_user_id,
    )
    oauth_row: OAuthIdentity | None = (await db.execute(stmt)).scalar_one_or_none()
    user: User | None = None

    if oauth_row:
        user = await db.get(User, oauth_row.user_id)
        # Ensure user is verified if they are logging in with Google
        if user and not user.is_email_verified:
            user.is_email_verified = True
            await db.commit()

    # 2. If no oauth_row found, try matching by email
    if not user and email:
        stmt_u = select(User).where(User.email == email.lower())
        existing_user: User | None = (await db.execute(stmt_u)).scalar_one_or_none()
        if existing_user:
            user = existing_user
            # create oauth link
            new_oauth = OAuthIdentity(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                full_name=full_name,
                avatar_url=avatar,
            )
            db.add(new_oauth)
            # If user was unverified but is now linking a trusted Google account, verify them
            if not user.is_email_verified:
                user.is_email_verified = True
            await db.commit()

    # 3. If still no user, create account (email verified)
    if not user:
        random_pw = token_urlsafe(32)
        db_user = User(
            email=email,
            hashed_password=hash_password(random_pw),
            full_name=full_name,
            is_active=True,
            is_email_verified=True,
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        user = db_user
        new_oauth = OAuthIdentity(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            full_name=full_name,
            avatar_url=avatar,
        )
        db.add(new_oauth)
        await db.commit()

    if not user:
        raise HTTPException(status_code=400, detail="Unable to resolve user from Google token")

    # create tokens + save refresh
    access_token = create_access_token(str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token()
    login_expiry_in_days = int(await get_config_value_from_cache("LOGIN_EXPIRY"))
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=login_expiry_in_days
    )
    await db.execute(
        insert(RefreshToken).values(
            user_id=user.id,
            token_hash=hashed_refresh,
            user_agent=None,
            ip_address=None,
            expires_at=expires_at,
        )
    )
    await db.commit()

    COOKIE_MAX_AGE = int(await get_config_value_from_cache("LOGIN_EXPIRY")) * 60 * 60 * 24

    # Bind or rotate visitor session for this user (avoid associating another
    # user's VisitSession with this newly-signed-in OAuth user).
    new_vsid: str | None = None
    try:
        from app.models.geo import VisitSession

        vsid = getattr(request.state, "visitor_session_id", None)
        if vsid:
            sess = await db.get(VisitSession, vsid)
            if sess and sess.user_id and sess.user_id != user.id:
                # session belongs to a different user — create new VisitSession
                new_vsid = uuid.uuid4().hex[:32]
                new_sess = VisitSession(
                    id=new_vsid,
                    user_id=user.id,
                    first_ip=getattr(request.state, "client_ip", None),
                    first_country_code=(getattr(request.state, "geo", {}) or {}).get("country_code"),
                    first_city=(getattr(request.state, "geo", {}) or {}).get("city"),
                    user_agent=request.headers.get("user-agent"),
                    utm_source=request.query_params.get("utm_source"),
                    utm_medium=request.query_params.get("utm_medium"),
                    utm_campaign=request.query_params.get("utm_campaign"),
                    referrer=request.headers.get("referer"),
                )
                db.add(new_sess)
                await db.commit()
        else:
            # No visitor session present: create a new one bound to this user
            new_vsid = uuid.uuid4().hex[:32]
            new_sess = VisitSession(
                id=new_vsid,
                user_id=user.id,
                first_ip=getattr(request.state, "client_ip", None),
                first_country_code=(getattr(request.state, "geo", {}) or {}).get("country_code"),
                first_city=(getattr(request.state, "geo", {}) or {}).get("city"),
                user_agent=request.headers.get("user-agent"),
                utm_source=request.query_params.get("utm_source"),
                utm_medium=request.query_params.get("utm_medium"),
                utm_campaign=request.query_params.get("utm_campaign"),
                referrer=request.headers.get("referer"),
            )
            db.add(new_sess)
            await db.commit()
    except Exception:
        new_vsid = None

    # Update user IP history for location tracking
    ip = getattr(request.state, "client_ip", None) or get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )
    geo = getattr(request.state, "geo", {}) or {}
    # If geo isn't available yet, try a fast DB cache lookup
    if not geo and ip:
        try:
            from app.models.geo import IpLocationCache
            rec = await db.get(IpLocationCache, ip)
            if rec:
                geo = {"country_code": rec.country_code, "city": rec.city}
        except Exception:
            geo = {}

    await upsert_user_ip_history(
        db, user.id, ip, geo.get("country_code"), geo.get("city")
    )

    # Return HTML page that posts token to opener and auto-closes popup
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login Successful</title>
    </head>
    <body>
        <script>
        try {{
            if (window.opener) {{
                window.opener.postMessage({{ 
                    type: "google-oauth-token", 
                    token: "{access_token}" 
                }}, "*");
                window.close();
            }} else {{
                // Fallback: if not a popup, redirect to frontend dashboard
                window.location.href = "{settings.FRONTEND_URL}/dashboard";
            }}
        }} catch (e) {{
            console.error("postMessage failed", e);
            window.close();
        }}
        </script>
        <p>Login successful. This window will close automatically...</p>
    </body>
    </html>
    """
    
    response = HTMLResponse(content=html_content, status_code=200)

    # Rotate refresh cookie safely: delete old then set new
    try:
        response.delete_cookie(
            key=COOKIE_NAME,
            path="/",
            secure=not settings.DEBUG,
            samesite="none",
        )
    except Exception:
        pass

    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="none",
        path="/",
    )

    # If we created a fresh VisitSession, set the vsid cookie for the browser
    if new_vsid:
        try:
            from app.api.v1.deps_geo import SESSION_COOKIE

            response.delete_cookie(
                key=SESSION_COOKIE,
                path="/",
                secure=not settings.DEBUG,
                samesite="Lax",
            )
            response.set_cookie(
                key=SESSION_COOKIE,
                value=new_vsid,
                max_age=COOKIE_MAX_AGE,
                httponly=True,
                secure=(request.url.scheme == "https"),
                samesite="Lax",
                path="/",
            )
        except Exception:
            pass

    return response



@router.get("/google/start")
async def google_start(request: Request):
    """Redirects the browser to Google's OAuth2 authorization endpoint to
    start the Authorization Code flow. Optionally accepts `next` query
    parameter which will be returned in the `state` parameter from Google
    and can be used by the callback to redirect the user after login.
    """
    client_id = getattr(settings, "GOOGLE_CLIENT_ID", None)
    if not client_id:
        raise HTTPException(status_code=500, detail="Google client id not configured")

    redirect_uri = settings.GOOGLE_OAUTH_REDIRECT_URL

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "online",
        "include_granted_scopes": "true",
    }

    # preserve optional next param in state so callback can redirect appropriately
    next_param = request.query_params.get("next")
    if next_param:
        params["state"] = next_param

    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urlencode(params)
    return RedirectResponse(url=url)


@router.post("/google", response_model=LoginResponse)
async def google_auth(
    payload: SocialLoginRequest,
    request: Request,
    response: Response,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate or sign-up a user via Google ID token.

    Flow:
    - Verify Google ID token server-side.
    - If an OAuthIdentity exists for this provider_user_id, log in that user.
    - Else, if a User exists with same email, link OAuthIdentity and log them in.
    - Else, create a new User (mark email verified) and OAuthIdentity, then log in.
    """
    token = payload.id_token
    gpayload = verify_google_id_token(token)

    provider = "google"
    provider_user_id = gpayload.get("sub")
    email = gpayload.get("email")
    full_name = gpayload.get("name") or (email.split("@")[0].replace('.', ' ') if email else None)
    avatar = gpayload.get("picture")

    # 1. Check for existing OAuth identity
    stmt = select(OAuthIdentity).where(
        OAuthIdentity.provider == provider,
        OAuthIdentity.provider_user_id == provider_user_id,
    )
    oauth_row: OAuthIdentity | None = (await db.execute(stmt)).scalar_one_or_none()
    user: User | None = None

    if oauth_row:
        user = await db.get(User, oauth_row.user_id)
        # Ensure user is verified if they are logging in with Google
        if user and not user.is_email_verified:
            user.is_email_verified = True
            await db.commit()

    # 2. If no oauth_row found, try matching by email
    if not user and email:
        stmt_u = select(User).where(User.email == email.lower())
        existing_user: User | None = (await db.execute(stmt_u)).scalar_one_or_none()
        if existing_user:
            user = existing_user
            # create oauth link
            new_oauth = OAuthIdentity(
                user_id=user.id,
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                full_name=full_name,
                avatar_url=avatar,
            )
            db.add(new_oauth)
            # If user was unverified but is now linking a trusted Google account, verify them
            if not user.is_email_verified:
                user.is_email_verified = True
            await db.commit()

    # 3. If still no user, create account
    if not user:
        # create a random password so DB constraints are satisfied
        random_pw = token_urlsafe(32)
        db_user = User(
            email=email,
            hashed_password=hash_password(random_pw),
            full_name=full_name,
            is_active=True,
            is_email_verified=True,
        )
        db.add(db_user)
        await db.commit()
        await db.refresh(db_user)
        user = db_user
        new_oauth = OAuthIdentity(
            user_id=user.id,
            provider=provider,
            provider_user_id=provider_user_id,
            email=email,
            full_name=full_name,
            avatar_url=avatar,
        )
        db.add(new_oauth)
        await db.commit()

        # --- Send Welcome Email (Google Signup) ---
        try:
            support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
            company_address = await get_config_value_from_cache("ADDRESS")
            app_name = await get_config_value_from_cache("APP_NAME")
            dashboard_url = await get_config_value_from_cache("FRONTEND_URL") or settings.FRONTEND_URL

            html = templates.get_template("welcome_email.html").render(
                full_name=full_name or "Explorer",
                dashboard_url=dashboard_url,
                year=datetime.datetime.now(datetime.timezone.utc).year,
                app_name=app_name,
                support_email=support_email,
                company_address=company_address,
                backend_url=settings.BACKEND_URL,
            )
            
            background_tasks.add_task(
                send_email,
                subject=f"Welcome to {app_name}!",
                to=[email],
                html=html,
            )
        except Exception as e:
            print(f"[ERROR] Failed to schedule welcome email (Google Auth): {e}")


    # At this point we have a user
    if not user:
        raise HTTPException(status_code=400, detail="Unable to resolve user from Google token")

    # create tokens
    access_token = create_access_token(str(user.id))
    raw_refresh, hashed_refresh = create_refresh_token()

    # delete expired tokens
    await db.execute(
        delete(RefreshToken).where(
            RefreshToken.user_id == user.id,
            RefreshToken.expires_at < datetime.datetime.now(datetime.timezone.utc),
        )
    )

    ip_for_tokens = getattr(
        request.state, "client_ip", None
    ) or get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )

    login_expiry_in_days = int(await get_config_value_from_cache("LOGIN_EXPIRY"))
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(
        days=login_expiry_in_days
    )
    await db.execute(
        insert(RefreshToken).values(
            user_id=user.id,
            token_hash=hashed_refresh,
            user_agent=request.headers.get("user-agent"),
            ip_address=ip_for_tokens,
            expires_at=expires_at,
        )
    )
    await db.commit()
    COOKIE_MAX_AGE = (
        int(await get_config_value_from_cache("LOGIN_EXPIRY")) * 60 * 60 * 24
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=raw_refresh,
        max_age=COOKIE_MAX_AGE,
        httponly=True,
        secure=not settings.DEBUG,
        samesite="none",
        path="/",
    )

    # build user_data similar to /login
    full_name_val = user.full_name or (user.email.split("@")[0].replace('.', ' ') if user.email else "")
    try:
        role_value = (
            getattr(user.role, "value", None)
            or getattr(user.role, "name", None)
            or str(user.role)
        )
    except Exception:
        role_value = str(user.role)

    # gather wallet/subscription/location
    subscription_stmt = select(Subscription).where(Subscription.user_id == user.id)
    wallet_stmt = select(UserWallet).where(UserWallet.user_id == user.id)
    location_stmt = (
        select(UserIpHistory.location_country_code, UserIpHistory.location_city)
        .where(UserIpHistory.user_id == user.id)
        .order_by(UserIpHistory.last_seen_at.desc())
        .limit(1)
    )

    subs_result = await db.execute(subscription_stmt)
    wallet_result = await db.execute(wallet_stmt)
    location_result = await db.execute(location_stmt)

    subs = subs_result.scalar_one_or_none()
    subscription_status = "free"
    if subs and subs.status == "active":
        subscription_status = "active"

    wallet = wallet_result.scalar_one_or_none()
    coin_balance = wallet.coin_balance if wallet else 0

    location_result = location_result.first()
    country, city = (
        (location_result[0], location_result[1]) if location_result else (None, None)
    )

    user_data = {
        "id": user.id,
        "email": user.email,
        "full_name": str(full_name_val),
        "role": role_value,
        "is_active": bool(user.is_active),
        "is_email_verified": bool(user.is_email_verified),
        "subscription_status": subscription_status,
        "coin_balance": coin_balance,
        "country": country,
        "city": city,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }

    # Update user IP history for location tracking
    ip = getattr(request.state, "client_ip", None) or get_client_ip_from_headers(
        request.headers, request.client.host if request.client else None
    )
    geo = getattr(request.state, "geo", {}) or {}
    # If geo isn't available yet, try a fast DB cache lookup
    if not geo and ip:
        try:
            from app.models.geo import IpLocationCache
            rec = await db.get(IpLocationCache, ip)
            if rec:
                geo = {"country_code": rec.country_code, "city": rec.city}
        except Exception:
            geo = {}

    await upsert_user_ip_history(
        db, user.id, ip, geo.get("country_code"), geo.get("city")
    )

    await bind_session_to_user(request, user.id, db)

    return LoginResponse(access_token=access_token, user=user_data)


@router.post("/change-password", response_model=MessageResponse)
async def change_password(
    req: ChangePasswordRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    # Verify old password
    if not verify_password(req.old_password, user.hashed_password):
        raise HTTPException(status_code=403, detail="Old password is incorrect")

    # Ensure the new password is different from the old password
    if req.old_password == req.new_password:
        raise HTTPException(
            status_code=400,
            detail="New password must be different from the old password",
        )

    # Update password
    user.hashed_password = hash_password(req.new_password)
    await db.commit()

    return {"message": "Password changed successfully"}
