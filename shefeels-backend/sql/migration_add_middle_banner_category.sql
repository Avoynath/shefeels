-- Migration to add 'middle' to banner_category_enum
-- This script should be run against the PostgreSQL database

DO $$
BEGIN
    ALTER TYPE banner_category_enum ADD VALUE 'middle';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
