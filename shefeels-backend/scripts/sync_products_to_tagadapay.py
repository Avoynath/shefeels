"""
Script to create Honeylove products and variants in TagadaPay dashboard.

This script reads the pricing_plan table from the database and creates
corresponding products and variants in TagadaPay via their API.

Usage:
    python -m scripts.sync_products_to_tagadapay
"""

import asyncio
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.services.tagadapay import TagadaPayClient, TagadaPayError
from app.core.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


async def get_async_session():
    """Create async database session."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    return async_session()


async def fetch_pricing_plans():
    """Fetch all active pricing plans from database."""
    query = text(
        """
        SELECT 
            id, plan_name, pricing_id, coupon, currency,
            price, discount, billing_cycle, coin_reward, status
        FROM pricing_plan
        WHERE status = 'Active'
        ORDER BY billing_cycle DESC, coin_reward ASC
    """
    )

    session = await get_async_session()
    try:
        result = await session.execute(query)
        plans = result.fetchall()
        return plans
    finally:
        await session.close()


def group_plans_by_type(plans):
    """Group plans into subscriptions and token packs."""
    subscriptions = []
    token_packs = []

    for plan in plans:
        if plan.billing_cycle == "OneTime":
            token_packs.append(plan)
        else:
            subscriptions.append(plan)

    return subscriptions, token_packs


def map_billing_cycle(billing_cycle: str):
    """Map database billing cycle to TagadaPay interval format."""
    mapping = {
        "Monthly": {"interval": "month", "intervalCount": 1},
        "Every 3 Months": {"interval": "month", "intervalCount": 3},
        "Every 12 Months": {"interval": "year", "intervalCount": 1},
        "OneTime": {"interval": None, "intervalCount": 1},
    }
    return mapping.get(billing_cycle, {"interval": None, "intervalCount": 1})


async def create_subscription_product(client: TagadaPayClient, plans: list):
    """Create a single product with multiple subscription variants."""
    if not plans:
        return None

    # Create variants from all subscription plans
    variants = []
    for plan in plans:
        billing = map_billing_cycle(plan.billing_cycle)

        # Convert price to cents
        amount_cents = int(float(plan.price) * 100)

        variant = {
            "name": f"{plan.billing_cycle} Plan",
            "description": f"Honeylove subscription - {plan.coin_reward} coins - {plan.billing_cycle}",
            "sku": plan.pricing_id,
            "grams": 0,  # Digital product, no weight
            "price": amount_cents,  # Base price in cents
            "compareAtPrice": amount_cents,  # Same as price (no discount)
            "active": True,
            "default": plan.billing_cycle == "Monthly",  # Make monthly the default
            "prices": [
                {
                    "currencyOptions": {
                        plan.currency: {
                            "amount": amount_cents,
                            "currency": plan.currency,
                        }
                    },
                    "recurring": True,
                    "interval": billing["interval"],
                    "intervalCount": billing["intervalCount"],
                    "billingTiming": "advance",  # Bill at start of period
                    "default": True,
                }
            ],
        }
        variants.append(variant)

    # Create the product
    payload = {
        "storeId": settings.TAGADA_STORE_ID,
        "name": "Honey Love Subscription",
        "description": "Honeylove AI companion subscription with monthly coins",
        "active": True,
        "isShippable": False,
        "isTaxable": False,
        "variants": variants,
    }

    logger.info(f"Creating subscription product with {len(variants)} variants...")
    try:
        result = await client._request(
            "POST", "/api/public/v1/products/create", payload
        )
        logger.info(f"✅ Subscription product created successfully!")

        # Handle both dict and list responses
        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        product_id = result.get("id") if isinstance(result, dict) else None
        if product_id:
            logger.info(f"   Product ID: {product_id}")

        # Return result with plan mapping for database update
        return {"result": result, "plans": plans, "product_type": "subscription"}
    except TagadaPayError as e:
        logger.error(f"❌ Failed to create subscription product: {e}")
        return None


async def create_token_pack_product(client: TagadaPayClient, plans: list):
    """Create a single product with multiple token pack variants."""
    if not plans:
        return None

    # Create variants from all token pack plans
    variants = []
    for plan in plans:
        # Convert price to cents
        amount_cents = int(float(plan.price) * 100)

        variant = {
            "name": f"{plan.coin_reward} Tokens",
            "description": f"One-time purchase of {plan.coin_reward} tokens",
            "sku": plan.pricing_id,
            "grams": 0,  # Digital product, no weight
            "price": amount_cents,  # Base price in cents
            "compareAtPrice": amount_cents,  # Same as price (no discount)
            "active": True,
            "default": plan.coin_reward == 300,  # Make smallest pack default
            "prices": [
                {
                    "currencyOptions": {
                        plan.currency: {
                            "amount": amount_cents,
                            "currency": plan.currency,
                        }
                    },
                    "recurring": False,
                    "interval": None,
                    "intervalCount": 1,
                    "billingTiming": "usage",
                    "default": True,
                }
            ],
        }
        variants.append(variant)

    # Create the product
    payload = {
        "storeId": settings.TAGADA_STORE_ID,
        "name": "Honey Love Token Pack",
        "description": "One-time token purchase for Honeylove AI companion",
        "active": True,
        "isShippable": False,
        "isTaxable": False,
        "variants": variants,
    }

    logger.info(f"Creating token pack product with {len(variants)} variants...")
    try:
        result = await client._request(
            "POST", "/api/public/v1/products/create", payload
        )
        logger.info(f"✅ Token pack product created successfully!")

        # Handle both dict and list responses
        if isinstance(result, list) and len(result) > 0:
            result = result[0]

        product_id = result.get("id") if isinstance(result, dict) else None
        if product_id:
            logger.info(f"   Product ID: {product_id}")

        # Return result with plan mapping for database update
        return {"result": result, "plans": plans, "product_type": "token_pack"}
    except TagadaPayError as e:
        logger.error(f"❌ Failed to create token pack product: {e}")
        return None


async def update_database_with_variant_ids(product_data):
    """Update pricing_plan table with variant IDs from TagadaPay response."""
    if not product_data:
        return False

    plans = product_data.get("plans", [])
    product_type = product_data.get("product_type", "")

    # Since create API doesn't return product ID, we need to list products and match by name
    logger.info(f"   Fetching products from store to find variant IDs...")
    client = TagadaPayClient()

    try:
        # List all products for the store
        list_payload = {
            "storeId": settings.TAGADA_STORE_ID,
            "page": 1,
            "per_page": 100,
            "includeVariants": True,
        }

        products_response = await client._request(
            "POST", "/api/public/v1/products/list", list_payload
        )
        products = products_response.get("items", [])

        if not products:
            logger.warning(f"⚠️  No products found in store")
            return False

        logger.info(f"   Found {len(products)} products in store")

        # Find our product by name
        product_name = (
            "Honey Love Subscription"
            if product_type == "subscription"
            else "Honey Love Token Pack"
        )
        target_product = None

        for product in products:
            if product.get("name") == product_name:
                target_product = product
                break

        if not target_product:
            logger.warning(f"⚠️  Could not find product '{product_name}' in store")
            return False

        variants = target_product.get("variants", [])
        if not variants:
            logger.warning(f"⚠️  No variants found in product")
            return False

        logger.info(f"   Found {len(variants)} variants in product")

        # Create a session for database updates
        session = await get_async_session()
        try:
            updates_made = 0

            # Match variants by SKU to plans
            for variant in variants:
                variant_id = variant.get("id")
                sku = variant.get("sku")
                variant_name = variant.get("name")

                if not variant_id or not sku:
                    continue

                # Find matching plan by old pricing_id (which we used as SKU)
                matching_plan = None
                for plan in plans:
                    if plan.pricing_id == sku:
                        matching_plan = plan
                        break

                if matching_plan:
                    # Update database
                    update_query = text(
                        """
                        UPDATE pricing_plan 
                        SET pricing_id = :new_variant_id
                        WHERE id = :plan_id
                    """
                    )

                    await session.execute(
                        update_query,
                        {"new_variant_id": variant_id, "plan_id": matching_plan.id},
                    )

                    logger.info(
                        f"   ✅ Updated {matching_plan.plan_name}: {sku} → {variant_id}"
                    )
                    updates_made += 1
                else:
                    logger.warning(f"   ⚠️  No matching plan for variant SKU: {sku}")

            # Commit all updates
            await session.commit()
            logger.info(f"   💾 Committed {updates_made} database updates")
            return updates_made > 0

        finally:
            await session.close()

    except Exception as e:
        logger.error(f"   ❌ Failed to update database: {e}")
        import traceback

        traceback.print_exc()
        return False


async def main():
    """Main function to sync all products to TagadaPay."""
    logger.info("🚀 Starting product sync to TagadaPay...")
    logger.info(f"   Store ID: {settings.TAGADA_STORE_ID}")
    logger.info(f"   API URL: {settings.TAGADA_BASE_URL}")

    # Check configuration
    if not settings.TAGADA_API_KEY or not settings.TAGADA_STORE_ID:
        logger.error("❌ TAGADA_API_KEY or TAGADA_STORE_ID not configured!")
        logger.error("   Please check your .env file")
        return

    # Fetch plans from database
    logger.info("\n📊 Fetching pricing plans from database...")
    plans = await fetch_pricing_plans()
    logger.info(f"   Found {len(plans)} active pricing plans")

    # Group plans
    subscriptions, token_packs = group_plans_by_type(plans)
    logger.info(f"   - {len(subscriptions)} subscription plans")
    logger.info(f"   - {len(token_packs)} token pack plans")

    # Display what will be created
    logger.info("\n📦 Products to create:")
    logger.info("   1. Honey Love Subscription (with variants):")
    for sub in subscriptions:
        logger.info(
            f"      • {sub.billing_cycle}: ${sub.price} → {sub.coin_reward} coins"
        )

    logger.info("   2. Honey Love Token Pack (with variants):")
    for pack in token_packs:
        logger.info(f"      • {pack.coin_reward} tokens: ${pack.price}")

    # Initialize TagadaPay client
    client = TagadaPayClient()

    # Create subscription product
    logger.info("\n🔨 Creating products in TagadaPay...")
    sub_result = await create_subscription_product(client, subscriptions)

    # Create token pack product
    token_result = await create_token_pack_product(client, token_packs)

    # Update database with variant IDs
    logger.info("\n💾 Updating database with variant IDs...")
    sub_updated = False
    token_updated = False

    if sub_result:
        sub_updated = await update_database_with_variant_ids(sub_result)

    if token_result:
        token_updated = await update_database_with_variant_ids(token_result)

    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("📋 SYNC SUMMARY")
    logger.info("=" * 60)
    logger.info(f"Subscription product: {'✅ Created' if sub_result else '❌ Failed'}")
    if sub_result:
        logger.info(f"  Database updated: {'✅ Yes' if sub_updated else '❌ Failed'}")

    logger.info(f"Token pack product: {'✅ Created' if token_result else '❌ Failed'}")
    if token_result:
        logger.info(f"  Database updated: {'✅ Yes' if token_updated else '❌ Failed'}")

    if (sub_result and sub_updated) or (token_result and token_updated):
        logger.info(
            "\n✅ SUCCESS! Your database has been updated with TagadaPay variant IDs"
        )
        logger.info("   You can now test the hosted checkout flow:")
        logger.info("   1. Login: admin@tripleminds.co / admin1234")
        logger.info("   2. Navigate: /premium → select plan → verify")
        logger.info("   3. You'll be redirected to TagadaPay checkout")
    elif sub_result or token_result:
        logger.info("\n⚠️  Products created but database update failed")
        logger.info("   Please update manually:")
        logger.info("   1. Login to TagadaPay dashboard: https://app.tagadapay.com")
        logger.info("   2. Navigate to Products section")
        logger.info("   3. Find each variant and copy its Variant ID")
        logger.info("   4. Run SQL updates as shown above")

    logger.info("\n✨ Done!")


if __name__ == "__main__":
    asyncio.run(main())
