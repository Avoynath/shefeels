# app/middleware/geo.py
from starlette.middleware.base import BaseHTTPMiddleware
import geoip2.database
from functools import lru_cache

reader = geoip2.database.Reader('/path/GeoLite2-City.mmdb')

def lookup_geo(ip: str):
    try:
        r = reader.city(ip)
        return {
            "country_code": r.country.iso_code,
            "country_name": r.country.name,
            "region": r.subdivisions.most_specific.name,
            "city": r.city.name,
        }
    except Exception:
        return {}

class GeoCaptureMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        xf = request.headers.get("x-forwarded-for")
        ip = (xf.split(",")[0].strip() if xf else request.client.host)
        geo = lookup_geo(ip) if ip else {}
        # stash for handlers
        request.state.client_ip = ip
        request.state.geo = geo
        response = await call_next(request)
        return response
