from __future__ import annotations
from pydantic import BaseModel, Field, EmailStr
from typing import Optional


class MeResponse(BaseModel):
    isAuthenticated: bool
    hasActiveSubscription: bool
    tokenBalance: int = 0
    subscription_coin_reward: int = 0
    subscription_plan_name: str | None = None


class TopUpRequest(BaseModel):
    tokensRequested: int = Field(..., gt=0)

    # Minimal billing info expected from frontend for one-time card sale.
    firstName: str
    lastName: str
    emailAddress: EmailStr
    address1: str
    city: str
    state: str
    country: str
    postalCode: str
    phoneNumber: Optional[str]

    # Card details (note: sending raw card data to backend has PCI implications)
    cardNumber: str
    cardMonth: str  # mm
    cardYear: str  # yyyy
    cardSecurityCode: Optional[str]


class TopUpResponse(BaseModel):
    success: bool
    orderId: Optional[str]
    tokensCredited: Optional[int]
    tokenBalance: Optional[int]
    message: Optional[str]
