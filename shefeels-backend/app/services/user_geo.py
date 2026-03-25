# app/services/user_geo.py
from sqlalchemy import select, update, insert
from sqlalchemy.ext.asyncio import AsyncSession
import datetime
import logging
import json
from pathlib import Path
from app.models.geo import UserIpHistory
from sqlalchemy.exc import IntegrityError

# Logger for geo-related operations
logger = logging.getLogger("app.geo")
_audit_log_path = Path("./logs/geo_failures.log")
_audit_log_path.parent.mkdir(parents=True, exist_ok=True)

async def upsert_user_ip_history(
    db: AsyncSession,
    user_id: str,
    ip: str,
    country_code: str | None,
    city: str | None,
):
    if not (user_id and ip):
        return
    try:
        logger.info("upsert_user_ip_history called: user_id=%s ip=%s country=%s city=%s", user_id, ip, country_code, city)
    except Exception:
        pass
    row = await db.execute(
        select(UserIpHistory).where(
            UserIpHistory.user_id == user_id,
            UserIpHistory.ip == ip
        )
    )
    rec = row.scalars().first()
    now = datetime.datetime.now(datetime.timezone.utc)
    if rec:
        rec.location_country_code = country_code or rec.location_country_code
        rec.location_city = city or rec.location_city
        rec.last_seen_at = now
    else:
        rec = UserIpHistory(
            user_id=user_id,
            ip=ip,
            location_country_code=country_code,
            location_city=city,
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(rec)
    try:
        await db.commit()
    except IntegrityError as exc:
        # Defensive: some DB rows may have unexpected NULLs or unique/index
        # violations from older data. Rollback and record an audit so we can
        # investigate later without breaking user flows.
        await db.rollback()
        payload = {
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "user_id": user_id,
            "ip": ip,
            "country_code": country_code,
            "city": city,
            "error": str(exc.__class__.__name__),
            "detail": str(exc),
        }
        try:
            # Log to the standard logger
            logger.exception("upsert_user_ip_history IntegrityError: %s", payload)
        except Exception:
            # Best-effort logging - do not raise
            pass
        try:
            # Also append a JSON-line to a local audit file for offline analysis
            with _audit_log_path.open("a", encoding="utf-8") as f:
                f.write(json.dumps(payload, ensure_ascii=False) + "\n")
        except Exception:
            # don't raise from audit failure
            pass
        return
