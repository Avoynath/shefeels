# app/services/geo.py
from __future__ import annotations

import os
import requests
import ipaddress
from typing import Dict, Optional
from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from app.models.geo import IpLocationCache
from app.models.geo import UserIpHistory
from app.core.config import settings

# -------- Config --------
CACHE_TTL = timedelta(days=14)
_GEO_READER = None
_GEO_DB_PATH = settings.GEOIP_DB  # e.g. "./data/GeoLite2-City.mmdb"

# -------- IP helpers (string-safe) --------
# ---- Replace these helpers in app/services/geo.py ----

def _parse_ip(ip_str: str) -> Optional[ipaddress._BaseAddress]:
    """
    Robustly parse IPv4/IPv6.
    - Accepts IPv4, IPv6
    - Accepts [IPv6]:port (bracketed) and strips the port
    - Accepts IPv4:port and strips the port
    - Accepts zone IDs in IPv6 (fe80::1%eth0) and strips the zone
    - DOES NOT strip a trailing :hextet from plain (unbracketed) IPv6
    """
    if not ip_str:
        return None
    s = ip_str.strip()

    # Bracketed IPv6 with optional port: [2001:db8::1]:443
    if s.startswith("[") and "]" in s:
        inside = s[1:s.index("]")]        # extract address within brackets
        addr = inside.split("%", 1)[0]    # drop zone id if any
        try:
            return ipaddress.ip_address(addr)
        except ValueError:
            return None

    # Strip zone id for unbracketed IPv6 (fe80::1%eth0)
    if "%" in s:
        s = s.split("%", 1)[0]

    # IPv4:port => strip port
    if "." in s and ":" in s:
        host, _, maybe_port = s.partition(":")
        if host and maybe_port.isdigit():
            s = host  # drop port for IPv4

    # DO NOT attempt to remove :port from unbracketed IPv6!
    # If it's plain IPv6, any trailing :xxxx is a real hextet, not a port.

    try:
        return ipaddress.ip_address(s)
    except ValueError:
        return None


def _is_private_str(ip_str: str) -> bool:
    ip = _parse_ip(ip_str)
    print(f"[DEBUG] _is_private_str parsed IP: {ip}")
    if not ip:
        # Treat unparsable as not-public (skip lookups)
        return True
    
    print(f"[DEBUG] _is_private_str IP properties: private={ip.is_private}, loopback={ip.is_loopback}, reserved={ip.is_reserved}, link_local={ip.is_link_local}, multicast={ip.is_multicast}")
    return (
        ip.is_private or ip.is_loopback or ip.is_reserved
        or ip.is_link_local or ip.is_multicast
    )


def _first_public_from_xff(xff: str) -> Optional[str]:
    # XFF is "client, proxy1, proxy2, ..."
    for part in xff.split(","):
        cand = part.strip().strip('"').strip("'")
        ip = _parse_ip(cand)
        if ip and not (
            ip.is_private or ip.is_loopback or ip.is_reserved
            or ip.is_link_local or ip.is_multicast
        ):
            return cand
    return None


def get_client_ip_from_headers(headers, fallback_host: Optional[str]) -> Optional[str]:
    # Cloudflare
    cf = headers.get("cf-connecting-ip")
    if cf:
        ip = _parse_ip(cf)
        if ip and not (
            ip.is_private or ip.is_loopback or ip.is_reserved
            or ip.is_link_local or ip.is_multicast
        ):
            return cf.strip()

    # X-Forwarded-For
    xff = headers.get("x-forwarded-for")
    if xff:
        pub = _first_public_from_xff(xff)
        if pub:
            return pub

    # X-Real-IP
    xri = headers.get("x-real-ip")
    if xri:
        ip = _parse_ip(xri)
        if ip and not (
            ip.is_private or ip.is_loopback or ip.is_reserved
            or ip.is_link_local or ip.is_multicast
        ):
            return xri.strip()

    # Forwarded: for=...
    fwd = headers.get("forwarded")
    if fwd:
        # examples: for="[2001:db8::1]:1234";proto=https;by=...
        #           for=203.0.113.10
        # We just extract the value after for= and feed it to _parse_ip
        for segment in fwd.split(","):
            for token in segment.split(";"):
                token = token.strip()
                if token.lower().startswith("for="):
                    cand = token[4:].strip().strip('"').strip("'")
                    ip = _parse_ip(cand)
                    if ip and not (
                        ip.is_private or ip.is_loopback or ip.is_reserved
                        or ip.is_link_local or ip.is_multicast
                    ):
                        return cand

    return fallback_host

