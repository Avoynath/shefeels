from typing import Optional, List, Dict, Any, Literal
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, cast, Date, text, case, literal, and_, or_
from pydantic import BaseModel, Field
from decimal import Decimal

from app.api.v1.deps import get_db, require_admin
from app.models.subscription import (
    CoinTransaction, Subscription, Order, PromoManagement, PricingPlan
)
from app.models.user import User, UserProfile
from app.models.character import Character
from app.models.geo import VisitSession, UserIpHistory

router = APIRouter()


def _normalize_amount(value: float) -> float:
    """Normalize money values that may have been stored as integer cents.
    Heuristic: if value is a large integer-like number (>= 1000), treat it as cents
    and convert to dollars by dividing by 100. Returns 0.0 for falsy inputs.
    """
    try:
        v = float(value or 0.0)
        if v >= 1000:
            return v / 100.0
        return v
    except Exception:
        return float(value or 0.0)


# ============================================================================
# Response Models
# ============================================================================

class PeriodRevenue(BaseModel):
    """Revenue data for a single time period."""
    period: str = Field(..., description="Period label (e.g., '2025-01', '2025-Q1', '2025-W01')")
    revenue: float = Field(..., description="Total revenue in the period")


class GeoRevenueItem(BaseModel):
    """Revenue breakdown for a single geographic entity."""
    geo_key: str = Field(..., description="Geographic identifier (e.g., 'US' or 'Mumbai, IN')")
    periods: List[PeriodRevenue] = Field(..., description="Time-series revenue data")
    total_revenue: float = Field(..., description="Sum of revenue across all periods")
    growth_vs_prev_period: Optional[float] = Field(
        None, 
        description="Growth rate vs previous period for the latest period (e.g., 0.18 = +18%)"
    )


class RevenueByGeoResponse(BaseModel):
    """Response for revenue by geography analytics."""
    level: Literal["country", "city"] = Field(..., description="Geographic aggregation level")
    interval: Literal["daily", "weekly", "monthly", "quarterly", "yearly"]
    items: List[GeoRevenueItem] = Field(..., description="Revenue data by geography")
    currency: str = Field(default="USD", description="Currency code")


class FunnelByCountryItem(BaseModel):
    """Funnel metrics for a single country."""
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    visitors: int = Field(..., description="Unique visit sessions from this country")
    signups: int = Field(..., description="Users who signed up from this country")
    payers: int = Field(..., description="Users who made successful payments from this country")
    signup_rate: float = Field(..., description="Signups / Visitors conversion rate")
    pay_rate: float = Field(..., description="Payers / Visitors conversion rate")


class FunnelByCountryResponse(BaseModel):
    """Response for funnel by country analytics."""
    items: List[FunnelByCountryItem] = Field(..., description="Funnel data by country")


class ArpuPeriodData(BaseModel):
    """ARPU metrics for a specific time period."""
    period: str = Field(..., description="Period label (e.g., '2025-01')")
    users: int = Field(..., description="Count of users with this home country")
    revenue: float = Field(..., description="Total revenue from users in this geo")
    orders: int = Field(..., description="Number of successful orders from users in this geo")
    arpu: float = Field(..., description="Average Revenue Per User (revenue / users)")
    aov: float = Field(..., description="Average Order Value (revenue / orders)")


class ArpuByGeoItem(BaseModel):
    """ARPU and AOV metrics for a single geographic entity."""
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    users: int = Field(..., description="Count of users with this home country")
    revenue: float = Field(..., description="Total revenue from users in this geo")
    orders: int = Field(..., description="Number of successful orders from users in this geo")
    arpu: float = Field(..., description="Average Revenue Per User (revenue / users)")
    aov: float = Field(..., description="Average Order Value (revenue / orders)")
    periods: Optional[List[ArpuPeriodData]] = Field(None, description="Time-series breakdown if interval provided")


class ArpuByGeoResponse(BaseModel):
    """Response for ARPU by geography analytics."""
    interval: Optional[str] = Field(None, description="Time interval used for aggregation")
    items: List[ArpuByGeoItem] = Field(..., description="ARPU data by geography")


class CountryCoinTotals(BaseModel):
    """Aggregated coin purchase/spend totals for a country."""
    coins_purchased: int = Field(..., description="Total coins credited in the window")
    coins_spent: int = Field(..., description="Total coins debited in the window")
    net: int = Field(..., description="coins_purchased - coins_spent")
    purchase_spend_ratio: Optional[float] = Field(
        None,
        description="coins_purchased / coins_spent (None when spend is zero)"
    )


class CoinTimeseriesPoint(BaseModel):
    """Overall coin flow per time period."""
    period: str = Field(..., description="Period label (e.g., '2025-01')")
    coins_purchased: int = Field(..., description="Coins purchased in this period")
    coins_spent: int = Field(..., description="Coins spent in this period")


class CoinGeoFeatureResponse(BaseModel):
    """Coin usage heatmap + totals payload for the dashboard."""
    countries: List[str] = Field(..., description="Ordered list of country codes represented in the matrix")
    features: List[str] = Field(..., description="Ordered list of feature buckets represented in the matrix")
    matrix: List[List[float]] = Field(..., description="Matrix[country][feature] coin spend values")
    totals: Dict[str, CountryCoinTotals] = Field(..., description="Per-country purchase/spend aggregates")
    timeseries: List[CoinTimeseriesPoint] = Field(..., description="Overall purchase/spend per time period")


