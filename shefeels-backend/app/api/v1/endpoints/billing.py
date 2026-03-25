from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.api.v1.deps import get_current_user, require_active_subscription
from app.core.database import get_db
from app.schemas.billing import MeResponse, TopUpRequest, TopUpResponse
from app.services.subscription import get_subscription_status
from app.services.app_config import get_config_value_from_cache
from app.services.tagadapay import process_payment
from app.core.config import settings
from app.models.subscription import UserWallet, CoinTransaction, Subscription
from app.models.subscription import TokenTopUp
from app.models.user import User
from datetime import datetime

router = APIRouter()


@router.get("/me", response_model=MeResponse)
async def get_me(user=Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Return authentication + subscription state and token balance for header/sidebar."""
    if not user:
        # Shouldn't happen because get_current_user raises, but keep symmetry
        return MeResponse(
            isAuthenticated=False, hasActiveSubscription=False, tokenBalance=0
        )

    has_active = await get_subscription_status(db, user.id)
    # load wallet
    res = await db.execute(select(UserWallet).where(UserWallet.user_id == user.id))
    wallet = res.scalars().first()
    balance = int(wallet.coin_balance) if wallet else 0
    
    # Get subscription coin reward if user has active subscription
    subscription_coin_reward = 0
    subscription_plan_name = None
    if has_active:
        sub_res = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = sub_res.scalars().first()
        if subscription and subscription.price_id:
            from app.models.subscription import PricingPlan
            plan_res = await db.execute(
                select(PricingPlan).where(PricingPlan.pricing_id == subscription.price_id)
            )
            plan = plan_res.scalars().first()
            if plan:
                subscription_coin_reward = plan.coin_reward
                subscription_plan_name = plan.plan_name
    
    return MeResponse(
        isAuthenticated=True, 
        hasActiveSubscription=has_active, 
        tokenBalance=balance,
        subscription_coin_reward=subscription_coin_reward,
        subscription_plan_name=subscription_plan_name
    )


@router.post("/tokens/topup", response_model=TopUpResponse)
async def topup_tokens(
    payload: TopUpRequest,
    user=Depends(get_current_user),
    subscription=Depends(require_active_subscription),  # Enforce active subscription
    db: AsyncSession = Depends(get_db),
):
    """Top up tokens by charging via TagadaPay (sandbox by default).

    This endpoint uses `app.services.tagadapay.process_payment` and stores
    `CoinTransaction` / `TokenTopUp` on success. It expects raw card details
    (note: sending raw card data to backend has PCI implications).
    """
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required"
        )

    # Determine price per token from config (default 0.05 USD/token)
    price_per_token = await get_config_value_from_cache("TOKEN_PRICE_USD") or "0.05"
    try:
        price_per_token = float(price_per_token)
    except Exception:
        price_per_token = 0.05

    tokens = payload.tokensRequested
    amount = round(tokens * price_per_token, 2)

    # Build TagadaPay payment payload
    card = {
        "number": payload.cardNumber,
        "expMonth": payload.cardMonth,
        "expYear": payload.cardYear,
        "cvc": payload.cardSecurityCode or "",
    }

    customer = {
        "email": payload.emailAddress,
        "firstName": payload.firstName,
        "lastName": payload.lastName,
        "address": {
            "address1": payload.address1,
            "city": payload.city,
            "state": payload.state,
            "country": payload.country,
            "postalCode": payload.postalCode,
        },
        "phone": payload.phoneNumber or "",
    }

    metadata = {"user_id": str(user.id), "tokens": str(tokens)}

    try:
        resp = await process_payment(amount, "USD", card, customer, metadata=metadata)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Payment processor error: {exc}")

    # Handle TagadaPay response shape — best-effort mapping.
    # We expect the processor to return a status or result key.
    success = False
    order_id = None
    message = None
    if isinstance(resp, dict):
        # common shapes: {"status": "success"}, {"result": "SUCCESS"}, etc.
        status_val = (resp.get("status") or resp.get("result") or "").lower()
        if status_val in ("success", "ok", "true", "processed", "completed"):
            success = True
        # Try to extract an id
        order_id = resp.get("paymentId") or resp.get("id") or resp.get("orderId")
        message = resp.get("message") or resp.get("error") or str(resp)
    else:
        message = str(resp)

    if not success:
        return TopUpResponse(
            success=False, orderId=order_id, tokensCredited=0, message=str(message)
        )

    # credit wallet
    tx = CoinTransaction(
        user_id=user.id,
        transaction_type="credit",
        coins=tokens,
        source_type="token_topup",
        order_id=order_id,
        ip=None,
        country_code=None,
        city=None,
        visitor_session_id=None,
    )
    db.add(tx)

    # record token top-up audit
    try:
        topup = TokenTopUp(
            user_id=user.id,
            tokens=tokens,
            amount=amount,
            product_id=str(
                await get_config_value_from_cache("TOKEN_PRODUCT_ID") or "1"
            ),
            order_id=order_id,
        )
        db.add(topup)
    except Exception:
        pass

    # update wallet
    res = await db.execute(select(UserWallet).where(UserWallet.user_id == user.id))
    wallet = res.scalars().first()
    if wallet:
        wallet.coin_balance = (wallet.coin_balance or 0) + tokens
        db.add(wallet)
    else:
        wallet = UserWallet(user_id=user.id, coin_balance=tokens)
        db.add(wallet)

    await db.commit()

    # reload wallet to get the committed balance
    res = await db.execute(select(UserWallet).where(UserWallet.user_id == user.id))
    wallet = res.scalars().first()
    new_balance = int(wallet.coin_balance) if wallet else 0

    return TopUpResponse(
        success=True,
        orderId=order_id,
        tokensCredited=tokens,
        tokenBalance=new_balance,
        message="Top-up successful",
    )
