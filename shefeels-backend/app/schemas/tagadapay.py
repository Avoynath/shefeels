"""
Pydantic schemas for TagadaPay subscription management.
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class CreateSubscriptionRequest(BaseModel):
    """Request to create a TagadaPay subscription."""

    price_id: str = Field(
        ..., description="TagadaPay price ID for the subscription plan"
    )
    payment_instrument_id: Optional[str] = Field(
        None, description="Saved payment method ID (optional)"
    )
    currency: str = Field(default="USD", description="Currency code")

    class Config:
        json_schema_extra = {
            "example": {
                "price_id": "price_abc123",
                "payment_instrument_id": "pi_xyz789",
                "currency": "USD",
            }
        }


class CancelSubscriptionRequest(BaseModel):
    """Request to cancel a subscription."""

    cancel_at_period_end: bool = Field(
        default=True,
        description="If true, cancel at end of billing period. If false, cancel immediately.",
    )

    class Config:
        json_schema_extra = {"example": {"cancel_at_period_end": True}}


class SubscriptionResponse(BaseModel):
    """Subscription details response."""

    subscription_id: str
    status: str
    plan_name: Optional[str] = None
    billing_cycle: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool
    total_coins_rewarded: int
    created_at: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "subscription_id": "sub_abc123",
                "status": "active",
                "plan_name": "pro",
                "current_period_end": "2025-12-28T10:00:00Z",
                "cancel_at_period_end": False,
                "total_coins_rewarded": 200,
                "created_at": "2025-11-28T10:00:00Z",
            }
        }


class TokenPurchaseRequest(BaseModel):
    """Request to purchase tokens (one-time payment)."""

    token_package_id: str = Field(
        ..., description="Token package identifier (e.g., '300', '750')"
    )
    payment_instrument_id: Optional[str] = Field(
        None, description="Saved payment method ID"
    )

    class Config:
        json_schema_extra = {
            "example": {"token_package_id": "750", "payment_instrument_id": "pi_xyz789"}
        }


class TokenPurchaseResponse(BaseModel):
    """Response after token purchase."""

    success: bool
    tokens_credited: int
    new_balance: int
    order_id: Optional[str] = None
    message: str

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "tokens_credited": 750,
                "new_balance": 950,
                "order_id": "txn_abc123",
                "message": "Tokens purchased successfully",
            }
        }
