-- BuyMeTokens Database Schema
-- PostgreSQL 14+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (authentication & account info)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  github_id VARCHAR(255) UNIQUE,
  github_username VARCHAR(255),
  github_access_token TEXT, -- encrypted
  display_name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  stripe_customer_id VARCHAR(255) UNIQUE,
  stripe_account_id VARCHAR(255) UNIQUE, -- for Stripe Connect
  onboarding_completed BOOLEAN DEFAULT false
);

CREATE INDEX idx_users_github_id ON users(github_id);
CREATE INDEX idx_users_github_username ON users(github_username);
CREATE INDEX idx_users_email ON users(email);

-- Profiles table (public showcase pages)
CREATE TABLE profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., /nakulkelkar
  bio TEXT,
  tagline VARCHAR(255),
  ai_generated_bio TEXT,
  bio_edited BOOLEAN DEFAULT false,
  profile_image_url TEXT,
  cover_image_url TEXT,
  social_links JSONB, -- {twitter: "", linkedin: "", website: ""}
  donation_message TEXT DEFAULT 'Support my work with AI credits!',
  minimum_donation DECIMAL(10,2) DEFAULT 5.00,
  suggested_amounts JSONB DEFAULT '[5, 10, 25, 50]',
  theme_settings JSONB, -- color scheme, layout preferences
  is_public BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  github_sync_enabled BOOLEAN DEFAULT true,
  last_github_sync TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_profiles_slug ON profiles(slug);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_is_public ON profiles(is_public);

-- GitHub repos cache
CREATE TABLE github_repos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  repo_id BIGINT NOT NULL,
  name VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  description TEXT,
  url TEXT,
  stars INTEGER DEFAULT 0,
  forks INTEGER DEFAULT 0,
  language VARCHAR(100),
  topics JSONB,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, repo_id)
);

CREATE INDEX idx_github_repos_user_id ON github_repos(user_id);
CREATE INDEX idx_github_repos_is_featured ON github_repos(user_id, is_featured);
CREATE INDEX idx_github_repos_stars ON github_repos(stars DESC);

-- GitHub contributions
CREATE TABLE github_contributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  total_contributions INTEGER DEFAULT 0,
  contribution_data JSONB, -- weekly contribution graph data
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, year)
);

CREATE INDEX idx_github_contributions_user_id ON github_contributions(user_id);

-- Balances table (developer's available credits)
CREATE TABLE balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
  available_balance DECIMAL(10,2) DEFAULT 0.00,
  pending_balance DECIMAL(10,2) DEFAULT 0.00, -- funds in Stripe but not yet available
  lifetime_received DECIMAL(10,2) DEFAULT 0.00,
  lifetime_spent DECIMAL(10,2) DEFAULT 0.00,
  currency VARCHAR(3) DEFAULT 'USD',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_balances_user_id ON balances(user_id);

-- Transactions table (all financial movements)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'donation_received', 'openrouter_spend', 'payout', 'refund'
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(50) NOT NULL, -- 'pending', 'completed', 'failed', 'refunded'

  -- Donation-specific fields
  donor_email VARCHAR(255),
  donor_name VARCHAR(255),
  message TEXT,
  is_anonymous BOOLEAN DEFAULT false,

  -- Stripe-specific fields
  stripe_payment_intent_id VARCHAR(255),
  stripe_charge_id VARCHAR(255),
  stripe_transfer_id VARCHAR(255),
  stripe_fee DECIMAL(10,2),
  net_amount DECIMAL(10,2),

  -- OpenRouter-specific fields
  openrouter_request_id VARCHAR(255),
  model_used VARCHAR(255),
  tokens_used JSONB, -- {prompt: 0, completion: 0}

  metadata JSONB, -- flexible field for additional data
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_transactions_user_type ON transactions(user_id, type);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_stripe_payment_intent ON transactions(stripe_payment_intent_id);
CREATE INDEX idx_transactions_status ON transactions(status);

-- OpenRouter API keys (encrypted storage) - Future feature
CREATE TABLE openrouter_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  key_name VARCHAR(255) NOT NULL,
  encrypted_api_key TEXT NOT NULL, -- encrypted with app secret
  key_prefix VARCHAR(20), -- first few chars for identification
  is_active BOOLEAN DEFAULT true,
  last_used TIMESTAMP,
  total_requests INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_openrouter_keys_user_id ON openrouter_keys(user_id);
CREATE INDEX idx_openrouter_keys_is_active ON openrouter_keys(user_id, is_active);

-- API usage tracking
CREATE TABLE api_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  openrouter_key_id UUID REFERENCES openrouter_keys(id) ON DELETE SET NULL,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  model VARCHAR(255) NOT NULL,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  total_tokens INTEGER,
  cost DECIMAL(10,4),
  status VARCHAR(50), -- 'success', 'error', 'insufficient_balance'
  error_message TEXT,
  request_metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_api_usage_user_created ON api_usage_logs(user_id, created_at DESC);
CREATE INDEX idx_api_usage_model ON api_usage_logs(model);

-- Notifications table
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL, -- 'donation_received', 'low_balance', 'payout_completed'
  title VARCHAR(255) NOT NULL,
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  action_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC);

-- Webhooks log (for debugging)
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider VARCHAR(50) NOT NULL, -- 'stripe', 'github'
  event_type VARCHAR(100) NOT NULL,
  event_id VARCHAR(255) UNIQUE,
  payload JSONB,
  status VARCHAR(50), -- 'received', 'processed', 'failed'
  error_message TEXT,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_webhook_events_provider ON webhook_events(provider, event_type);
CREATE INDEX idx_webhook_events_status ON webhook_events(status);
CREATE INDEX idx_webhook_events_created ON webhook_events(created_at DESC);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_balances_updated_at BEFORE UPDATE ON balances
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_openrouter_keys_updated_at BEFORE UPDATE ON openrouter_keys
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
