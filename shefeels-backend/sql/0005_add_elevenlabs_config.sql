-- Add ElevenLabs configuration entries to app_config table
-- Migration: 0005_add_elevenlabs_config
-- Date: 2025-11-27

INSERT INTO app_config (category, parameter_name, parameter_value, parameter_description, created_at, updated_at)
VALUES 
(
    'VoiceAPI', 
    'ELEVENLABS_API_KEY', 
    'sk_1d16d4b1ff8f4eec593ee63890f0c19ac81cd312e5d475ef', 
    'ElevenLabs API key for voice generation (text-to-voice)', 
    NOW(), 
    NOW()
),
(
    'VoiceAPI', 
    'ELEVENLABS_MODEL_ID', 
    'eleven_flash_v2_5', 
    'ElevenLabs model ID for text-to-speech synthesis', 
    NOW(), 
    NOW()
)
ON CONFLICT (parameter_name) DO UPDATE 
SET 
    parameter_description = EXCLUDED.parameter_description,
    updated_at = NOW();

-- Note: The API key and model are already set to production values above
-- If you need to update them later, use:
-- UPDATE app_config SET parameter_value = 'your_new_key' WHERE parameter_name = 'ELEVENLABS_API_KEY';
-- UPDATE app_config SET parameter_value = 'your_model_id' WHERE parameter_name = 'ELEVENLABS_MODEL_ID';
