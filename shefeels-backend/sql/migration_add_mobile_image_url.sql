-- Migration: add mobile_image_url to hero_banners

ALTER TABLE hero_banners
ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;

-- backfill mobile_image_url to NULL for safety (no-op)
UPDATE hero_banners SET mobile_image_url = NULL WHERE mobile_image_url IS NULL;

-- create index if desired (not necessary but useful for queries)
-- CREATE INDEX IF NOT EXISTS idx_hero_banners_mobile_image_url ON hero_banners(mobile_image_url);
