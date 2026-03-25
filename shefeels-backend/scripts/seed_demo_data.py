"""
Populate the database with synthetic geo-aware data for the admin dashboard.

This keeps existing rows untouched and only inserts demo users/characters and
linked activity records (subscriptions, orders, coin transactions, media,
chat messages) spread across multiple countries and cities.

Usage (PowerShell):
  python scripts/seed_demo_data.py
"""

import asyncio
import random
import datetime
import uuid
from typing import List, Dict, Tuple

from sqlalchemy.future import select
from sqlalchemy import func, delete

from app.core.database import AsyncSessionLocal
from app.core.security import hash_password
from app.models.user import User, UserProfile, RoleEnum
from app.models.geo import UserIpHistory, VisitSession
from app.models.character import Character
from app.models.character_media import CharacterMedia
from app.models.private_content import MediaPack  # ensure model registry is populated
from app.models.subscription import (
    Subscription,
    Order,
    CoinTransaction,
    PricingPlan,
    UserWallet,
)
from app.models.chat import ChatMessage
from app.models.private_content import MediaPack  # ensure model registry is populated

TIME_RANGE_DAYS = 730  # spread over last 2 years
TARGET_USERS = 300
TARGET_CHARACTERS = 400


def random_ip() -> str:
    return ".".join(str(random.randint(1, 254)) for _ in range(4))


def random_datetime_within(days: int) -> datetime.datetime:
    now = datetime.datetime.now(datetime.timezone.utc)
    start = now - datetime.timedelta(days=days)
    return start + datetime.timedelta(
        seconds=random.randint(0, int((now - start).total_seconds()))
    )


def to_naive(dt: datetime.datetime | None) -> datetime.datetime | None:
    if dt is None:
        return None
    return dt.replace(tzinfo=None) if dt.tzinfo else dt


def sample_locations() -> List[Dict[str, str]]:
    """Predefined geo mix to stress geo analytics."""
    return [
        {"country": "US", "city": "New York"},
        {"country": "US", "city": "San Francisco"},
        {"country": "CA", "city": "Toronto"},
        {"country": "GB", "city": "London"},
        {"country": "DE", "city": "Berlin"},
        {"country": "FR", "city": "Paris"},
        {"country": "BR", "city": "Sao Paulo"},
        {"country": "IN", "city": "Bengaluru"},
        {"country": "SG", "city": "Singapore"},
        {"country": "AU", "city": "Sydney"},
        {"country": "ZA", "city": "Cape Town"},
        {"country": "AE", "city": "Dubai"},
    ]


def character_traits() -> Tuple[List[str], List[str], List[str]]:
    styles = ["Glam", "Casual", "Cosplay", "Streetwear", "Sporty", "Vintage", "Minimal"]
    personalities = [
        "playful",
        "sarcastic",
        "sweet",
        "bold",
        "mysterious",
        "energetic",
        "chill",
    ]
    backgrounds = [
        "former barista turned streamer",
        "digital nomad who loves beaches",
        "DJ spinning at underground clubs",
        "comic artist who sketches nightly",
        "fitness trainer filming routines",
        "gamer who speedruns classics",
    ]
    return styles, personalities, backgrounds