class CharacterCountrySpend(BaseModel):
    """Coin spending data for a character in a specific country."""
    country_code: str = Field(..., description="ISO 3166-1 alpha-2 country code")
    coins_spent: int = Field(..., description="Total coins spent on this character in this country")


class CharacterEngagementGeoItem(BaseModel):
    """Character engagement data with geographic breakdown."""
    character_id: str = Field(..., description="Unique character identifier")
    character_name: str = Field(..., description="Character display name")
    total_coins_spent: int = Field(..., description="Total coins spent on this character across all countries")
    by_country: List[CharacterCountrySpend] = Field(..., description="Spending breakdown by country")


class CharacterEngagementGeoResponse(BaseModel):
    """Response for character engagement by geography."""
    metric: str = Field(..., description="Metric used for ranking (e.g., 'coins_spent')")
    results: List[CharacterEngagementGeoItem] = Field(..., description="Character engagement data")


# ============================================================================
# Helper Functions
# ============================================================================

def _date_range_defaults(start_date: Optional[str], end_date: Optional[str]):
    # pass-through; router endpoints handle optional strings and SQL filters
    return start_date, end_date


def _parse_datetime(s: Optional[str]):
    """Parse an ISO or YYYY-MM-DD date string into a datetime (or None)."""
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except Exception:
        try:
            return datetime.strptime(s, "%Y-%m-%d")
        except Exception:
            return None


def _get_default_date_range(interval: str) -> tuple[datetime, datetime]:
    """Return default start and end dates based on interval (last 12 periods)."""
    end = datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
    if interval == "daily":
        start = end - timedelta(days=12)
    elif interval == "weekly":
        start = end - timedelta(weeks=12)
    elif interval == "monthly":
        start = end - timedelta(days=365)  # ~12 months
    elif interval == "quarterly":
        start = end - timedelta(days=365 * 3)  # ~12 quarters
    elif interval == "yearly":
        start = end - timedelta(days=365 * 12)  # 12 years
    else:
        start = end - timedelta(days=365)
    
    return start, end


def _get_postgres_date_format(interval: str) -> str:
    """Return Postgres to_char format string for the given interval."""
    formats = {
        "daily": "YYYY-MM-DD",
        "weekly": "IYYY-IW",  # ISO year and week
        "monthly": "YYYY-MM",
        "quarterly": "YYYY-\"Q\"Q",
        "yearly": "YYYY"
    }
    return formats.get(interval, "YYYY-MM")


def _get_postgres_date_trunc_unit(interval: str) -> str:
    """Convert interval name to PostgreSQL date_trunc unit."""
    units = {
        "daily": "day",
        "weekly": "week",
        "monthly": "month",
        "quarterly": "quarter",
        "yearly": "year"
    }
    return units.get(interval, "month")


def _calculate_growth(current: float, previous: float) -> Optional[float]:
    """Calculate growth rate. Returns None if previous is 0 or if calculation fails."""
    if previous == 0 or previous is None:
        return None
    if current is None:
        return None
    try:
        return round((current - previous) / previous, 4)
    except (ZeroDivisionError, TypeError):
        return None


