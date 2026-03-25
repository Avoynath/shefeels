-- Add gif_url_s3 column to characters table
-- Run this with psql or any SQL client connected to your database

ALTER TABLE characters
ADD COLUMN IF NOT EXISTS gif_url_s3 TEXT;

-- Optionally, you can set gif_url_s3 for existing rows here (example):
-- UPDATE characters SET gif_url_s3 = NULL WHERE gif_url_s3 IS NULL;
