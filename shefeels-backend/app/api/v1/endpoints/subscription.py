"""
FastAPI routes for PayGate:
- POST /create-checkout-session  -> returns hosted checkout URL
- GET  /paygate-callback         -> PayGate hits this after payment
- (optional) GET /check-status   -> manual reconciliation (do NOT use as source of truth)
"""

from __future__ import annotations
from typing import Optional
import logging

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.schemas.subscription import (
    CheckoutSessionRequest,
    SubscriptionStatusResponse,
    OrderStatusRequest,
)
from app.services.app_config import get_config_value_from_cache
from app.services.paygate import (
    create_temp_wallet,
    build_checkout_url,
    extract_callback_fields,
    PAYGATE_CHECK_PAYMENT_URL,
    _get_with_retries,
)

# import your own settings / DB / auth util
from app.core.config import settings
from app.core.database import get_db
from app.api.v1.deps import get_current_user
from app.models.subscription import (
    Order,
    UserWallet,
    CoinTransaction,
    PricingPlan,
    Subscription,
)
from app.services.subscription import get_pricing
from app.models.user import User
from urllib.parse import unquote
from starlette.datastructures import QueryParams

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/create-checkout-session")
async def create_checkout_session(
    request: Request,
    payload: CheckoutSessionRequest,
    user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not settings.PAYGATE_MERCHANT_ADDRESS:
        raise HTTPException(
            status_code=500,
            detail="PAYGATE_MERCHANT_ADDRESS is not configured",
        )

    # Create Order in DB (status=pending)
    order = Order(
        user_id=user.id,
        promo_id=payload.promo_id,
        promo_code=payload.promo_code,
        pricing_id=payload.price_id,
        currency=payload.currency or "USD",
        status="pending",
        discount_type=payload.discount_type,
        discount_applied=payload.discount_applied or 0,
        subtotal_at_apply=payload.subtotal_at_apply,
        provider=settings.PAYGATE_DEFAULT_PROVIDER,
        visitor_session_id=request.state.visitor_session_id,
        ip=request.state.client_ip,
        country_code=request.state.geo.get("country_code"),
        city=request.state.geo.get("city"),
    )
    db.add(order)
    await db.flush()
    ########### REMOVE LATER AFTER INTEGRATION OF PAYMENT GATEWAY ############
    # For testing purposes, we can auto-complete the order here
    payment_customer_id = user.id
    subscription_id = order.id

    #############################################################################
    pricing = await get_pricing(payload.price_id, db)
    subscription = Subscription(
        user_id=user.id,
        payment_customer_id=payment_customer_id,
        subscription_id=subscription_id,
        order_id=order.id,
        price_id=payload.price_id,
        plan_name=pricing.plan_name if pricing else "unknown",
        status="pending",
        total_coins_rewarded=pricing.coin_reward if pricing else 0,
        signup_ip=request.state.client_ip,
        signup_country_code=request.state.geo.get("country_code"),
        signup_city=request.state.geo.get("city"),
    )
    db.add(subscription)
    await db.flush()

    # BACKEND_URL = await get_config_value_from_cache("BACKEND_URL")
    # callback_url = f"{BACKEND_URL.rstrip('/')}/api/v1/subscription/paygate-callback?order_id={order.id}"

    # if BACKEND_URL is None:
    #     raise HTTPException(status_code=500, detail="BACKEND_URL missing")

    # # BACKEND_URL must be public (ngrok/domain), not localhost
    # if "localhost" in BACKEND_URL or "127.0.0.1" in BACKEND_URL:
    #     raise HTTPException(status_code=500, detail="BACKEND_URL must be publicly reachable")

    # # Optional: PayGate may require https callback
    # if BACKEND_URL.startswith("http://"):
    #     # Many providers require https; warn loudly even if you allow it in dev
    #     print("BACKEND_URL is http; PayGate may reject callbacks. Backend URL", BACKEND_URL)

    #     # Create temp wallet with correct param `wallet`
    # print("Creating checkout session", {
    #     "user_id": user.id,
    #     "price_id": payload.price_id,
    #     "currency": payload.currency,
    # })

    # print("Computed callback URL : ", callback_url)
    # # temp = await probe_paygate_wallet(settings.PAYGATE_MERCHANT_ADDRESS, callback_url)

    # try:
    #     temp = await create_temp_wallet(settings.PAYGATE_MERCHANT_ADDRESS, callback_url)
    # except Exception as exc:
    #     await db.rollback()
    #     # Keep detail, but avoid leaking secrets
    #     logger.exception("Failed to create PayGate wallet", extra={
    #         "merchant_address_prefix": settings.PAYGATE_MERCHANT_ADDRESS[:8],
    #         "callback_url": callback_url
    #     })
    #     raise HTTPException(status_code=502, detail="Failed to create PayGate wallet")
    # # Persist PayGate-specific values
    # # Decode once so we don't double-encode later
    # encrypted_address = unquote(temp["address_in"])
    # print("encrypted_address : ", encrypted_address)
    # # persist useful fields
    # order.paygate_ipn_token = temp.get("ipn_token")
    # order.paygate_address_in = temp["polygon_address_in"]              # keep raw (as returned) for verification if you want
    # #order.paygate_polygon_address_in = temp.get("polygon_address_in")

    # amount = float(payload.subtotal_at_apply or 0.0)
    # if amount <= 0:
    #     await db.rollback()
    #     raise HTTPException(status_code=400, detail="Amount must be > 0")

    # checkout_url = build_checkout_url(
    #     encrypted_address=encrypted_address,  # decoded address_in
    #     amount=amount,                        # <-- was value=amount
    #     currency=order.currency,
    #     order=str(order.id),
    #     email=user.email or "",
    #     provider=settings.PAYGATE_DEFAULT_PROVIDER, # e.g. "moonpay" if you want to force it
    # )

    await db.commit()
    return {"order_id": order.id, "subscription_id": subscription.id}


@router.get("/webhook-receiver")
async def get_webhook_receiver(request: Request, db: AsyncSession = Depends(get_db)):
    method = request.method
    url = str(request.url)
    raw_query = request.url.query  # exact querystring as sent
    client_ip = request.headers.get("x-forwarded-for") or (
        request.client.host if request.client else None
    )

    # parsed params (preserve duplicates if any)
    qp: QueryParams = request.query_params
    print("Raw query params:", qp)
    params_dict = dict(qp)  # last value wins
    params_all = list(
        qp.multi_items()
    )  # list of (key,value) pairs, includes duplicates

    # body (usually empty for GET, but log just in case)
    try:
        body_bytes = await request.body()
        body_preview = body_bytes[:1024].decode(errors="replace") if body_bytes else ""
    except Exception:
        body_preview = "<unreadable>"

    # headers (small, redact anything sensitive if present)
    headers_sample = {
        "user-agent": request.headers.get("user-agent"),
        "x-forwarded-for": request.headers.get("x-forwarded-for"),
        "cf-connecting-ip": request.headers.get("cf-connecting-ip"),
        "content-type": request.headers.get("content-type"),
    }

    print(
        "PayGate callback received",
        {
            "method": method,
            "url": url,
            "client_ip": client_ip,
            "raw_query": raw_query,
            "params": params_dict,
            "params_all": params_all,
            "headers": headers_sample,
            "body_preview": body_preview,
        },
    )

    qs = dict(request.query_params)  # PayGate sends GET
    fields = extract_callback_fields(qs)
    order_id = qs.get("order_id") or fields["order"]

    if not order_id:
        return JSONResponse(status_code=400, content={"error": "missing order_id"})

    res = await db.execute(select(Order).where(Order.id == order_id))
    order: Optional[Order] = res.scalars().first()
    if not order:
        return JSONResponse(status_code=404, content={"error": "order not found"})

    # Idempotency: if already success, return OK
    if order.status == "success":
        return {"status": "ok", "message": "already processed"}

    # Verify callback authenticity using paygate address_in if set
    # expected_addr_in = getattr(order, "paygate_address_in", None)
    # if expected_addr_in and fields["address_in"] != expected_addr_in:
    #     #return JSONResponse(status_code=403, content={"error": "invalid address_in"})
    #     print("Invalid address_in", {"order": order.id, "expected": expected_addr_in, "received": fields["address_in"]})
    # else:
    #     print("address_in invalid or not set", {"order": order.id})
    # # Sanity checks
    # value_coin = fields["value_coin"]
    # coin = fields["coin"]
    # if not value_coin:
    #     print("Callback without value_coin", {"order": order.id})
    # if coin and coin not in ("polygon_usdc", "polygon_usdt"):
    #     print("Unexpected payout coin", {"order": order.id, "coin": coin})

    # Mark order success + store provider txids
    order.status = "success"
    subs = await db.execute(
        select(Subscription).where(Subscription.order_id == order.id)
    )
    subscription = subs.scalars().first()
    if subscription:
        subscription.status = "active"
        subscription.current_period_end = (
            None  # set appropriately based on your billing cycle
        )

    # order.provider_coin = coin
    # order.provider_txid_in = fields["txid_in"]
    # order.provider_txid_out = fields["txid_out"]
    # order.paid_value_coin = value_coin

    # attempt to credit coins based on order.price_id
    pricing = None
    if getattr(order, "pricing_id", None):
        pricing = await get_pricing(order.pricing_id, db)
    coins = int(pricing.coin_reward or 0) if pricing else 0
    user_res = await db.execute(select(User).where(User.id == order.user_id))
    user = user_res.scalars().first()
    if user:
        tx = CoinTransaction(
            user_id=user.id,
            transaction_type="credit",
            coins=coins,
            source_type="subscription",
            order_id=str(order_id),
            period_start=None,
            period_end=None,
            ip=order.ip,
            country_code=order.country_code,
            city=order.city,
            visitor_session_id=order.visitor_session_id,
        )
        db.add(tx)
        wallet_res = await db.execute(
            select(UserWallet).where(UserWallet.user_id == user.id)
        )
        wallet = wallet_res.scalars().first()
        if wallet:
            wallet.coin_balance = (wallet.coin_balance or 0) + coins
        else:
            wallet = UserWallet(user_id=user.id, coin_balance=coins)
            db.add(wallet)

    await db.commit()
    return {"status": "success"}


@router.get("/check-status")  # optional, for manual reconciliation only
async def check_status(ipn_token: str):
    try:
        resp = await _get_with_retries(
            PAYGATE_CHECK_PAYMENT_URL, params={"ipn_token": ipn_token}
        )
        return resp.json()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Check status failed: {exc}")


@router.post("/order-status")
async def get_order_status(
    order_status: OrderStatusRequest,
    db: AsyncSession = Depends(get_db),
    user=Depends(get_current_user),
):
    """
    Return current subscription status for the authenticated user.

    If the user cannot be resolved from the bearer token in Authorization header, return status=False.
    """

    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    result = await db.execute(
        select(Order).where(
            (Order.user_id == user.id) & (Order.id == order_status.order_id)
        )
    )
    order = result.scalars().first()
    if not order:
        return {"status": "not found"}
    return {
        "status": order.status,
        "order_id": order.id,
        "pricing_id": order.pricing_id,
    }


@router.get("/get-users-orders")
async def get_users_orders(
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    """
    Get all orders for the authenticated user.
    """
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    # Join with PricingPlan to fetch coin_reward for each order (pricing_id -> pricing_plan.pricing_id)
    stmt = (
        select(Order, PricingPlan.coin_reward)
        .join(PricingPlan, PricingPlan.pricing_id == Order.pricing_id, isouter=True)
        .where(Order.user_id == user.id)
        .order_by(Order.id.desc())
    )
    result = await db.execute(stmt)
    rows = result.all()  # list of (Order, coin_reward)

    orders_out = []
    for order, coin_reward in rows:
        # Serialize the order minimally to avoid leaking internal SQLAlchemy state
        orders_out.append(
            {
                "id": order.id,
                "subtotal_at_apply": (
                    float(order.subtotal_at_apply)
                    if order.subtotal_at_apply is not None
                    else None
                ),
                "discount_applied": (
                    float(order.discount_applied)
                    if order.discount_applied is not None
                    else None
                ),
                "currency": order.currency,
                "status": order.status,
                "created_at": (
                    order.created_at.isoformat()
                    if order.created_at is not None
                    else None
                ),
                "coin_reward": int(coin_reward) if coin_reward is not None else 0,
            }
        )

    return {"orders": orders_out}


@router.get("/status")
async def get_subscription_status_endpoint(
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    """
    Return user's subscription active state and coin balance.
    This endpoint is a lightweight billing/status endpoint used by the frontend.
    """
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Determine whether user has an active subscription
    subs = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    subscription = subs.scalars().first()
    has_active = False
    subscription_out = None
    if subscription and getattr(subscription, "status", None) == "active":
        has_active = True
        subscription_out = {
            "id": subscription.id,
            "plan_name": subscription.plan_name,
            "status": subscription.status,
            "current_period_end": (
                subscription.current_period_end.isoformat()
                if subscription.current_period_end
                else None
            ),
        }

    # coin balance
    wallet_res = await db.execute(
        select(UserWallet).where(UserWallet.user_id == user.id)
    )
    wallet = wallet_res.scalars().first()
    coins = int(wallet.coin_balance) if wallet else 0

    return {"status": has_active, "subscription": subscription_out, "coins": coins}


@router.get("/get-user-coin")
async def get_user_coin(
    db: AsyncSession = Depends(get_db), user=Depends(get_current_user)
):
    """Return authenticated user's coin balance."""
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    wallet_res = await db.execute(
        select(UserWallet).where(UserWallet.user_id == user.id)
    )
    wallet = wallet_res.scalars().first()
    coins = int(wallet.coin_balance) if wallet else 0
    return {"coin_balance": coins}
