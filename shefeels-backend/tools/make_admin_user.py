#!/usr/bin/env python3
"""Script to ensure a user exists and set them to admin with a known password.

Usage: run from the `hl-backend` directory: `python3 tools/make_admin_user.py`
"""
import asyncio
import sys

from sqlalchemy import select

from app.core.database import AsyncSessionLocal
# Import every module in app/models so SQLAlchemy relationship target classes are registered
import importlib
import pathlib
import traceback

models_dir = pathlib.Path(__file__).resolve().parents[1] / "app" / "models"
if models_dir.exists() and models_dir.is_dir():
    for p in models_dir.glob("*.py"):
        name = p.stem
        if name == "__init__":
            continue
        module_name = f"app.models.{name}"
        try:
            importlib.import_module(module_name)
        except Exception:
            # best-effort: print and continue importing other modules
            print(f"Warning: failed importing {module_name}")
            traceback.print_exc()

from app.models.user import User, RoleEnum
from app.core.security import hash_password


TARGET_EMAIL = "admin@tripleminds.co"
NEW_PASSWORD = "admin1234"


async def main() -> int:
    async with AsyncSessionLocal() as session:
        stmt = select(User).where(User.email == TARGET_EMAIL)
        result = await session.execute(stmt)
        user = result.scalar_one_or_none()

        hashed = hash_password(NEW_PASSWORD)

        if user is None:
            print(f"User with email {TARGET_EMAIL} not found — creating new admin user.")
            user = User(email=TARGET_EMAIL, hashed_password=hashed, role=RoleEnum.ADMIN)
            session.add(user)
            await session.commit()
            print(f"Created user {TARGET_EMAIL} with role=admin.")
            return 0

        # Update existing user
        changed = False
        if user.role != RoleEnum.ADMIN:
            user.role = RoleEnum.ADMIN
            changed = True
        user.hashed_password = hashed
        changed = True

        if changed:
            session.add(user)
            await session.commit()
            print(f"Updated user {TARGET_EMAIL}: set role=admin and updated password.")
        else:
            print(f"No changes needed for user {TARGET_EMAIL}.")

        return 0


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except Exception as e:
        print("Error while updating/creating user:", e)
        sys.exit(2)
