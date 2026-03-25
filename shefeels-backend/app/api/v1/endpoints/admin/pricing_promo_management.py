from typing import List, Any, Optional
from datetime import datetime, timedelta
import logging

from sqlalchemy.exc import IntegrityError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, func

from app.api.v1.deps import get_db, require_admin
from app.models.subscription import (
    PricingPlan,
    PromoManagement,
    Order,
    CoinTransaction,
    Subscription,
)
from app.models.user import User
from app.schemas.subscription import (
    PricingPlanCreate,
    PricingPlanUpdate,
    PricingPlanRead,
    PromoManagementCreate,
    PromoManagementUpdate,
    PromoManagementRead,
    OrderRead,
    CoinTransactionRead,
    SubscriptionRead,
)

router = APIRouter()


# =========================
# PRICING PLANS
# =========================

@router.post(
    "/create-pricing",
    dependencies=[Depends(require_admin)],
    response_model=PricingPlanRead,
)
async def create_pricing(
    pricing_data: PricingPlanCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new pricing plan."""
    payload = pricing_data.model_dump()

    # Normalize values
    if payload.get("currency"):
        payload["currency"] = str(payload["currency"]).upper()
    if payload.get("coupon"):
        payload["coupon"] = str(payload["coupon"]).upper()
    if payload.get("discount") is not None:
        try:
            d = float(payload["discount"])
            payload["discount"] = max(0.0, min(100.0, d))
        except Exception:
            payload["discount"] = 0.0
    if payload.get("price") is not None:
        try:
            p = float(payload["price"])
            payload["price"] = max(0.0, p)
        except Exception:
            payload["price"] = 0.0
    if payload.get("coin_reward") is not None:
        try:
            payload["coin_reward"] = int(payload["coin_reward"])
            if payload["coin_reward"] < 0:
                payload["coin_reward"] = 0
        except Exception:
            payload["coin_reward"] = 0

    new_plan = PricingPlan(**payload)
    db.add(new_plan)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logging.exception("Failed to create pricing plan: %s", e)
        raise HTTPException(status_code=409, detail="Pricing ID or unique field conflict")
    await db.refresh(new_plan)
    return new_plan


@router.put(
    "/edit-pricing/{pricing_id}",
    dependencies=[Depends(require_admin)],
    response_model=PricingPlanRead,
)
async def edit_pricing(
    pricing_id: str,
    pricing_data: PricingPlanUpdate,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Edit a pricing plan by external pricing_id or internal id."""
    result = await db.execute(
        select(PricingPlan).where(
            or_(
                PricingPlan.pricing_id == pricing_id,
                PricingPlan.id == pricing_id,
            )
        )
    )
    pricing_plan = result.scalar_one_or_none()

    if not pricing_plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")

    update_data = pricing_data.model_dump(exclude_unset=True)

    # Normalize and validate incoming update fields
    if "currency" in update_data and update_data.get("currency"):
        update_data["currency"] = str(update_data["currency"]).upper()
    if "coupon" in update_data and update_data.get("coupon"):
        update_data["coupon"] = str(update_data["coupon"]).upper()
    if "discount" in update_data:
        try:
            d = float(update_data.get("discount") or 0)
            update_data["discount"] = max(0.0, min(100.0, d))
        except Exception:
            update_data["discount"] = 0.0
    if "price" in update_data:
        try:
            p = float(update_data.get("price") or 0)
            update_data["price"] = max(0.0, p)
        except Exception:
            update_data["price"] = 0.0
    if "coin_reward" in update_data:
        try:
            cr = int(update_data.get("coin_reward") or 0)
            update_data["coin_reward"] = max(0, cr)
        except Exception:
            update_data["coin_reward"] = 0

    for field, value in update_data.items():
        setattr(pricing_plan, field, value)

    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logging.exception("Failed to update pricing plan %s: %s", pricing_id, e)
        raise HTTPException(status_code=409, detail="Pricing ID or unique field conflict")

    await db.refresh(pricing_plan)
    return pricing_plan


@router.delete(
    "/delete-pricing/{pricing_id}",
    dependencies=[Depends(require_admin)],
)
async def delete_pricing(
    pricing_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Delete a pricing plan by external pricing_id or internal id."""
    result = await db.execute(
        select(PricingPlan).where(
            or_(
                PricingPlan.pricing_id == pricing_id,
                PricingPlan.id == pricing_id,
            )
        )
    )
    pricing_plan = result.scalar_one_or_none()

    if not pricing_plan:
        raise HTTPException(status_code=404, detail="Pricing plan not found")

    await db.delete(pricing_plan)
    try:
        await db.commit()
    except IntegrityError as e:
        await db.rollback()
        logging.exception("Failed to delete pricing plan %s: %s", pricing_id, e)
        raise HTTPException(
            status_code=409,
            detail="Cannot delete plan – it may be referenced by existing orders or subscriptions",
        )

    return {"detail": f"Pricing plan {pricing_id} deleted successfully."}


# =========================
# PROMOTIONS
# =========================

@router.post(
    "/create-promo",
    dependencies=[Depends(require_admin)],
    response_model=PromoManagementRead,
)
async def create_promo(
    promo_data: PromoManagementCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create a new promotion."""
    payload = promo_data.model_dump()

    if payload.get("coupon"):
        payload["coupon"] = str(payload["coupon"]).upper()

    if not payload.get("discount_type"):
        payload["discount_type"] = "promo"

    if payload.get("currency"):
        payload["currency"] = str(payload["currency"]).upper()

    new_promo = PromoManagement(**payload)
    db.add(new_promo)
    await db.commit()
    await db.refresh(new_promo)
    return new_promo


@router.put(
    "/edit-promo/{promo_id}",
    dependencies=[Depends(require_admin)],
)
async def edit_promo(
    promo_id: int,
    promo_data: PromoManagementUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit an existing promotion."""
    result = await db.execute(
        select(PromoManagement).where(PromoManagement.promo_id == promo_id)
    )
    promo = result.scalar_one_or_none()

    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")

    update_data = promo_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(promo, field, value)

    await db.commit()
    await db.refresh(promo)
    return {"detail": f"Promotion {promo_id} updated successfully."}


# =========================
# ORDERS
# =========================

@router.get(
    "/all-orders",
    dependencies=[Depends(require_admin)],
)
async def get_all_orders(
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Return paginated orders (most recent first) with user email.

    Supports optional `search` (matches user email or order id) and `status` filters.
    """
    # Build base query and filters
    stmt = select(Order)
    count_stmt = select(func.count(Order.id))

    filters = []
    if status:
        filters.append(Order.status == status)
    if search:
        like_q = f"%{search}%"
        # Join with User to search by email as well
        stmt = stmt.outerjoin(User, User.id == Order.user_id)
        count_stmt = count_stmt.outerjoin(User, User.id == Order.user_id)
        filters.append(or_(
            Order.id.ilike(like_q),
            Order.provider_order_ref.ilike(like_q),
            User.email.ilike(like_q)
        ))

    if filters:
        stmt = stmt.where(*filters)
        count_stmt = count_stmt.where(*filters)

    # Order newest first
    stmt = stmt.order_by(Order.created_at.desc())

    # Pagination
    try:
        p = max(1, int(page))
    except Exception:
        p = 1
    try:
        pp = max(1, min(100, int(per_page)))
    except Exception:
        pp = 20

    total_res = await db.execute(count_stmt)
    total = int(total_res.scalar() or 0)

    stmt = stmt.offset((p - 1) * pp).limit(pp)
    result = await db.execute(stmt)
    orders = result.scalars().all()

    # Attach user emails
    user_ids = {str(o.user_id) for o in orders if o.user_id}
    users_map = {}
    if user_ids:
        users = await db.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        )
        users_map = {str(uid): email for uid, email in users.fetchall()}

    for o in orders:
        o.user_email = users_map.get(str(o.user_id))

    return {
        "items": orders,
        "total": total,
        "page": p,
        "per_page": pp,
    }


# =========================
# COIN TRANSACTIONS
# =========================

@router.get(
    "/all-coin-transactions",
    dependencies=[Depends(require_admin)],
)
async def get_all_coin_transactions(
    page: int = 1,
    per_page: int = 20,
    search: Optional[str] = None,
    transaction_type: Optional[str] = None,
    source_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    user_email: Optional[str] = None,
    country: Optional[str] = None,
    city: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Return paginated coin transactions with user email.

    Response shape: { items: [...], total: N, page: page, per_page: per_page }
    """
    # Build filtering conditions
    conditions = []

    # parse date filters
    start_dt = None
    end_dt = None
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except Exception:
            try:
                start_dt = datetime.fromisoformat(start_date + 'T00:00:00')
            except Exception:
                start_dt = None
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except Exception:
            try:
                end_dt = datetime.fromisoformat(end_date + 'T23:59:59')
            except Exception:
                end_dt = None
    if start_dt:
        conditions.append(CoinTransaction.created_at >= start_dt)
    if end_dt:
        # ensure end of day
        if end_dt.hour == 0 and end_dt.minute == 0 and end_dt.second == 0:
            end_dt = end_dt + timedelta(hours=23, minutes=59, seconds=59)
        conditions.append(CoinTransaction.created_at <= end_dt)

    if transaction_type:
        conditions.append(CoinTransaction.transaction_type == transaction_type)
    if source_type:
        conditions.append(CoinTransaction.source_type == source_type)
    if country:
        # CoinTransaction stores country as `country_code`
        conditions.append(func.lower(CoinTransaction.country_code) == country.lower())
    if city:
        conditions.append(func.lower(CoinTransaction.city) == city.lower())

    # For search and user_email, we need to join User
    join_user = False
    if search or user_email:
        join_user = True
    # search may match transaction id or user email
    if search:
        q = f"%{search}%"
        conditions.append(or_(CoinTransaction.id.ilike(q), User.email.ilike(q)))
    if user_email:
        conditions.append(func.lower(User.email).ilike(f"%{user_email.lower()}%"))

    # Count total matching rows
    count_stmt = select(func.count()).select_from(CoinTransaction)
    if join_user:
        count_stmt = count_stmt.outerjoin(User, User.id == CoinTransaction.user_id)
    if conditions:
        count_stmt = count_stmt.where(*conditions)
    count_res = await db.execute(count_stmt)
    total = int(count_res.scalar() or 0)

    # fetch page with filters
    offset = max(0, (page - 1)) * per_page
    stmt = select(CoinTransaction).select_from(CoinTransaction)
    if join_user:
        stmt = stmt.outerjoin(User, User.id == CoinTransaction.user_id)
    if conditions:
        stmt = stmt.where(*conditions)
    stmt = stmt.order_by(CoinTransaction.created_at.desc()).offset(offset).limit(per_page)
    result = await db.execute(stmt)
    transactions = result.scalars().all()

    user_ids = {str(t.user_id) for t in transactions if t.user_id}
    users_map = {}

    if user_ids:
        users = await db.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        )
        users_map = {str(uid): email for uid, email in users.fetchall()}

    # Convert to Pydantic schemas for serialization
    items = []
    for t in transactions:
        t.user_email = users_map.get(str(t.user_id))
        items.append(CoinTransactionRead.model_validate(t))

    return {"items": items, "total": total, "page": page, "per_page": per_page}


# =========================
# SUBSCRIPTIONS
# =========================

@router.get(
    "/all-subscriptions",
    dependencies=[Depends(require_admin)],
    response_model=List[SubscriptionRead],
)
async def get_all_subscriptions(
    db: AsyncSession = Depends(get_db),
) -> List[SubscriptionRead]:
    """Return all subscriptions with user email."""
    result = await db.execute(select(Subscription))
    subscriptions = result.scalars().all()

    user_ids = {str(s.user_id) for s in subscriptions if s.user_id}
    users_map = {}

    if user_ids:
        users = await db.execute(
            select(User.id, User.email).where(User.id.in_(user_ids))
        )
        users_map = {str(uid): email for uid, email in users.fetchall()}

    for s in subscriptions:
        s.user_email = users_map.get(str(s.user_id))

    return subscriptions
