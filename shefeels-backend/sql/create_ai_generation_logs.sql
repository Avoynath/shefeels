-- Create AI Generation Logs table
-- This table stores all AI-generated content including prompts, images, and metadata
-- for content moderation and future evaluation

CREATE TABLE IF NOT EXISTS ai_generation_logs (
    id VARCHAR(32) PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    character_id VARCHAR(32) REFERENCES characters(id) ON DELETE SET NULL,
    
    -- Type of generation: 'image', 'video', 'voice', etc.
    generation_type VARCHAR(50) NOT NULL DEFAULT 'image',
    
    -- The actual prompt used for generation
    prompt_text TEXT NOT NULL,
    
    -- Additional metadata in JSON format (e.g., settings, clothing, style, etc.)
    prompt_metadata JSONB,
    
    -- AI model used (e.g., 'xl_pornai', 'xl_anime', etc.)
    ai_model VARCHAR(100),
    
    -- Generation parameters
    num_generations INTEGER DEFAULT 1,
    size_orientation VARCHAR(50),
    
    -- Initial image if it was an image-to-image generation
    initial_image_s3_key TEXT,
    
    -- Generated content URLs and S3 keys (can be array for multiple generations)
    generated_content_urls TEXT[],
    generated_s3_keys TEXT[],
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, success, failed
    error_message TEXT,
    
    -- Face swap tracking (if applicable)
    face_swap_applied BOOLEAN DEFAULT FALSE,
    face_swap_source_s3_key TEXT,
    
    -- Compliance/moderation flags
    is_compliant BOOLEAN DEFAULT TRUE,
    moderation_notes TEXT,
    
    -- Source context (where the generation was triggered from)
    source_context VARCHAR(100),  -- 'chat', 'character_creation', 'character_media', etc.
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_user_id ON ai_generation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_character_id ON ai_generation_logs(character_id);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_generation_type ON ai_generation_logs(generation_type);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_created_at ON ai_generation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_status ON ai_generation_logs(status);
CREATE INDEX IF NOT EXISTS idx_ai_gen_logs_is_compliant ON ai_generation_logs(is_compliant);

-- Create a trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_generation_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_generation_logs_updated_at
    BEFORE UPDATE ON ai_generation_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_generation_logs_updated_at();

-- Add comment to the table
COMMENT ON TABLE ai_generation_logs IS 'Stores all AI-generated content with prompts for content moderation and evaluation';
COMMENT ON COLUMN ai_generation_logs.prompt_text IS 'The actual prompt sent to the AI generation service';
COMMENT ON COLUMN ai_generation_logs.prompt_metadata IS 'Additional metadata like clothing, settings, style in JSON format';
COMMENT ON COLUMN ai_generation_logs.source_context IS 'Where the generation was triggered: chat, character_creation, character_media, etc.';
