#!/usr/bin/env python3
"""Resolve and backfill geo for all historical VisitSession and UserIpHistory rows.

Steps:
- Find IPs missing in ip_location_cache and resolve them via `resolve_geo` (uses local mmdb).
- Update VisitSession.first_country_code/first_city where missing.
- Update UserIpHistory.location_country_code/location_city where missing.

Run from repo root:
    PYTHONPATH=. python3 tools/full_geo_backfill.py
"""
import asyncio
from app.core.database import AsyncSessionLocal
from sqlalchemy import select, text
import importlib
import pathlib
import traceback

# Ensure all model modules are imported so SQLAlchemy mappers initialize
models_dir = pathlib.Path(__file__).resolve().parents[1] / "app" / "models"
if models_dir.exists() and models_dir.is_dir():
    for p in models_dir.glob("*.py"):
        name = p.stem
        if name == "__init__":
            continue
        module_name = f"app.models.{name}"
        try:
            importlib.import_module(module_name)
        except Exception:
            print(f"Warning: failed importing {module_name}")
            traceback.print_exc()

from app.models.geo import IpLocationCache
from app.services.geo import resolve_geo
import sys


async def gather_ips(db):
    # collect IPs from visit_sessions and user_ip_history that lack geo
    ips = set()
    rows = await db.execute(
        text("""
        SELECT DISTINCT first_ip as ip FROM visit_sessions WHERE first_ip IS NOT NULL AND (first_country_code IS NULL OR first_city IS NULL)
        UNION
        SELECT DISTINCT ip FROM user_ip_history WHERE ip IS NOT NULL AND (location_country_code IS NULL OR location_city IS NULL)
        """)
    )
    for r in rows.fetchall():
        if r and r[0]:
            ips.add(r[0])
    return ips


async def backfill():
    async with AsyncSessionLocal() as db:
        print("Gathering IPs needing resolution...")
        ips = await gather_ips(db)
        print(f"Found {len(ips)} unique IPs to resolve")

        resolved = 0
        for ip in ips:
            try:
                # resolve_geo will insert/update IpLocationCache
                res = await resolve_geo(ip, db)
                if res:
                    resolved += 1
                    print(f"Resolved {ip} -> {res.get('country_code')}, {res.get('city')}")
                else:
                    print(f"No geo for {ip}")
            except Exception as e:
                print(f"Error resolving {ip}: {e}")

        print(f"Resolved {resolved}/{len(ips)} IPs via MaxMind/http fallback")

        # Now update VisitSession rows from cache
        print("Updating visit_sessions from ip_location_cache...")
        upd_vs = await db.execute(
            text("""
            UPDATE visit_sessions vs
            SET first_country_code = rec.country_code,
                first_city = rec.city
            FROM ip_location_cache rec
            WHERE vs.first_ip = rec.ip
              AND (vs.first_country_code IS NULL OR vs.first_city IS NULL)
            RETURNING vs.id, vs.first_ip, rec.country_code, rec.city
            """)
        )
        rows = upd_vs.fetchall()
        print(f"Updated {len(rows)} visit_sessions")
        for r in rows[:10]:
            print(r)

        # Update user_ip_history rows
        print("Updating user_ip_history from ip_location_cache...")
        upd_ui = await db.execute(
            text("""
            UPDATE user_ip_history ui
            SET location_country_code = COALESCE(ui.location_country_code, rec.country_code),
                location_city = COALESCE(ui.location_city, rec.city),
                last_seen_at = NOW()
            FROM ip_location_cache rec
            WHERE ui.ip = rec.ip
              AND (ui.location_country_code IS NULL OR ui.location_city IS NULL)
            RETURNING ui.id, ui.user_id, ui.ip, rec.country_code, rec.city
            """)
        )
        rows2 = upd_ui.fetchall()
        print(f"Updated {len(rows2)} user_ip_history rows")
        for r in rows2[:10]:
            print(r)


if __name__ == "__main__":
    try:
        asyncio.run(backfill())
    except Exception as e:
        print("Backfill failed:", e)
        sys.exit(1)
