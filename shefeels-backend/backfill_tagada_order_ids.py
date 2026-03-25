#!/usr/bin/env python3
"""
Backfill tagada_transaction_id for existing orders by fetching from TagadaPay API.
"""
import asyncio
import sys
import os
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.models.subscription import Order
from app.core.config import settings
from app.services.tagadapay import get_tagada_client

async def backfill_transaction_ids():
    """Backfill tagada_transaction_id for orders missing it."""
    
    # Create async engine
    engine = create_async_engine(settings.DATABASE_URL, echo=True)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as session:
        # Get orders without tagada_transaction_id
        stmt = select(Order).where(
            Order.provider == 'tagadapay',
            Order.tagada_transaction_id.is_(None),
            Order.provider_order_ref.isnot(None)
        ).order_by(Order.created_at.desc()).limit(50)
        
        result = await session.execute(stmt)
        orders = result.scalars().all()
        
        print(f"\nFound {len(orders)} orders missing tagada_transaction_id")
        
        if not orders:
            print("No orders to backfill!")
            return
        
        tagada = get_tagada_client()
        updated_count = 0
        
        for order in orders:
            payment_id = order.provider_order_ref
            print(f"\n--- Processing Order {order.id} ---")
            print(f"Payment ID: {payment_id}")
            print(f"Amount: ${order.subtotal_at_apply}")
            print(f"Created: {order.created_at}")
            
            try:
                # Search for this payment in TagadaPay orders
                endpoint = "/api/public/v1/orders/list"
                if settings.TAGADA_STORE_ID:
                    endpoint = f"{endpoint}?storeId={settings.TAGADA_STORE_ID}"
                
                body = {"search": payment_id}
                res = await tagada._request("POST", endpoint, body)
                
                if res and isinstance(res, dict) and "orders" in res:
                    orders_list = res["orders"]
                    if orders_list and len(orders_list) > 0:
                        tagada_order = orders_list[0]
                        order_id = tagada_order.get("id")
                        
                        if order_id:
                            print(f"✓ Found TagadaPay order ID: {order_id}")
                            
                            # Update the order
                            order.tagada_transaction_id = order_id
                            updated_count += 1
                        else:
                            print(f"✗ No order ID in response")
                    else:
                        print(f"✗ No orders found for payment {payment_id}")
                else:
                    print(f"✗ Invalid response from TagadaPay")
                    
            except Exception as e:
                print(f"✗ Error fetching order for {payment_id}: {e}")
                continue
        
        if updated_count > 0:
            await session.commit()
            print(f"\n✓ Successfully updated {updated_count} orders!")
        else:
            print(f"\n✗ No orders were updated")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(backfill_transaction_ids())