# Canonical feature buckets used for geo coin analytics.
DEFAULT_FEATURE_ORDER = ["chat", "chat_image", "image", "video", "private_content"]
FEATURE_TO_SOURCE_TYPES: Dict[str, Optional[List[str]]] = {
    "all": None,
    "chat": ["chat"],
    "chat_image": ["chat_image"],
    "image": ["image"],
    "video": ["video"],
    "private_content": ["private_content", "character"],
}


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/revenue/by-geo", response_model=RevenueByGeoResponse)
async def get_revenue_by_geo(
    level: Literal["country", "city"] = Query(default="country", description="Geographic aggregation level"),
    interval: Literal["daily", "weekly", "monthly", "quarterly", "yearly"] = Query(
        default="monthly", 
        description="Time interval for aggregation"
    ),
    start_date: Optional[str] = Query(None, description="Start date (ISO format or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format or YYYY-MM-DD)"),
    top_n: int = Query(default=20, ge=1, le=100, description="Number of top geos to return"),
    country_code: Optional[str] = Query(None, description="Filter by specific country code (e.g., 'IN', 'US')"),
    db: AsyncSession = Depends(get_db),
    _admin: bool = Depends(require_admin)
):
    """
    Get revenue analytics by geography with time-series breakdown.
    
    This endpoint analyzes successful orders, grouping by country or city
    and aggregating revenue over the specified time interval.
    
    Features:
    - Denormalized geo data from orders (country_code, city)
    - Time-series data with period labels
    - Growth calculation vs previous period
    - Configurable aggregation levels and intervals
    """
    
    # Parse and set date range
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    
    if not start_dt or not end_dt:
        start_dt, end_dt = _get_default_date_range(interval)
    
    # Get Postgres format for the interval
    date_format = _get_postgres_date_format(interval)
    date_trunc_unit = _get_postgres_date_trunc_unit(interval)
    
    # Build geo grouping columns
    if level == "country":
        geo_group_cols = [Order.country_code]
        geo_select = Order.country_code.label("geo_key")
    else:  # city
        geo_group_cols = [Order.city, Order.country_code]
        geo_select = func.concat(
            func.coalesce(Order.city, "Unknown"), 
            literal(", "), 
            func.coalesce(Order.country_code, "??")
        ).label("geo_key")
    
    # Build the main query with CTE for period generation
    # Step 1: Aggregate orders by geo and period
    period_label = func.to_char(
        func.date_trunc(date_trunc_unit, Order.applied_at),
        date_format
    ).label("period")
    
    revenue_sum = func.sum(Order.subtotal_at_apply).label("revenue")
    
    # Build WHERE conditions
    where_conditions = [
        Order.status == "success",
        Order.applied_at.between(start_dt, end_dt)
    ]
    if country_code:
        where_conditions.append(Order.country_code == country_code)
    
    subq = (
        select(
            geo_select,
            period_label,
            revenue_sum,
            *geo_group_cols
        )
        .where(and_(*where_conditions))
        .group_by(
            *geo_group_cols,
            "period"
        )
    ).alias("geo_periods")
    
    # Step 2: Calculate totals per geo
    geo_totals_subq = (
        select(
            geo_select.label("geo_key_total"),
            func.sum(Order.subtotal_at_apply).label("total_revenue")
        )
        .where(and_(*where_conditions))
        .group_by(*geo_group_cols)
        .order_by(func.sum(Order.subtotal_at_apply).desc())
        .limit(top_n)
    ).alias("geo_totals")
    
    # Execute to get top geos first
    result = await db.execute(
        select(
            geo_totals_subq.c.geo_key_total,
            geo_totals_subq.c.total_revenue
        )
    )
    top_geos_data = result.fetchall()
    
    if not top_geos_data:
        return RevenueByGeoResponse(
            level=level,
            interval=interval,
            items=[],
            currency="USD"
        )
    
    top_geos = [row.geo_key_total for row in top_geos_data]
    geo_totals_map = {row.geo_key_total: _normalize_amount(float(row.total_revenue or 0)) for row in top_geos_data}
    
    # Step 3: Get period breakdown for top geos
    if level == "country":
        geo_filter = Order.country_code.in_(top_geos)
    else:  # city
        # For city level, we need to reconstruct the geo_key and filter
        # This is a bit more complex - we'll fetch all data and filter in Python
        geo_filter = or_(
            *[
                and_(
                    func.coalesce(Order.city, "Unknown") == geo_key.split(", ")[0],
                    func.coalesce(Order.country_code, "??") == geo_key.split(", ")[1]
                )
                for geo_key in top_geos
            ]
        )
    
    # Build WHERE conditions for period query
    period_where_conditions = [
        Order.status == "success",
        Order.applied_at.between(start_dt, end_dt),
        geo_filter
    ]
    if country_code:
        period_where_conditions.append(Order.country_code == country_code)
    
    period_query = (
        select(
            geo_select,
            period_label,
            revenue_sum
        )
        .where(and_(*period_where_conditions))
        .group_by(
            *geo_group_cols,
            "period"
        )
        .order_by(
            "period"
        )
    )
    
    result = await db.execute(period_query)
    period_data = result.fetchall()
    
    # Step 4: Organize data by geo
    geo_periods_map: Dict[str, List[PeriodRevenue]] = {geo: [] for geo in top_geos}
    
    for row in period_data:
        geo_key = row.geo_key
        if geo_key in geo_periods_map:
            geo_periods_map[geo_key].append(
                PeriodRevenue(
                    period=row.period,
                    revenue=_normalize_amount(float(row.revenue or 0))
                )
            )
    
    # Step 5: Calculate growth for each geo
    items = []
    for geo_key in top_geos:
        # Skip entries with NULL or empty geo_key to prevent validation errors
        if not geo_key:
            continue
            
        periods = geo_periods_map.get(geo_key, [])
        total_revenue = geo_totals_map.get(geo_key, 0)
        
        # Calculate growth vs previous period for latest period
        growth = None
        if len(periods) >= 2:
            latest_revenue = periods[-1].revenue
            previous_revenue = periods[-2].revenue
            growth = _calculate_growth(latest_revenue, previous_revenue)
        
        items.append(
            GeoRevenueItem(
                geo_key=geo_key,
                periods=periods,
                total_revenue=total_revenue,
                growth_vs_prev_period=growth
            )
        )
    
    return RevenueByGeoResponse(
        level=level,
        interval=interval,
        items=items,
        currency="USD"
    )


