-- Complete Database Initialization Script for HoneyLove
-- This script creates all tables required for the application to work properly
-- Run this script against your PostgreSQL database

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Role Enum
DO $$ BEGIN
    CREATE TYPE role_enum AS ENUM ('user', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Chat Model Type Enum
DO $$ BEGIN
    CREATE TYPE chat_model_type AS ENUM ('standard', 'premium');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Chat Tone Enum
DO $$ BEGIN
    CREATE TYPE chat_tone_enum AS ENUM ('Standard', 'NSFW', 'Ultra-NSFW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Image Model Type Enum
DO $$ BEGIN
    CREATE TYPE image_model_type_enum AS ENUM ('text-to-image', 'image-to-image');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Speech Model Type Enum
DO $$ BEGIN
    CREATE TYPE speech_model_type_enum AS ENUM ('text-to-speech', 'speech-to-text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(32) PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    hashed_password TEXT,
    full_name TEXT,
    role role_enum NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    has_active_subscription BOOLEAN NOT NULL DEFAULT FALSE,
    payment_customer_id VARCHAR(255),
    tagada_customer_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tagada_customer_id ON users(tagada_customer_id);

-- User Profiles Table
CREATE TABLE IF NOT EXISTS user_profiles (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT,
    email_id TEXT,
    username VARCHAR(150),
    gender VARCHAR(32),
    birth_date DATE,
    profile_image_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);

-- User Activations Table
CREATE TABLE IF NOT EXISTS user_activations (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activations_user_id ON user_activations(user_id);

-- OAuth Identities Table
CREATE TABLE IF NOT EXISTS oauth_identities (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(255) NOT NULL,
    provider_user_id VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    full_name VARCHAR(255),
    avatar_url VARCHAR(500)
);

CREATE INDEX IF NOT EXISTS idx_oauth_identities_user_id ON oauth_identities(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_identities_provider ON oauth_identities(provider, provider_user_id);

-- Email Verifications Table
CREATE TABLE IF NOT EXISTS email_verifications (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    sent_to_email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_user_id ON email_verifications(user_id);

-- Password Resets Table
CREATE TABLE IF NOT EXISTS password_resets (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    consumed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user_id ON password_resets(user_id);

-- Refresh Tokens Table
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL,
    user_agent VARCHAR(500),
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ============================================================================
-- CHARACTER TABLES
-- ============================================================================

-- Characters Table
CREATE TABLE IF NOT EXISTS characters (
    id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    bio TEXT,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    gender VARCHAR(255) NOT NULL DEFAULT 'Girl',
    style VARCHAR(255),
    ethnicity VARCHAR(255),
    age INTEGER,
    eye_colour VARCHAR(255),
    hair_style VARCHAR(255),
    hair_colour VARCHAR(255),
    body_type VARCHAR(255),
    breast_size VARCHAR(255),
    butt_size VARCHAR(255),
    dick_size VARCHAR(255),
    personality TEXT,
    voice_type VARCHAR(255),
    relationship_type VARCHAR(255),
    clothing VARCHAR(255),
    special_features TEXT,
    background TEXT,
    prompt TEXT NOT NULL,
    prompt_enhanced TEXT,
    voice_prompt TEXT,
    generated_voice_id VARCHAR(255),
    image_url_s3 TEXT,
    privacy VARCHAR(255) DEFAULT 'private',
    onlyfans_url TEXT,
    fanvue_url TEXT,
    tiktok_url TEXT,
    instagram_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_privacy ON characters(privacy);

-- Character Stats Table
CREATE TABLE IF NOT EXISTS character_stats (
    id VARCHAR(32) PRIMARY KEY,
    character_id VARCHAR(32) NOT NULL REFERENCES characters(id),
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    liked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_stats_character_id ON character_stats(character_id);
CREATE INDEX IF NOT EXISTS idx_character_stats_user_id ON character_stats(user_id);

-- Character Media Table
CREATE TABLE IF NOT EXISTS character_media (
    id VARCHAR(32) PRIMARY KEY,
    character_id VARCHAR(32) REFERENCES characters(id) ON DELETE CASCADE,
    user_id VARCHAR(32) REFERENCES users(id) ON DELETE CASCADE,
    media_type VARCHAR(255) NOT NULL DEFAULT 'image',
    s3_path TEXT UNIQUE NOT NULL,
    mime_type VARCHAR(255) NOT NULL DEFAULT 'image/png',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_character_media_character_id ON character_media(character_id);
CREATE INDEX IF NOT EXISTS idx_character_media_user_id ON character_media(user_id);

-- Character Media Likes Table
CREATE TABLE IF NOT EXISTS character_media_likes (
    id SERIAL PRIMARY KEY,
    character_media_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    liked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT _user_media_like_unique UNIQUE (character_media_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_character_media_likes_user_id ON character_media_likes(user_id);

-- ============================================================================
-- CHAT TABLES
-- ============================================================================

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
    id VARCHAR(32) PRIMARY KEY,
    session_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    character_id VARCHAR(32) NOT NULL REFERENCES characters(id),
    user_query TEXT NOT NULL,
    ai_message TEXT,
    debug_ai_message TEXT,
    transcription TEXT,
    context_window INTEGER,
    is_media_available BOOLEAN DEFAULT FALSE,
    media_type VARCHAR(250),
    s3_url_media TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_character_id ON chat_messages(character_id);

-- ============================================================================
-- GEO & SESSION TRACKING TABLES
-- ============================================================================

-- IP Location Cache Table
CREATE TABLE IF NOT EXISTS ip_location_cache (
    ip VARCHAR(45) PRIMARY KEY,
    country_code VARCHAR(2),
    country_name VARCHAR(64),
    region VARCHAR(128),
    city VARCHAR(128),
    source VARCHAR(16),
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_location_cache_country_code ON ip_location_cache(country_code);
CREATE INDEX IF NOT EXISTS idx_ip_location_cache_city ON ip_location_cache(city);

-- User IP History Table
CREATE TABLE IF NOT EXISTS user_ip_history (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    ip VARCHAR(45) NOT NULL,
    location_country_code VARCHAR(2),
    location_city VARCHAR(128),
    first_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_user_ip_history_user_ip UNIQUE (user_id, ip)
);

CREATE INDEX IF NOT EXISTS idx_user_ip_history_user_id ON user_ip_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_ip_history_ip ON user_ip_history(ip);

-- Visit Sessions Table
CREATE TABLE IF NOT EXISTS visit_sessions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) REFERENCES users(id),
    first_ip VARCHAR(45),
    first_country_code VARCHAR(2),
    first_city VARCHAR(128),
    user_agent TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    referrer TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_visit_sessions_user_id ON visit_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_started_at ON visit_sessions(started_at);

-- Request Events Table
CREATE TABLE IF NOT EXISTS request_events (
    id VARCHAR(32) PRIMARY KEY,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    visitor_session_id VARCHAR(64),
    user_id VARCHAR(32),
    path TEXT,
    event_name TEXT NOT NULL,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    ip TEXT,
    country_code TEXT,
    city TEXT,
    user_agent TEXT,
    properties JSONB
);

CREATE INDEX IF NOT EXISTS idx_request_events_created_at ON request_events(created_at);
CREATE INDEX IF NOT EXISTS idx_request_events_user_id ON request_events(user_id);

-- ============================================================================
-- SUBSCRIPTION & PAYMENT TABLES
-- ============================================================================

-- Pricing Plan Table
CREATE TABLE IF NOT EXISTS pricing_plan (
    id VARCHAR(32) PRIMARY KEY,
    plan_name VARCHAR(255) NOT NULL,
    pricing_id VARCHAR(255) UNIQUE NOT NULL,
    coupon VARCHAR(255) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    price NUMERIC(10, 2) NOT NULL,
    discount NUMERIC(10, 2),
    billing_cycle VARCHAR(50) NOT NULL,
    coin_reward INTEGER NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Promo Management Table
CREATE TABLE IF NOT EXISTS promo_management (
    id VARCHAR(32) PRIMARY KEY,
    promo_name VARCHAR(255) NOT NULL,
    discount_type VARCHAR(50) NOT NULL,
    coupon VARCHAR(100) UNIQUE NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    percent_off NUMERIC(5, 2) NOT NULL,
    start_date TIMESTAMP WITH TIME ZONE,
    expiry_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    applied_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_coupon_upper CHECK (coupon = UPPER(coupon)),
    CONSTRAINT chk_percent_range CHECK (percent_off >= 0 AND percent_off <= 100),
    CONSTRAINT chk_dates_order CHECK (expiry_date IS NULL OR start_date IS NULL OR start_date <= expiry_date)
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id VARCHAR(32) PRIMARY KEY,
    promo_id VARCHAR(32),
    promo_code VARCHAR(100),
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    pricing_id VARCHAR(255) REFERENCES pricing_plan(pricing_id) ON DELETE RESTRICT,
    provider VARCHAR(50),
    provider_order_ref VARCHAR(150),
    provider_txid_in VARCHAR(150),
    provider_txid_out VARCHAR(150),
    provider_coin VARCHAR(50),
    paid_value_coin NUMERIC(18, 6),
    discount_type VARCHAR(100),
    discount_applied NUMERIC(10, 2) NOT NULL DEFAULT 0,
    subtotal_at_apply NUMERIC(10, 2) NOT NULL,
    currency CHAR(3) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    paygate_ipn_token TEXT,
    paygate_address_in TEXT,
    applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip VARCHAR(45),
    country_code VARCHAR(2),
    city VARCHAR(128),
    visitor_session_id VARCHAR(32) REFERENCES visit_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_country_code ON orders(country_code);

-- Subscriptions Table
CREATE TABLE IF NOT EXISTS subscriptions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    payment_customer_id VARCHAR(50) NOT NULL,
    subscription_id VARCHAR(50) UNIQUE,
    tagada_subscription_id VARCHAR(50) UNIQUE,
    tagada_customer_id VARCHAR(50),
    order_id VARCHAR(32) REFERENCES orders(id),
    price_id VARCHAR(32),
    plan_name VARCHAR(32),
    status VARCHAR(32) NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE,
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancel_at_period_end BOOLEAN DEFAULT FALSE,
    last_rewarded_period_end TIMESTAMP WITH TIME ZONE,
    total_coins_rewarded INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    signup_ip VARCHAR(45),
    signup_country_code VARCHAR(2),
    signup_city VARCHAR(128)
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_tagada_subscription_id ON subscriptions(tagada_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_signup_country_code ON subscriptions(signup_country_code);

-- User Wallets Table
CREATE TABLE IF NOT EXISTS user_wallets (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    coin_balance INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets(user_id);

-- Coin Transactions Table
CREATE TABLE IF NOT EXISTS coin_transactions (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id VARCHAR(32) REFERENCES characters(id) ON DELETE SET NULL,
    transaction_type VARCHAR(50) NOT NULL,
    coins INTEGER NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    order_id VARCHAR(50),
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    ip VARCHAR(45),
    country_code VARCHAR(2),
    city VARCHAR(128),
    visitor_session_id VARCHAR(32) REFERENCES visit_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_country_code ON coin_transactions(country_code);

-- Token Topups Table
CREATE TABLE IF NOT EXISTS token_topups (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tokens INTEGER NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    product_id VARCHAR(64),
    order_id VARCHAR(64),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_token_topups_user_id ON token_topups(user_id);

-- ============================================================================
-- MEDIA PACK TABLES
-- ============================================================================

-- Media Packs Table
CREATE TABLE IF NOT EXISTS media_packs (
    id VARCHAR(32) PRIMARY KEY,
    character_id VARCHAR(32) NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
    created_by VARCHAR(32) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price_tokens INTEGER NOT NULL DEFAULT 100,
    num_images INTEGER NOT NULL DEFAULT 0,
    num_videos INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    thumbnail_s3_path TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_packs_character_id ON media_packs(character_id);
CREATE INDEX IF NOT EXISTS idx_media_packs_created_by ON media_packs(created_by);

-- Media Pack Media Table
CREATE TABLE IF NOT EXISTS media_pack_media (
    id VARCHAR(32) PRIMARY KEY,
    media_pack_id VARCHAR(32) NOT NULL REFERENCES media_packs(id) ON DELETE CASCADE,
    character_media_id VARCHAR(32) NOT NULL REFERENCES character_media(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_media_pack_media_media_pack_id ON media_pack_media(media_pack_id);

-- User Media Pack Access Table
CREATE TABLE IF NOT EXISTS user_media_pack_access (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    media_pack_id VARCHAR(32) NOT NULL REFERENCES media_packs(id) ON DELETE CASCADE,
    unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT _user_pack_unique UNIQUE (user_id, media_pack_id)
);

CREATE INDEX IF NOT EXISTS idx_user_media_pack_access_user_id ON user_media_pack_access(user_id);

-- ============================================================================
-- MODEL CONFIGURATION TABLES
-- ============================================================================

-- Chat Model Table
CREATE TABLE IF NOT EXISTS chat_model (
    id SERIAL PRIMARY KEY,
    model_type chat_model_type NOT NULL,
    endpoint_id VARCHAR(255) NOT NULL,
    chat_tone chat_tone_enum NOT NULL,
    prompt_standard TEXT,
    prompt_nsfw TEXT,
    prompt_ultra_nsfw TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Image Model Table
CREATE TABLE IF NOT EXISTS image_model (
    id SERIAL PRIMARY KEY,
    model_type image_model_type_enum NOT NULL,
    endpoint_id VARCHAR(255) NOT NULL,
    prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Speech Model Table
CREATE TABLE IF NOT EXISTS speech_model (
    id SERIAL PRIMARY KEY,
    model_type speech_model_type_enum NOT NULL,
    endpoint_id VARCHAR(255) NOT NULL,
    prompt TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- USAGE METRICS & CONFIG TABLES
-- ============================================================================

-- Usage Metrics Table
CREATE TABLE IF NOT EXISTS usage_metrics (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id),
    character_id VARCHAR(32) NOT NULL REFERENCES characters(id),
    tokens_input INTEGER DEFAULT 0,
    tokens_output INTEGER DEFAULT 0,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_metrics_user_id ON usage_metrics(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_character_id ON usage_metrics(character_id);

-- App Config Table
CREATE TABLE IF NOT EXISTS app_config (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL,
    parameter_name VARCHAR(255) UNIQUE NOT NULL,
    parameter_value TEXT NOT NULL,
    parameter_description TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at columns
DO $$
DECLARE
    t text;
BEGIN
    FOR t IN 
        SELECT table_name 
        FROM information_schema.columns 
        WHERE column_name = 'updated_at' 
        AND table_schema = 'public'
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS update_%s_updated_at ON %s', t, t);
        EXECUTE format('CREATE TRIGGER update_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', t, t);
    END LOOP;
END;
$$;

-- ============================================================================
-- COMPLETION MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Database initialization complete!';
    RAISE NOTICE 'All tables, indexes, and constraints have been created successfully.';
END $$;
