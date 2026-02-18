export interface Transaction {
  id: string;
  user_id: string;
  type: TransactionType;
  amount: number;
  currency: string;
  status: TransactionStatus;
  platform_fee: number | null;

  // Donation-specific
  donor_email: string | null;
  donor_name: string | null;
  message: string | null;
  is_anonymous: boolean;

  // Stripe-specific
  stripe_payment_intent_id: string | null;
  stripe_charge_id: string | null;
  stripe_fee: number | null;
  net_amount: number | null;

  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export type TransactionType =
  | 'donation_received'
  | 'refund';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string | null;
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export type NotificationType =
  | 'donation_received'
  | 'low_balance';

export interface WebhookEvent {
  id: string;
  provider: 'stripe' | 'github';
  event_type: string;
  event_id: string;
  payload: Record<string, unknown>;
  status: 'received' | 'processed' | 'failed';
  error_message: string | null;
  processed_at: Date | null;
  created_at: Date;
}
