-- Add new columns for voice generation and enhanced prompts to characters table
-- Migration: 0004_add_voice_and_enhanced_prompts
-- Date: 2025-11-27

-- Add prompt_enhanced column to store AI-enhanced prompt used for image generation
ALTER TABLE characters ADD COLUMN IF NOT EXISTS prompt_enhanced TEXT;

-- Add voice_prompt column to store voice description prompt for ElevenLabs
ALTER TABLE characters ADD COLUMN IF NOT EXISTS voice_prompt TEXT;

-- Add generated_voice_id column to store ElevenLabs voice ID
ALTER TABLE characters ADD COLUMN IF NOT EXISTS generated_voice_id VARCHAR(255);

-- Add comments to columns for documentation
COMMENT ON COLUMN characters.prompt_enhanced IS 'AI-enhanced prompt used for image generation';
COMMENT ON COLUMN characters.voice_prompt IS 'Voice description prompt generated for ElevenLabs text-to-voice';
COMMENT ON COLUMN characters.generated_voice_id IS 'ElevenLabs voice ID returned from text-to-voice API';
