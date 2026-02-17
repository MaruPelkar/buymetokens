export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  donor_email: string | null;
  donor_name: string | null;
  message: string | null;
  is_anonymous: boolean;
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_transfer_id: string | null;
  stripe_fee: number | null;
  net_amount: number | null;
  openrouter_request_id: string | null;
  model_used: string | null;
  tokens_used: TokenUsage | null;
  metadata: Record<string, any> | null;
  created_at: Date;
  updated_at: Date;
}

export type TransactionType =
  | 'donation_received'
  | 'openrouter_spend'
  | 'payout'
  | 'refund';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface TokenUsage {
  prompt: number;
  completion: number;
}

export interface ApiUsageLog {
  id: string;
  user_id: string;
  openrouter_key_id: string | null;
  transaction_id: string | null;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost: number;
  status: 'success' | 'error' | 'insufficient_balance';
  error_message: string | null;
  request_metadata: Record<string, any> | null;
  created_at: Date;
}

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, any> | null;
  created_at: Date;
}

export type NotificationType =
  | 'donation_received'
  | 'low_balance'
  | 'payout_completed';

export interface WebhookEvent {
  id: string;
  provider: 'stripe' | 'github';
  event_type: string;
  event_id: string;
  payload: Record<string, any>;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
}
