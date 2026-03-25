import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

# User provided this connection string
DATABASE_URL = "postgresql+asyncpg://postgres:Depl0yEcs_Db-2020@honeylove-backend-prod.c0l4qmw26fyn.us-east-1.rds.amazonaws.com:5432/honeylove"

async def truncate_characters():
    print(f"Connecting to database...")
    try:
        engine = create_async_engine(DATABASE_URL, echo=True)
        async with engine.begin() as conn:
            print("Truncating characters table with CASCADE...")
            await conn.execute(text("TRUNCATE TABLE characters CASCADE;"))
            print("Successfully truncated characters table.")
        await engine.dispose()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(truncate_characters())
