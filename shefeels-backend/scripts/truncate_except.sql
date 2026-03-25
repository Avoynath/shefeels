-- truncate_except.sql
-- Truncate all tables in the public schema except a chosen keep-list.
-- WARNING: This is destructive. BACKUP your database before running.
-- Usage (PowerShell):
--   $env:PGPASSWORD='your_db_password'; psql -h localhost -p 5432 -U postgres -d honey_db -f .\scripts\truncate_except.sql; Remove-Item Env:PGPASSWORD

DO $$
DECLARE
    tbls text;
    keep_list text[] := ARRAY[
        'users',
        'user_profiles',
        'pricing_plan',
        'email_verifications',
        'app_config'
    ];
BEGIN
    SELECT string_agg(format('%I.%I', schemaname, tablename), ', ')
    INTO tbls
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> ALL(keep_list);

    IF tbls IS NULL THEN
        RAISE NOTICE 'No tables found to truncate (all tables are in the keep list).';
    ELSE
        RAISE NOTICE 'Truncating: %', tbls;
        EXECUTE 'TRUNCATE TABLE ' || tbls || ' RESTART IDENTITY CASCADE';
    END IF;
END$$;

-- End of file
