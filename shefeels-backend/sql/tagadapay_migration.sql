-- TagadaPay Integration - Database Schema Changes
-- Run this SQL script to add TagadaPay fields to existing tables
-- Date: 2025-11-28

-- ====================================================================
-- 1. Add TagadaPay customer ID to users table
-- ====================================================================

-- Check if column exists before adding (PostgreSQL)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'tagada_customer_id'
    ) THEN
        ALTER TABLE users 
        ADD COLUMN tagada_customer_id VARCHAR(50) NULL;
        
        RAISE NOTICE 'Added tagada_customer_id to users table';
    ELSE
        RAISE NOTICE 'Column tagada_customer_id already exists in users table';
    END IF;
END $$;

-- ====================================================================
-- 2. Add TagadaPay fields to subscriptions table
-- ====================================================================

-- Add tagada_subscription_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'tagada_subscription_id'
    ) THEN
        ALTER TABLE subscriptions 
        ADD COLUMN tagada_subscription_id VARCHAR(50) NULL;
        
        RAISE NOTICE 'Added tagada_subscription_id to subscriptions table';
    ELSE
        RAISE NOTICE 'Column tagada_subscription_id already exists in subscriptions table';
    END IF;
END $$;

-- Add tagada_customer_id column
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'subscriptions' 
        AND column_name = 'tagada_customer_id'
    ) THEN
        ALTER TABLE subscriptions 
        ADD COLUMN tagada_customer_id VARCHAR(50) NULL;
        
        RAISE NOTICE 'Added tagada_customer_id to subscriptions table';
    ELSE
        RAISE NOTICE 'Column tagada_customer_id already exists in subscriptions table';
    END IF;
END $$;

-- ====================================================================
-- 3. Create indexes for better query performance
-- ====================================================================

-- Unique index on tagada_subscription_id (prevents duplicates)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'subscriptions' 
        AND indexname = 'idx_subscriptions_tagada_subscription_id'
    ) THEN
        CREATE UNIQUE INDEX idx_subscriptions_tagada_subscription_id 
        ON subscriptions(tagada_subscription_id) 
        WHERE tagada_subscription_id IS NOT NULL;
        
        RAISE NOTICE 'Created unique index on tagada_subscription_id';
    ELSE
        RAISE NOTICE 'Index idx_subscriptions_tagada_subscription_id already exists';
    END IF;
END $$;

-- Index on tagada_customer_id for faster lookups
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE tablename = 'users' 
        AND indexname = 'idx_users_tagada_customer_id'
    ) THEN
        CREATE INDEX idx_users_tagada_customer_id 
        ON users(tagada_customer_id) 
        WHERE tagada_customer_id IS NOT NULL;
        
        RAISE NOTICE 'Created index on users.tagada_customer_id';
    ELSE
        RAISE NOTICE 'Index idx_users_tagada_customer_id already exists';
    END IF;
END $$;

-- ====================================================================
-- 4. Verification queries
-- ====================================================================

-- Show the new columns
SELECT 
    'users' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
AND column_name = 'tagada_customer_id'

UNION ALL

SELECT 
    'subscriptions' as table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions' 
AND column_name IN ('tagada_subscription_id', 'tagada_customer_id')
ORDER BY table_name, column_name;

-- Show the new indexes
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'subscriptions')
AND indexname LIKE '%tagada%'
ORDER BY tablename, indexname;

-- ====================================================================
-- MIGRATION COMPLETE
-- ====================================================================

-- Summary:
-- ✅ users.tagada_customer_id (VARCHAR(50), NULL, indexed)
-- ✅ subscriptions.tagada_subscription_id (VARCHAR(50), NULL, unique indexed)
-- ✅ subscriptions.tagada_customer_id (VARCHAR(50), NULL)
-- 
-- These changes are safe to run multiple times (idempotent).
-- All new columns are nullable, so existing rows are not affected.
-- Indexes improve query performance and prevent duplicate subscriptions.
