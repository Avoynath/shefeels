#!/usr/bin/env python3
"""Test script to validate geo -> user_ip_history flows.

Creates temporary users, VisitSession and IpLocationCache rows and exercises
`bind_session_to_user` and `resolve_geo` to confirm user_ip_history is populated.

Run from project root:
    PYTHONPATH=. python3 tools/test_geo_flow.py
"""
import asyncio
import datetime
import uuid
from types import SimpleNamespace

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.geo import VisitSession, IpLocationCache, UserIpHistory
from app.services.user_geo import upsert_user_ip_history
from app.api.v1.deps_geo import bind_session_to_user
from app.services.geo import resolve_geo


async def run():
    async with AsyncSessionLocal() as db:
        now = datetime.datetime.now(datetime.timezone.utc)

        # Test A: VisitSession -> bind_session_to_user should create user_ip_history
        email_a = f"test-geo-a-{uuid.uuid4().hex[:6]}@example.com"
        user_a = User(email=email_a, hashed_password="x", is_active=True)
        db.add(user_a)
        await db.commit()
        await db.refresh(user_a)

        vsid = uuid.uuid4().hex[:32]
        ip_a = "1.2.3.4"
        sess = VisitSession(
            id=vsid,
            user_id=None,
            first_ip=ip_a,
            first_country_code="US",
            first_city="Testville",
            started_at=now,
        )
        db.add(sess)
        await db.commit()

        # Build a minimal dummy request object with state.visitor_session_id
        req = SimpleNamespace()
        req.state = SimpleNamespace(visitor_session_id=vsid)

        # Call bind_session_to_user which should upsert user_ip_history
        print("[TEST A] Binding session to user and upserting ip history...")
        await bind_session_to_user(req, user_a.id, db)

        row = await db.execute(
            db.select(UserIpHistory).where(UserIpHistory.user_id == user_a.id)
        )
        rec = row.scalar_one_or_none()
        print("[TEST A] user_ip_history for user:", rec and (rec.ip, rec.location_country_code, rec.location_city) or None)

        # Test B: IpLocationCache -> resolve_geo should backfill existing user_ip_history
        email_b = f"test-geo-b-{uuid.uuid4().hex[:6]}@example.com"
        user_b = User(email=email_b, hashed_password="x", is_active=True)
        db.add(user_b)
        await db.commit()
        await db.refresh(user_b)

        ip_b = "5.6.7.8"
        # Insert a user_ip_history row with NULL location
        uih = UserIpHistory(user_id=user_b.id, ip=ip_b, location_country_code=None, location_city=None, first_seen_at=now, last_seen_at=now)
        db.add(uih)
        # Insert IpLocationCache so resolve_geo returns data and triggers backfill
        cache = IpLocationCache(ip=ip_b, country_code="GB", country_name="United Kingdom", city="London", source="test", first_seen_at=now, last_seen_at=now)
        db.add(cache)
        await db.commit()

        print("[TEST B] Calling resolve_geo to trigger backfill...")
        res = await resolve_geo(ip_b, db)
        print("[TEST B] resolve_geo returned:", res)

        row2 = await db.execute(
            db.select(UserIpHistory).where(UserIpHistory.user_id == user_b.id, UserIpHistory.ip == ip_b)
        )
        rec2 = row2.scalar_one_or_none()
        print("[TEST B] user_ip_history after backfill:", rec2 and (rec2.ip, rec2.location_country_code, rec2.location_city) or None)


if __name__ == "__main__":
    asyncio.run(run())
