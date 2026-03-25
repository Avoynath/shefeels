"""Apply Alembic migrations (upgrade to head) using Alembic API.

This script:
- loads DATABASE_URL from environment or .env in project root
- creates an alembic Config from alembic.ini
- sets sqlalchemy.url to DATABASE_URL
- runs alembic.command.upgrade(cfg, 'head')

Run with: python scripts/apply_alembic_upgrade.py
"""
import os
import sys
from pathlib import Path

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

try:
    import alembic.config
    import alembic.command
except Exception as e:
    print("Failed to import alembic. Please ensure alembic is installed in this Python environment.", file=sys.stderr)
    raise

cfg = alembic.config.Config(str(project_root / "alembic.ini"))
# override url
cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"]) 

print("Applying Alembic migrations to:", os.environ["DATABASE_URL"]) 
try:
    alembic.command.upgrade(cfg, "head")
    print("Alembic upgrade to head completed successfully.")
except Exception:
    import traceback
    traceback.print_exc()
    sys.exit(1)
