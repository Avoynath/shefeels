#!/usr/bin/env python3
"""
Backfill tagada_transaction_id for existing orders by fetching from TagadaPay API.
Simplified version using direct SQL and httpx.
"""
import asyncio
import os
import httpx
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

# Database URL from environment or default
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL not set in environment")
    exit(1)

# TagadaPay credentials from environment
TAGADA_API_KEY = os.getenv("TAGADA_API_KEY")
TAGADA_STORE_ID = os.getenv("TAGADA_STORE_ID")
TAGADA_BASE_URL = "https://app.tagadapay.com"

async def fetch_order_from_tagadapay(payment_id: str) -> str | None:
    """Fetch order ID from TagadaPay API using payment ID."""
    if not TAGADA_API_KEY or not TAGADA_STORE_ID:
        print("ERROR: TAGADA_API_KEY or TAGADA_STORE_ID not configured")
        return None
    
    endpoint = f"{TAGADA_BASE_URL}/api/public/v1/orders/list?storeId={TAGADA_STORE_ID}"
    headers = {
        "Authorization": f"Bearer {TAGADA_API_KEY}",
        "Content-Type": "application/json"
    }
    body = {"search": payment_id}
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(endpoint, json=body, headers=headers, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            if data and "orders" in data and len(data["orders"]) > 0:
                order = data["orders"][0]
                return order.get("id")
    except Exception as e:
        print(f"  Error fetching from TagadaPay: {e}")
    
    return None

async def backfill_transaction_ids():
    """Backfill tagada_transaction_id for orders missing it."""
    
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        # Get orders without tagada_transaction_id
        result = await conn.execute(text("""
            SELECT id, provider_order_ref, subtotal_at_apply, created_at
            FROM orders
            WHERE provider = 'tagadapay'
              AND tagada_transaction_id IS NULL
              AND provider_order_ref IS NOT NULL
            ORDER BY created_at DESC
            LIMIT 50
        """))
        
        orders = result.fetchall()
        print(f"\nFound {len(orders)} orders missing tagada_transaction_id\n")
        
        if not orders:
            print("No orders to backfill!")
            return
        
        updated_count = 0
        
        for order in orders:
            order_id, payment_id, amount, created_at = order
            print(f"Order {order_id[:12]}... | Payment: {payment_id} | ${amount} | {created_at}")
            
            # Fetch from TagadaPay
            tagada_order_id = await fetch_order_from_tagadapay(payment_id)
            
            if tagada_order_id:
                print(f"  ✓ Found TagadaPay order: {tagada_order_id}")
                
                # Update the database
                await conn.execute(text("""
                    UPDATE orders
                    SET tagada_transaction_id = :tagada_order_id
                    WHERE id = :order_id
                """), {"tagada_order_id": tagada_order_id, "order_id": order_id})
                
                updated_count += 1
            else:
                print(f"  ✗ Not found in TagadaPay")
            
            # Small delay to avoid rate limiting
            await asyncio.sleep(0.5)
        
        print(f"\n{'='*60}")
        print(f"✓ Successfully updated {updated_count} out of {len(orders)} orders!")
        print(f"{'='*60}\n")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(backfill_transaction_ids())
