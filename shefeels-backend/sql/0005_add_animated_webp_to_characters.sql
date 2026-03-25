-- Add animated_webp_url_s3 column to characters table
-- Run with psql connected to your database

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS animated_webp_url_s3 TEXT;

-- Optionally initialize values from existing gif_url_s3 if you already uploaded webp versions
-- UPDATE characters SET animated_webp_url_s3 = NULL WHERE animated_webp_url_s3 IS NULL;
