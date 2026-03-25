from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy import text, func, distinct, desc
from typing import Optional
from app.models.user import User
from app.models.user import UserActivation
from app.models.subscription import Order, Subscription, UserWallet, CoinTransaction, PricingPlan
from app.models.geo import UserIpHistory
from app.schemas.user import UserRead, AdminUserCreateRequest
from app.api.v1.deps import get_db
from app.api.v1.deps import require_admin
from app.models.character import Character
from app.models.chat import ChatMessage as Chat
from app.models.character_media import CharacterMedia
from app.core.config import settings
from app.schemas.character import CharacterRead
from app.schemas.chat import MessageRead
from app.schemas.user import UserEditRequest
from app.core.templates import templates
from app.services.app_config import get_config_value_from_cache
from app.services.email import send_email
from app.core.aws_s3 import generate_presigned_url
import asyncio
from passlib.context import CryptContext
from passlib.hash import bcrypt
from secrets import token_urlsafe
import datetime
import uuid
from app.core.security import (
    verify_password,
    create_access_token,
    create_refresh_token,
    hash_password,
)
import secrets
import string
from app.schemas.engagement_stats import EngagementStats
from datetime import timedelta
from app.models.ai_generation_log import AiGenerationLog
from app.models.chat import ChatMessage

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@router.get(
    "/all-users", response_model=list[UserRead], dependencies=[Depends(require_admin)]
)
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    # Attach telegram_username if available via Order (or Subscription -> Order)
    user_ids = [str(u.id) for u in users if getattr(u, "id", None) is not None]
    totals_map: dict[str, float] = {}
    if user_ids:
        totals_stmt = (
            select(Order.user_id, func.coalesce(func.sum(Order.subtotal_at_apply), 0.0))
            .where(Order.user_id.in_(user_ids), Order.status == "success")
            .group_by(Order.user_id)
        )
        totals_rows = await db.execute(totals_stmt)
        for uid, s in totals_rows.fetchall():
            try:
                v = float(s) if s is not None else 0.0
                # Normalize potential cent-stored values
                if v >= 1000:
                    v = v / 100.0
                totals_map[str(uid)] = v
            except Exception:
                totals_map[str(uid)] = 0.0

    # Get subscription statuses for all users
    subscription_map: dict[str, str] = {}
    if user_ids:
        sub_stmt = select(Subscription.user_id, Subscription.status).where(
            Subscription.user_id.in_(user_ids)
        )
        sub_rows = await db.execute(sub_stmt)
        for uid, status in sub_rows.fetchall():
            subscription_map[str(uid)] = "active" if status == "active" else "free"

    # Get coin balances for all users
    wallet_map: dict[str, int] = {}
    if user_ids:
        wallet_stmt = select(UserWallet.user_id, UserWallet.coin_balance).where(
            UserWallet.user_id.in_(user_ids)
        )
        wallet_rows = await db.execute(wallet_stmt)
        for uid, balance in wallet_rows.fetchall():
            wallet_map[str(uid)] = balance or 0

    # Get latest location for all users from user_ip_history
    location_map: dict[str, tuple[str, str]] = {}
    if user_ids:
        # Get the most recent location for each user
        location_stmt = (
            select(
                UserIpHistory.user_id,
                UserIpHistory.location_country_code,
                UserIpHistory.location_city,
            )
            .where(UserIpHistory.user_id.in_(user_ids))
            .order_by(UserIpHistory.last_seen_at.desc())
        )

        location_rows = await db.execute(location_stmt)
        seen_users = set()
        for uid, country, city in location_rows.fetchall():
            if uid not in seen_users:
                location_map[str(uid)] = (country, city)
                seen_users.add(uid)

    # Precompute which users have at least one successful payment (order.status == 'success')
    paid_set: set[str] = set()
    if user_ids:
        paid_stmt = select(distinct(Order.user_id)).where(
            Order.user_id.in_(user_ids), Order.status == "success"
        )
        paid_rows = await db.execute(paid_stmt)
        for (uid,) in paid_rows.fetchall():
            if uid is not None:
                paid_set.add(str(uid))

    out = []
    for user in users:
        # Normalize base user dict via Pydantic to ensure fields like dates are typed
        base = UserRead.model_validate(user).model_dump()
        # base['telegram_username'] = telegram_map.get(str(user.id)) if str(user.id) in telegram_map else None
        # Expose total_revenue for the frontend (aligned with top-spenders calculation)
        base["total_revenue"] = totals_map.get(str(user.id), 0.0)
        # base['has_paid'] = str(user.id) in paid_set or (base.get('total_revenue', 0.0) > 0)
        base["subscription_status"] = subscription_map.get(str(user.id), "free")
        base["coin_balance"] = wallet_map.get(str(user.id), 0)

        # Add location data
        country, city = location_map.get(str(user.id), (None, None))
        base["country"] = country
        base["city"] = city

        out.append(base)

    return out


