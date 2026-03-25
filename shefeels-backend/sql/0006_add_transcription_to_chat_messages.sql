-- Add transcription column to chat_messages table for storing voice message transcriptions
-- This stores the STT (Speech-to-Text) result from voice messages

ALTER TABLE chat_messages 
ADD COLUMN transcription TEXT NULL;

COMMENT ON COLUMN chat_messages.transcription IS 'Transcription of voice message (STT result from ElevenLabs)';
