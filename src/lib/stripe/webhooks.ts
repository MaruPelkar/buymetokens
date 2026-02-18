import Stripe from 'stripe';
import { stripe } from './client';
import { transaction } from '@/lib/db/client';
import { updateKeyLimit } from '@/lib/openrouter/keys';
import { PoolClient } from 'pg';

const PLATFORM_FEE_PERCENT = parseFloat(process.env.PLATFORM_FEE_PERCENT || '5');

export function validateWebhookSignature(rawBody: string, signature: string): Stripe.Event {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

export async function handlePaymentIntentSucceeded(
  paymentIntent: Stripe.PaymentIntent
): Promise<void> {
  const { metadata } = paymentIntent;
  const recipientUserId = metadata?.recipientUserId;
  const donorEmail = metadata?.donorEmail || null;
  const donorName = metadata?.donorName || null;
  const message = metadata?.message || null;
  const isAnonymous = metadata?.isAnonymous === 'true';
  const eventId = `pi_succeeded_${paymentIntent.id}`;

  if (!recipientUserId) {
    console.error('Webhook: missing recipientUserId in metadata', paymentIntent.id);
    return;
  }

  // Fetch the charge to get the actual Stripe fee
  let stripeFeeUsd = 0;
  try {
    const charge = await stripe.charges.retrieve(paymentIntent.latest_charge as string, {
      expand: ['balance_transaction'],
    });
    const bt = charge.balance_transaction as Stripe.BalanceTransaction | null;
    if (bt) stripeFeeUsd = bt.fee / 100;
  } catch (err) {
    console.error('Webhook: failed to fetch charge for fee calculation', err);
    // Estimate: 2.9% + $0.30
    stripeFeeUsd = paymentIntent.amount / 100 * 0.029 + 0.30;
  }

  const amountUsd = paymentIntent.amount / 100;
  const platformFee = parseFloat((amountUsd * PLATFORM_FEE_PERCENT / 100).toFixed(2));
  const netUsd = parseFloat((amountUsd - stripeFeeUsd - platformFee).toFixed(2));

  let newBalance = 0;
  let openrouterHash: string | null = null;

  await transaction(async (client: PoolClient) => {
    // 1. Idempotency: insert webhook event, throw on duplicate (caught as unique violation)
    await client.query(
      `INSERT INTO webhook_events (event_id, provider, event_type, payload, status)
       VALUES ($1, 'stripe', 'payment_intent.succeeded', $2, 'received')`,
      [eventId, JSON.stringify(paymentIntent)]
    );

    // 2. Insert transaction record
    await client.query(
      `INSERT INTO transactions
         (user_id, type, amount, currency, status, donor_email, donor_name,
          message, is_anonymous, stripe_payment_intent_id, stripe_fee, net_amount, platform_fee)
       VALUES ($1, 'donation_received', $2, 'USD', 'completed', $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        recipientUserId, amountUsd, donorEmail, donorName,
        message, isAnonymous, paymentIntent.id,
        stripeFeeUsd, netUsd, platformFee,
      ]
    );

    // 3. Credit developer balance
    const balResult = await client.query<{ available_balance: string }>(
      `UPDATE balances
       SET available_balance = available_balance + $1,
           lifetime_received = lifetime_received + $1
       WHERE user_id = $2
       RETURNING available_balance`,
      [netUsd, recipientUserId]
    );
    newBalance = parseFloat(balResult.rows[0]?.available_balance ?? '0');

    // 4. Upsert donation_supporters
    if (donorEmail) {
      await client.query(
        `INSERT INTO donation_supporters
           (recipient_user_id, donor_email, donor_name, total_donated_usd, donation_count, is_anonymous, last_donated_at)
         VALUES ($1, $2, $3, $4, 1, $5, NOW())
         ON CONFLICT (recipient_user_id, donor_email) DO UPDATE
           SET total_donated_usd = donation_supporters.total_donated_usd + EXCLUDED.total_donated_usd,
               donation_count    = donation_supporters.donation_count + 1,
               donor_name        = COALESCE(EXCLUDED.donor_name, donation_supporters.donor_name),
               is_anonymous      = EXCLUDED.is_anonymous,
               last_donated_at   = NOW()`,
        [recipientUserId, donorEmail, donorName, netUsd, isAnonymous]
      );
    }

    // 5. Update profile aggregate stats
    await client.query(
      `UPDATE profiles
       SET total_received_usd = total_received_usd + $1,
           total_supporters   = (
             SELECT COUNT(DISTINCT donor_email)
             FROM donation_supporters
             WHERE recipient_user_id = $2
           )
       WHERE user_id = $2`,
      [netUsd, recipientUserId]
    );

    // 6. Fetch OpenRouter key hash for limit update after commit
    const keyResult = await client.query<{ openrouter_key_hash: string }>(
      `SELECT openrouter_key_hash FROM provisioned_keys
       WHERE user_id = $1 AND is_active = true
       LIMIT 1`,
      [recipientUserId]
    );
    openrouterHash = keyResult.rows[0]?.openrouter_key_hash ?? null;

    // 7. Mark webhook as processed
    await client.query(
      `UPDATE webhook_events SET status = 'processed', processed_at = NOW()
       WHERE event_id = $1`,
      [eventId]
    );
  });

  // After DB commit: update OpenRouter key limit (failure is tolerable — cron reconciles)
  if (openrouterHash && newBalance > 0) {
    try {
      await updateKeyLimit(openrouterHash, newBalance);
    } catch (err) {
      console.error(
        `Webhook: OpenRouter key limit update failed for user ${recipientUserId}. ` +
        `Balance credited to DB ($${newBalance}). Cron will reconcile.`,
        err
      );
    }
  }
}
