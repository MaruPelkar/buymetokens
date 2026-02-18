import { NextRequest, NextResponse } from 'next/server';
import { validateWebhookSignature, handlePaymentIntentSucceeded } from '@/lib/stripe/webhooks';
import Stripe from 'stripe';

// Stripe requires the raw body for signature verification
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = validateWebhookSignature(rawBody, signature);
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;
      default:
        // Silently acknowledge unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;

    // Unique constraint violation on webhook_events.event_id = already processed
    if (code === '23505') {
      return NextResponse.json({ received: true });
    }

    console.error(`Stripe webhook handler error [${event.type}]:`, err);
    // Return 500 → Stripe will retry
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
