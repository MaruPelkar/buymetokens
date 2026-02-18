export interface ProvisionedKey {
  id: string;
  user_id: string;
  key_name: string;
  openrouter_key_hash: string;
  key_prefix: string;          // masked display: 'sk-or-v1-a3f2...c123'
  is_active: boolean;
  last_synced_at: Date | null;
  synced_limit_remaining: number;
  synced_usage: number;
  created_at: Date;
  revoked_at: Date | null;
}

export interface DonationSupporter {
  id: string;
  recipient_user_id: string;
  donor_email: string;
  donor_name: string | null;
  total_donated_usd: number;
  donation_count: number;
  is_anonymous: boolean;
  last_donated_at: Date;
}
