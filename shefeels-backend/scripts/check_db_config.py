
import asyncio
from sqlalchemy import text
from app.core.database import engine

async def check_config():
    print("Checking app_config table for AWS/S3 settings...")
    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT parameter_name, parameter_value FROM app_config WHERE parameter_name LIKE '%AWS%' OR parameter_name LIKE '%S3%'"))
        rows = result.fetchall()
        
        if not rows:
            print("No AWS/S3 configuration found in app_config table.")
        else:
            print("Found config in DB:")
            for row in rows:
                print(f"{row[0]} = {row[1]}")

if __name__ == "__main__":
    if asyncio.get_event_loop_policy().__class__.__name__ == 'WindowsProactorEventLoopPolicy':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_config())
