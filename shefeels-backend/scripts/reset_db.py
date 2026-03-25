import asyncio
import os
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from dotenv import load_dotenv

# Add parent dir to path to import app settings if needed, 
# but for this simple script we just need the DB URL.
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    print("DATABASE_URL not found in environment")
    sys.exit(1)

async def truncate_table():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Truncating characters table...")
        await conn.execute(text("TRUNCATE TABLE characters CASCADE;"))
        print("Truncation complete.")
    await engine.dispose()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(truncate_table())
