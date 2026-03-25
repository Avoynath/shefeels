# models_geo.py
from sqlalchemy import (
    Column, String, Integer, DateTime, Boolean, ForeignKey, Text,
    Index, func
)
from sqlalchemy.orm import relationship
from app.models.base import Base
from app.services.app_config import generate_id
from sqlalchemy.dialects.postgresql import JSONB
# -----------------------------
# NEW TABLES
# -----------------------------

class IpLocationCache(Base):
    """
    Cache for IP -> Geo resolution. Keep immutable-ish rows and refresh last_seen_at on usage.
    """
    __tablename__ = "ip_location_cache"

    ip = Column(String(45), primary_key=True)  # IPv4/IPv6 compatible
    country_code = Column(String(2), index=True, nullable=True)
    country_name = Column(String(64), nullable=True)
    region = Column(String(128), nullable=True)
    city = Column(String(128), index=True, nullable=True)
    source = Column(String(16), nullable=True)  # 'maxmind', 'ipapi', etc.
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index("ix_ip_location_cache_country_code", "country_code"),
        Index("ix_ip_location_cache_city", "city"),
    )


class UserIpHistory(Base):
    """
    Per-user IPs and resolved (snapshot) geo. Lets you infer 'home' country/city.
    """
    __tablename__ = "user_ip_history"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=False, index=True)
    ip = Column(String(45), nullable=False, index=True)
    location_country_code = Column(String(2), nullable=True)
    location_city = Column(String(128), nullable=True)
    first_seen_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    last_seen_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    user = relationship("User", backref="ip_history")

    __table_args__ = (
        Index("uq_user_ip_history_user_ip", "user_id", "ip", unique=True),
    )


class VisitSession(Base):
    """
    Lightweight web session for funneling geo, UTM, referrer, UA.
    """
    __tablename__ = "visit_sessions"

    id = Column(String(32), primary_key=True, default=generate_id)
    user_id = Column(String(32), ForeignKey("users.id"), nullable=True, index=True)

    first_ip = Column(String(45), nullable=True)
    first_country_code = Column(String(2), nullable=True)
    first_city = Column(String(128), nullable=True)

    user_agent = Column(Text, nullable=True)
    utm_source = Column(Text, nullable=True)
    utm_medium = Column(Text, nullable=True)
    utm_campaign = Column(Text, nullable=True)
    referrer = Column(Text, nullable=True)

    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    ended_at = Column(DateTime(timezone=True), nullable=True)

    user = relationship("User", backref="visit_sessions")

    __table_args__ = (
        Index("ix_visit_sessions_started_at", "started_at"),
    )


class RequestEvent(Base):
    __tablename__ = "request_events"
    id = Column(String(32), primary_key=True, default=generate_id)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    visitor_session_id = Column(String(64), nullable=True)
    user_id = Column(String(32), nullable=True)
    path = Column(Text, nullable=True)
    event_name = Column(Text, nullable=False)
    referrer = Column(Text, nullable=True)
    utm_source = Column(Text, nullable=True)
    utm_medium = Column(Text, nullable=True)
    utm_campaign = Column(Text, nullable=True)
    ip = Column(Text, nullable=True)
    country_code = Column(Text, nullable=True)
    city = Column(Text, nullable=True)
    user_agent = Column(Text, nullable=True)
    properties = Column(JSONB, nullable=True)
