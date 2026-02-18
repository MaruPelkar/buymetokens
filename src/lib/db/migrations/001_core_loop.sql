-- BuyMeTokens Migration 001: Core Loop
-- Drops legacy tables/columns, adds Phase 1 schema

-- ─── Cleanup ────────────────────────────────────────────────────────────────

-- api_usage_logs references openrouter_keys; drop the FK column first
ALTER TABLE api_usage_logs DROP COLUMN IF EXISTS openrouter_key_id;

-- openrouter_keys is superseded by provisioned_keys
DROP TABLE IF EXISTS openrouter_keys;

-- stripe_account_id was for Stripe Connect (rejected)
ALTER TABLE users DROP COLUMN IF EXISTS stripe_account_id;

-- ─── Alter existing tables ───────────────────────────────────────────────────

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'user';

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS total_supporters INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_received_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00;

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS platform_fee DECIMAL(10,2);

-- ─── New tables ──────────────────────────────────────────────────────────────

-- provisioned_keys: one OpenRouter key per developer (hash only; plaintext shown once)
CREATE TABLE IF NOT EXISTS provisioned_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL DEFAULT 'Default',
  openrouter_key_hash VARCHAR(255) NOT NULL,  -- hash from OpenRouter response
  key_prefix VARCHAR(30) NOT NULL,             -- masked e.g. 'sk-or-v1-a3f2...c123'
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_synced_at TIMESTAMP,
  synced_limit_remaining DECIMAL(10,4) NOT NULL DEFAULT 0.00,
  synced_usage DECIMAL(10,4) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  UNIQUE (openrouter_key_hash)
);

CREATE INDEX IF NOT EXISTS idx_provisioned_keys_user
  ON provisioned_keys(user_id, is_active);

-- donation_supporters: aggregated donor→recipient roll-up for supporter wall
CREATE TABLE IF NOT EXISTS donation_supporters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  donor_email VARCHAR(255) NOT NULL,
  donor_name VARCHAR(255),
  total_donated_usd DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  donation_count INTEGER NOT NULL DEFAULT 1,
  is_anonymous BOOLEAN NOT NULL DEFAULT false,
  last_donated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (recipient_user_id, donor_email)
);

CREATE INDEX IF NOT EXISTS idx_supporters_recipient
  ON donation_supporters(recipient_user_id, total_donated_usd DESC);
