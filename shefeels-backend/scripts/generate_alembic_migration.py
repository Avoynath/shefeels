"""Generate an alembic autogenerate revision using alembic API.

This script:
- loads DATABASE_URL from environment or .env file in project root
- uses alembic.config.Config to load alembic.ini
- sets sqlalchemy.url to the DATABASE_URL so env.py will use it
- runs alembic.command.revision(autogenerate=True)

Run with: python scripts/generate_alembic_migration.py "create all tables"
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

message = "create all tables"
if len(sys.argv) > 1:
    message = sys.argv[1]

try:
    import alembic.config
    import alembic.command
except Exception as e:
    print("Failed to import alembic. Please ensure alembic is installed in this Python environment.", file=sys.stderr)
    raise

cfg = alembic.config.Config(str(project_root / "alembic.ini"))
# override url
cfg.set_main_option("sqlalchemy.url", os.environ["DATABASE_URL"]) 

# create revision with autogenerate
alembic.command.revision(cfg, message=message, autogenerate=True)
print("Created revision (autogenerate) with message:", message)