@router.post("/create", dependencies=[Depends(require_admin)])
async def create_user_by_admin(
    user_data: AdminUserCreateRequest, db: AsyncSession = Depends(get_db)
):
    """
    Create a new user by admin. User receives an email with activation link.
    """
    company_address = await get_config_value_from_cache("ADDRESS")
    support_email = await get_config_value_from_cache("SUPPORT_EMAIL")
    app_name = await get_config_value_from_cache("APP_NAME")
    # Check if user already exists

    existing_user_query = select(User).where(User.email == user_data.email.lower())
    existing_user = (await db.execute(existing_user_query)).scalar_one_or_none()

    user_email = user_data.email.lower()
    # if user with same email exists, delete the unverified one first from User
    stmt_existing = select(User).where(User.email == user_email)
    existing_user: User | None = (
        await db.execute(stmt_existing)
    ).scalar_one_or_none()
    if existing_user and not existing_user.is_email_verified:
        print("[DEBUG] Deleting existing unverified user from User")
        await db.delete(existing_user)
        await db.commit()
    if existing_user and existing_user.is_email_verified:
        print(
            "[DEBUG] User with email already exists and is verified. Reset your password instead."
        )
        raise HTTPException(status_code=400, detail="Email already registered")

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
    hashed_password = hash_password(new_password)
    await db.commit()

    db_user = User(
        email=user_data.email.lower(),
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=user_data.role,
        is_active=True,
        is_email_verified=True,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    html = templates.get_template("create_user.html").render(
        full_name=db_user.full_name or "Explorer",
        support_email=support_email,
        app_name=app_name,
        company_address=company_address,
        password=new_password,
        year=datetime.datetime.now(datetime.timezone.utc).year,
        backend_url=(await get_config_value_from_cache("BACKEND_URL") or settings.BACKEND_URL),
    )
    await send_email(
        subject="Honey Love AI Character password",
        to=[db_user.email],
        html=html,
    )
    return {"message": "If the e-mail exists, password was sent to email."}

@router.post("/deactivate/{user_id}", dependencies=[Depends(require_admin)])
async def deactivate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user_id = str(user_id)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return {"detail": f"User {user_id} has been deactivated"}


@router.post("/activate/{user_id}", dependencies=[Depends(require_admin)])
async def activate_user(user_id: str, db: AsyncSession = Depends(get_db)):
    user_id = str(user_id)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = True
    await db.commit()
    await db.refresh(user)
    return {"detail": f"User {user_id} has been activated"}


@router.put("/edit/{user_id}", dependencies=[Depends(require_admin)])
async def edit_user(
    user_id: str, payload: UserEditRequest, db: AsyncSession = Depends(get_db)
):
    user_id = str(user_id)
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if payload.full_name is not None:
        user.full_name = payload.full_name
    if payload.role is not None:
        user.role = payload.role
    # Update is_active only if explicitly provided in the payload
    if getattr(payload, "is_active", None) is not None:
        user.is_active = payload.is_active
    await db.commit()
    await db.refresh(user)

    return {
        "detail": f"User {user_id} updated",
        "user": {"id": user.id, "full_name": user.full_name, "role": user.role},
    }


@router.post("/delete/{user_id}", dependencies=[Depends(require_admin)])
async def delete_user(user_id: str, db: AsyncSession = Depends(get_db)):
    """
    Properly delete a user and ALL related records from all tables.
    Deletes in correct order to avoid foreign key constraint violations.
    """
    user_id = str(user_id)

    # Tables to delete from in order (children first, then parent)
    tables_to_clean = [
        "visit_sessions",  # User tracking data
        "user_media_pack_access",  # Media pack access
        "user_ip_history",  # IP history
        "usage_metrics",  # Usage tracking
        "token_topups",  # Token purchase history
        "subscriptions",  # Subscription records
        "request_events",  # Request events
        "orders",  # Orders
        "oauth_identities",  # OAuth connections (Google, etc)
        "coin_transactions",  # Coin transaction history
        "chat_messages",  # Chat messages
        "character_stats",  # Character statistics
        "character_media_likes",  # Character media likes
        "character_media",  # Character media
        "characters",  # Characters created by user
        "user_wallets",  # User wallet
        "user_profiles",  # User profile
        "user_activations",  # User activation records
        "refresh_tokens",  # Refresh tokens
        "password_resets",  # Password reset tokens
        "email_verifications",  # Email verification records
    ]

    deleted_counts = {}

    # Delete from each table
    for table in tables_to_clean:
        try:
            result = await db.execute(
                text(f"DELETE FROM {table} WHERE user_id = :user_id"),
                {"user_id": user_id},
            )
            deleted_counts[table] = result.rowcount
            if result.rowcount > 0:
                print(
                    f"[INFO] Deleted {result.rowcount} rows from {table} for user {user_id}"
                )
        except Exception as e:
            # Log but continue if table doesn't exist or other errors
            print(f"[WARNING] Failed to delete from {table} for user {user_id}: {e}")
            deleted_counts[table] = 0

    # Finally, delete the user record itself
    try:
        result = await db.execute(
            text("DELETE FROM users WHERE id = :user_id"), {"user_id": user_id}
        )
        deleted_counts["users"] = result.rowcount

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"User {user_id} not found")

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete user: {str(e)}")

    await db.commit()

    # Count total records deleted
    total_deleted = sum(deleted_counts.values())

    return {
        "detail": f"User {user_id} and all related records deleted successfully",
        "total_records_deleted": total_deleted,
        "breakdown": deleted_counts,
    }


