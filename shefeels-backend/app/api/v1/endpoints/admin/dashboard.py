from typing import Optional, List, Dict, Any
from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func, select, cast, Date, text, case, literal,and_, or_

from app.api.v1.deps import get_db, require_admin
from app.models.subscription import (
    CoinTransaction, Subscription, Order, PromoManagement, PricingPlan
)
from app.models.user import User, UserProfile
from app.models.character import Character

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


@router.get("/coins/purchases-summary", dependencies=[Depends(require_admin)])
async def coins_purchases_summary(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[str] = Query(None),  # daily, weekly, monthly
    db: AsyncSession = Depends(get_db),
):
    """Aggregated coin purchase data."""
    # overall totals from coin_purchases table
    # keep the raw strings for returning in the response, but parse into
    # datetime objects so asyncpg receives proper timestamp/date params
    start_date_raw, end_date_raw = _date_range_defaults(start_date, end_date)

    def _parse_dt(s: Optional[str]):
        if not s:
            return None
        try:
            # accept YYYY-MM-DD or full ISO (with optional Z)
            return datetime.fromisoformat(s.replace("Z", "+00:00"))
        except Exception:
            try:
                return datetime.strptime(s, "%Y-%m-%d")
            except Exception:
                return None

    start_dt = _parse_dt(start_date_raw)
    end_dt = _parse_dt(end_date_raw)

    # total purchase transactions = successful orders (payments)
    purchases_q = select(func.count(Order.id).label("total_purchase_transactions")).where(Order.status == 'success')
    if start_dt:
        purchases_q = purchases_q.where(Order.applied_at >= start_dt)
    if end_dt:
        purchases_q = purchases_q.where(Order.applied_at <= end_dt)
    print('purchases_q:', purchases_q)
    # total coins purchased = credits recorded in CoinTransaction with source_type 'coin_purchase'
    coins_q = select(func.coalesce(func.sum(CoinTransaction.coins), 0).label('total_coins_purchased')).where(CoinTransaction.transaction_type == 'credit', CoinTransaction.source_type == 'coin_purchase')
    if start_dt:
        coins_q = coins_q.where(CoinTransaction.created_at >= start_dt)
    if end_dt:
        coins_q = coins_q.where(CoinTransaction.created_at <= end_dt)

    purchases_res = await db.execute(purchases_q)
    coins_res = await db.execute(coins_q)
    total_purchases = int(purchases_res.scalar() or 0)
    total_coins = int(coins_res.scalar() or 0)

    response = {
        "start_date": start_date_raw,
        "end_date": end_date_raw,
        "total_purchase_transactions": total_purchases,
        "total_coins_purchased": total_coins,
    }

    if interval:
        # bucket coin credits by period using CoinTransaction.created_at
        if interval == "daily":
            label = func.to_char(CoinTransaction.created_at, 'YYYY-MM-DD')
        elif interval == "monthly":
            label = func.to_char(CoinTransaction.created_at, 'YYYY-MM')
        else:
            label = func.to_char(CoinTransaction.created_at, 'IYYY-"W"IW')

        breakdown_q = select(label.label("date"), func.coalesce(func.sum(CoinTransaction.coins), 0).label("coins_purchased")).where(CoinTransaction.transaction_type == 'credit', CoinTransaction.source_type == 'coin_purchase')
        if start_dt:
            breakdown_q = breakdown_q.where(CoinTransaction.created_at >= start_dt)
        if end_dt:
            breakdown_q = breakdown_q.where(CoinTransaction.created_at <= end_dt)
        breakdown_q = breakdown_q.group_by(label).order_by(label)

        rows = await db.execute(breakdown_q)
        breakdown = [{"date": r[0], "coins_purchased": int(r[1] or 0)} for r in rows]
        response["breakdown"] = breakdown

    return response

@router.get("/coins/usage-by-feature", dependencies=[Depends(require_admin)])
async def coins_usage_by_feature(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    feature: Optional[str] = Query(None),
    flow: Optional[str] = Query("spent"),  # 'spent' | 'credited' | 'both'
    db: AsyncSession = Depends(get_db),
):
    """
    Coins by feature, separated by flow (spent=debit, credited=credit).
    Default: spent (usage).
    """
    ct = CoinTransaction

    # parse dates (you already have _parse_datetime in your snippet)
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    def base_where(q):
        if start_dt:
            q = q.where(ct.created_at >= start_dt)
        if end_dt:
            q = q.where(ct.created_at <= end_dt)
        if feature:
            q = q.where(ct.source_type == feature)
        return q

    # totals
    total_spent_q = base_where(select(func.coalesce(func.sum(ct.coins), 0))).where(ct.transaction_type == 'debit')
    total_credited_q = base_where(select(func.coalesce(func.sum(ct.coins), 0))).where(ct.transaction_type == 'credit')

    total_spent = int((await db.execute(total_spent_q)).scalar() or 0)
    total_credited = int((await db.execute(total_credited_q)).scalar() or 0)

    # by feature helpers
    async def by_feature(direction: str):
        dir_filter = ct.transaction_type == ('debit' if direction == 'spent' else 'credit')
        q = base_where(
            select(
                ct.source_type.label('feature'),
                func.coalesce(func.sum(ct.coins), 0).label('coins'),
                func.count(ct.id).label('transactions'),
            ).where(dir_filter)
        ).group_by(ct.source_type).order_by(func.sum(ct.coins).desc())
        rows = await db.execute(q)
        if direction == 'spent':
            denom = total_spent or 1
        else:
            denom = total_credited or 1
        out = []
        for feat, coins, tx in rows:
            c = int(coins or 0)
            pct = round(c / denom * 100, 2) if denom else 0.0
            out.append({"feature": feat, "coins": c, "transactions": int(tx), "share_pct": pct})
        return out

    if flow == 'both':
        by_spent = await by_feature('spent')
        by_credited = await by_feature('credited')

        # merge on feature to compute net (credited - spent)
        index = {}
        for row in by_spent:
            index[row["feature"]] = {"feature": row["feature"], "spent": row["coins"], "credited": 0}
        for row in by_credited:
            d = index.setdefault(row["feature"], {"feature": row["feature"], "spent": 0, "credited": 0})
            d["credited"] = row["coins"]

        combined = []
        for feat, vals in index.items():
            net = vals["credited"] - vals["spent"]
            # optional: separate shares for spent vs credited; net has no meaningful share
            combined.append({
                "feature": feat,
                "spent": vals["spent"],
                "credited": vals["credited"],
                "net": net,
            })

        return {
            "start_date": start_date, "end_date": end_date, "flow": "both",
            "totals": {"spent": total_spent, "credited": total_credited, "net": total_credited - total_spent},
            "by_feature": combined,
        }

    # single flow (default: spent)
    direction = 'debit' if flow == 'spent' else 'credit'
    items = await by_feature('spent' if flow == 'spent' else 'credited')
    total = total_spent if flow == 'spent' else total_credited

    return {
        "start_date": start_date,
        "end_date": end_date,
        "flow": flow,
        "total_coins": total,
        "by_feature": items,  # [{feature, coins, transactions, share_pct}]
    }


