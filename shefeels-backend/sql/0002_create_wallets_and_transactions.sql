-- SQL-only migration: create user_wallets and coin_transactions
-- Run this against your development DB using psql or your DB client.
-- WARNING: run on dev DB first and ensure credentials/host are correct.

BEGIN;

-- user_wallets: keep schema in sync with SQLAlchemy model
CREATE TABLE IF NOT EXISTS public.user_wallets (
  id varchar(32) PRIMARY KEY,
  user_id varchar(32) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  coin_balance integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- coin_transactions: audit table for credits/debits
CREATE TABLE IF NOT EXISTS public.coin_transactions (
  id varchar(32) PRIMARY KEY,
  user_id varchar(32) NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  character_id varchar(32) NULL REFERENCES public.characters(id) ON DELETE SET NULL,
  transaction_type varchar(50) NOT NULL,
  coins integer NOT NULL,
  source_type varchar(50) NOT NULL,
  order_id varchar(50),
  period_start timestamp NULL,
  period_end timestamp NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  ip varchar(45) NULL,
  country_code varchar(2) NULL,
  city varchar(128) NULL,
  visitor_session_id varchar(32) NULL
);

-- Helpful index for querying by user and/or country
CREATE INDEX IF NOT EXISTS ix_coin_transactions_user_id ON public.coin_transactions (user_id);
CREATE INDEX IF NOT EXISTS ix_coin_transactions_country_code ON public.coin_transactions (country_code);

COMMIT;

-- Rollback statements (if you need to drop these tables manually):
-- DROP TABLE IF EXISTS public.coin_transactions;
-- DROP TABLE IF EXISTS public.user_wallets;
