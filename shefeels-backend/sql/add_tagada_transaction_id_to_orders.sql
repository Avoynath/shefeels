-- Add tagada_transaction_id column to orders table
-- Migration: add_tagada_transaction_id_to_orders
-- Date: 2025-12-28

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS tagada_transaction_id VARCHAR(150);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_orders_tagada_transaction_id 
ON orders(tagada_transaction_id);

-- Verify the column was added
SELECT column_name, data_type, character_maximum_length 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name = 'tagada_transaction_id';
