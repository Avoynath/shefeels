"""
Subscription SQLAlchemy model.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    ForeignKey,
    DateTime,
    Boolean,
    Numeric,
    BigInteger,
    CheckConstraint,
    CHAR,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from app.models.base import Base
from sqlalchemy.sql import func

from app.services.app_config import generate_id


class Subscription(Base):
    __tablename__ = "subscriptions"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)

    # Legacy payment provider fields (PayGate, Stripe, etc.)
    payment_customer_id = Column(String(50), nullable=False)
    subscription_id = Column(String(50), nullable=True, unique=True)

    # TagadaPay specific fields
    tagada_subscription_id = Column(String(50), nullable=True, unique=True, index=True)
    tagada_customer_id = Column(String(50), nullable=True)

    order_id = Column(String(32), ForeignKey("orders.id"), nullable=True)
    price_id = Column(String(32), nullable=True)
    plan_name = Column(String(32), nullable=True)  # "pro" or "vip"
    status = Column(String(32), nullable=False)
    current_period_end = Column(DateTime)
    start_date = Column(DateTime, default=func.now())
    cancel_at_period_end = Column(Boolean, default=False)
    last_rewarded_period_end = Column(DateTime, nullable=True)
    total_coins_rewarded = Column(Integer, default=0, nullable=False)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    signup_ip = Column(String(45), nullable=True)
    signup_country_code = Column(String(2), index=True, nullable=True)
    signup_city = Column(String(128), nullable=True)
    user = relationship("User", back_populates="subscription")


class PromoManagement(Base):
    __tablename__ = "promo_management"

    id = Column(String(32), primary_key=True, default=generate_id)
    promo_name = Column(String(255), nullable=False)
    discount_type = Column(String(50), nullable=False)  # e.g. 'subscription', 'promo'
    coupon = Column(String(100), nullable=False, unique=True)  # human code (UPPER)
    currency = Column(String(3), nullable=False, server_default="USD")
    percent_off = Column(Numeric(5, 2), nullable=False)
    start_date = Column(DateTime(timezone=True), nullable=True)
    expiry_date = Column(DateTime(timezone=True), nullable=True)
    status = Column(String(20), nullable=False, server_default="active")
    applied_count = Column(Integer, nullable=False, server_default="0")
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # orders = relationship("Order", back_populates="promo_management")
    __table_args__ = (
        CheckConstraint("coupon = UPPER(coupon)", name="chk_coupon_upper"),
        CheckConstraint(
            "percent_off >= 0 AND percent_off <= 100", name="chk_percent_range"
        ),
        CheckConstraint(
            "expiry_date IS NULL OR start_date IS NULL OR start_date <= expiry_date",
            name="chk_dates_order",
        ),
    )


class PricingPlan(Base):
    __tablename__ = "pricing_plan"

    id = Column(String(32), primary_key=True, default=generate_id)
    plan_name = Column(String(255), nullable=False)
    pricing_id = Column(String(255), nullable=False, unique=True)
    coupon = Column(String(255), nullable=False)
    currency = Column(CHAR(3), nullable=False, server_default="USD")
    price = Column(Numeric(10, 2), nullable=False)
    discount = Column(Numeric(10, 2), nullable=True)
    billing_cycle = Column(String(50), nullable=False)  # e.g. 'Monthly', 'Yearly'
    coin_reward = Column(Integer, nullable=False, default=0)
    status = Column(String(50), nullable=False)  # e.g. 'Active', 'Inactive'
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class Order(Base):
    __tablename__ = "orders"

    id = Column(String(32), primary_key=True, default=generate_id)

    # User & promo linkage
    promo_id = Column(String(32), nullable=True)
    promo_code = Column(String(100), nullable=True)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False)
    pricing_id = Column(
        String(255),
        ForeignKey("pricing_plan.pricing_id", ondelete="RESTRICT"),
        nullable=True,
    )  # Link to PricingPlan.pricing_id
    # Provider info (for PayGate or future providers)
    provider = Column(String(50), nullable=True)  # e.g. 'paygate'
    provider_order_ref = Column(
        String(150), nullable=True
    )  # Encrypted wallet (used in checkout)
    provider_txid_in = Column(String(150), nullable=True)  # Blockchain inbound txid
    provider_txid_out = Column(String(150), nullable=True)  # Blockchain payout txid
    provider_coin = Column(String(50), nullable=True)  # e.g. 'polygon_usdc'
    tagada_transaction_id = Column(String(150), nullable=True, index=True)  # TagadaPay order ID
    tagada_payment_id = Column(String(150), nullable=True, index=True)  # TagadaPay payment ID
    paid_value_coin = Column(
        Numeric(18, 6), nullable=True
    )  # Amount actually paid in coin

    # Discounts / pricing context
    discount_type = Column(String(100), nullable=True)
    discount_applied = Column(Numeric(10, 2), server_default="0", nullable=False)
    subtotal_at_apply = Column(Numeric(10, 2), nullable=False)
    currency = Column(CHAR(3), nullable=False, server_default="USD")

    # Status lifecycle
    status = Column(
        String(20),
        nullable=False,
        server_default="pending",  # allowed: 'pending', 'success', 'failed', 'refunded'
    )
    # PayGate-specific verification
    paygate_ipn_token = Column(Text, nullable=True)
    paygate_address_in = Column(Text, nullable=True)
    applied_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    ip = Column(String(45), nullable=True)
    country_code = Column(String(2), index=True, nullable=True)
    city = Column(String(128), nullable=True)
    visitor_session_id = Column(
        String(32), ForeignKey("visit_sessions.id"), nullable=True
    )

    # Relationships
    user = relationship("User", back_populates="order")
    session = relationship("VisitSession", backref="orders")


class UserWallet(Base):
    __tablename__ = "user_wallets"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    coin_balance = Column(Integer, nullable=False, server_default="0")
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    user = relationship("User", back_populates="user_wallet")


class CoinTransaction(Base):
    __tablename__ = "coin_transactions"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    character_id = Column(
        String(32), ForeignKey("characters.id", ondelete="SET NULL"), nullable=True
    )
    transaction_type = Column(String(50), nullable=False)  # e.g. 'debit', 'credit'
    coins = Column(Integer, nullable=False)
    source_type = Column(
        String(50), nullable=False
    )  # e.g. 'subscription', 'coin_purchase','chat', 'image', 'video', 'character'
    order_id = Column(String(50), nullable=True)
    period_start = Column(DateTime, nullable=True)
    period_end = Column(DateTime, nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    ip = Column(String(45), nullable=True)
    country_code = Column(String(2), index=True, nullable=True)
    city = Column(String(128), nullable=True)
    visitor_session_id = Column(
        String(32), ForeignKey("visit_sessions.id"), nullable=True
    )
    # relationships (optional):
    session = relationship("VisitSession", backref="coin_transactions")
    user = relationship("User")


class TokenTopUp(Base):
    __tablename__ = "token_topups"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(
        String(32), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tokens = Column(Integer, nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    product_id = Column(String(64), nullable=True)
    order_id = Column(String(64), nullable=True)
    created_at = Column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    user = relationship("User")


# -----------------------------
# PATCHES TO EXISTING TABLES
# -----------------------------
# Copy these fields into your existing model classes.

# 1) ORDERS: add geo + session link
# class Order(Base):
#     __tablename__ = "orders"
#     ...
#     ip = Column(String(45), nullable=True)
#     country_code = Column(String(2), index=True, nullable=True)
#     city = Column(String(128), nullable=True)
#     session_id = Column(String(32), ForeignKey("visit_sessions.id"), nullable=True)
#     # relationships (optional):
#     session = relationship("VisitSession", backref="orders")

# 2) SUBSCRIPTIONS: snapshot of signup geo
# class Subscription(Base):
#     __tablename__ = "subscriptions"
#     ...
#     signup_ip = Column(String(45), nullable=True)
#     signup_country_code = Column(String(2), index=True, nullable=True)
#     signup_city = Column(String(128), nullable=True)

# 3) COIN TRANSACTIONS: add geo + session link
# class CoinTransaction(Base):
#     __tablename__ = "coin_transactions"
#     ...
#     ip = Column(String(45), nullable=True)
#     country_code = Column(String(2), index=True, nullable=True)
#     city = Column(String(128), nullable=True)
#     session_id = Column(String(32), ForeignKey("visit_sessions.id"), nullable=True)
#     # relationships (optional):
#     session = relationship("VisitSession", backref="coin_transactions")
