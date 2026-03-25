"""
Simple helper to run the SQL migration file against the DATABASE_URL in .env
Usage: python scripts/apply_sql_migration_add_gif_url.py

This script reads `hl-backend/.env` for DATABASE_URL; it requires `python -m pip install python-dotenv psycopg[binary]`.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv
import sqlalchemy

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
SQL_FILE = ROOT / "sql" / "0004_add_gif_url_to_characters.sql"

if not ENV_PATH.exists():
    print(f".env not found at {ENV_PATH}")
    sys.exit(1)

load_dotenv(ENV_PATH)
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("DATABASE_URL not set in .env")
    sys.exit(1)

if not SQL_FILE.exists():
    print(f"SQL file not found: {SQL_FILE}")
    sys.exit(1)

with open(SQL_FILE, "r", encoding="utf-8") as f:
    sql = f.read()

print("Connecting to database...")
# SQLAlchemy doesn't create a synchronous engine for async drivers like asyncpg.
# If the DATABASE_URL uses the asyncpg driver (e.g. postgresql+asyncpg://),
# replace it with a synchronous driver-compatible URL before creating engine.
sync_database_url = DATABASE_URL
if "+asyncpg" in DATABASE_URL:
    sync_database_url = DATABASE_URL.replace("+asyncpg", "")

engine = sqlalchemy.create_engine(sync_database_url)
with engine.connect() as conn:
    print("Executing SQL migration...")
    conn.execute(sqlalchemy.text(sql))
    print("Migration executed successfully.")
