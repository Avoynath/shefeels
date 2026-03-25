from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class CheckoutSessionRequest(BaseModel):
    price_id: str | None = None
    promo_id: str | None = None
    promo_code: str | None = None
    discount_type: str | None = None
    currency: str
    discount_applied: float | None = None
    subtotal_at_apply: float


class CheckoutSessionResponse(BaseModel):
    session_id: str


class SubscriptionStatusResponse(BaseModel):
    plan_name: str | None = None
    # allow boolean for easy false/true reporting or string for textual statuses
    status: str | bool | None = None
    current_period_end: datetime | None = None


"""
Pydantic schemas for Subscription.
"""


class SubscriptionBase(BaseModel):
    payment_customer_id: str
    subscription_id: str | None = None
    status: str
    current_period_end: Optional[str]


class SubscriptionRead(SubscriptionBase):
    id: str
    user_id: str
    user_email: str | None = None


class PricingPlanRead(BaseModel):
    id: str
    plan_name: str
    pricing_id: str
    coupon: str | None = None
    currency: str
    price: float
    discount: float | None = 0.0
    billing_cycle: str
    coin_reward: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class PricingPlanCreate(BaseModel):
    plan_name: str
    pricing_id: str
    stripe_promotion_id: str
    stripe_coupon_id: str
    coupon: str
    currency: str
    price: float
    discount: float
    billing_cycle: str
    coin_reward: int
    status: str


class PricingPlanUpdate(BaseModel):
    plan_name: Optional[str] = None
    pricing_id: Optional[str] = None
    currency: Optional[str] = None
    price: Optional[float] = None
    discount: Optional[float] = None
    billing_cycle: Optional[str] = None
    coin_reward: Optional[int] = None
    status: Optional[str] = None


class PromoManagementRead(BaseModel):
    id: str
    promo_name: str
    coupon: str
    percent_off: float
    provider_promotion_id: str | None = None
    provider_coupon_id: str | None = None
    start_date: Optional[datetime]
    expiry_date: Optional[datetime]
    status: str
    applied_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }


class PromoManagementCreate(BaseModel):
    promo_name: str
    coupon: str
    percent_off: float
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: str
    # discount_type corresponds to PromoManagement.discount_type and is required
    # at the DB level. Provide a sensible default so older admin UIs that don't
    # send this field won't cause insert failures.
    discount_type: str | None = "promo"
    # Currency defaults to USD; allow override in creation payload when needed.
    currency: str | None = "USD"


class PromoManagementUpdate(BaseModel):
    promo_name: Optional[str] = None
    percent_off: Optional[float] = None
    start_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    status: Optional[str] = None


class PromoVerifyRequest(BaseModel):
    promo_code: str
    pricing_id: str


class CoinTransactionRead(BaseModel):
    id: str
    user_id: str
    user_email: str | None = None
    transaction_type: str
    coins: int
    source_type: str
    order_id: str | None = None
    period_start: datetime | None = None
    period_end: datetime | None = None
    country_code: str | None = None
    city: str | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class OrderRead(BaseModel):
    id: str
    promo_id: str | None = None
    promo_code: str | None = None
    user_id: str
    user_email: str | None = None
    discount_type: str | None = None
    applied_at: datetime
    discount_applied: float
    subtotal_at_apply: float
    currency: str
    status: str
    tagada_transaction_id: str | None = None
    tagada_payment_id: str | None = None
    country_code: str | None = None
    city: str | None = None
    created_at: datetime

    model_config = {
        "from_attributes": True,
    }


class OrderStatusRequest(BaseModel):
    order_id: str
