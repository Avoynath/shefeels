"""Drop and recreate the target Postgres database and run alembic upgrade head.

This script reads DATABASE_URL from environment or .env, connects to the server
'super' database (postgres), terminates connections to the target DB, drops it,
recreates it with the same owner and encoding, and then runs alembic upgrade head
(using alembic API) to apply migrations.

Run with:
  C:/Users/rober/hl/hl-backend/.venv/Scripts/python.exe scripts/recreate_db.py

CAUTION: destructive. All data in the target DB will be lost.
"""
import os
import sys
from pathlib import Path
import urllib.parse

project_root = Path(__file__).resolve().parents[1]
# load simple .env if present
env_path = project_root / ".env"
if "DATABASE_URL" not in os.environ and env_path.exists():
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip()
        if k == "DATABASE_URL":
            os.environ["DATABASE_URL"] = v

if "DATABASE_URL" not in os.environ:
    print("DATABASE_URL not found in environment or .env", file=sys.stderr)
    sys.exit(2)

raw = os.environ["DATABASE_URL"]
# support asyncpg style urls like postgresql+asyncpg://user:pass@host:port/db
if "+" in raw:
    scheme, rest = raw.split("+", 1)
else:
    scheme = raw

# use urllib to parse
parsed = urllib.parse.urlparse(raw)
user = parsed.username or "postgres"
password = parsed.password or ""
host = parsed.hostname or "localhost"
port = parsed.port or 5432
dbname = parsed.path.lstrip("/") or "postgres"

# administrative connection will be to the 'postgres' database
admin_db = "postgres"

print(f"Recreating database '{dbname}' on {host}:{port} as user '{user}'")

try:
    import psycopg2
    from psycopg2 import sql
except Exception as e:
    print("psycopg2 is required in the venv. Please install it and retry.", file=sys.stderr)
    raise

# Build connection params for admin connection
conn_params = {
    'dbname': admin_db,
    'user': user,
    'password': password,
    'host': host,
    'port': port,
}

# Connect to admin DB and drop/create target DB
try:
    conn = psycopg2.connect(**conn_params)
    conn.autocommit = True
    cur = conn.cursor()

    # Terminate connections to target db
    cur.execute(sql.SQL("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = %s AND pid <> pg_backend_pid();"), [dbname])
    print("Terminated active connections to", dbname)

    # Drop database
    cur.execute(sql.SQL("DROP DATABASE IF EXISTS {};").format(sql.Identifier(dbname)))
    print("Dropped database", dbname)

    # Create database with owner
    cur.execute(sql.SQL("CREATE DATABASE {} OWNER {};").format(sql.Identifier(dbname), sql.Identifier(user)))
    print("Created database", dbname)

    cur.close()
    conn.close()
except Exception:
    import traceback
    traceback.print_exc()
    print("Failed to recreate database", file=sys.stderr)
    sys.exit(1)

# Now run alembic upgrade head using alembic API
try:
    import alembic.config
    import alembic.command
except Exception:
    print("Alembic is required in the venv. Please install it and retry.", file=sys.stderr)
    raise

cfg = alembic.config.Config(str(project_root / "alembic.ini"))
cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"]) 
print("Applying migrations to freshly-created database...")
try:
    alembic.command.upgrade(cfg, "head")
    print("Alembic upgrade completed.")
except Exception:
    import traceback
    traceback.print_exc()
    print("Alembic upgrade failed", file=sys.stderr)
    sys.exit(1)

print("Done.")