@router.get("/funnel/by-country", response_model=FunnelByCountryResponse)
async def get_funnel_by_country(
    start_date: Optional[str] = Query(None, description="Start date (ISO format or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format or YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _admin: bool = Depends(require_admin)
):
    """
    Get funnel analytics by country: visitors -> signups -> payers.
    
    Metrics:
    - Visitors: Unique visit sessions with first_country_code in date range
    - Signups: Users created in date range, attributed to country via:
      1. user_ip_history (latest IP in window)
      2. Fallback to earliest VisitSession.first_country_code
    - Payers: Users with successful orders in date range, same country attribution
    
    Returns conversion rates (signup_rate, pay_rate) and totals.
    """
    
    # Parse date range
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    
    if not start_dt or not end_dt:
        # Default to last 30 days
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=30)
    
    # ========================================================================
    # Step 1: Count visitors by country (distinct visit sessions)
    # ========================================================================
    visitor_query = (
        select(
            VisitSession.first_country_code.label("country_code"),
            func.count(func.distinct(VisitSession.id)).label("visitors")
        )
        .where(
            and_(
                VisitSession.first_country_code.isnot(None),
                VisitSession.started_at.between(start_dt, end_dt)
            )
        )
        .group_by(VisitSession.first_country_code)
    )
    
    result = await db.execute(visitor_query)
    visitor_data = result.fetchall()
    visitors_by_country = {row.country_code: row.visitors for row in visitor_data}
    
    # ========================================================================
    # Step 2: Count signups by country with attribution logic
    # ========================================================================
    # Subquery: Latest user_ip_history per user within the window
    latest_ip_subq = (
        select(
            UserIpHistory.user_id,
            UserIpHistory.location_country_code.label("ip_country_code")
        )
        .where(
            and_(
                UserIpHistory.last_seen_at.between(start_dt, end_dt),
                UserIpHistory.location_country_code.isnot(None)
            )
        )
        .distinct(UserIpHistory.user_id)
        .order_by(UserIpHistory.user_id, UserIpHistory.last_seen_at.desc())
    ).alias("latest_ip")
    
    # Subquery: Earliest visit session country per user
    earliest_visit_subq = (
        select(
            VisitSession.user_id,
            VisitSession.first_country_code.label("visit_country_code")
        )
        .where(
            and_(
                VisitSession.user_id.isnot(None),
                VisitSession.first_country_code.isnot(None)
            )
        )
        .distinct(VisitSession.user_id)
        .order_by(VisitSession.user_id, VisitSession.started_at.asc())
    ).alias("earliest_visit")
    
    # Main signup query with country attribution
    signup_query = (
        select(
            func.coalesce(
                latest_ip_subq.c.ip_country_code,
                earliest_visit_subq.c.visit_country_code,
                literal("Unknown")
            ).label("country_code"),
            func.count(func.distinct(User.id)).label("signups")
        )
        .select_from(User)
        .outerjoin(latest_ip_subq, User.id == latest_ip_subq.c.user_id)
        .outerjoin(earliest_visit_subq, User.id == earliest_visit_subq.c.user_id)
        .where(
            User.created_at.between(start_dt, end_dt)
        )
        .group_by("country_code")
    )
    
    result = await db.execute(signup_query)
    signup_data = result.fetchall()
    signups_by_country = {row.country_code: row.signups for row in signup_data if row.country_code != "Unknown"}
    
    # ========================================================================
    # Step 3: Count payers by country with same attribution logic
    # ========================================================================
    # Get unique payer user_ids from orders
    payer_ids_subq = (
        select(func.distinct(Order.user_id).label("user_id"))
        .where(
            and_(
                Order.status == "success",
                Order.applied_at.between(start_dt, end_dt)
            )
        )
    ).alias("payers")
    
    # Apply same country attribution logic for payers
    payer_query = (
        select(
            func.coalesce(
                latest_ip_subq.c.ip_country_code,
                earliest_visit_subq.c.visit_country_code,
                literal("Unknown")
            ).label("country_code"),
            func.count(func.distinct(payer_ids_subq.c.user_id)).label("payers")
        )
        .select_from(payer_ids_subq)
        .outerjoin(latest_ip_subq, payer_ids_subq.c.user_id == latest_ip_subq.c.user_id)
        .outerjoin(earliest_visit_subq, payer_ids_subq.c.user_id == earliest_visit_subq.c.user_id)
        .group_by("country_code")
    )
    
    result = await db.execute(payer_query)
    payer_data = result.fetchall()
    payers_by_country = {row.country_code: row.payers for row in payer_data if row.country_code != "Unknown"}
    
    # ========================================================================
    # Step 4: Combine data and calculate conversion rates
    # ========================================================================
    all_countries = set(visitors_by_country.keys()) | set(signups_by_country.keys()) | set(payers_by_country.keys())
    
    items = []
    total_visitors = 0
    total_signups = 0
    total_payers = 0
    
    for country_code in all_countries:
        visitors = visitors_by_country.get(country_code, 0)
        signups = signups_by_country.get(country_code, 0)
        payers = payers_by_country.get(country_code, 0)
        
        signup_rate = round(signups / visitors, 4) if visitors > 0 else 0.0
        pay_rate = round(payers / visitors, 4) if visitors > 0 else 0.0
        
        items.append(
            FunnelByCountryItem(
                country_code=country_code,
                visitors=visitors,
                signups=signups,
                payers=payers,
                signup_rate=signup_rate,
                pay_rate=pay_rate
            )
        )
        
        total_visitors += visitors
        total_signups += signups
        total_payers += payers
    
    # Sort by payers descending
    items.sort(key=lambda x: x.payers, reverse=True)
    
    # Add totals row
    total_signup_rate = round(total_signups / total_visitors, 4) if total_visitors > 0 else 0.0
    total_pay_rate = round(total_payers / total_visitors, 4) if total_visitors > 0 else 0.0
    
    items.append(
        FunnelByCountryItem(
            country_code="TOTAL",
            visitors=total_visitors,
            signups=total_signups,
            payers=total_payers,
            signup_rate=total_signup_rate,
            pay_rate=total_pay_rate
        )
    )
    
    return FunnelByCountryResponse(items=items)


