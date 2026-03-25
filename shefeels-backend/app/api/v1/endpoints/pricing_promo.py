from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
from app.api.v1.deps import get_db, require_admin
from app.models.subscription import PricingPlan, PromoManagement, UserWallet
from app.schemas.subscription import (
    PricingPlanRead,
    PromoManagementRead,
    PromoVerifyRequest,
)
from app.services.app_config import get_config_value_from_cache
from app.core.config import settings
from app.api.v1.deps import get_current_user
from sqlalchemy.sql import func
import time
from datetime import datetime, timezone

router = APIRouter()


@router.get("/get-pricing", response_model=List[PricingPlanRead])
async def get_pricing(db: AsyncSession = Depends(get_db)):
    """
    Retrieve subscription pricing plans (exclude one-time/token packs).
    """
    # Exclude plans whose billing_cycle indicates a one-time purchase.
    # Use a case-insensitive match for 'one' to cover 'OneTime' or 'one-time'.
    result = await db.execute(
        select(PricingPlan)
        .where(~func.lower(PricingPlan.billing_cycle).like("%one%"))
        .order_by(PricingPlan.id)
    )
    pricing_plans = result.scalars().all()
    return pricing_plans


@router.get("/get-promo", response_model=List[PromoManagementRead])
async def get_promo(db: AsyncSession = Depends(get_db)):
    """
    Retrieve all promo data.
    """
    result = await db.execute(
        select(PromoManagement)
        .order_by(PromoManagement.id)
        .where(PromoManagement.discount_type == "promo")
    )
    promo_data = result.scalars().all()
    return promo_data


@router.post("/verify-promo")
async def verify_promo(
    request: PromoVerifyRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Verify the authenticity of a promo code using Stripe.
    """
    try:
        result = await db.execute(
            select(PromoManagement).where(PromoManagement.coupon == request.promo_code)
        )
        promo_db = result.scalar_one_or_none()
        if not promo_db:
            return {"valid": False, "reason": "Invalid or inactive promo code."}
        if (getattr(promo_db, "status", "") or "").lower() != "active":
            return {"valid": False, "reason": "Promo code is not active."}
        # compare expiry against server UTC now
        if promo_db.expiry_date and promo_db.expiry_date < datetime.now(timezone.utc):
            return {"valid": False, "reason": "Promo code has expired."}

        return {
            "valid": True,
            "percent_off": float(promo_db.percent_off),
            "promo_id": promo_db.id,
            "discount_type": promo_db.discount_type,
            "promo_code": promo_db.coupon,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Stripe error: {str(e)}")


@router.get("/get-user-coin")
async def get_user_coin(
    user=Depends(get_current_user), db: AsyncSession = Depends(get_db)
):
    """
    Get the user's coin balance.
    """
    stmt = select(UserWallet).where(UserWallet.user_id == user.id)
    result = await db.execute(stmt)
    user_wallet = result.scalar_one_or_none()
    if not user_wallet:
        raise HTTPException(status_code=404, detail="User wallet not found")

    return user_wallet


@router.get("/coin-cost")
async def get_coin_cost(db: AsyncSession = Depends(get_db)):
    """
    Get the coin cost consumption cost for chat, video, and image.
    """
    chat_cost = await get_config_value_from_cache("CHAT_COST")
    character_cost = await get_config_value_from_cache("CHARACTER_COST")
    image_cost = await get_config_value_from_cache("IMAGE_COST")
    voice_cost = await get_config_value_from_cache("VOICE_COST")

    return {
        "chat_cost": int(chat_cost or 0),
        "character_cost": int(character_cost or 0),
        "image_cost": int(image_cost or 0),
        "voice_cost": int(voice_cost or 0),
    }


@router.get("/get-coin-pricing")
async def get_coin_pricing(db: AsyncSession = Depends(get_db)):
    """
    Get the coin purchase pricing plans.
    """
    result = await db.execute(
        select(PricingPlan)
        .where(func.lower(PricingPlan.billing_cycle).like("%one%"))
        .order_by(PricingPlan.coin_reward)
    )
    coin_plans = result.scalars().all()
    return coin_plans