# @router.get("/engagement-stats/{user_id}", response_model=EngagementStats, dependencies=[Depends(require_admin)])
# async def get_user_engagement_stats(user_id: str, db: AsyncSession = Depends(get_db)):
#     user_id = str(user_id)
#     # Total messages
#     total_messages = await db.scalar(select(func.count(Chat.id)).where(Chat.user_id == user_id))

#     # Total sessions
#     session_count = await db.scalar(select(func.count(distinct(Chat.session_id))).where(Chat.user_id == user_id))

#     # Avg messages per session
#     avg_per_session = total_messages / session_count if session_count else 0

#     # Messages per character
#     char_counts = await db.execute(
#         select(Chat.character_id, func.count(Chat.id))
#         .where(Chat.user_id == user_id)
#         .group_by(Chat.character_id)
#     )
#     messages_per_character = {str(cid): count for cid, count in char_counts.fetchall()}

#     # Media type breakdown: 'image' or NULL (chat)
#     mt_counts = await db.execute(
#         select(Chat.media_type, func.count(Chat.id))
#         .where(Chat.user_id == user_id)
#         .group_by(Chat.media_type)
#     )
#     # Normalize keys: keep 'image' as string, represent NULL as 'null'
#     media_type_breakdown = {('null' if mt is None else str(mt)): count for mt, count in mt_counts.fetchall()}

#     # Role breakdown: derive from message columns since Chat has no 'role' column
#     # Count messages sent by the user (user_query present) and by the assistant (ai_message present)
#     user_msg_count = await db.scalar(
#         select(func.count(Chat.id)).where(Chat.user_id == user_id).where(Chat.user_query != None)
#     )
#     assistant_msg_count = await db.scalar(
#         select(func.count(Chat.id)).where(Chat.user_id == user_id).where(Chat.ai_message != None)
#     )
#     role_breakdown = {
#         "user": int(user_msg_count or 0),
#         "assistant": int(assistant_msg_count or 0),
#     }

#     # Messages over time (last 30 days)
#     date_30_days_ago = datetime.datetime.now(datetime.timezone.utc) - timedelta(days=30)
#     daily_counts = await db.execute(
#         select(func.date(Chat.created_at), func.count(Chat.id))
#         .where(Chat.user_id == user_id)
#         .where(Chat.created_at >= date_30_days_ago)
#         .group_by(func.date(Chat.created_at))
#         .order_by(func.date(Chat.created_at))
#     )
#     messages_over_time = [{"date": str(date), "count": count} for date, count in daily_counts.fetchall()]

#     # Total characters
#     total_characters = await db.scalar(select(func.count(Character.id)).where(Character.user_id == user_id))

#     # Most used character
#     most_used_character = max(messages_per_character.items(), key=lambda x: x[1])[0] if messages_per_character else ""

#     # Prompt usage diversity
#     prompt_counts = await db.execute(
#         select(Character.prompt)
#         .where(Character.user_id == user_id)
#     )
#     prompt_usage_count = len(set(row[0] for row in prompt_counts.fetchall()))