async def ensure_pricing_plans(session) -> Dict[str, PricingPlan]:
    # Ensure canonical Honey Love pricing plans exist. We update existing
    # rows (so foreign-keyed orders/subscriptions remain valid) or create
    # them when missing. Deleting all rows can violate FK constraints,
    # so we avoid a hard truncate.
    plans = [
        {
            "plan_name": "Honey Love Subscription",
            "pricing_id": "honeylove-monthly",
            "coupon": "NOPROMO",
            "currency": "USD",
            "price": 19.99,
            "discount": 0,
            "billing_cycle": "Monthly",
            # tokens per billing cycle (monthly)
            "coin_reward": 200,
        },
        {
            "plan_name": "Honey Love Subscription",
            "pricing_id": "honeylove-3months",
            "coupon": "NOPROMO",
            "currency": "USD",
            "price": 54.99,
            "discount": 20,
            "billing_cycle": "Every 3 Months",
            # tokens per billing cycle (3 months)
            "coin_reward": 600,
        },
        {
            "plan_name": "Honey Love Subscription",
            "pricing_id": "honeylove-12months",
            "coupon": "NOPROMO",
            "currency": "USD",
            "price": 179.99,
            "discount": 35,
            "billing_cycle": "Every 12 Months",
            # tokens per billing cycle (12 months)
            "coin_reward": 2400,
        },
        # Token packages (buy-tokens page)
        {
            "plan_name": "Honey Love Token Pack",
            "pricing_id": "honeylove-tokens-300",
            "coupon": "AR10",
            "currency": "USD",
            "price": 29.99,
            "discount": 15,  # one-time bonus %
            "billing_cycle": "OneTime",
            "coin_reward": 300,
        },
        {
            "plan_name": "Honey Love Token Pack",
            "pricing_id": "honeylove-tokens-750",
            "coupon": "AR10",
            "currency": "USD",
            "price": 69.99,
            "discount": 25,
            "billing_cycle": "OneTime",
            "coin_reward": 750,
        },
        {
            "plan_name": "Honey Love Token Pack",
            "pricing_id": "honeylove-tokens-1500",
            "coupon": "AR10",
            "currency": "USD",
            "price": 129.99,
            "discount": 35,
            "billing_cycle": "OneTime",
            "coin_reward": 1500,
        },
        {
            "plan_name": "Honey Love Token Pack",
            "pricing_id": "honeylove-tokens-3000",
            "coupon": "AR10",
            "currency": "USD",
            "price": 239.99,
            "discount": 45,
            "billing_cycle": "OneTime",
            "coin_reward": 3000,
        },
    ]
    pricing_ids = [p["pricing_id"] for p in plans]

    # For each canonical plan: update existing row or create a new one.
    for plan in plans:
        plan_id = plan["pricing_id"]
        existing_obj = (
            (
                await session.execute(
                    select(PricingPlan).where(PricingPlan.pricing_id == plan_id)
                )
            )
            .scalars()
            .one_or_none()
        )
        if existing_obj:
            # Update fields in-place so FK relationships stay intact.
            existing_obj.plan_name = plan["plan_name"]
            existing_obj.coupon = plan.get("coupon", "NOPROMO")
            existing_obj.currency = plan.get("currency", "USD")
            existing_obj.price = plan.get("price", 0)
            existing_obj.discount = plan.get("discount", None)
            existing_obj.billing_cycle = plan.get("billing_cycle", "Monthly")
            existing_obj.coin_reward = plan.get("coin_reward", 0)
            existing_obj.status = "Active"
            session.add(existing_obj)
        else:
            session.add(
                PricingPlan(
                    plan_name=plan["plan_name"],
                    pricing_id=plan_id,
                    coupon=plan.get("coupon", "NOPROMO"),
                    currency=plan.get("currency", "USD"),
                    price=plan.get("price", 0),
                    discount=plan.get("discount", None),
                    billing_cycle=plan.get("billing_cycle", "Monthly"),
                    coin_reward=plan.get("coin_reward", 0),
                    status="Active",
                )
            )

    await session.flush()
    refreshed = (
        (
            await session.execute(
                select(PricingPlan).where(PricingPlan.pricing_id.in_(pricing_ids))
            )
        )
        .scalars()
        .all()
    )
    return {p.pricing_id: p for p in refreshed}


