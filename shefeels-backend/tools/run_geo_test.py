#!/usr/bin/env python3
import asyncpg, re, uuid, datetime
from pathlib import Path

envp = Path(__file__).resolve().parents[1] / '.env'
text = envp.read_text()
m = re.search(r'^DATABASE_URL=(.+)$', text, flags=re.M)
if not m:
    print('DATABASE_URL not found')
    raise SystemExit(1)
raw = m.group(1).strip()
db_url = raw.replace('postgresql+asyncpg://', 'postgresql://')
print('Using DB URL (hidden password) ->', re.sub(r':[^:@]+@', ':*****@', db_url))

async def run():
    conn = await asyncpg.connect(db_url)
    try:
        now = datetime.datetime.utcnow()
        # Reuse an existing user to avoid enum/ddl issues when inserting into users
        row_u = await conn.fetchrow('SELECT id FROM users LIMIT 1')
        if not row_u:
            print('No users present in DB — please create at least one user before running this test.')
            return
        user_a_id = row_u['id']
        vsid = uuid.uuid4().hex[:32]
        ip_a = '1.2.3.4'
        await conn.execute('''INSERT INTO visit_sessions (id, user_id, first_ip, first_country_code, first_city, user_agent, started_at) VALUES($1,NULL,$2,$3,$4,'test', $5)''', vsid, ip_a, 'US', 'Testville', now)
        await conn.execute('UPDATE visit_sessions SET user_id=$1 WHERE id=$2', user_a_id, vsid)
        uih_id = uuid.uuid4().hex[:32]
        await conn.execute('''INSERT INTO user_ip_history (id, user_id, ip, location_country_code, location_city, first_seen_at, last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$6)
            ON CONFLICT (user_id, ip) DO UPDATE SET location_country_code = COALESCE(user_ip_history.location_country_code, EXCLUDED.location_country_code), location_city = COALESCE(user_ip_history.location_city, EXCLUDED.location_city), last_seen_at = EXCLUDED.last_seen_at''', uih_id, user_a_id, ip_a, 'US', 'Testville', now)
        row = await conn.fetchrow('SELECT id, ip, location_country_code, location_city FROM user_ip_history WHERE user_id=$1', user_a_id)
        print('[TEST A] user_ip_history:', dict(row) if row else None)

        # Reuse the same existing user for test B as well
        user_b_id = user_a_id
        ip_b = '5.6.7.8'
        uih2_id = uuid.uuid4().hex[:32]
        await conn.execute('''INSERT INTO user_ip_history (id, user_id, ip, location_country_code, location_city, first_seen_at, last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$6)''', uih2_id, user_b_id, ip_b, None, None, now)
        await conn.execute('''INSERT INTO ip_location_cache (ip, country_code, country_name, city, source, first_seen_at, last_seen_at) VALUES($1,$2,$3,$4,$5,$6,$6)
            ON CONFLICT (ip) DO UPDATE SET country_code=EXCLUDED.country_code, country_name=EXCLUDED.country_name, city=EXCLUDED.city, source=EXCLUDED.source, last_seen_at=EXCLUDED.last_seen_at''', ip_b, 'GB', 'United Kingdom', 'London', 'test', now)
        await conn.execute('''UPDATE user_ip_history SET location_country_code = COALESCE(location_country_code, $1), location_city = COALESCE(location_city, $2), last_seen_at = $3 WHERE ip = $4 AND (location_country_code IS NULL OR location_city IS NULL)''', 'GB', 'London', now, ip_b)
        row2 = await conn.fetchrow('SELECT id, ip, location_country_code, location_city FROM user_ip_history WHERE user_id=$1 AND ip=$2', user_b_id, ip_b)
        print('[TEST B] user_ip_history after backfill:', dict(row2) if row2 else None)
    finally:
        await conn.close()

import asyncio
asyncio.run(run())
