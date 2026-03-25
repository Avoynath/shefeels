-- Database Health Check and Verification Script
-- This script verifies that all required tables and relationships exist

\echo '==========================================';
\echo 'Database Health Check for HoneyLove';
\echo '==========================================';
\echo '';

-- Check database connection
\echo '1. Database Connection:';
SELECT current_database() as database_name, 
       current_user as connected_as,
       version() as postgres_version;
\echo '';

-- Count all tables
\echo '2. Total Tables:';
SELECT COUNT(*) as total_tables 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
\echo '';

-- List all tables
\echo '3. All Tables in Database:';
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
\echo '';

-- Check critical tables
\echo '4. Critical Tables Status:';
SELECT 
    t.table_name,
    CASE WHEN t.table_name IS NOT NULL THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM (
    VALUES 
        ('users'),
        ('user_profiles'),
        ('characters'),
        ('chat_messages'),
        ('subscriptions'),
        ('orders'),
        ('user_wallets'),
        ('coin_transactions'),
        ('character_media'),
        ('media_packs'),
        ('pricing_plan'),
        ('promo_management')
) AS required(table_name)
LEFT JOIN information_schema.tables t 
    ON t.table_name = required.table_name 
    AND t.table_schema = 'public';
\echo '';

-- Check row counts
\echo '5. Row Counts in Key Tables:';
SELECT 'users' as table_name, COUNT(*) as row_count FROM users
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles
UNION ALL
SELECT 'characters', COUNT(*) FROM characters
UNION ALL
SELECT 'chat_messages', COUNT(*) FROM chat_messages
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'orders', COUNT(*) FROM orders
UNION ALL
SELECT 'user_wallets', COUNT(*) FROM user_wallets
UNION ALL
SELECT 'coin_transactions', COUNT(*) FROM coin_transactions
UNION ALL
SELECT 'character_media', COUNT(*) FROM character_media
UNION ALL
SELECT 'media_packs', COUNT(*) FROM media_packs
ORDER BY table_name;
\echo '';

-- Check for foreign key constraints
\echo '6. Foreign Key Constraints Count:';
SELECT 
    COUNT(*) as total_foreign_keys
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'public';
\echo '';

-- Check for indexes
\echo '7. Total Indexes:';
SELECT COUNT(*) as total_indexes
FROM pg_indexes
WHERE schemaname = 'public';
\echo '';

-- Check for triggers with updated_at
\echo '8. Tables with updated_at Triggers:';
SELECT DISTINCT
    t.tgname as trigger_name,
    c.relname as table_name
FROM pg_trigger t
JOIN pg_class c ON t.tgrelid = c.oid
WHERE t.tgname LIKE 'update_%_updated_at'
ORDER BY c.relname;
\echo '';

-- Check enum types
\echo '9. Custom Enum Types:';
SELECT 
    t.typname as enum_name,
    string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as values
FROM pg_type t
JOIN pg_enum e ON t.oid = e.enumtypid
WHERE t.typtype = 'e'
GROUP BY t.typname
ORDER BY t.typname;
\echo '';

\echo '==========================================';
\echo 'Health Check Complete!';
\echo '==========================================';