@router.get("/subscriptions/plan-summary", dependencies=[Depends(require_admin)])
async def subscriptions_plan_summary(
    as_of_date: Optional[str] = Query(None),
    include_inactive: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Subscription counts and simple retention/churn snapshot by plan."""
    # parse as_of_date into a datetime for window calculations
    as_of_dt = _parse_datetime(as_of_date)
    
    q = select(Subscription.plan_name, func.count(Subscription.id).label("active_subscribers"))
    if not include_inactive:
        q = q.where(Subscription.status == 'active')
    if as_of_dt:
        # naive filter: subscriptions created before or equal to as_of_date
        q = q.where(Subscription.start_date <= as_of_dt)

    q = q.group_by(Subscription.plan_name)
    rows = await db.execute(q)
    plans = []
    total_active = 0
    window_end = as_of_dt or datetime.utcnow()
    window_start = window_end - timedelta(days=30)

    for plan_name, active_count in rows:
        active_i = int(active_count or 0)

        # monthly price: prefer PricingPlan.price by plan_name
        monthly_price = None
        if plan_name is not None:
            price_row = await db.execute(select(PricingPlan.price).where(PricingPlan.plan_name == plan_name).limit(1))
            price_val = price_row.scalar()
            if price_val is not None:
                try:
                    monthly_price = float(price_val)
                except Exception:
                    monthly_price = None

        # churn in the last 30 days ending at window_end
        churn_q = select(func.count(Subscription.id)).where(
            Subscription.plan_name == plan_name,
            Subscription.status == 'canceled',
            Subscription.current_period_end != None,
            Subscription.current_period_end >= window_start,
            Subscription.current_period_end <= window_end,
        )
        churn_count = int((await db.execute(churn_q)).scalar() or 0)

        denom = active_i + churn_count
        churn_rate = round((churn_count / denom * 100), 2) if denom > 0 else 0.0
        retention_rate = round((100.0 - churn_rate), 2) if denom > 0 else 0.0

        # average subscription duration in months for this plan (use start_date -> current_period_end or window_end)
        avg_epoch_q = select(func.avg(func.extract('epoch', func.coalesce(Subscription.current_period_end, window_end) - Subscription.start_date))).where(
            Subscription.plan_name == plan_name,
            Subscription.start_date != None,
        )
        avg_seconds = (await db.execute(avg_epoch_q)).scalar()
        if avg_seconds:
            avg_months = round(float(avg_seconds) / (3600.0 * 24.0 * 30.436875), 2)
        else:
            avg_months = 0.0

        plans.append({
            "plan_name": plan_name,
            "monthly_price": round(monthly_price, 2) if monthly_price is not None else None,
            "active_subscribers": active_i,
            "retention_rate": retention_rate,
            "churn_rate": churn_rate,
            "avg_subscription_duration": avg_months,
        })
        total_active += active_i

    highest_retention_plan = None
    if plans:
        highest_retention_plan = plans[0]["plan_name"]

    return {"as_of_date": as_of_date, "total_active_subscribers": total_active, "plans": plans, "highest_retention_plan": highest_retention_plan}


@router.get("/subscriptions/history", dependencies=[Depends(require_admin)])
async def subscriptions_history(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    metric: Optional[str] = Query("active_count"),  # active_count, new_subscriptions, cancellations
    interval: Optional[str] = Query("monthly"),     # monthly | quarterly
    db: AsyncSession = Depends(get_db),
):
    """
    Historical subscription metrics over time.

    - metric=active_count        : number of active subscriptions at the END of each period
    - metric=new_subscriptions   : count of subscriptions that STARTED within each period
    - metric=cancellations       : count of subscriptions that ENDED within each period (status='canceled')
    - interval                   : 'monthly' (default) or 'quarterly'
    - start_date / end_date      : ISO date strings; defaults to last 12 months aligned to interval start
    """

    # ---- validate inputs ----
    metric = (metric or "active_count").lower()
    if metric not in {"active_count", "new_subscriptions", "cancellations"}:
        metric = "active_count"

    interval = (interval or "monthly").lower()
    if interval not in {"daily", "weekly", "monthly", "quarterly", "yearly"}:
        interval = "monthly"

    # ---- parse & default dates ----
    def _to_date(s: Optional[str]) -> Optional[date]:
        if not s:
            return None
        try:
            # Accept 'YYYY-MM-DD' or full ISO; ignore time part
            return datetime.fromisoformat(s.replace("Z", "+00:00")).date()
        except Exception:
            return None

    start_dt = _to_date(start_date)
    end_dt = _to_date(end_date) or date.today()

    if not start_dt:
        # default: last 12 months from end_dt (inclusive)
        start_dt = end_dt - timedelta(days=365)

    # ---- align to period boundaries ----
    def _month_start(d: date) -> date:
        return d.replace(day=1)

    def _quarter_start(d: date) -> date:
        q_month = ((d.month - 1) // 3) * 3 + 1
        return date(d.year, q_month, 1)

    # support daily, weekly, monthly, quarterly
    if interval == "daily":
        # align to day boundaries
        start_dt = start_dt
        end_dt = end_dt
        step_sql = "interval '1 day'"
        label_sql = "to_char(p.period_start, 'YYYY-MM-DD')"
        trunc_unit = "day"
        period_add_sql = "interval '1 day'"
    elif interval == "weekly":
        # align to ISO week (period_start should be a date that represents week start)
        # use generate_series stepping by 1 week and label with ISO week
        # for alignment we keep start_dt as-is; label formatting uses ISO week
        start_dt = start_dt
        end_dt = end_dt
        step_sql = "interval '1 week'"
        label_sql = "to_char(p.period_start, 'IYYY-\"W\"IW')"
        trunc_unit = "week"
        period_add_sql = "interval '1 week'"
    elif interval == "monthly":
        start_dt = _month_start(start_dt)
        end_dt = _month_start(end_dt)
        step_sql = "interval '1 month'"
        label_sql = "to_char(p.period_start, 'YYYY-MM')"
        trunc_unit = "month"
        period_add_sql = "interval '1 month'"
    elif interval == "yearly":
        # align to year boundaries
        start_dt = date(start_dt.year, 1, 1)
        end_dt = date(end_dt.year, 1, 1)
        step_sql = "interval '1 year'"
        label_sql = "to_char(p.period_start, 'YYYY')"
        trunc_unit = "year"
        period_add_sql = "interval '1 year'"
    else:  # quarterly
        start_dt = _quarter_start(start_dt)
        end_dt = _quarter_start(end_dt)
        step_sql = "interval '3 month'"
        label_sql = "to_char(p.period_start, 'YYYY-\"Q\"Q')"
        trunc_unit = "quarter"
        period_add_sql = "interval '3 month'"

    # ---- SQL templates (Postgres) ----
    # We build a periods CTE with period_start and next_period_start (boundary moment).
    # Then left join to subscriptions with the metric-specific predicate.
    base_cte = f"""
            WITH periods AS (
                SELECT gs::date AS period_start,
                             (date_trunc('{trunc_unit}', gs)::date
                                + {period_add_sql}) AS next_period_start
                FROM generate_series(cast(:start_date as date), cast(:end_date as date), {step_sql}) AS gs
            )
    """

    if metric == "active_count":
        # Active at end of period = active at next_period_start instant
        sql = text(
            base_cte
            + f"""
            SELECT {label_sql} AS period,
                   COUNT(s.*) AS value
            FROM periods p
            LEFT JOIN subscriptions s
              ON s.start_date < p.next_period_start
             AND (s.current_period_end IS NULL OR s.current_period_end >= p.next_period_start)
            GROUP BY period
            ORDER BY period
            """
        )

    elif metric == "new_subscriptions":
        # Started within the period
        sql = text(
            base_cte
            + f"""
            SELECT {label_sql} AS period,
                   COUNT(s.*) AS value
            FROM periods p
            LEFT JOIN subscriptions s
              ON date_trunc('{trunc_unit}', s.start_date) = p.period_start
            GROUP BY period
            ORDER BY period
            """
        )

    else:  # cancellations
        # Ended within the period (status='canceled' and ended in that bucket)
        # If you have a dedicated `canceled_at`, prefer that column. We use current_period_end here.
        sql = text(
            base_cte
            + f"""
            SELECT {label_sql} AS period,
                   COUNT(s.*) AS value
            FROM periods p
            LEFT JOIN subscriptions s
              ON s.status = 'canceled'
             AND s.current_period_end IS NOT NULL
             AND date_trunc('{trunc_unit}', s.current_period_end) = p.period_start
            GROUP BY period
            ORDER BY period
            """
        )

    params = {"start_date": start_dt, "end_date": end_dt}
    rows = await db.execute(sql, params)
    history = [{"period": r[0], "value": int(r[1] or 0)} for r in rows]

    return {"metric": metric, "interval": interval, "history": history}

@router.get("/users/lifetime-value", dependencies=[Depends(require_admin)])
async def users_lifetime_value(
    user_id: Optional[str] = Query(None),
    user_query: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    detailed: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """
    LTV for a user (or aggregate if user_id omitted).
    For a specific user:
      - total_revenue = sum of all orders.subtotal_at_apply (filtered by date range if provided)
      - total_coins_acquired (credits) / total_coins_spent (debits) (filtered by date range if provided)
      - lifetime_duration_months from first activity to last activity
    If detailed=true, include revenue_breakdown, coins_over_time (monthly credits vs debits), activity snapshot.
    
    For aggregate (no user_id): returns average LTV across all users.
    """
    ct = CoinTransaction
    
    # Parse date range for filtering
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    if end_dt and end_date and len(end_date) == 10:
        end_dt = end_dt + timedelta(days=1) - timedelta(microseconds=1)

    # If a user identifier was provided, accept either:
    # - internal user id (string UUID)
    # - email address
    # - username (stored in user_profiles.username)
    # Support either `user_id` (legacy) or `user_query` (name/email/username) from the frontend.
    if user_query or user_id:
        uid_raw = str(user_query or user_id).strip()
        # attempt direct id match first
        user_row = await db.execute(select(User).where(User.id == uid_raw))
        user_obj = user_row.scalars().first()
        if not user_obj:
            # try email match
            user_row = await db.execute(select(User).where(User.email == uid_raw))
            user_obj = user_row.scalars().first()
        if not user_obj:
            # try profile username or full_name
            try:
                profile_q = select(User).join(UserProfile, User.profile).where(
                    (UserProfile.username == uid_raw) | (UserProfile.full_name == uid_raw)
                )
                user_row = await db.execute(profile_q)
                user_obj = user_row.scalars().first()
            except Exception:
                user_obj = None

        if not user_obj:
            raise HTTPException(status_code=404, detail="user not found")

        # Use the resolved user id for subsequent queries
        resolved_user_id = user_obj.id
        resolved_user_email = user_obj.email
        resolved_user_name = getattr(user_obj, 'full_name', None) or getattr(user_obj, 'username', None)

        # ---- Revenue (only successful orders) ----
        rev_q = select(func.coalesce(func.sum(Order.subtotal_at_apply), 0.0)).where(
            Order.user_id == resolved_user_id,
            Order.status == 'success'
        )
        if start_dt:
            rev_q = rev_q.where(Order.applied_at >= start_dt)
        if end_dt:
            rev_q = rev_q.where(Order.applied_at <= end_dt)
        total_revenue = float((await db.execute(rev_q)).scalar() or 0.0)
        total_revenue = _normalize_amount(total_revenue)

        # ---- Coins ledger ----
        acquired_q = select(func.coalesce(func.sum(ct.coins), 0)).where(
            and_(ct.user_id == resolved_user_id, ct.transaction_type == 'credit')
        )
        if start_dt:
            acquired_q = acquired_q.where(ct.created_at >= start_dt)
        if end_dt:
            acquired_q = acquired_q.where(ct.created_at <= end_dt)
            
        spent_q = select(func.coalesce(func.sum(ct.coins), 0)).where(
            and_(ct.user_id == resolved_user_id, ct.transaction_type == 'debit')
        )
        if start_dt:
            spent_q = spent_q.where(ct.created_at >= start_dt)
        if end_dt:
            spent_q = spent_q.where(ct.created_at <= end_dt)
            
        total_coins_acquired = int((await db.execute(acquired_q)).scalar() or 0)
        total_coins_spent = int((await db.execute(spent_q)).scalar() or 0)

        # ---- Lifetime duration (months) ----
        # consider only successful orders when computing first/last order timestamps
        first_order_q = select(func.min(Order.applied_at)).where(
            Order.user_id == resolved_user_id,
            Order.status == 'success'
        )
        last_order_q = select(func.max(Order.applied_at)).where(
            Order.user_id == resolved_user_id,
            Order.status == 'success'
        )
        first_ct_q = select(func.min(ct.created_at)).where(ct.user_id == resolved_user_id)
        last_ct_q = select(func.max(ct.created_at)).where(ct.user_id == resolved_user_id)
        user_created_q = select(User.created_at).where(User.id == resolved_user_id)

        first_order_at = (await db.execute(first_order_q)).scalar()
        last_order_at = (await db.execute(last_order_q)).scalar()
        first_ct_at = (await db.execute(first_ct_q)).scalar()
        last_ct_at = (await db.execute(last_ct_q)).scalar()
        user_created = (await db.execute(user_created_q)).scalar()

        candidates_first = [d for d in [user_created, first_order_at, first_ct_at] if d]
        candidates_last = [d for d in [user_created, last_order_at, last_ct_at] if d]
        lifetime_months = None
        if candidates_first and candidates_last:
            first = min(candidates_first)
            last = max(candidates_last)
            lifetime_months = (last.year - first.year) * 12 + (last.month - first.month)
            try:
                lifetime_months += 1 if last.day >= first.day else 0
            except Exception:
                pass

        resp = {
            "user_id": resolved_user_id,
            "user_name": resolved_user_name,
            "user_email": resolved_user_email,
            "total_revenue": round(total_revenue, 2),
            "total_coins_acquired": total_coins_acquired,
            "total_coins_spent": total_coins_spent,
            "lifetime_duration_months": lifetime_months,
        }

        if detailed:
            # Monthly coin credits/debits (apply date filters if provided)
            coins_params: Dict[str, Any] = {"uid": resolved_user_id}
            coins_sql = """
                SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS period,
                       COALESCE(SUM(CASE WHEN transaction_type = 'credit' THEN coins ELSE 0 END), 0) AS credits,
                       COALESCE(SUM(CASE WHEN transaction_type = 'debit'  THEN coins ELSE 0 END), 0) AS debits
                FROM coin_transactions
                WHERE user_id = :uid
            """
            if start_dt:
                coins_sql += "\n AND created_at >= :start_dt"
                coins_params["start_dt"] = start_dt
            if end_dt:
                coins_sql += "\n AND created_at <= :end_dt"
                coins_params["end_dt"] = end_dt
            coins_sql += "\n GROUP BY period ORDER BY period"
            rows = await db.execute(text(coins_sql), coins_params)
            coins_over_time = [{"period": r[0], "credits": int(r[1] or 0), "debits": int(r[2] or 0)} for r in rows]

            # Orders breakdown (just total count now)
            # Orders breakdown: apply date filters if provided
            orders_params: Dict[str, Any] = {"uid": resolved_user_id}
            orders_sql = """
                SELECT COUNT(*) AS orders_count,
                       MIN(applied_at) AS first_order_at,
                       MAX(applied_at) AS last_order_at
                FROM orders
                WHERE user_id = :uid AND status = 'success'
            """
            if start_dt:
                orders_sql += "\n AND applied_at >= :start_dt"
                orders_params["start_dt"] = start_dt
            if end_dt:
                orders_sql += "\n AND applied_at <= :end_dt"
                orders_params["end_dt"] = end_dt
            oc = (await db.execute(text(orders_sql), orders_params)).first()
            revenue_breakdown = {
                "orders_count": int(oc[0] or 0),
                "first_order_at": oc[1].isoformat() if oc[1] else None,
                "last_order_at": oc[2].isoformat() if oc[2] else None,
            }

            # Activity snapshot
            # Activity snapshot: apply same date range to coin transaction counts
            coin_txn_q = select(func.count(ct.id)).where(ct.user_id == resolved_user_id)
            if start_dt:
                coin_txn_q = coin_txn_q.where(ct.created_at >= start_dt)
            if end_dt:
                coin_txn_q = coin_txn_q.where(ct.created_at <= end_dt)
            coin_txn_count = int((await db.execute(coin_txn_q)).scalar() or 0)

            # Determine last active within the overall dataset (use last_order_at/last_ct_at computed earlier which are lifetime values)
            last_active_iso = (max([d for d in [last_order_at, last_ct_at] if d]).isoformat()
                               if [d for d in [last_order_at, last_ct_at] if d] else None)

            activity = {
                "orders_count": revenue_breakdown["orders_count"],
                "coin_transactions_count": coin_txn_count,
                "last_active_at": last_active_iso,
            }

            resp["details"] = {
                "revenue_breakdown": revenue_breakdown,
                "coins_over_time": coins_over_time,
                "activity": activity,
            }

        return resp

    # ---- Aggregate branch (no user_id) ----
    # Aggregate LTV: consider only successful orders for revenue, optionally filtered by date range
    total_rev_q = select(func.coalesce(func.sum(Order.subtotal_at_apply), 0.0)).where(Order.status == 'success')
    if start_dt:
        total_rev_q = total_rev_q.where(Order.applied_at >= start_dt)
    if end_dt:
        total_rev_q = total_rev_q.where(Order.applied_at <= end_dt)
        
    total_users_q = select(func.count(User.id))
    total_rev = float((await db.execute(total_rev_q)).scalar() or 0.0)
    total_rev = _normalize_amount(total_rev)
    total_users = int((await db.execute(total_users_q)).scalar() or 0)
    avg_ltv = round(total_rev / total_users, 2) if total_users > 0 else 0.0

    return {
        "average_ltv": avg_ltv,
        "total_revenue_all_users": round(total_rev, 2),
        "total_users": total_users,
        "start_date": start_date,
        "end_date": end_date,
    }


@router.get("/revenue/trends", dependencies=[Depends(require_admin)])
async def revenue_trends(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[str] = Query('monthly'),
    segment: Optional[str] = Query('all'),  # all, subscription, coins
    db: AsyncSession = Depends(get_db),
):
    """Revenue trends combining orders and coin purchases with subscription revenue.

    Fixes:
    - Parse start_date/end_date strings into datetimes to avoid Postgres comparing
      timestamp columns against varchar parameters.
    - Support daily/monthly interval period formatting.
    """
    # parse ISO date strings into datetimes so SQLAlchemy/asyncpg send proper timestamp/date params
    start_dt = None
    end_dt = None
    try:
        if start_date:
            start_dt = datetime.fromisoformat(start_date)
        if end_date:
            end_dt = datetime.fromisoformat(end_date)
    except Exception:
        # leave as None; DB-side validation/empty results are acceptable
        start_dt = None
        end_dt = None

    # choose period label based on interval (daily, weekly, monthly, quarterly)
    if interval == 'daily':
        period_expr_order = func.to_char(Order.applied_at, 'YYYY-MM-DD').label('period')
        period_expr_sub = func.to_char(Subscription.start_date, 'YYYY-MM-DD').label('period')
    elif interval == 'weekly':
        # ISO week label, e.g. 2025-W01
        period_expr_order = func.to_char(Order.applied_at, 'IYYY-"W"IW').label('period')
        period_expr_sub = func.to_char(Subscription.start_date, 'IYYY-"W"IW').label('period')
    elif interval == 'quarterly':
        # Quarter label, e.g. 2025-Q1
        period_expr_order = func.to_char(Order.applied_at, 'YYYY-"Q"Q').label('period')
        period_expr_sub = func.to_char(Subscription.start_date, 'YYYY-"Q"Q').label('period')
    elif interval == 'yearly':
        # Year label, e.g. 2025
        period_expr_order = func.to_char(Order.applied_at, 'YYYY').label('period')
        period_expr_sub = func.to_char(Subscription.start_date, 'YYYY').label('period')
    else:
        # default to monthly
        period_expr_order = func.to_char(Order.applied_at, 'YYYY-MM').label('period')
        period_expr_sub = func.to_char(Subscription.start_date, 'YYYY-MM').label('period')

    # base query: only coin purchases (use successful orders)
    coin_q = select(period_expr_order, func.coalesce(func.sum(Order.subtotal_at_apply), 0).label('coin_revenue')).where(Order.status == "success")

    if start_dt:
        coin_q = coin_q.where(Order.applied_at >= start_dt)
    if end_dt:
        coin_q = coin_q.where(Order.applied_at <= end_dt)

    coin_q = coin_q.group_by(period_expr_order).order_by(period_expr_order)

    # subscription revenue query: sum up subscription prices by period using PricingPlan join
    sub_q = select(
        period_expr_sub,
        func.coalesce(func.sum(PricingPlan.price), 0).label('subscription_revenue')
    ).select_from(Subscription).join(
        PricingPlan, 
        Subscription.plan_name == PricingPlan.plan_name,
        isouter=True
    ).where(Subscription.status == 'active')

    if start_dt:
        sub_q = sub_q.where(Subscription.start_date >= start_dt)
    if end_dt:
        sub_q = sub_q.where(Subscription.start_date <= end_dt)

    sub_q = sub_q.group_by(period_expr_sub).order_by(period_expr_sub)

    coin_rows = await db.execute(coin_q)
    # normalize potential cent-stored values
    coin_map = {r[0]: _normalize_amount(float(r[1] or 0.0)) for r in coin_rows}

    sub_rows = await db.execute(sub_q)
    sub_map = {r[0]: _normalize_amount(float(r[1] or 0.0)) for r in sub_rows}

    # combine all periods from both queries
    all_periods = sorted(set(coin_map.keys()) | set(sub_map.keys()))
    
    trends = []
    total_coin = 0.0
    total_sub = 0.0
    for p in all_periods:
        c = coin_map.get(p, 0.0)
        s = sub_map.get(p, 0.0)
        t = c + s
        trends.append({
            "period": p, 
            "coin_revenue": round(c, 2),
            "subscription_revenue": round(s, 2),
            "total_revenue": round(t, 2)
        })
        total_coin += c
        total_sub += s

    total = total_coin + total_sub
    avg_monthly = round(total / len(all_periods), 2) if all_periods else 0.0
    
    return {
        "currency": "USD", 
        "interval": interval, 
        "revenue_trends": trends, 
        "total_coin_revenue": round(total_coin, 2),
        "total_subscription_revenue": round(total_sub, 2),
        "total_revenue_all_periods": round(total, 2), 
        "avg_monthly_revenue": avg_monthly
    }


@router.get("/coins/trends", dependencies=[Depends(require_admin)])
async def coins_trends(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[str] = Query('weekly'),
    cohort: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Coins purchased vs spent over time (simple weekly/monthly grouping)."""
    # use coin_transactions table for spent and purchases (transaction_type)
    # support daily | weekly | monthly | quarterly
    interval = (interval or 'weekly').lower()
    if interval == 'daily':
        period_label = func.to_char(CoinTransaction.created_at, 'YYYY-MM-DD')
    elif interval == 'weekly':
        period_label = func.to_char(CoinTransaction.created_at, 'IYYY-"W"IW')
    elif interval == 'quarterly':
        period_label = func.to_char(CoinTransaction.created_at, 'YYYY-"Q"Q')
    elif interval == 'yearly':
        period_label = func.to_char(CoinTransaction.created_at, 'YYYY')
    else:
        # default to monthly
        period_label = func.to_char(CoinTransaction.created_at, 'YYYY-MM')
    q = select(
        period_label.label('period'),
    func.coalesce(func.sum(case((CoinTransaction.transaction_type == 'credit', CoinTransaction.coins), else_=0)), 0).label('coins_purchased'),
    func.coalesce(func.sum(case((CoinTransaction.transaction_type == 'debit', CoinTransaction.coins), else_=0)), 0).label('coins_spent')
    )
    # parse date strings
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    if start_dt:
        q = q.where(CoinTransaction.created_at >= start_dt)
    if end_dt:
        q = q.where(CoinTransaction.created_at <= end_dt)
    if cohort:
        # no cohort mapping supported in schema; ignore
        pass
    q = q.group_by('period').order_by('period')
    rows = await db.execute(q)
    trends = []
    total_purchased = 0
    total_spent = 0
    for p, purchased, spent in rows:
        purchased_i = int(purchased or 0)
        spent_i = int(spent or 0)
        trends.append({"period": p, "coins_purchased": purchased_i, "coins_spent": spent_i})
        total_purchased += purchased_i
        total_spent += spent_i

    net = total_purchased - total_spent
    ratio = round((total_purchased / total_spent), 2) if total_spent > 0 else None

    return {"interval": interval, "coin_trends": trends, "net_coins_change": net, "purchase_to_spend_ratio": ratio}



@router.get("/orders/aggregate", dependencies=[Depends(require_admin)])
async def orders_aggregate(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    interval: Optional[str] = Query('monthly'),
    db: AsyncSession = Depends(get_db),
):
    """Return aggregated order status counts and revenue totals bucketed by period.

    Response shape:
    {
      status_counts: { success: int, failed: int, refunded: int, total: int },
      revenue_by_period: [{ period: str, revenue: float }]
    }
    """
    # parse dates
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    if end_dt and end_date and len(end_date) == 10:
        # include full day
        end_dt = end_dt + timedelta(days=1) - timedelta(microseconds=1)

    # status counts using SQL expressions
    status_q = select(
        func.coalesce(func.sum(case((Order.status == 'success', 1), else_=0)), 0).label('success'),
        func.coalesce(func.sum(case((Order.status.in_(['failed','fail','declined','declined']), 1), else_=0)), 0).label('failed'),
        func.coalesce(func.sum(case((Order.status.in_(['refunded','refund']), 1), else_=0)), 0).label('refunded'),
        func.count(Order.id).label('total'),
    )
    if start_dt:
        status_q = status_q.where(Order.applied_at >= start_dt)
    if end_dt:
        status_q = status_q.where(Order.applied_at <= end_dt)

    status_res = await db.execute(status_q)
    s_row = status_res.first() or (0, 0, 0, 0)
    success_cnt = int(s_row[0] or 0)
    failed_cnt = int(s_row[1] or 0)
    refunded_cnt = int(s_row[2] or 0)
    total_cnt = int(s_row[3] or 0)

    # revenue by period (successful orders only)
    iv = (interval or 'monthly').lower()
    if iv == 'daily':
        period_label = func.to_char(Order.applied_at, 'YYYY-MM-DD')
    elif iv == 'weekly':
        period_label = func.to_char(Order.applied_at, 'IYYY-"W"IW')
    elif iv == 'quarterly':
        period_label = func.to_char(Order.applied_at, 'YYYY-"Q"Q')
    elif iv == 'yearly':
        period_label = func.to_char(Order.applied_at, 'YYYY')
    else:
        period_label = func.to_char(Order.applied_at, 'YYYY-MM')

    rev_q = select(period_label.label('period'), func.coalesce(func.sum(Order.subtotal_at_apply), 0).label('revenue')).where(Order.status == 'success')
    if start_dt:
        rev_q = rev_q.where(Order.applied_at >= start_dt)
    if end_dt:
        rev_q = rev_q.where(Order.applied_at <= end_dt)
    rev_q = rev_q.group_by(period_label).order_by(period_label)

    rev_rows = await db.execute(rev_q)
    revenue_by_period = []
    for p, rev in rev_rows:
        revenue_by_period.append({"period": p, "revenue": round(_normalize_amount(float(rev or 0.0)), 2)})

    return {
        "status_counts": {"success": success_cnt, "failed": failed_cnt, "refunded": refunded_cnt, "total": total_cnt},
        "revenue_by_period": revenue_by_period,
        "start_date": start_date,
        "end_date": end_date,
        "interval": iv,
    }


@router.get("/users/top-spenders", dependencies=[Depends(require_admin)])
async def users_top_spenders(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get top spending users by both revenue and coins.
    """
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)
    if end_dt and end_date and len(end_date) == 10:
        end_dt = end_dt + timedelta(days=1) - timedelta(microseconds=1)

    # Revenue subquery (with dummy coins_spent)
    revenue_q = (
        select(
            Order.user_id.label("user_id"),
            func.coalesce(func.sum(Order.subtotal_at_apply), 0).label("total_revenue"),
            literal(0).label("coins_spent"),
        )
    )
    # Only consider successful orders for revenue calculations
    revenue_q = revenue_q.where(Order.status == 'success')
    if start_dt:
        revenue_q = revenue_q.where(Order.applied_at >= start_dt)
    if end_dt:
        revenue_q = revenue_q.where(Order.applied_at <= end_dt)
    revenue_q = revenue_q.group_by(Order.user_id)

    # Coins subquery (with dummy total_revenue)
    coins_q = (
        select(
            CoinTransaction.user_id.label("user_id"),
            literal(0).label("total_revenue"),
            func.coalesce(func.sum(CoinTransaction.coins), 0).label("coins_spent"),
        )
        .where(CoinTransaction.transaction_type == "debit")
    )
    if start_dt:
        coins_q = coins_q.where(CoinTransaction.created_at >= start_dt)
    if end_dt:
        coins_q = coins_q.where(CoinTransaction.created_at <= end_dt)
    coins_q = coins_q.group_by(CoinTransaction.user_id)

    # Union with aligned columns
    union_q = revenue_q.union_all(coins_q).subquery()

    # Final aggregation
    q = (
        # join to users table to fetch readable name/email and avoid returning raw ids only
        select(
            union_q.c.user_id,
            func.coalesce(User.full_name, User.email).label("user_name"),
            User.email.label("user_email"),
            func.sum(union_q.c.total_revenue).label("total_revenue"),
            func.sum(union_q.c.coins_spent).label("coins_spent"),
        )
        .select_from(union_q.outerjoin(User, User.id == union_q.c.user_id))
        .group_by(union_q.c.user_id, User.full_name, User.email)
        .order_by(
            func.sum(union_q.c.total_revenue).desc(),
            func.sum(union_q.c.coins_spent).desc(),
        )
        .limit(limit)
    )

    rows = await db.execute(q)

    top_spenders = [
        {
            "user_id": uid,
            "user_name": user_name,
            "user_email": user_email,
            "total_revenue": _normalize_amount(float(total_rev or 0.0)),
            "coins_spent": int(coins or 0),
        }
        for uid, user_name, user_email, total_rev, coins in rows
    ]

    return {
        "start_date": start_date,
        "end_date": end_date,
        "limit": limit,
        "top_spenders": top_spenders,
    }


@router.get("/users/top-active", dependencies=[Depends(require_admin)])
async def users_top_active(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(20, ge=1, le=100),
    metric: str = Query('coins_spent'),
    feature: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Top active users by coins_spent or actions."""
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    if metric == 'actions':
        # use count of coin transactions as proxy for actions
        # select aggregated counts and left-join users so name/email come back directly
        q = (
            select(
                CoinTransaction.user_id,
                func.coalesce(User.full_name, User.email).label('user_name'),
                User.email.label('user_email'),
                func.count(CoinTransaction.id).label('total_actions'),
            )
            .select_from(CoinTransaction)
            .join(User, User.id == CoinTransaction.user_id, isouter=True)
        )
        if start_dt:
            q = q.where(CoinTransaction.created_at >= start_dt)
        if end_dt:
            q = q.where(CoinTransaction.created_at <= end_dt)
        if feature:
            q = q.where(CoinTransaction.source_type == feature)
        q = q.group_by(CoinTransaction.user_id, User.full_name, User.email).order_by(func.count(CoinTransaction.id).desc()).limit(limit)

        rows = await db.execute(q)
        out = []
        for uid, user_name, user_email, actions in rows:
            coins_q = select(func.coalesce(func.sum(CoinTransaction.coins), 0)).where(CoinTransaction.user_id == uid)
            if start_dt:
                coins_q = coins_q.where(CoinTransaction.created_at >= start_dt)
            if end_dt:
                coins_q = coins_q.where(CoinTransaction.created_at <= end_dt)
            coins_val = int((await db.execute(coins_q)).scalar() or 0)
            # determine most used feature for this user (by action count) within the same time window
            feat_q = select(CoinTransaction.source_type, func.count(CoinTransaction.id).label('cnt')).where(CoinTransaction.user_id == uid)
            if start_dt:
                feat_q = feat_q.where(CoinTransaction.created_at >= start_dt)
            if end_dt:
                feat_q = feat_q.where(CoinTransaction.created_at <= end_dt)
            feat_q = feat_q.group_by(CoinTransaction.source_type).order_by(func.count(CoinTransaction.id).desc()).limit(1)
            feat_row = await db.execute(feat_q)
            most_used = None
            first = feat_row.first()
            if first:
                most_used = first[0]
            # determine most spent feature (by coins) for this user within the same window
            spent_feat_q = select(CoinTransaction.source_type, func.coalesce(func.sum(CoinTransaction.coins), 0).label('coins')).where(CoinTransaction.user_id == uid, CoinTransaction.transaction_type == 'debit')
            if start_dt:
                spent_feat_q = spent_feat_q.where(CoinTransaction.created_at >= start_dt)
            if end_dt:
                spent_feat_q = spent_feat_q.where(CoinTransaction.created_at <= end_dt)
            spent_feat_q = spent_feat_q.group_by(CoinTransaction.source_type).order_by(func.sum(CoinTransaction.coins).desc()).limit(1)
            spent_row = await db.execute(spent_feat_q)
            most_spent_feature = None
            most_spent_feature_coins = 0
            sr = spent_row.first()
            if sr:
                most_spent_feature = sr[0]
                try:
                    most_spent_feature_coins = int(sr[1] or 0)
                except Exception:
                    most_spent_feature_coins = int(sr[1]) if sr[1] is not None else 0

            out.append({
                "user_id": uid,
                "user_name": user_name,
                "user_email": user_email,
                "total_actions": int(actions),
                "total_coins_spent": coins_val,
                "avg_coins_per_action": round(coins_val / int(actions) if actions else 0, 2),
                "most_used_feature": most_used,
                "most_spent_feature": most_spent_feature,
                "most_spent_feature_coins": most_spent_feature_coins,
            })

        return {"start_date": start_date, "end_date": end_date, "metric": metric, "top_active_users": out}

    # default coins_spent
    q = select(CoinTransaction.user_id, func.coalesce(func.sum(CoinTransaction.coins), 0).label('total_coins_spent')).where(CoinTransaction.transaction_type == 'debit')
    if start_dt:
        q = q.where(CoinTransaction.created_at >= start_dt)
    if end_dt:
        q = q.where(CoinTransaction.created_at <= end_dt)
    if feature:
        q = q.where(CoinTransaction.source_type == feature)
    q = q.group_by(CoinTransaction.user_id).order_by(func.sum(CoinTransaction.coins).desc()).limit(limit)
    rows = await db.execute(q)
    out = []
    for uid, coins in rows:
        actions_q = select(func.count(CoinTransaction.id)).where(CoinTransaction.user_id == uid)
        if start_dt:
            actions_q = actions_q.where(CoinTransaction.created_at >= start_dt)
        if end_dt:
            actions_q = actions_q.where(CoinTransaction.created_at <= end_dt)
        actions_val = int((await db.execute(actions_q)).scalar() or 0)
        # determine most used feature for this user (by action count) within the same time window
        feat_q = select(CoinTransaction.source_type, func.count(CoinTransaction.id).label('cnt')).where(CoinTransaction.user_id == uid)
        if start_dt:
            feat_q = feat_q.where(CoinTransaction.created_at >= start_dt)
        if end_dt:
            feat_q = feat_q.where(CoinTransaction.created_at <= end_dt)
        feat_q = feat_q.group_by(CoinTransaction.source_type).order_by(func.count(CoinTransaction.id).desc()).limit(1)
        feat_row = await db.execute(feat_q)
        most_used = None
        first = feat_row.first()
        if first:
            most_used = first[0]

        # determine most spent feature (by coins) for this user within the same window
        spent_feat_q = select(CoinTransaction.source_type, func.coalesce(func.sum(CoinTransaction.coins), 0).label('coins')).where(CoinTransaction.user_id == uid, CoinTransaction.transaction_type == 'debit')
        if start_dt:
            spent_feat_q = spent_feat_q.where(CoinTransaction.created_at >= start_dt)
        if end_dt:
            spent_feat_q = spent_feat_q.where(CoinTransaction.created_at <= end_dt)
        spent_feat_q = spent_feat_q.group_by(CoinTransaction.source_type).order_by(func.sum(CoinTransaction.coins).desc()).limit(1)
        spent_row = await db.execute(spent_feat_q)
        most_spent_feature = None
        most_spent_feature_coins = 0
        sr = spent_row.first()
        if sr:
            most_spent_feature = sr[0]
            try:
                most_spent_feature_coins = int(sr[1] or 0)
            except Exception:
                most_spent_feature_coins = int(sr[1]) if sr[1] is not None else 0

        out.append({"user_id": uid, "total_actions": actions_val, "total_coins_spent": int(coins or 0), "avg_coins_per_action": round(int(coins or 0) / actions_val if actions_val else 0, 2), "most_used_feature": most_used, "most_spent_feature": most_spent_feature, "most_spent_feature_coins": most_spent_feature_coins})

    # Batch-fetch user name/email for the returned uids and attach to each row
    uids = [o["user_id"] for o in out if o.get("user_id")]
    if uids:
        users_q = select(User.id, User.full_name, User.email).where(User.id.in_(uids))
        users_rows = await db.execute(users_q)
        users_map = {str(u[0]): {"user_name": u[1], "user_email": u[2]} for u in users_rows}
        for o in out:
            uid_key = str(o.get("user_id"))
            info = users_map.get(uid_key)
            if info:
                o.setdefault("user_name", info.get("user_name"))
                o.setdefault("user_email", info.get("user_email"))

    return {"start_date": start_date, "end_date": end_date, "metric": metric, "top_active_users": out}


@router.get("/engagement/feature-breakdown", dependencies=[Depends(require_admin)])
async def engagement_feature_breakdown(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    cohort: Optional[str] = Query(None),
    detail: Optional[bool] = Query(False),
    db: AsyncSession = Depends(get_db),
):
    """Engagement metrics by feature."""
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    q = select(CoinTransaction.source_type.label('feature'), func.count(CoinTransaction.id).label('total_actions'), func.count(func.distinct(CoinTransaction.user_id)).label('unique_users'), func.coalesce(func.sum(CoinTransaction.coins), 0).label('coins_spent'))
    if start_dt:
        q = q.where(CoinTransaction.created_at >= start_dt)
    if end_dt:
        q = q.where(CoinTransaction.created_at <= end_dt)
    q = q.group_by(CoinTransaction.source_type).order_by(func.count(CoinTransaction.id).desc())
    rows = await db.execute(q)
    features = []
    for feat, actions, uniq, coins in rows:
        item = {"feature": feat, "total_actions": int(actions), "unique_users": int(uniq), "coins_spent": int(coins or 0)}
        if detail and uniq:
            item["avg_actions_per_user"] = round(int(actions) / int(uniq), 2)
            item["avg_coins_per_user"] = round(int(coins or 0) / int(uniq), 2)
        features.append(item)
    return {"start_date": start_date, "end_date": end_date, "feature_breakdown": features}


@router.get("/engagement/top-characters", dependencies=[Depends(require_admin)])
async def engagement_top_characters(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(10),
    metric: str = Query('coins_spent'),
    db: AsyncSession = Depends(get_db),
):
    """Top characters by coins spent or interactions."""
    # assume character interactions are recorded in CoinTransaction with source_type 'character'
    # and that CoinTransaction.character_id exists (new column). Aggregate by that field
    # and left-join Character to include character names when available.
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    ct = CoinTransaction
    # normalize metric and choose ordering
    metric = (metric or 'coins_spent').lower()
    if metric not in {'coins_spent', 'interactions', 'unique_users'}:
        metric = 'coins_spent'

    q = select(
        ct.character_id.label('character_id'),
        Character.name.label('character_name'),
        func.coalesce(func.sum(ct.coins), 0).label('coins_spent'),
        func.count(ct.id).label('interactions'),
        func.count(func.distinct(ct.user_id)).label('unique_users'),
    ).where(ct.transaction_type == 'debit')
    if start_dt:
        q = q.where(ct.created_at >= start_dt)
    if end_dt:
        q = q.where(ct.created_at <= end_dt)
    # left join Character to retrieve names; group by character id and name
    q = q.select_from(ct).join(Character, Character.id == ct.character_id, isouter=True)
    q = q.group_by(ct.character_id, Character.name)

    # ordering based on requested metric
    if metric == 'interactions':
        q = q.order_by(func.count(ct.id).desc())
    elif metric == 'unique_users':
        q = q.order_by(func.count(func.distinct(ct.user_id)).desc())
    else:
        q = q.order_by(func.sum(ct.coins).desc())

    q = q.limit(limit)

    rows = await db.execute(q)
    out = []
    for char_id, char_name, coins, interactions, uniq in rows:
        out.append({
            "character_id": (str(char_id) if char_id is not None else None),
            "character_name": char_name,
            "coins_spent": int(coins or 0),
            "interactions": int(interactions or 0),
            "unique_users": int(uniq or 0),
        })
    return {"start_date": start_date, "end_date": end_date, "metric": metric, "top_characters": out}

# --- New endpoint: top characters breakdown by source_type ---
ALLOWED_METRICS = {"coins_spent", "interactions", "unique_users"}
DEFAULT_SOURCES = ("chat", "image", "video", "character", "chat_image", "chat_video")


@router.get("/engagement/top-characters-breakdown", dependencies=[Depends(require_admin)])
async def engagement_top_characters_breakdown(
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    limit: int = Query(10, ge=1, le=100),
    metric: str = Query("coins_spent"),
    source_types: Optional[List[str]] = Query(None, description="Filter to these source types (e.g., chat,image,video,character)"),
    include_unknown_characters: bool = Query(False, description="Include rows with character_id = NULL"),
    db: AsyncSession = Depends(get_db),
):
    """
    Top characters with per-source_type breakdown.
    - Only counts debit (spend) transactions.
    - Aggregates {coins_spent, interactions, unique_users} per (character, source_type) and totals per character.
    - Results are ranked by the requested metric (using totals), and truncated to `limit`.
    """
    # --- Parse & normalize params ---
    metric = (metric or "coins_spent").lower()
    if metric not in ALLOWED_METRICS:
        metric = "coins_spent"

    spending_sources = tuple((source_types or DEFAULT_SOURCES))
    if not spending_sources:
        spending_sources = DEFAULT_SOURCES

    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    ct = CoinTransaction

    # --- Base filters: only debits (spend), selected sources, date range ---
    filters = [
        ct.transaction_type == "debit",
        ct.source_type.in_(spending_sources),
    ]
    if not include_unknown_characters:
        filters.append(ct.character_id.isnot(None))
    if start_dt:
        filters.append(ct.created_at >= start_dt)
    if end_dt:
        filters.append(ct.created_at <= end_dt)

    # --- Breakdown query by (character, source_type) ---
    # We join Character to get names; left join so NULL character_id can be optionally included.
    breakdown_q = (
        select(
            ct.character_id.label("character_id"),
            Character.name.label("character_name"),
            ct.source_type.label("source_type"),
            func.coalesce(func.sum(ct.coins), 0).label("coins_spent"),
            func.count(ct.id).label("interactions"),
            func.count(func.distinct(ct.user_id)).label("unique_users"),
        )
        .select_from(ct)
        .join(Character, Character.id == ct.character_id, isouter=True)
        .where(*filters)
        .group_by(ct.character_id, Character.name, ct.source_type)
    )

    rows = (await db.execute(breakdown_q)).all()

    # --- Assemble nested structure: totals + per-source breakdown ---
    # char_map: character_id -> {character_name, totals, breakdown{source: metrics}}
    # character IDs are strings (or None), normalize typing accordingly
    char_map: Dict[Optional[str], Dict[str, Any]] = {}
    for char_id, char_name, source_type, coins, inters, uniq in rows:
        key = (str(char_id) if char_id is not None else None)
        node = char_map.setdefault(
            key,
            {
                "character_id": key,
                "character_name": char_name,
                "totals": {"coins_spent": 0, "interactions": 0, "unique_users": 0},
                "breakdown": {},
            },
        )
        node["breakdown"][source_type] = {
            "coins_spent": int(coins or 0),
            "interactions": int(inters or 0),
            "unique_users": int(uniq or 0),
        }
        node["totals"]["coins_spent"] += int(coins or 0)
        node["totals"]["interactions"] += int(inters or 0)
        node["totals"]["unique_users"] += int(uniq or 0)

    # --- Rank by chosen metric (using totals) and slice top N ---
    def total_metric(d: Dict[str, Any]) -> int:
        return int(d["totals"].get(metric, 0))

    ranked = sorted(char_map.values(), key=total_metric, reverse=True)[:limit]

    # Optional: ensure every requested source_type appears (fill missing with 0s) for consistent stacking
    for item in ranked:
        for s in spending_sources:
            item["breakdown"].setdefault(
                s, {"coins_spent": 0, "interactions": 0, "unique_users": 0}
            )

    return {
        "start_date": start_date,
        "end_date": end_date,
        "metric": metric,
        "source_types": list(spending_sources),
        "limit": limit,
        "results": ranked,
    }


@router.get("/promotions/performance", dependencies=[Depends(require_admin)])
async def promotions_performance(
    promo_code: Optional[str] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    metric: Optional[str] = Query('revenue'),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """Promo performance metrics."""
    pm = PromoManagement
    q = select(
        pm.coupon.label('promo_code'),
        pm.promo_name,
        func.coalesce(func.count(Order.id), 0).label('times_redeemed'),
    # subscription concept removed; only track times_redeemed and financials
        func.coalesce(func.sum(Order.discount_applied), 0).label('total_discount_given'),
        func.coalesce(func.sum(Order.subtotal_at_apply), 0).label('total_revenue_generated'),
    )
    q = q.join(Order, Order.promo_id == pm.id)
    start_dt = _parse_datetime(start_date)
    end_dt = _parse_datetime(end_date)

    if promo_code:
        q = q.where(pm.coupon.ilike(f"%{promo_code}%"))
    if status:
        q = q.where(pm.status == status)
    if start_dt:
        q = q.where(Order.applied_at >= start_dt)
    if end_dt:
        q = q.where(Order.applied_at <= end_dt)
    q = q.group_by(pm.coupon, pm.promo_name)
    rows = await db.execute(q)
    res = []
    for promo_code, promo_name, times_redeemed, total_discount_given, total_revenue_generated in rows:
        times = int(times_redeemed or 0)
        rev = float(total_revenue_generated or 0.0)
        rev = _normalize_amount(rev)
        avg_rev = round(rev / times, 2) if times > 0 else 0.0
        res.append({
            "promo_code": promo_code,
            "promo_name": promo_name,
            "times_redeemed": times,
            "total_discount_given": float(total_discount_given or 0.0),
            "total_revenue_generated": rev,
            "avg_revenue_per_use": avg_rev,
        })
    return {"start_date": start_date, "end_date": end_date, "promotions": res}


@router.get("/metrics/summary", dependencies=[Depends(require_admin)])
async def metrics_summary(
    as_of_date: Optional[str] = Query(None),
    interval: Optional[str] = Query('monthly'),
    cohort: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    """High level KPIs based on coin purchases: ARPU, revenue, conversion."""
    # Use Order (successful orders) as the source of purchases. subtotal_at_apply stores the fiat value at time of purchase.
    orders = Order
    # Build base filters depending on as_of_date/interval. For now support monthly period alignment for as_of_date.
    as_of_dt = _parse_datetime(as_of_date)

    # revenue for requested period (coin purchases)
    revenue_q = select(func.coalesce(func.sum(orders.subtotal_at_apply), 0)).where(orders.status == 'success')
    orders_count_q = select(func.count(orders.id)).where(orders.status == 'success')
    paying_users_q = select(func.count(func.distinct(orders.user_id))).where(orders.status == 'success')
    
    # subscription revenue query
    sub_revenue_q = select(func.coalesce(func.sum(PricingPlan.price), 0)).select_from(Subscription).join(
        PricingPlan, 
        Subscription.plan_name == PricingPlan.plan_name,
        isouter=True
    ).where(Subscription.status == 'active')

    if as_of_dt and interval == 'weekly':
        period_label = as_of_dt.strftime('%Y-W%U')
        revenue_q = revenue_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == period_label)
        orders_count_q = orders_count_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == period_label)
        paying_users_q = paying_users_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == period_label)
        sub_revenue_q = sub_revenue_q.where(func.to_char(Subscription.start_date, 'IYYY-"W"IW') == period_label)

        # compute previous week label
        prev_date = as_of_dt - timedelta(weeks=1)
        prev_label = prev_date.strftime('%Y-W%U')
    elif as_of_dt and interval == 'monthly':
        period_label = as_of_dt.strftime('%Y-%m')
        revenue_q = revenue_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == period_label)
        orders_count_q = orders_count_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == period_label)
        paying_users_q = paying_users_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == period_label)
        sub_revenue_q = sub_revenue_q.where(func.to_char(Subscription.start_date, 'YYYY-MM') == period_label)

        # compute previous month label
        prev_month = as_of_dt.month - 1 or 12
        prev_year = as_of_dt.year if as_of_dt.month > 1 else as_of_dt.year - 1
        prev_label = f"{prev_year:04d}-{prev_month:02d}"
    elif as_of_dt and interval == 'quarterly':
        quarter = (as_of_dt.month - 1) // 3 + 1
        period_label = f"{as_of_dt.year}-Q{quarter}"
        revenue_q = revenue_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == period_label)
        orders_count_q = orders_count_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == period_label)
        paying_users_q = paying_users_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == period_label)
        sub_revenue_q = sub_revenue_q.where(func.to_char(Subscription.start_date, 'YYYY-"Q"Q') == period_label)

        # compute previous quarter label
        prev_quarter = quarter - 1 if quarter > 1 else 4
        prev_year = as_of_dt.year if quarter > 1 else as_of_dt.year - 1
        prev_label = f"{prev_year}-Q{prev_quarter}"
    else:
        prev_label = None

    coin_revenue = float((await db.execute(revenue_q)).scalar() or 0.0)
    coin_revenue = _normalize_amount(coin_revenue)
    subscription_revenue = float((await db.execute(sub_revenue_q)).scalar() or 0.0)
    total_revenue = coin_revenue + subscription_revenue
    total_orders = int((await db.execute(orders_count_q)).scalar() or 0)

    # total users in system (active users). Use same definition as other endpoints
    total_users = int((await db.execute(select(func.count(User.id)))).scalar() or 0)

    paying_users = int((await db.execute(paying_users_q)).scalar() or 0)

    # ARPU = revenue over total users (note: frontend sometimes computes ARPU client side; provide it too)
    arpu = round(total_revenue / total_users, 2) if total_users > 0 else 0.0

    # conversion_rate returned as percentage (e.g., 3.8) to match frontend helpers
    conversion_rate = round((paying_users / total_users * 100), 2) if total_users > 0 else 0.0

    # average order value (fiat)
    avg_order_value = round(coin_revenue / total_orders, 2) if total_orders > 0 else 0.0

    result = {
        "as_of_date": as_of_date,
        "ARPU": arpu,
        "coin_revenue": round(coin_revenue, 2),
        "subscription_revenue": round(subscription_revenue, 2),
        "total_revenue": round(total_revenue, 2),
        "active_users": total_users,
        "conversion_rate": conversion_rate,
        "paying_users": paying_users,
        "total_users": total_users,
        "avg_order_value": avg_order_value,
        "currency": "USD",
    }

    # previous period metrics (weekly, monthly, quarterly)
    if prev_label:
        prev_coin_revenue_q = select(func.coalesce(func.sum(orders.subtotal_at_apply), 0)).where(orders.status == 'success')
        prev_orders_q = select(func.count(orders.id)).where(orders.status == 'success')
        prev_paying_q = select(func.count(func.distinct(orders.user_id))).where(orders.status == 'success')
        prev_sub_revenue_q = select(func.coalesce(func.sum(PricingPlan.price), 0)).select_from(Subscription).join(
            PricingPlan, 
            Subscription.plan_name == PricingPlan.plan_name,
            isouter=True
        ).where(Subscription.status == 'active')

        if interval == 'weekly':
            prev_coin_revenue_q = prev_coin_revenue_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == prev_label)
            prev_orders_q = prev_orders_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == prev_label)
            prev_paying_q = prev_paying_q.where(func.to_char(orders.applied_at, 'IYYY-"W"IW') == prev_label)
            prev_sub_revenue_q = prev_sub_revenue_q.where(func.to_char(Subscription.start_date, 'IYYY-"W"IW') == prev_label)
        elif interval == 'monthly':
            prev_coin_revenue_q = prev_coin_revenue_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == prev_label)
            prev_orders_q = prev_orders_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == prev_label)
            prev_paying_q = prev_paying_q.where(func.to_char(orders.applied_at, 'YYYY-MM') == prev_label)
            prev_sub_revenue_q = prev_sub_revenue_q.where(func.to_char(Subscription.start_date, 'YYYY-MM') == prev_label)
        elif interval == 'quarterly':
            prev_coin_revenue_q = prev_coin_revenue_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == prev_label)
            prev_orders_q = prev_orders_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == prev_label)
            prev_paying_q = prev_paying_q.where(func.to_char(orders.applied_at, 'YYYY-"Q"Q') == prev_label)
            prev_sub_revenue_q = prev_sub_revenue_q.where(func.to_char(Subscription.start_date, 'YYYY-"Q"Q') == prev_label)

        prev_coin_revenue = float((await db.execute(prev_coin_revenue_q)).scalar() or 0.0)
        prev_coin_revenue = _normalize_amount(prev_coin_revenue)
        prev_sub_revenue = float((await db.execute(prev_sub_revenue_q)).scalar() or 0.0)
        prev_revenue = prev_coin_revenue + prev_sub_revenue
        prev_orders = int((await db.execute(prev_orders_q)).scalar() or 0)
        prev_paying = int((await db.execute(prev_paying_q)).scalar() or 0)

        prev_total_users = total_users  # system-level users unchanged for a simple previous snapshot
        prev_arpu = round(prev_revenue / prev_total_users, 2) if prev_total_users > 0 else 0.0
        prev_conversion = round((prev_paying / prev_total_users * 100), 2) if prev_total_users > 0 else 0.0
        prev_avg_order = round(prev_coin_revenue / prev_orders, 2) if prev_orders > 0 else 0.0

        result["previous_period"] = {
            "coin_revenue": round(prev_coin_revenue, 2),
            "subscription_revenue": round(prev_sub_revenue, 2),
            "total_revenue": round(prev_revenue, 2),
            "active_users": prev_total_users,
            "conversion_rate": prev_conversion,
            "avg_order_value": prev_avg_order,
        }

    return result