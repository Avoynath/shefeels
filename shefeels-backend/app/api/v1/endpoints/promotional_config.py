from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.app_config import AppConfig
from typing import Dict

router = APIRouter()


@router.get("/promotional-config")
async def get_promotional_config(db: AsyncSession = Depends(get_db)):
    """
    Get promotional configuration settings (public endpoint).
    Returns settings like offer timer duration, discount percentage, etc.
    """
    query = select(AppConfig).where(AppConfig.category == "promotional")
    result = await db.execute(query)
    configs = result.scalars().all()

    # Convert to dict
    config_dict: Dict[str, str] = {}
    for config in configs:
        config_dict[config.parameter_name] = config.parameter_value

    # Return with defaults if not found
    payload = {
        "offer_timer_minutes": int(config_dict.get("OFFER_TIMER_MINUTES", "360")),
        "offer_discount_percentage": config_dict.get("OFFER_DISCOUNT_PERCENTAGE", "70"),
        "offer_enabled": config_dict.get("OFFER_ENABLED", "true").lower() == "true",
        "premium_button_text": config_dict.get("PREMIUM_BUTTON_TEXT", "Get Premium"),
        "offer_badge_text": config_dict.get("OFFER_BADGE_TEXT", "70% off"),
    }

    # Make this effectively uncacheable in browsers/CDNs.
    return JSONResponse(
        content=payload,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
        },
    )
