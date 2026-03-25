
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def update_config():
    print("Updating AWS_BUCKET_NAME in app_config table...")
    new_bucket_name = "honeylove-backend-672911155558-us-east-1-assets"
    
    async with engine.begin() as conn:
        # Check current value
        result = await conn.execute(text("SELECT parameter_value FROM app_config WHERE parameter_name = 'AWS_BUCKET_NAME'"))
        current_val = result.scalar()
        print(f"Current AWS_BUCKET_NAME: {current_val}")
        
        # Update value
        await conn.execute(text("UPDATE app_config SET parameter_value = :val WHERE parameter_name = 'AWS_BUCKET_NAME'"), {"val": new_bucket_name})
        print(f"Updated AWS_BUCKET_NAME to: {new_bucket_name}")
        
        # Verify update
        result = await conn.execute(text("SELECT parameter_value FROM app_config WHERE parameter_name = 'AWS_BUCKET_NAME'"))
        new_val = result.scalar()
        print(f"Verified AWS_BUCKET_NAME: {new_val}")
        
        # Also let's check AWS_REGION just in case
        result = await conn.execute(text("SELECT parameter_value FROM app_config WHERE parameter_name = 'AWS_REGION'"))
        region_val = result.scalar()
        print(f"Current AWS_REGION: {region_val}")
        if region_val != 'us-east-1':
             await conn.execute(text("UPDATE app_config SET parameter_value = 'us-east-1' WHERE parameter_name = 'AWS_REGION'"))
             print(f"Updated AWS_REGION to: us-east-1")

if __name__ == "__main__":
    if asyncio.get_event_loop_policy().__class__.__name__ == 'WindowsProactorEventLoopPolicy':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(update_config())
