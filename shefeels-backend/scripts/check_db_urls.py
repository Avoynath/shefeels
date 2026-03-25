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

async def check_urls():
    engine = create_async_engine(DATABASE_URL)
    async with engine.begin() as conn:
        print("Checking character URLs...")
        result = await conn.execute(text("SELECT name, image_url_s3, privacy FROM characters ORDER BY created_at DESC LIMIT 5;"))
        rows = result.fetchall()
        for row in rows:
            print(f"Name: {row[0]}")
            print(f"Privacy: {row[2]}")
            print(f"Image URL: {row[1]}")
            print("-" * 20)
    await engine.dispose()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(check_urls())
