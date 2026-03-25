import asyncio
import os
import sys

# Add project root to path
sys.path.append(os.getcwd())

from app.services import redis_cache
from app.core import database
from sqlalchemy import select
from app.models.app_config import AppConfig

async def main():
    print("Checking Redis config cache...")
    try:
        # Check current cached values
        bucket = await redis_cache.get_cached("config:AWS_BUCKET_NAME")
        region = await redis_cache.get_cached("config:AWS_REGION")
        print(f"Current Cached AWS_BUCKET_NAME: {bucket}")
        print(f"Current Cached AWS_REGION: {region}")

        # Clear them
        print("Clearing cache...")
        await redis_cache.del_cached("config:AWS_BUCKET_NAME")
        await redis_cache.del_cached("config:AWS_REGION")
        await redis_cache.del_cached("config:IMAGE_GENERATION_BUCKET") # Just in case

        # Verify DB values
        async with database.AsyncSessionLocal() as db:
            result = await db.execute(select(AppConfig).where(AppConfig.parameter_name.in_(["AWS_BUCKET_NAME", "AWS_REGION"])))
            configs = result.scalars().all()
            print("\nValues in DB:")
            for c in configs:
                print(f"{c.parameter_name}: {c.parameter_value}")

        print("\nCache cleared. Please restart the application if it uses in-memory cache as well.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
