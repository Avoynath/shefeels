from fastapi import HTTPException, Request
from sqlalchemy.future import select
from app.core.database import get_db
from app.models.subscription import PricingPlan, Subscription
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.services.app_config import get_config_value_from_cache
from app.models.subscription import UserWallet, CoinTransaction
from app.api.v1.deps import check_admin
import datetime
async def get_subscription_status(db: AsyncSession, user_id: str):
    if not user_id:
        return False
    if await check_admin(user_id, db):
        return True
    res = await db.execute(
        select(Subscription).where(Subscription.user_id == user_id)
    )
    subscription = res.scalars().first()
    if subscription:
        current_period_end = subscription.current_period_end
        if current_period_end and current_period_end.tzinfo is None:
            current_period_end = current_period_end.replace(tzinfo=datetime.timezone.utc)

        if subscription.status.lower() == "active" and current_period_end and current_period_end > datetime.datetime.now(datetime.timezone.utc): 
            status = True
        else:
            status = False
        return status
    return False

async def get_pricing(price_id: str, db: AsyncSession):
    if not price_id:
        return None
    res = await db.execute(
        select(PricingPlan).where(PricingPlan.pricing_id == price_id)
    )
    return res.scalars().first()

async def get_media_cost(media_type: str = "chat", video_duration: int = 0):
    if media_type == "chat":
        media_cost = await get_config_value_from_cache("CHAT_COST")
    elif media_type == "image" or media_type == "chat_image" :
        media_cost = await get_config_value_from_cache("IMAGE_COST")
    elif media_type == "character":
        media_cost = await get_config_value_from_cache("CHARACTER_COST")
    elif media_type == "voice":
        media_cost = await get_config_value_from_cache("VOICE_COST")
    elif media_type == "video":
        media_cost = await get_config_value_from_cache("VIDEO_COST")
    else:
        media_cost = 0

    return int(media_cost)

async def check_user_wallet(db: AsyncSession, user_id: str, media_type: str = "chat", video_duration: int = 0):
    is_coin_sufficient = False
    if await check_admin(user_id, db):
        return True
    ## Check if user has active subscription
    sub_status = await get_subscription_status(db, user_id)
    if sub_status == False:
        # Enforce 30-token lifetime trial spend limit for free users
        from sqlalchemy import func
        from app.models.subscription import CoinTransaction
        stmt = select(func.sum(CoinTransaction.coins)).where(
            CoinTransaction.user_id == user_id,
            CoinTransaction.transaction_type == "debit"
        )
        total_spent = (await db.execute(stmt)).scalar() or 0
        media_cost = await get_media_cost(media_type, video_duration=video_duration)
        
        if total_spent + media_cost > 30:
            raise HTTPException(status_code=402, detail="Trial limit reached. Please subscribe to continue.")
        
        # If they haven't spent 30 tokens yet, we let them proceed to balance check
        
    coins = await db.execute(select(UserWallet).where(UserWallet.user_id == user_id))
    coins = coins.scalars().first()
    if coins:
        coin_balance = coins.coin_balance
    else:
        coin_balance = 0

    media_cost = await get_media_cost(media_type, video_duration=video_duration)
    if coin_balance < media_cost:
        raise HTTPException(status_code=402, detail="Insufficient coins. Please purchase more coins to continue.")
    else:
        is_coin_sufficient = True
    return is_coin_sufficient

async def deduhl_user_coins(request: Request, db: AsyncSession, user_id: str, character_id: str, media_type: str = "chat", video_duration: int = 0):
    # if await check_admin(user_id, db):
    #     return True
    media_cost = await get_media_cost(media_type, video_duration)
    
    # Get visitor_session_id and validate it exists in visit_sessions table
    visitor_session_id = getattr(request.state, "visitor_session_id", None)
    if visitor_session_id:
        # Verify the session exists in the database before using it
        from app.models.geo import VisitSession
        session_exists = await db.get(VisitSession, visitor_session_id)
        if not session_exists:
            visitor_session_id = None
    
    # Record coin transaction as one-time purchase
    tx = CoinTransaction(
        user_id=user_id,
        transaction_type="debit",
        coins=media_cost,
        source_type=media_type,
        period_start=None,
        period_end=None,
        character_id=character_id,
        ip=getattr(request.state, "client_ip", None),
        country_code=(getattr(request.state, "geo", {}) or {}).get("country_code"),
        city=(getattr(request.state, "geo", {}) or {}).get("city"),
        visitor_session_id=visitor_session_id,
    )
    db.add(tx)
    await db.commit()

    # Update wallet
    wallet_res = await db.execute(select(UserWallet).where(UserWallet.user_id == user_id))
    wallet = wallet_res.scalars().first()
    if wallet:
        wallet.coin_balance = (wallet.coin_balance ) - media_cost
        db.add(wallet)
        await db.commit()
    return True