# -------- Geo lookup --------
def _load_reader():
    """Lazy-load the MaxMind reader once."""
    global _GEO_READER
    if _GEO_READER is not None:
        return _GEO_READER
    try:
        import geoip2.database
        _GEO_READER = geoip2.database.Reader(_GEO_DB_PATH)
        print("[DEBUG] MaxMind reader loaded")
    except Exception:
        _GEO_READER = None
    return _GEO_READER

def _mm_lookup(ip: str) -> Optional[Dict]:
    reader = _load_reader()
    if not reader:
        print("[DEBUG] MaxMind reader not available")
        return None
    try:
        r = reader.city(ip)
        print(f"[DEBUG] MaxMind lookup result for IP {ip}: {r}")
        return {
            "country_code": (r.country.iso_code or None),
            "country_name": (r.country.name or None),
            "region": (r.subdivisions.most_specific.name or None),
            "city": (r.city.name or None),
            "source": "maxmind",
        }
    except Exception:
        return None

def _http_fallback(ip: str) -> Optional[Dict]:
    # ipapi.co is OK for light use; replace with ipinfo if you prefer.
    try:
        print(f"[DEBUG] Performing HTTP fallback lookup for IP {ip}")
        resp = requests.get(f"https://ipapi.co/{ip}/json/", timeout=3)
        if resp.status_code != 200:
            print(f"[DEBUG] HTTP fallback lookup failed for IP {ip} with status {resp.status_code}")
            return None
        j = resp.json()
        print(f"[DEBUG] HTTP fallback lookup result for IP {ip}: {j}")
        if j.get("country") == "ZZ":  # bogon/reserved per ipapi
            return None
        return {
            "country_code": j.get("country"),
            "country_name": j.get("country_name"),
            "region": j.get("region"),
            "city": j.get("city"),
            "source": "ipapi",
        }
    except Exception:
        return None

async def resolve_geo(ip: Optional[str], db: AsyncSession) -> Dict:
    """
    Resolve IP -> {country_code, country_name, region, city}.
    Uses DB cache with TTL; tries MaxMind first, then HTTP fallback.
    Skips lookup for private/loopback/etc.
    """
    if not ip or _is_private_str(ip):
        return {}

    now = datetime.now(timezone.utc)
    rec = await db.get(IpLocationCache, ip)

    if rec and rec.last_seen_at and (now - rec.last_seen_at) < CACHE_TTL:
        print(f"[DEBUG] Using cached geo data for IP {ip}: {rec}")
        return {
            "country_code": rec.country_code,
            "country_name": rec.country_name,
            "region": rec.region,
            "city": rec.city,
        }

    data = _mm_lookup(ip) or _http_fallback(ip) or {}
    print(f"[DEBUG] Geo lookup result for IP {ip}: {data}")
    if not rec:
        rec = IpLocationCache(
            ip=ip,
            country_code=data.get("country_code"),
            country_name=data.get("country_name"),
            region=data.get("region"),
            city=data.get("city"),
            source=data.get("source") or "unknown",
            first_seen_at=now,
            last_seen_at=now,
        )
        db.add(rec)
    else:
        rec.country_code = data.get("country_code")
        rec.country_name = data.get("country_name")
        rec.region = data.get("region")
        rec.city = data.get("city")
        rec.source = data.get("source") or rec.source
        rec.last_seen_at = now

    await db.commit()

    # Backfill any existing UserIpHistory rows that were created earlier
    # without resolved geo. This ensures admin lists reflect resolved
    # country/city even when the initial signup stored a blank location.
    try:
        if data.get("country_code") or data.get("city"):
            await db.execute(
                """
                UPDATE user_ip_history
                SET location_country_code = COALESCE(location_country_code, :country_code),
                    location_city = COALESCE(location_city, :city),
                    last_seen_at = :now
                WHERE ip = :ip AND (location_country_code IS NULL OR location_city IS NULL)
                """,
                {
                    "country_code": data.get("country_code"),
                    "city": data.get("city"),
                    "now": now,
                    "ip": ip,
                },
            )
            await db.commit()
    except Exception:
        # Best-effort: do not raise, but don't swallow silently during development
        pass

    return {
        "country_code": rec.country_code,
        "country_name": rec.country_name,
        "region": rec.region,
        "city": rec.city,
    }
