#!/usr/bin/env python3
"""Manual update for specific orders with known order IDs from logs."""
import asyncio
import os
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

DATABASE_URL = os.getenv("DATABASE_URL")

# Order ID mappings from logs
UPDATES = [
    ("order_f80e01639169", "pay_14b115823c61"),  # $239.99 order from logs
    ("order_7a16314498ac", "pay_d146b0405b39"),  # $129.99 order from logs
]

async def manual_update():
    engine = create_async_engine(DATABASE_URL, echo=False)
    
    async with engine.begin() as conn:
        for order_id, payment_id in UPDATES:
            result = await conn.execute(text("""
                UPDATE orders
                SET tagada_transaction_id = :order_id
                WHERE provider_order_ref = :payment_id AND tagada_transaction_id IS NULL
                RETURNING id, subtotal_at_apply
            """), {"order_id": order_id, "payment_id": payment_id})
            
            row = result.fetchone()
            if row:
                print(f"✓ Updated order {row[0][:12]}... (${row[1]}) -> {order_id}")
            else:
                print(f"✗ No update for payment {payment_id}")
    
    await engine.dispose()
    print("\n✓ Manual updates complete!")

if __name__ == "__main__":
    asyncio.run(manual_update())