async def seed():
    async with AsyncSessionLocal() as session:
        locs = sample_locations()
        styles, personalities, backgrounds = character_traits()
        pricing_plans = await ensure_pricing_plans(session)
        existing_subscription_users = set(
            row[0]
            for row in (await session.execute(select(Subscription.user_id))).all()
            if row[0]
        )

        existing_users = (
            (
                await session.execute(
                    select(User).where(User.email.like("demo_geo_%@example.com"))
                )
            )
            .scalars()
            .all()
        )
        existing_user_count = len(existing_users)
        print(f"Existing demo users: {existing_user_count}")

        users_to_create = max(TARGET_USERS - existing_user_count, 0)
        existing_demo_characters = (
            (
                await session.execute(
                    select(Character).where(Character.username.like("demo_%"))
                )
            )
            .scalars()
            .all()
        )
        characters_to_create = max(TARGET_CHARACTERS - len(existing_demo_characters), 0)

        password_hash = hash_password("DemoPass123!")
        created_users: List[User] = []
        created_characters: List[Character] = list(existing_demo_characters)
        subscription_created_for: set[str] = set()
        subscription_created_for.update(existing_subscription_users)
        orders_created = 0
        coin_tx_created = 0
        chats_created = 0
        media_created = 0
        characters_created = len(existing_demo_characters)
        subscriptions_created = 0

        # Create users with geo + wallet
        for i in range(users_to_create):
            loc = random.choice(locs)
            created_at = random_datetime_within(TIME_RANGE_DAYS)
            user = User(
                email=f"demo_geo_{existing_user_count + i + 1}@example.com",
                hashed_password=password_hash,
                full_name=f"Demo User {existing_user_count + i + 1}",
                role=RoleEnum.USER,
                is_active=True,
                is_email_verified=True,
                created_at=created_at,
            )
            session.add(user)
            await session.flush()

            session.add(
                UserProfile(
                    user_id=user.id,
                    full_name=user.full_name,
                    email_id=user.email,
                    username=f"demo_{user.id[:8]}",
                    gender=random.choice(["male", "female", "other"]),
                )
            )
            session.add(
                UserIpHistory(
                    user_id=user.id,
                    ip=random_ip(),
                    location_country_code=loc["country"],
                    location_city=loc["city"],
                )
            )
            visit = VisitSession(
                user_id=user.id,
                first_ip=random_ip(),
                first_country_code=loc["country"],
                first_city=loc["city"],
                utm_source=random.choice(["ads", "social", "organic", "email"]),
                utm_medium=random.choice(["cpc", "cpa", "referral", "newsletter"]),
                utm_campaign=random.choice(["launch", "spring", "black-friday"]),
                started_at=created_at
                + datetime.timedelta(minutes=random.randint(0, 120)),
            )
            session.add(visit)
            session.add(UserWallet(user_id=user.id, coin_balance=0))

            created_users.append((user, loc, visit))

        # Existing demo users (if any) get included in downstream linking
        for usr in existing_users:
            created_users.append((usr, random.choice(locs), None))

        # Characters (evenly distribute across users)
        character_names = [
            "Luna",
            "Riley",
            "Nova",
            "Mia",
            "Aria",
            "Scarlett",
            "Zara",
            "Ava",
            "Chloe",
            "Harper",
            "Isla",
            "Layla",
            "Skye",
            "Serena",
            "Ember",
            "Nyx",
        ]
        idx = 0
        while len(created_characters) < characters_to_create + len(
            existing_demo_characters
        ):
            user, loc, visit = created_users[idx % len(created_users)]
            style = random.choice(styles)
            personality = random.choice(personalities)
            background = random.choice(backgrounds)
            created_at = random_datetime_within(TIME_RANGE_DAYS)
            name = random.choice(character_names)
            username = f"demo_{name.lower()}_{idx:04d}"
            character = Character(
                username=username,
                bio=f"{name} with a {personality} vibe from {loc['city']}.",
                user_id=user.id,
                name=name,
                gender=random.choice(["Girl", "Boy", "Non-binary"]),
                style=style,
                ethnicity=random.choice(
                    ["Latina", "Asian", "Caucasian", "Mixed", "Black"]
                ),
                age=random.randint(20, 34),
                eye_colour=random.choice(["brown", "blue", "green", "hazel"]),
                hair_style=random.choice(
                    ["curly", "straight", "wavy", "pixie", "braided"]
                ),
                hair_colour=random.choice(
                    ["black", "brunette", "blonde", "red", "auburn"]
                ),
                body_type=random.choice(["petite", "athletic", "curvy", "slim"]),
                breast_size=random.choice(["A", "B", "C", "D"]),
                butt_size=random.choice(["S", "M", "L"]),
                dick_size=None,
                personality=personality,
                voice_type=random.choice(["soft", "husky", "bright", "calm"]),
                relationship_type=random.choice(["flirty", "romantic", "friendly"]),
                clothing=random.choice(["streetwear", "formal", "casual", "sporty"]),
                special_features="Freckles and a quick wit",
                background=background,
                prompt=f"Act as {name}, a {personality} companion who loves {style} aesthetics.",
                image_url_s3=f"https://cdn.example.com/{username}.webp",
                created_at=created_at,
            )
            session.add(character)
            await session.flush()
            session.add(
                CoinTransaction(
                    user_id=user.id,
                    character_id=character.id,
                    transaction_type="debit",
                    coins=random.choice([50, 75, 100]),
                    source_type="character",
                    created_at=created_at,
                    ip=random_ip(),
                    country_code=loc["country"],
                    city=loc["city"],
                    visitor_session_id=visit.id if visit else None,
                )
            )
            coin_tx_created += 1

            media_count = random.randint(1, 3)
            for m in range(media_count):
                media_created_at = created_at + datetime.timedelta(
                    minutes=random.randint(1, 240)
                )
                session.add(
                    CharacterMedia(
                        character_id=character.id,
                        user_id=user.id,
                        media_type="image",
                        s3_path=f"demo/{character.id}/media_{m+1}.webp",
                        mime_type="image/webp",
                        created_at=media_created_at,
                    )
                )
                media_created += 1
                session.add(
                    CoinTransaction(
                        user_id=user.id,
                        character_id=character.id,
                        transaction_type="debit",
                        coins=random.choice([15, 25, 40]),
                        source_type="image",
                        created_at=media_created_at,
                        ip=random_ip(),
                        country_code=loc["country"],
                        city=loc["city"],
                        visitor_session_id=visit.id if visit else None,
                    )
                )
                coin_tx_created += 1

            created_characters.append(character)
            idx += 1
            characters_created += 1

        # Orders, subscriptions, coin purchases, and coin transactions
        for user, loc, visit in created_users:
            order_count = random.randint(2, 6)
            for _ in range(order_count):
                plan = random.choice(list(pricing_plans.values()))
                order_type = (
                    "subscription"
                    if plan.billing_cycle != "OneTime"
                    else "coin_purchase"
                )
                # Ensure only one subscription per user
                if order_type == "subscription" and user.id in subscription_created_for:
                    # User already has a subscription; fallback to a coin pack (one-time purchase)
                    coin_pack = None
                    for _k, _v in pricing_plans.items():
                        try:
                            bc = getattr(_v, "billing_cycle", "") or getattr(
                                _v, "billingCycle", ""
                            )
                        except Exception:
                            bc = ""
                        if (
                            str(bc).lower().startswith("one")
                            or str(bc).lower().startswith("onet")
                            or "one" in str(bc).lower()
                        ):
                            coin_pack = _v
                            break
                    if coin_pack is None:
                        # last-resort: use the currently selected plan
                        coin_pack = plan
                    plan = coin_pack
                    order_type = "coin_purchase"

                order_status = random.choices(
                    ["success", "failed"], weights=[0.8, 0.2]
                )[0]
                applied_at = random_datetime_within(TIME_RANGE_DAYS)
                order = Order(
                    user_id=user.id,
                    pricing_id=plan.pricing_id,
                    provider="demo",
                    provider_order_ref=f"pay_{random.randint(10000, 99999)}",
                    provider_coin="usd",
                    paid_value_coin=plan.price if order_status == "success" else 0,
                    discount_type=None,
                    discount_applied=0,
                    subtotal_at_apply=plan.price,
                    currency="USD",
                    status=order_status,
                    applied_at=applied_at,
                    ip=random_ip(),
                    country_code=loc["country"],
                    city=loc["city"],
                    visitor_session_id=visit.id if visit else None,
                )
                session.add(order)
                await session.flush()
                orders_created += 1

                # Successful orders create subscription/credits
                if order_status == "success":
                    if (
                        order_type == "subscription"
                        and user.id not in subscription_created_for
                    ):
                        session.add(
                            Subscription(
                                user_id=user.id,
                                payment_customer_id=f"cust_{user.id[:8]}",
                                subscription_id=f"sub_{random.randint(10000, 99999)}",
                                order_id=order.id,
                                price_id=plan.pricing_id,
                                plan_name=plan.plan_name,
                                status=random.choice(
                                    ["active", "trialing", "canceled"]
                                ),
                                current_period_end=to_naive(
                                    applied_at + datetime.timedelta(days=30)
                                ),
                                start_date=to_naive(applied_at),
                                cancel_at_period_end=random.choice(
                                    [False, False, True]
                                ),
                                signup_ip=order.ip,
                                signup_country_code=loc["country"],
                                signup_city=loc["city"],
                                total_coins_rewarded=int(plan.coin_reward),
                            )
                        )
                        subscription_created_for.add(user.id)
                        subscriptions_created += 1

                    session.add(
                        CoinTransaction(
                            user_id=user.id,
                            transaction_type="credit",
                            coins=int(plan.coin_reward),
                            source_type=(
                                "subscription"
                                if order_type == "subscription"
                                else "coin_purchase"
                            ),
                            order_id=order.id,
                            period_start=to_naive(applied_at),
                            period_end=to_naive(
                                applied_at + datetime.timedelta(days=30)
                            ),
                            created_at=applied_at,
                            ip=order.ip,
                            country_code=loc["country"],
                            city=loc["city"],
                            visitor_session_id=visit.id if visit else None,
                        )
                    )
                    coin_tx_created += 1

                    # Spending on random characters after credits land
                    spend_events = random.randint(3, 8)
                    for _ in range(spend_events):
                        character = random.choice(created_characters)
                        coins = random.choice([25, 50, 75, 100, 150])
                        session.add(
                            CoinTransaction(
                                user_id=user.id,
                                character_id=character.id,
                                transaction_type="debit",
                                coins=coins,
                                source_type=random.choice(["chat", "image", "video"]),
                                created_at=applied_at
                                + datetime.timedelta(minutes=random.randint(5, 720)),
                                ip=order.ip,
                                country_code=loc["country"],
                                city=loc["city"],
                                visitor_session_id=visit.id if visit else None,
                            )
                        )
                coin_tx_created += 1

        # Chat messages
        chat_sessions = {}
        for user, loc, visit in created_users:
            msg_count = random.randint(150, 250)
            for _ in range(msg_count):
                character = random.choice(created_characters)
                session_id = chat_sessions.get(user.id)
                if not session_id:
                    session_id = f"chat_{user.id[:10]}_{random.randint(1000,9999)}"
                    chat_sessions[user.id] = session_id
                created_at = random_datetime_within(TIME_RANGE_DAYS)
                session.add(
                    ChatMessage(
                        session_id=session_id,
                        user_id=user.id,
                        character_id=character.id,
                        user_query=f"Hey {character.name}, what's up in {loc['city']}?",
                        ai_message=f"{character.name} replies with a {random.choice(['cheerful','playful','teasing'])} note.",
                        context_window=random.choice([30, 60, 90]),
                        is_media_available=random.choice([True, False]),
                        media_type=random.choice(["text", "image", "voice"]),
                        created_at=created_at,
                    )
                )
                chats_created += 1
                session.add(
                    CoinTransaction(
                        user_id=user.id,
                        character_id=character.id,
                        transaction_type="debit",
                        coins=random.choice([5, 10, 15, 20]),
                        source_type="chat",
                        created_at=created_at,
                        ip=random_ip(),
                        country_code=loc["country"],
                        city=loc["city"],
                        visitor_session_id=visit.id if visit else None,
                    )
                )
                coin_tx_created += 1

        # Bulk media enrichment across existing characters/users to reach ~50k entries
        current_media_count = (
            await session.execute(select(func.count(CharacterMedia.id)))
        ).scalar_one()
        target_media = 50000
        extra_media_needed = max(target_media - current_media_count, 0)
        if extra_media_needed > 0 and created_characters:
            print(f"Adding {extra_media_needed} additional character_media rows...")
            # Skew user selection so some users have more media than others
            user_pool = created_users
            user_weights = [random.uniform(0.5, 2.5) for _ in user_pool]
            for i in range(extra_media_needed):
                user, loc, visit = random.choices(user_pool, weights=user_weights, k=1)[
                    0
                ]
                character = random.choice(created_characters)
                created_at = random_datetime_within(TIME_RANGE_DAYS)
                s3_key = f"demo/{character.id}/bulk_media_{uuid.uuid4().hex}.webp"
                session.add(
                    CharacterMedia(
                        character_id=character.id,
                        user_id=user.id,
                        media_type="image",
                        s3_path=s3_key,
                        mime_type="image/webp",
                        created_at=created_at,
                    )
                )
                media_created += 1
                session.add(
                    CoinTransaction(
                        user_id=user.id,
                        character_id=character.id,
                        transaction_type="debit",
                        coins=random.choice([10, 15, 20, 25, 30]),
                        source_type="image",
                        created_at=created_at,
                        ip=random_ip(),
                        country_code=loc["country"],
                        city=loc["city"],
                        visitor_session_id=visit.id if visit else None,
                    )
                )
                coin_tx_created += 1
                if i and i % 2000 == 0:
                    await session.flush()

        await session.commit()
        print(
            f"Inserted {users_to_create} demo users, "
            f"{len(created_characters)} characters (including existing demos), "
            f"plus linked orders, subscriptions, coins, media, and chats."
        )
        print(
            f"Counts -> orders: {orders_created}, subscriptions: {subscriptions_created}, "
            f"coin_tx: {coin_tx_created}, chat_messages: {chats_created}, media: {media_created}, "
            f"characters_created_now: {characters_created}"
        )


if __name__ == "__main__":
    asyncio.run(seed())