#     # Common traits
#     trait_counts = {"gender": {}, "style": {}}
#     traits = await db.execute(
#         select(Character.gender, Character.style)
#         .where(Character.user_id == user_id)
#     )
#     for gender, style in traits.fetchall():
#         trait_counts["gender"][gender] = trait_counts["gender"].get(gender, 0) + 1
#         trait_counts["style"][style] = trait_counts["style"].get(style, 0) + 1

#     return EngagementStats(
#         total_messages=total_messages,
#         total_sessions=session_count,
#         avg_messages_per_session=round(avg_per_session, 2),
#         messages_per_character=messages_per_character,
#     media_type_breakdown=media_type_breakdown,
#         role_breakdown=role_breakdown,
#         messages_over_time=messages_over_time,
#         total_characters=total_characters,
#         most_used_character=most_used_character,
#         prompt_usage_count=prompt_usage_count,
#         common_traits=trait_counts
#     )


@router.get("/engagement-stats", dependencies=[Depends(require_admin)])
async def get_user_engagement_stats(user_id: str, db: AsyncSession = Depends(get_db)):

    user_id = str(user_id)
    # Subscription details
    subscription = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = subscription.scalar_one_or_none()
    if not subscription:
        subscription_info = {
            "payment_customer_id": None,
            "subscription_id": None,
            "order_id": None,
            "status": "free",
            "started_at": None,
            "ended_at": None,
        }
    else:
        subscription_info = {
            "payment_customer_id": subscription.payment_customer_id,
            "subscription_id": subscription.subscription_id,
            "order_id": subscription.order_id,
            "status": subscription.status,
            "started_at": (
                subscription.start_date.isoformat() if subscription.start_date else None
            ),
            "ended_at": (
                subscription.current_period_end.isoformat()
                if subscription.current_period_end
                else None
            ),
        }
    # Total messages
    total_messages = await db.scalar(
        select(func.count(Chat.id)).where(Chat.user_id == user_id)
    )

    # Total sessions
    session_count = await db.scalar(
        select(func.count(distinct(Chat.session_id))).where(Chat.user_id == user_id)
    )

    # Avg messages per session
    avg_per_session = total_messages / session_count if session_count else 0

    # Messages per character
    char_counts = await db.execute(
        select(Chat.character_id, func.count(Chat.id))
        .where(Chat.user_id == user_id)
        .group_by(Chat.character_id)
    )

    # Numeric-only counts (used for computations) and an enriched map for the response
    messages_per_character_counts = {
        str(cid): int(count) for cid, count in char_counts.fetchall()
    }

    # Enrich character metadata (name, age, bio, presigned URL)
    messages_per_character: dict[str, dict] = {}
    if messages_per_character_counts:
        char_ids = list(messages_per_character_counts.keys())
        char_rows = await db.execute(
            select(
                Character.id,
                Character.name,
                Character.age,
                Character.bio,
                Character.image_url_s3,
                Character.gif_url_s3,
            ).where(Character.id.in_(char_ids))
        )
        char_meta: dict[str, dict] = {}
        # Batch presign character images and gifs to reduce latency
        char_rows_list = char_rows.fetchall()
        image_keys = [row[4] for row in char_rows_list]
        gif_keys = [row[5] for row in char_rows_list]
        presigned_images = []
        presigned_gifs = []
        if image_keys:
            presigned_images = await asyncio.gather(
                *[
                    (
                        generate_presigned_url(s3_key=k)
                        if k
                        else asyncio.sleep(0, result=None)
                    )
                    for k in image_keys
                ]
            )
        if gif_keys:
            presigned_gifs = await asyncio.gather(
                *[
                    (
                        generate_presigned_url(s3_key=k)
                        if k
                        else asyncio.sleep(0, result=None)
                    )
                    for k in gif_keys
                ]
            )

        # Build metadata map using the presigned lists (if present)
        for idx, row in enumerate(char_rows_list):
            cid, name, age, bio, image_s3, gif_s3 = row
            cid_str = str(cid)
            presigned_image = (
                presigned_images[idx]
                if presigned_images and idx < len(presigned_images)
                else None
            )
            presigned_gif = (
                presigned_gifs[idx]
                if presigned_gifs and idx < len(presigned_gifs)
                else None
            )
            char_meta[cid_str] = {
                "name": name,
                "age": age,
                "bio": bio,
                "image_url_s3": presigned_image,
                "gif_url_s3": presigned_gif,
            }
        # If for some reason presigned lists were empty but rows exist, fall back to per-row handling
        if not presigned_images and not presigned_gifs and char_rows_list:
            for cid, name, age, bio, image_s3, gif_s3 in char_rows_list:
                cid_str = str(cid)
                char_meta[cid_str] = {
                    "name": name,
                    "age": age,
                    "bio": bio,
                    "image_url_s3": None,
                    "gif_url_s3": None,
                }

        # Gather character_media counts grouped by character and media_type
        char_media_map: dict[str, dict] = {}
        try:
            cm_rows = await db.execute(
                select(
                    CharacterMedia.character_id,
                    CharacterMedia.media_type,
                    func.count(CharacterMedia.id),
                )
                .where(CharacterMedia.character_id.in_(char_ids))
                .group_by(CharacterMedia.character_id, CharacterMedia.media_type)
            )
            for cid, mtype, cnt in cm_rows.fetchall():
                cid_s = str(cid)
                if cid_s not in char_media_map:
                    char_media_map[cid_s] = {}
                # Normalize/rename media_type keys per requirements
                key = str(mtype)
                if key == "chat_image":
                    key = "chat_gen_image"
                elif key == "image":
                    key = "image_gen_image"
                char_media_map[cid_s][key] = int(cnt)
        except Exception:
            # If table missing or query fails, leave map empty
            char_media_map = {}
        # Gather voice counts from chat_messages where media_type == 'voice'
        voice_map: dict[str, int] = {}
        try:
            v_rows = await db.execute(
                select(Chat.character_id, func.count(Chat.id))
                .where(
                    Chat.user_id == user_id,
                    Chat.character_id.in_(char_ids),
                    Chat.media_type == "voice",
                )
                .group_by(Chat.character_id)
            )
            for cid, cnt in v_rows.fetchall():
                voice_map[str(cid)] = int(cnt)
        except Exception:
            voice_map = {}

        for cid, cnt in messages_per_character_counts.items():
            meta = char_meta.get(cid, {})
            messages_per_character[cid] = {
                "count": cnt,
                "name": meta.get("name"),
                "age": meta.get("age"),
                "bio": meta.get("bio"),
                # image_url_s3 is only presigned for Character.image_url_s3 (no presigning for chat media here)
                "image_url_s3": meta.get("image_url_s3"),
                # character_media counts grouped by media_type (e.g., 'image', 'video', 'gif')
                "character_media_counts": char_media_map.get(cid, {}),
                # voice messages count from chat_messages where media_type == 'voice'
                "voice_count": voice_map.get(cid, 0),
            }
    else:
        messages_per_character = {}

    # # Media type breakdown: 'image' or NULL (chat)
    # mt_counts = await db.execute(
    #     select(Chat.media_type, func.count(Chat.id))
    #     .where(Chat.user_id == user_id)
    #     .group_by(Chat.media_type)
    # )
    # # Normalize keys and rename per requirements:
    # # - NULL -> 'null'
    # # - 'chat_image' -> 'chat_gen_image'
    # # - 'image' -> 'image_gen_image'
    # media_type_breakdown = {}
    # for mt, count in mt_counts.fetchall():
    #     key = 'null' if mt is None else str(mt)
    #     if key == 'chat_image':
    #         key = 'chat_gen_image'
    #     elif key == 'image':
    #         key = 'image_gen_image'
    #     media_type_breakdown[key] = count

    # Role breakdown: derive from message columns since Chat has no 'role' column
    # Count messages sent by the user (user_query present) and by the assistant (ai_message present)
    user_msg_count = await db.scalar(
        select(func.count(Chat.id))
        .where(Chat.user_id == user_id)
        .where(Chat.user_query != None)
    )
    assistant_msg_count = await db.scalar(
        select(func.count(Chat.id))
        .where(Chat.user_id == user_id)
        .where(Chat.ai_message != None)
    )
    role_breakdown = {
        "user": int(user_msg_count or 0),
        "assistant": int(assistant_msg_count or 0),
    }

    # Messages over time (last 90 days)
    date_90_days_ago = datetime.datetime.now(datetime.timezone.utc) - timedelta(days=90)
    daily_counts = await db.execute(
        select(func.date(Chat.created_at), func.count(Chat.id))
        .where(Chat.user_id == user_id)
        .where(Chat.created_at >= date_90_days_ago)
        .group_by(func.date(Chat.created_at))
        .order_by(func.date(Chat.created_at))
    )

    messages_over_time = [
        {"date": str(date), "count": count} for date, count in daily_counts.fetchall()
    ]

    # Images over time (last 90 days) using CharacterMedia
    images_daily = await db.execute(
        select(func.date(CharacterMedia.created_at), func.count(CharacterMedia.id))
        .where(CharacterMedia.user_id == user_id)
        .where(CharacterMedia.created_at >= date_90_days_ago)
        .group_by(func.date(CharacterMedia.created_at))
        .order_by(func.date(CharacterMedia.created_at))
    )
    images_over_time = [
        {"date": str(date), "count": count} for date, count in images_daily.fetchall()
    ]

    # Coins consumed over time (last 90 days) using CoinTransaction
    coins_daily = await db.execute(
        select(
            func.date(CoinTransaction.created_at),
            func.coalesce(func.sum(CoinTransaction.coins), 0),
        )
        .where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.created_at >= date_90_days_ago,
            CoinTransaction.transaction_type == "debit",
        )
        .group_by(func.date(CoinTransaction.created_at))
        .order_by(func.date(CoinTransaction.created_at))
    )
    coins_consumed_over_time = [
        {"date": str(date), "coins": int(total or 0)}
        for date, total in coins_daily.fetchall()
    ]

    # Total characters
    total_characters = await db.scalar(
        select(func.count(Character.id)).where(Character.user_id == user_id)
    )

    # Total media generations from character_media table
    total_media_generations = await db.scalar(
        select(func.count(CharacterMedia.id)).where(CharacterMedia.user_id == user_id)
    )

    # Media type breakdown from character_media table
    media_type_counts = await db.execute(
        select(CharacterMedia.media_type, func.count(CharacterMedia.id))
        .where(CharacterMedia.user_id == user_id)
        .group_by(CharacterMedia.media_type)
    )
    # Normalize and rename keys for character_media breakdown similar to above
    character_media_breakdown = {}
    for media_type, count in media_type_counts.fetchall():
        key = str(media_type)
        if key == "chat_image":
            key = "chat_gen_image"
        elif key == "image":
            key = "image_gen_image"
        character_media_breakdown[key] = count
    return {
        "subscription_info": subscription_info,
        "total_messages": total_messages,
        "total_sessions": session_count,
        "avg_messages_per_session": round(avg_per_session, 2),
        "messages_per_character": messages_per_character,
        # "media_type_breakdown": media_type_breakdown,
        "role_breakdown": role_breakdown,
        "messages_over_time": messages_over_time,
        "images_over_time": images_over_time,
        "coins_consumed_over_time": coins_consumed_over_time,
        "total_characters": total_characters,
        "total_media_generations": total_media_generations,
        "character_media_breakdown": character_media_breakdown,
    }


