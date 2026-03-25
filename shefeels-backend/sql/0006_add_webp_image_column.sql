-- Add webp_image_url_s3 column to store static WebP version of character images
-- This is separate from animated_webp_url_s3 (which is for hover animations)

ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS webp_image_url_s3 TEXT;

-- Comment explaining the column
COMMENT ON COLUMN characters.webp_image_url_s3 IS 'S3 key for WebP version of character image (static, for faster loading)';
