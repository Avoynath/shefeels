-- Add tagada_transaction_id column to coin_transactions table
-- Migration: add_tagada_transaction_id_to_coin_transactions
-- Date: 2025-12-28

ALTER TABLE coin_transactions 
ADD COLUMN IF NOT EXISTS tagada_transaction_id VARCHAR(150);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_coin_transactions_tagada_transaction_id 
ON coin_transactions(tagada_transaction_id);

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'coin_transactions' AND column_name = 'tagada_transaction_id';
