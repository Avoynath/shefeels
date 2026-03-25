-- Create hero_banners table for managing hero section banners
-- Run this script to add banner management functionality

-- Create enum type for banner categories
CREATE TYPE banner_category_enum AS ENUM ('default', 'male', 'female', 'trans');

-- Create hero_banners table
CREATE TABLE IF NOT EXISTS hero_banners (
    id VARCHAR(32) PRIMARY KEY,
    category banner_category_enum NOT NULL UNIQUE,
    image_url TEXT NOT NULL,
    mobile_image_url TEXT,
    heading TEXT NOT NULL,
    subheading TEXT,
    cta_text VARCHAR(255),
    cta_link VARCHAR(500),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index on category for faster lookups
CREATE INDEX idx_hero_banners_category ON hero_banners(category);

-- Create index on is_active for filtering
CREATE INDEX idx_hero_banners_is_active ON hero_banners(is_active);

-- Insert default banners for each category
INSERT INTO hero_banners (id, category, image_url, heading, subheading, cta_text, cta_link, is_active)
VALUES 
    (substring(md5(random()::text) from 1 for 32), 'default', 'https://via.placeholder.com/1920x600', 'Welcome to HoneyLove', 'Your AI companion awaits', 'Get Started', '/', TRUE),
    (substring(md5(random()::text) from 1 for 32), 'male', 'https://via.placeholder.com/1920x600', 'Find Your Perfect Match', 'Explore male characters', 'Browse Now', '/characters', TRUE),
    (substring(md5(random()::text) from 1 for 32), 'female', 'https://via.placeholder.com/1920x600', 'Meet Amazing Characters', 'Discover female companions', 'Explore', '/characters', TRUE),
    (substring(md5(random()::text) from 1 for 32), 'trans', 'https://via.placeholder.com/1920x600', 'Inclusive AI Companions', 'Everyone is welcome here', 'Start Chatting', '/characters', TRUE)
ON CONFLICT (category) DO NOTHING;

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hero_banners_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_hero_banners_updated_at
    BEFORE UPDATE ON hero_banners
    FOR EACH ROW
    EXECUTE FUNCTION update_hero_banners_updated_at();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON hero_banners TO your_app_user;