@router.get("/metrics/arpu-by-geo", response_model=ArpuByGeoResponse)
async def get_arpu_by_geo(
    interval: Optional[Literal["daily", "weekly", "monthly", "quarterly", "yearly"]] = Query(
        None, 
        description="Time interval for period breakdown"
    ),
    start_date: Optional[str] = Query(None, description="Start date (ISO format or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format or YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _admin: bool = Depends(require_admin)
):
    """
    Get ARPU (Average Revenue Per User) and AOV (Average Order Value) by geography.
    
    Home Country Attribution:
    - Mode (most frequent) country_code from user_ip_history
    - Fallback to earliest VisitSession.first_country_code if no IP history
    
    Metrics:
    - ARPU: Total revenue from users / Count of users (by home country)
    - AOV: Total order value / Count of orders (by home country)
    
    Optional time-series breakdown with interval parameter.
    """
    
    # Parse date range
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    
    if not start_dt or not end_dt:
        if interval:
            start_dt, end_dt = _get_default_date_range(interval)
        else:
            # Default to last 90 days for aggregate metrics
            end_dt = datetime.utcnow()
            start_dt = end_dt - timedelta(days=90)
    
    # ========================================================================
    # Step 1: Calculate home_country for each user
    # ========================================================================
    # Subquery: Most frequent country from user_ip_history (mode)
    # Using ROW_NUMBER to get the most common country per user
    ip_mode_subq = (
        select(
            UserIpHistory.user_id,
            UserIpHistory.location_country_code,
            func.count().label("country_count"),
            func.row_number().over(
                partition_by=UserIpHistory.user_id,
                order_by=[
                    func.count().desc(),
                    func.max(UserIpHistory.last_seen_at).desc()
                ]
            ).label("rn")
        )
        .where(UserIpHistory.location_country_code.isnot(None))
        .group_by(UserIpHistory.user_id, UserIpHistory.location_country_code)
    ).alias("ip_mode")
    
    ip_home_country_subq = (
        select(
            ip_mode_subq.c.user_id,
            ip_mode_subq.c.location_country_code.label("ip_home_country")
        )
        .where(ip_mode_subq.c.rn == 1)
    ).alias("ip_home")
    
    # Subquery: Earliest visit session country (fallback)
    visit_home_country_subq = (
        select(
            VisitSession.user_id,
            VisitSession.first_country_code.label("visit_home_country")
        )
        .where(
            and_(
                VisitSession.user_id.isnot(None),
                VisitSession.first_country_code.isnot(None)
            )
        )
        .distinct(VisitSession.user_id)
        .order_by(VisitSession.user_id, VisitSession.started_at.asc())
    ).alias("visit_home")
    
    # Main CTE: User to home_country mapping
    user_home_country_cte = (
        select(
            User.id.label("user_id"),
            func.coalesce(
                ip_home_country_subq.c.ip_home_country,
                visit_home_country_subq.c.visit_home_country
            ).label("home_country")
        )
        .select_from(User)
        .outerjoin(ip_home_country_subq, User.id == ip_home_country_subq.c.user_id)
        .outerjoin(visit_home_country_subq, User.id == visit_home_country_subq.c.user_id)
        .where(
            or_(
                ip_home_country_subq.c.ip_home_country.isnot(None),
                visit_home_country_subq.c.visit_home_country.isnot(None)
            )
        )
    ).cte("user_home_country")
    
    # ========================================================================
    # Step 2: Build queries based on whether interval is provided
    # ========================================================================
    
    if interval:
        # Time-series mode: breakdown by period
        date_format = _get_postgres_date_format(interval)
        date_trunc_unit = _get_postgres_date_trunc_unit(interval)
        period_label = func.to_char(
            func.date_trunc(date_trunc_unit, Order.applied_at),
            date_format
        ).label("period")
        
        # Query: Revenue and orders by home_country and period
        period_query = (
            select(
                user_home_country_cte.c.home_country,
                period_label,
                func.count(func.distinct(user_home_country_cte.c.user_id)).label("users"),
                func.sum(Order.subtotal_at_apply).label("revenue"),
                func.count(Order.id).label("orders")
            )
            .select_from(user_home_country_cte)
            .outerjoin(Order, and_(
                Order.user_id == user_home_country_cte.c.user_id,
                Order.status == "success",
                Order.applied_at.between(start_dt, end_dt)
            ))
            .where(user_home_country_cte.c.home_country.isnot(None))
            .group_by(user_home_country_cte.c.home_country, "period")
            .order_by(user_home_country_cte.c.home_country, "period")
        )
        
        result = await db.execute(period_query)
        period_data = result.fetchall()
        
        # Organize data by country
        country_periods_map: Dict[str, List[Dict[str, Any]]] = {}
        country_totals: Dict[str, Dict[str, float]] = {}
        
        for row in period_data:
            country = row.home_country
            if country not in country_periods_map:
                country_periods_map[country] = []
                country_totals[country] = {"users": 0, "revenue": 0.0, "orders": 0}
            
            users = row.users or 0
            revenue = _normalize_amount(float(row.revenue or 0))
            orders = row.orders or 0
            arpu = round(revenue / users, 2) if users > 0 else 0.0
            aov = round(revenue / orders, 2) if orders > 0 else 0.0
            
            country_periods_map[country].append({
                "period": row.period or "Unknown",
                "users": users,
                "revenue": revenue,
                "orders": orders,
                "arpu": arpu,
                "aov": aov
            })
            
            country_totals[country]["users"] = max(country_totals[country]["users"], users)
            country_totals[country]["revenue"] += revenue
            country_totals[country]["orders"] += orders
        
        # Build response items
        items = []
        for country_code in sorted(country_totals.keys(), 
                                   key=lambda c: country_totals[c]["revenue"], 
                                   reverse=True):
            totals = country_totals[country_code]
            periods_list = [
                ArpuPeriodData(**p) for p in country_periods_map[country_code]
            ]
            
            total_users = totals["users"]
            total_revenue = totals["revenue"]
            total_orders = totals["orders"]
            total_arpu = round(total_revenue / total_users, 2) if total_users > 0 else 0.0
            total_aov = round(total_revenue / total_orders, 2) if total_orders > 0 else 0.0
            
            items.append(
                ArpuByGeoItem(
                    country_code=country_code,
                    users=total_users,
                    revenue=round(total_revenue, 2),
                    orders=total_orders,
                    arpu=total_arpu,
                    aov=total_aov,
                    periods=periods_list
                )
            )
        
        return ArpuByGeoResponse(interval=interval, items=items)
    
    else:
        # Aggregate mode: total metrics by country
        
        # Count unique users per home_country
        user_count_query = (
            select(
                user_home_country_cte.c.home_country,
                func.count(func.distinct(user_home_country_cte.c.user_id)).label("users")
            )
            .where(user_home_country_cte.c.home_country.isnot(None))
            .group_by(user_home_country_cte.c.home_country)
        )
        
        result = await db.execute(user_count_query)
        user_counts = {row.home_country: row.users for row in result.fetchall()}
        
        # Calculate revenue and orders per home_country
        revenue_query = (
            select(
                user_home_country_cte.c.home_country,
                func.sum(Order.subtotal_at_apply).label("revenue"),
                func.count(Order.id).label("orders")
            )
            .select_from(user_home_country_cte)
            .join(Order, and_(
                Order.user_id == user_home_country_cte.c.user_id,
                Order.status == "success",
                Order.applied_at.between(start_dt, end_dt)
            ))
            .where(user_home_country_cte.c.home_country.isnot(None))
            .group_by(user_home_country_cte.c.home_country)
        )
        
        result = await db.execute(revenue_query)
        revenue_data = result.fetchall()
        
        # Build response
        items = []
        for row in revenue_data:
            country = row.home_country
            users = user_counts.get(country, 0)
            revenue = float(row.revenue or 0)
            orders = row.orders or 0
            
            arpu = round(revenue / users, 2) if users > 0 else 0.0
            aov = round(revenue / orders, 2) if orders > 0 else 0.0
            
            items.append(
                ArpuByGeoItem(
                    country_code=country,
                    users=users,
                    revenue=round(revenue, 2),
                    orders=orders,
                    arpu=arpu,
                    aov=aov,
                    periods=None
                )
            )
        
        # Sort by revenue descending
        items.sort(key=lambda x: x.revenue, reverse=True)
        
        return ArpuByGeoResponse(interval=None, items=items)


@router.get("/coins/geo-feature", response_model=CoinGeoFeatureResponse)
async def get_coins_geo_feature(
    interval: Literal["daily", "weekly", "monthly", "quarterly", "yearly"] = Query(
        default="monthly", 
        description="Time interval for aggregation"
    ),
    feature: Literal["all", "chat", "chat_image","image", "video", "private_content"] = Query(
        default="all", 
        description="Feature type filter"
    ),
    start_date: Optional[str] = Query(None, description="Start date (ISO format or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format or YYYY-MM-DD)"),
    top_n: int = Query(default=10, ge=1, le=50, description="Number of top countries to return"),
    db: AsyncSession = Depends(get_db),
    _admin: bool = Depends(require_admin)
):
    """
    Build a feature-by-country heatmap of coin spend plus supporting totals/time-series.
    
    Response structure matches dashboard expectations:
    - countries: Ordered list of country codes (top N by spend)
    - features: Ordered feature buckets included in the matrix
    - matrix: coins_spent values per country/feature combination
    - totals: per-country purchase/spend/net metrics
    - timeseries: overall purchase/spend per time interval
    
    Feature buckets:
    - chat: Chat-related spending (no media output)
    - chat_image: Images generated inside chat flows
    - image: Images generated via the standalone image interface
    - video: Video generation spending
    - private_content: Private/premium content spending
    """
    
    # Parse date range
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    
    if not start_dt or not end_dt:
        start_dt, end_dt = _get_default_date_range(interval)
    
    date_format = _get_postgres_date_format(interval)
    date_trunc_unit = _get_postgres_date_trunc_unit(interval)
    period_label = func.to_char(
        func.date_trunc(date_trunc_unit, CoinTransaction.created_at),
        date_format
    ).label("period")
    
    # Determine which feature buckets to include in the matrix/response
    if feature == "all":
        feature_buckets = list(DEFAULT_FEATURE_ORDER)
    else:
        feature_buckets = [feature]
    
    source_types = FEATURE_TO_SOURCE_TYPES.get(feature)
    
    # ========================================================================
    # Step 1: Build home_country attribution subqueries (reuse from ARPU endpoint)
    # ========================================================================
    # Subquery: Most frequent country from user_ip_history (mode)
    ip_mode_subq = (
        select(
            UserIpHistory.user_id,
            UserIpHistory.location_country_code,
            func.count().label("country_count"),
            func.row_number().over(
                partition_by=UserIpHistory.user_id,
                order_by=[
                    func.count().desc(),
                    func.max(UserIpHistory.last_seen_at).desc()
                ]
            ).label("rn")
        )
        .where(UserIpHistory.location_country_code.isnot(None))
        .group_by(UserIpHistory.user_id, UserIpHistory.location_country_code)
    ).alias("ip_mode")
    
    ip_home_country_subq = (
        select(
            ip_mode_subq.c.user_id,
            ip_mode_subq.c.location_country_code.label("ip_home_country")
        )
        .where(ip_mode_subq.c.rn == 1)
    ).alias("ip_home")
    
    # Subquery: Earliest visit session country (fallback)
    visit_home_country_subq = (
        select(
            VisitSession.user_id,
            VisitSession.first_country_code.label("visit_home_country")
        )
        .where(
            and_(
                VisitSession.user_id.isnot(None),
                VisitSession.first_country_code.isnot(None)
            )
        )
        .distinct(VisitSession.user_id)
        .order_by(VisitSession.user_id, VisitSession.started_at.asc())
    ).alias("visit_home")
    
    # Country: prefer coin_transactions.country_code, fallback to home_country
    country_select = func.coalesce(
        CoinTransaction.country_code,
        ip_home_country_subq.c.ip_home_country,
        visit_home_country_subq.c.visit_home_country
    ).label("country_code")
    
    credit_case = case(
        (CoinTransaction.transaction_type == "credit", CoinTransaction.coins),
        else_=0
    )
    debit_case = case(
        (CoinTransaction.transaction_type == "debit", CoinTransaction.coins),
        else_=0
    )
    feature_case = case(
        (CoinTransaction.source_type == "chat", literal("chat")),
        (CoinTransaction.source_type == "chat_image", literal("chat_image")),
        (CoinTransaction.source_type == "image", literal("image")),
        (CoinTransaction.source_type == "video", literal("video")),
        (CoinTransaction.source_type.in_(["private_content", "character"]), literal("private_content")),
        else_=None
    ).label("feature_bucket")
    
    base_where_conditions = [
        CoinTransaction.created_at.between(start_dt, end_dt)
    ]
    
    if source_types:
        base_where_conditions.append(CoinTransaction.source_type.in_(source_types))
    
    # ========================================================================
    # Step 2: Fetch top countries by spend with purchase/spend totals
    # ========================================================================
    totals_limit = max(top_n * 3, top_n)
    country_totals_query = (
        select(
            country_select,
            func.sum(credit_case).label("coins_purchased"),
            func.sum(debit_case).label("coins_spent")
        )
        .select_from(CoinTransaction)
        .outerjoin(ip_home_country_subq, CoinTransaction.user_id == ip_home_country_subq.c.user_id)
        .outerjoin(visit_home_country_subq, CoinTransaction.user_id == visit_home_country_subq.c.user_id)
        .where(and_(*base_where_conditions))
        .group_by(
            CoinTransaction.country_code,
            ip_home_country_subq.c.ip_home_country,
            visit_home_country_subq.c.visit_home_country
        )
        .order_by(func.sum(debit_case).desc())
        .limit(totals_limit)
    )
    result = await db.execute(country_totals_query)
    totals_rows = result.fetchall()
    
    countries: List[str] = []
    totals: Dict[str, CountryCoinTotals] = {}
    for row in totals_rows:
        country = row.country_code
        if not country or country == "Unknown" or country in countries:
            continue
        coins_purchased = int(row.coins_purchased or 0)
        coins_spent = int(row.coins_spent or 0)
        net = coins_purchased - coins_spent
        ratio = round(coins_purchased / coins_spent, 2) if coins_spent else None
        totals[country] = CountryCoinTotals(
            coins_purchased=coins_purchased,
            coins_spent=coins_spent,
            net=net,
            purchase_spend_ratio=ratio
        )
        countries.append(country)
        if len(countries) == top_n:
            break
    
    country_feature_map: Dict[str, Dict[str, float]] = {country: {} for country in countries}
    if countries:
        feature_conditions = [
            *base_where_conditions,
            feature_case.isnot(None),
            feature_case.in_(feature_buckets),
            country_select.in_(countries)
        ]
        feature_breakdown_query = (
            select(
                country_select,
                feature_case,
                func.sum(debit_case).label("coins_spent")
            )
            .select_from(CoinTransaction)
            .outerjoin(ip_home_country_subq, CoinTransaction.user_id == ip_home_country_subq.c.user_id)
            .outerjoin(visit_home_country_subq, CoinTransaction.user_id == visit_home_country_subq.c.user_id)
            .where(and_(*feature_conditions))
            .group_by(
                CoinTransaction.country_code,
                ip_home_country_subq.c.ip_home_country,
                visit_home_country_subq.c.visit_home_country,
                feature_case
            )
        )
        result = await db.execute(feature_breakdown_query)
        feature_rows = result.fetchall()
        for row in feature_rows:
            country = row.country_code
            feature_bucket = row.feature_bucket
            if not country or feature_bucket not in feature_buckets:
                continue
            country_feature_map.setdefault(country, {})[feature_bucket] = float(row.coins_spent or 0)
    
    matrix: List[List[float]] = []
    for country in countries:
        row_values = [
            country_feature_map.get(country, {}).get(bucket, 0.0)
            for bucket in feature_buckets
        ]
        matrix.append(row_values)
    
    # ========================================================================
    # Step 4: Build overall purchase/spend timeseries
    # ========================================================================
    timeseries_query = (
        select(
            period_label,
            func.sum(credit_case).label("coins_purchased"),
            func.sum(debit_case).label("coins_spent")
        )
        .select_from(CoinTransaction)
        .where(and_(*base_where_conditions))
        .group_by("period")
        .order_by("period")
    )
    result = await db.execute(timeseries_query)
    timeseries_rows = result.fetchall()
    timeseries = [
        CoinTimeseriesPoint(
            period=row.period,
            coins_purchased=int(row.coins_purchased or 0),
            coins_spent=int(row.coins_spent or 0)
        )
        for row in timeseries_rows
    ]
    
    return CoinGeoFeatureResponse(
        countries=countries,
        features=feature_buckets,
        matrix=matrix,
        totals=totals,
        timeseries=timeseries
    )


@router.get("/engagement/characters-geo", response_model=CharacterEngagementGeoResponse)
async def get_engagement_characters_geo(
    metric: Literal["coins_spent"] = Query(
        default="coins_spent", 
        description="Metric for ranking characters"
    ),
    limit: int = Query(default=10, ge=1, le=100, description="Number of top characters to return"),
    start_date: Optional[str] = Query(None, description="Start date (ISO format or YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (ISO format or YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    _admin: bool = Depends(require_admin)
):
    """
    Get character engagement analytics by geography based on coin spending.
    
    Analyzes DEBIT coin transactions to understand which characters are most
    popular in different countries/regions.
    
    Data Sources:
    - coin_transactions (transaction_type='debit' only)
    - Grouped by character_id and country_code
    - Joined with Character table for character names
    
    Returns:
    - Top N characters by total coins spent
    - Per-character breakdown by country
    - Countries sorted by spend within each character
    """
    
    # Parse date range
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    
    if not start_dt or not end_dt:
        # Default to last 90 days
        end_dt = datetime.utcnow()
        start_dt = end_dt - timedelta(days=90)
    
    # ========================================================================
    # Step 1: Build home_country CTE for fallback attribution
    # ========================================================================
    # Subquery: Most frequent country from user_ip_history (mode)
    ip_mode_subq = (
        select(
            UserIpHistory.user_id,
            UserIpHistory.location_country_code,
            func.count().label("country_count"),
            func.row_number().over(
                partition_by=UserIpHistory.user_id,
                order_by=[
                    func.count().desc(),
                    func.max(UserIpHistory.last_seen_at).desc()
                ]
            ).label("rn")
        )
        .where(UserIpHistory.location_country_code.isnot(None))
        .group_by(UserIpHistory.user_id, UserIpHistory.location_country_code)
    ).alias("ip_mode")
    
    ip_home_country_subq = (
        select(
            ip_mode_subq.c.user_id,
            ip_mode_subq.c.location_country_code.label("ip_home_country")
        )
        .where(ip_mode_subq.c.rn == 1)
    ).alias("ip_home")
    
    # Subquery: Earliest visit session country (fallback)
    visit_home_country_subq = (
        select(
            VisitSession.user_id,
            VisitSession.first_country_code.label("visit_home_country")
        )
        .where(
            and_(
                VisitSession.user_id.isnot(None),
                VisitSession.first_country_code.isnot(None)
            )
        )
        .distinct(VisitSession.user_id)
        .order_by(VisitSession.user_id, VisitSession.started_at.asc())
    ).alias("visit_home")
    
    # ========================================================================
    # Step 2: Query coin transactions (debits only) with country attribution
    # ========================================================================
    # Country: prefer coin_transactions.country_code, fallback to home_country
    country_select = func.coalesce(
        CoinTransaction.country_code,
        ip_home_country_subq.c.ip_home_country,
        visit_home_country_subq.c.visit_home_country
    ).label("country_code")
    
    # Query: Aggregate coin spending by character and country
    character_country_query = (
        select(
            CoinTransaction.character_id,
            Character.name.label("character_name"),
            country_select,
            func.sum(CoinTransaction.coins).label("coins_spent")
        )
        .select_from(CoinTransaction)
        .join(Character, CoinTransaction.character_id == Character.id)
        .outerjoin(ip_home_country_subq, CoinTransaction.user_id == ip_home_country_subq.c.user_id)
        .outerjoin(visit_home_country_subq, CoinTransaction.user_id == visit_home_country_subq.c.user_id)
        .where(
            and_(
                CoinTransaction.transaction_type == "debit",
                CoinTransaction.character_id.isnot(None),
                CoinTransaction.created_at.between(start_dt, end_dt)
            )
        )
        .group_by(
            CoinTransaction.character_id,
            Character.name,
            CoinTransaction.country_code,
            ip_home_country_subq.c.ip_home_country,
            visit_home_country_subq.c.visit_home_country
        )
        .order_by(CoinTransaction.character_id, func.sum(CoinTransaction.coins).desc())
    )
    
    result = await db.execute(character_country_query)
    character_data = result.fetchall()
    
    # ========================================================================
    # Step 3: Organize data by character and calculate totals
    # ========================================================================
    character_map: Dict[str, Dict[str, Any]] = {}
    
    for row in character_data:
        character_id = row.character_id
        country_code = row.country_code
        coins_spent = row.coins_spent or 0
        
        # Skip if no valid country
        if not country_code or country_code == "Unknown":
            continue
        
        # Initialize character if not exists
        if character_id not in character_map:
            character_map[character_id] = {
                "character_name": row.character_name or "Unknown",
                "total_coins_spent": 0,
                "by_country": []
            }
        
        # Add country data
        character_map[character_id]["by_country"].append({
            "country_code": country_code,
            "coins_spent": coins_spent
        })
        
        # Update total
        character_map[character_id]["total_coins_spent"] += coins_spent
    
    # ========================================================================
    # Step 4: Sort characters by total coins spent and limit
    # ========================================================================
    sorted_characters = sorted(
        character_map.items(),
        key=lambda x: x[1]["total_coins_spent"],
        reverse=True
    )[:limit]
    
    # ========================================================================
    # Step 5: Build response
    # ========================================================================
    results = []
    for character_id, data in sorted_characters:
        # Sort countries by spend within this character
        sorted_countries = sorted(
            data["by_country"],
            key=lambda x: x["coins_spent"],
            reverse=True
        )
        
        results.append(
            CharacterEngagementGeoItem(
                character_id=character_id,
                character_name=data["character_name"],
                total_coins_spent=data["total_coins_spent"],
                by_country=[
                    CharacterCountrySpend(**country_data)
                    for country_data in sorted_countries
                ]
            )
        )
    
    return CharacterEngagementGeoResponse(
        metric=metric,
        results=results
    )