@router.get("/{user_id}/activity-logs", dependencies=[Depends(require_admin)])
async def get_user_activity_logs(
    user_id: str,
    log_type: Optional[str] = Query(
        None, description="Filter by log type: 'chat', 'generation', 'all'"
    ),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    search: Optional[str] = Query(None, description="Search text for messages/prompts"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get comprehensive activity logs for a specific user including:
    - Chat messages (user queries and AI responses)
    - AI generation logs (images, videos, voice)
    - All media generated

    This endpoint is for auditing and moderation purposes.
    """
    user_id = str(user_id)

    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    response_data = {
        "user_id": user_id,
        "user_email": user.email,
        "user_full_name": user.full_name,
        "page": page,
        "page_size": page_size,
    }

    # Fetch chat messages
    if not log_type or log_type == "chat" or log_type == "all":
        chat_count_query = select(func.count(ChatMessage.id)).where(
            ChatMessage.user_id == user_id
        )
        if search:
            chat_count_query = chat_count_query.where(
                ChatMessage.user_query.ilike(f"%{search}%")
            )
        total_chats_result = await db.execute(chat_count_query)
        total_chats = total_chats_result.scalar() or 0

        chat_query = (
            select(ChatMessage, Character.name.label("character_name"))
            .join(Character, ChatMessage.character_id == Character.id, isouter=True)
            .where(ChatMessage.user_id == user_id)
        )
        if search:
            chat_query = chat_query.where(ChatMessage.user_query.ilike(f"%{search}%"))
        chat_query = (
            chat_query.order_by(desc(ChatMessage.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        chat_result = await db.execute(chat_query)
        chats = chat_result.all()

        chat_logs = []
        for chat_msg, char_name in chats:
            # Generate presigned URLs for media if available
            media_urls = None
            if chat_msg.s3_url_media:
                if isinstance(chat_msg.s3_url_media, dict):
                    # Voice message with input/output URLs
                    media_urls = {}
                    for key, s3_key in chat_msg.s3_url_media.items():
                        if s3_key:
                            try:
                                media_urls[key] = await generate_presigned_url(s3_key)
                            except:
                                media_urls[key] = None
                elif isinstance(chat_msg.s3_url_media, str):
                    # Image/video URL
                    try:
                        media_urls = await generate_presigned_url(chat_msg.s3_url_media)
                    except:
                        media_urls = None

            chat_logs.append(
                {
                    "id": chat_msg.id,
                    "session_id": chat_msg.session_id,
                    "character_id": chat_msg.character_id,
                    "character_name": char_name,
                    "user_query": chat_msg.user_query,
                    "ai_message": chat_msg.ai_message,
                    "transcription": chat_msg.transcription,
                    "media_type": chat_msg.media_type,
                    "media_urls": media_urls,
                    "is_media_available": chat_msg.is_media_available,
                    "created_at": (
                        chat_msg.created_at.isoformat() if chat_msg.created_at else None
                    ),
                }
            )

        response_data["chat_logs"] = {"total": total_chats, "logs": chat_logs}

    # Fetch AI generation logs
    if not log_type or log_type == "generation" or log_type == "all":
        gen_count_query = select(func.count(AiGenerationLog.id)).where(
            AiGenerationLog.user_id == user_id
        )
        if search:
            gen_count_query = gen_count_query.where(
                AiGenerationLog.prompt_text.ilike(f"%{search}%")
            )
        total_gens_result = await db.execute(gen_count_query)
        total_gens = total_gens_result.scalar() or 0

        gen_query = (
            select(AiGenerationLog, Character.name.label("character_name"))
            .join(Character, AiGenerationLog.character_id == Character.id, isouter=True)
            .where(AiGenerationLog.user_id == user_id)
        )
        if search:
            gen_query = gen_query.where(
                AiGenerationLog.prompt_text.ilike(f"%{search}%")
            )
        gen_query = (
            gen_query.order_by(desc(AiGenerationLog.created_at))
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        gen_result = await db.execute(gen_query)
        generations = gen_result.all()

        generation_logs = []
        for gen_log, char_name in generations:
            # Generate presigned URLs for generated content
            presigned_urls = []
            if gen_log.generated_s3_keys:
                for s3_key in gen_log.generated_s3_keys:
                    try:
                        presigned_url = await generate_presigned_url(s3_key)
                        presigned_urls.append(presigned_url)
                    except:
                        presigned_urls.append(None)

            generation_logs.append(
                {
                    "id": gen_log.id,
                    "character_id": gen_log.character_id,
                    "character_name": char_name,
                    "generation_type": gen_log.generation_type,
                    "prompt_text": gen_log.prompt_text,
                    "prompt_metadata": gen_log.prompt_metadata,
                    "ai_model": gen_log.ai_model,
                    "num_generations": gen_log.num_generations,
                    "size_orientation": gen_log.size_orientation,
                    "status": gen_log.status,
                    "error_message": gen_log.error_message,
                    "face_swap_applied": gen_log.face_swap_applied,
                    "is_compliant": gen_log.is_compliant,
                    "moderation_notes": gen_log.moderation_notes,
                    "source_context": gen_log.source_context,
                    "generated_content_urls": presigned_urls,
                    "created_at": (
                        gen_log.created_at.isoformat() if gen_log.created_at else None
                    ),
                }
            )

        response_data["generation_logs"] = {
            "total": total_gens,
            "logs": generation_logs,
        }

    return response_data


@router.delete("/{user_id}/chat-logs/{chat_id}", dependencies=[Depends(require_admin)])
async def delete_user_chat_log(
    user_id: str, chat_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Delete a specific chat message log for audit/moderation purposes.
    This will remove the message from the chat history.
    """
    user_id = str(user_id)
    chat_id = str(chat_id)

    # Get the chat message
    chat_result = await db.execute(
        select(ChatMessage).where(
            ChatMessage.id == chat_id, ChatMessage.user_id == user_id
        )
    )
    chat_msg = chat_result.scalar_one_or_none()

    if not chat_msg:
        raise HTTPException(status_code=404, detail="Chat message not found")

    # Delete media from S3 if exists
    if chat_msg.s3_url_media:
        from app.core.aws_s3 import delete_s3_object

        try:
            if isinstance(chat_msg.s3_url_media, dict):
                for s3_key in chat_msg.s3_url_media.values():
                    if s3_key:
                        await delete_s3_object(s3_key)
            elif isinstance(chat_msg.s3_url_media, str):
                await delete_s3_object(chat_msg.s3_url_media)
        except Exception as e:
            print(f"Error deleting S3 media: {e}")

    # Delete the chat message
    await db.delete(chat_msg)
    await db.commit()

    return {"message": "Chat log deleted successfully", "chat_id": chat_id}


@router.delete(
    "/{user_id}/generation-logs/{log_id}", dependencies=[Depends(require_admin)]
)
async def delete_user_generation_log(
    user_id: str, log_id: str, db: AsyncSession = Depends(get_db)
):
    """
    Delete a specific AI generation log for audit/moderation purposes.
    This will remove the generated content from S3 and the log entry.
    """
    user_id = str(user_id)
    log_id = str(log_id)

    # Get the generation log
    gen_result = await db.execute(
        select(AiGenerationLog).where(
            AiGenerationLog.id == log_id, AiGenerationLog.user_id == user_id
        )
    )
    gen_log = gen_result.scalar_one_or_none()

    if not gen_log:
        raise HTTPException(status_code=404, detail="Generation log not found")

    # Delete generated content from S3
    deleted_keys = []
    failed_keys = []

    if gen_log.generated_s3_keys:
        from app.core.aws_s3 import delete_s3_object

        for s3_key in gen_log.generated_s3_keys:
            try:
                await delete_s3_object(s3_key)
                deleted_keys.append(s3_key)
            except Exception as e:
                print(f"Failed to delete S3 object {s3_key}: {e}")
                failed_keys.append(s3_key)

    # Delete associated CharacterMedia records
    if deleted_keys:
        from sqlalchemy import delete as sql_delete

        try:
            delete_media_stmt = sql_delete(CharacterMedia).where(
                CharacterMedia.s3_path.in_(deleted_keys)
            )
            await db.execute(delete_media_stmt)
        except Exception as e:
            print(f"Failed to delete CharacterMedia records: {e}")

    # Delete the generation log
    await db.delete(gen_log)
    await db.commit()

    return {
        "message": "Generation log deleted successfully",
        "log_id": log_id,
        "deleted_s3_keys": deleted_keys,
        "failed_s3_keys": failed_keys,
    }


@router.post("/add-subscription-coin", dependencies=[Depends(require_admin)])
async def add_subscription_coin(payload: dict, db: AsyncSession = Depends(get_db)):
    """
    Add coins to a user's wallet for testing or promotional purposes.
    Also creates or updates a monthly subscription for the user.
    """
    user_id = payload.get("user_id")

    # Verify user exists
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    coins_to_add = int(payload.get("coins", 0))
    
    # Get monthly pricing plan from PricingPlan table
    pricing_plan_result = await db.execute(
        select(PricingPlan).where(
            PricingPlan.billing_cycle.ilike("%month%"),
            PricingPlan.status == "Active"
        ).limit(1)
    )
    pricing_plan = pricing_plan_result.scalar_one_or_none()
    
    if not pricing_plan:
        raise HTTPException(status_code=404, detail="Monthly pricing plan not found")
    
    # Add/update monthly subscription for the user
    subscription_result = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = subscription_result.scalar_one_or_none()
    
    # Generate dummy payment_customer_id if creating new subscription
    dummy_payment_customer_id = f"admin_test_{user_id[:8]}"
    
    if not subscription:
        # Create new subscription
        subscription = Subscription(
            user_id=user_id,
            payment_customer_id=dummy_payment_customer_id,
            subscription_id=None,
            order_id=None,
            price_id=pricing_plan.pricing_id,
            plan_name=pricing_plan.plan_name,
            status="active",
            total_coins_rewarded=coins_to_add,
            # DB expects timezone-naive timestamps for this column
            current_period_end=(datetime.datetime.utcnow() + timedelta(days=30)),
        )
        db.add(subscription)
    else:
        # Update existing subscription
        subscription.payment_customer_id = dummy_payment_customer_id
        subscription.price_id = pricing_plan.pricing_id
        subscription.plan_name = pricing_plan.plan_name
        subscription.status = "active"
        subscription.total_coins_rewarded = (subscription.total_coins_rewarded or 0) + coins_to_add
        subscription.current_period_end = (datetime.datetime.utcnow() + timedelta(days=30))
    
    await db.commit()
    await db.refresh(subscription)

    # Get or create user wallet
    wallet_result = await db.execute(
        select(UserWallet).where(UserWallet.user_id == user_id)
    )
    wallet = wallet_result.scalar_one_or_none()
    
    if not wallet:
        wallet = UserWallet(user_id=user_id, coin_balance=coins_to_add)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    else:
        wallet.coin_balance += coins_to_add
        await db.commit()
        await db.refresh(wallet)

    return {
        "message": f"Added {coins_to_add} coins to user {user_id} and updated subscription",
        "new_balance": wallet.coin_balance
    }