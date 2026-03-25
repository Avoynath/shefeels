-- cleanup_user_ip_history.sql
-- Idempotent cleanup script for rows in user_ip_history where user_id IS NULL.
-- BEFORE RUNNING: make a backup (see run_cleanup.sh which shows a safe backup command).

BEGIN;

-- Optional: inspect rows first
-- SELECT id, user_id, ip, location_country_code, location_city, first_seen_at, last_seen_at
-- FROM user_ip_history WHERE user_id IS NULL LIMIT 100;

-- Delete analytic rows that have NULL user_id (non-critical analytics table)
DELETE FROM user_ip_history WHERE user_id IS NULL;

COMMIT;
