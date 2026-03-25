#!/usr/bin/env python3
"""Backfill `user_ip_history` rows from `ip_location_cache` for any rows missing country/city.

Run with:
    PYTHONPATH=. python3 tools/backfill_user_ip_history.py

This updates rows in-place and prints a summary.
"""
import asyncio
import re
from pathlib import Path
import asyncpg

envp = Path(__file__).resolve().parents[1] / '.env'
text = envp.read_text()
import sys
m = re.search(r'^DATABASE_URL=(.+)$', text, flags=re.M)
if not m:
    print('DATABASE_URL not found in .env')
    sys.exit(1)
raw = m.group(1).strip()
db_url = raw.replace('postgresql+asyncpg://', 'postgresql://')

async def run():
    conn = await asyncpg.connect(db_url)
    try:
        # Update user_ip_history rows where ip_location_cache has data
        res = await conn.execute('''
            UPDATE user_ip_history ui
            SET location_country_code = COALESCE(ui.location_country_code, ilc.country_code),
                location_city = COALESCE(ui.location_city, ilc.city),
                last_seen_at = NOW()
            FROM ip_location_cache ilc
            WHERE ui.ip = ilc.ip
              AND (ui.location_country_code IS NULL OR ui.location_city IS NULL)
        ''')
        print('Backfill result:', res)
        # Report a few affected rows
        rows = await conn.fetch('SELECT id, user_id, ip, location_country_code, location_city FROM user_ip_history WHERE location_country_code IS NOT NULL OR location_city IS NOT NULL ORDER BY last_seen_at DESC LIMIT 10')
        for r in rows:
            print(dict(r))
    finally:
        await conn.close()

if __name__ == '__main__':
    asyncio.run(run())
