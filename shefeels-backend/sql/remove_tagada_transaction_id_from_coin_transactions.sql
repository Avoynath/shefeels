-- Remove tagada_transaction_id column from coin_transactions table
-- Migration: remove_tagada_transaction_id_from_coin_transactions
-- Date: 2025-12-28

-- Drop the index first
DROP INDEX IF EXISTS idx_coin_transactions_tagada_transaction_id;

-- Drop the column
ALTER TABLE coin_transactions 
DROP COLUMN IF EXISTS tagada_transaction_id;

-- Verify the column was removed
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'coin_transactions' AND column_name = 'tagada_transaction_id';
