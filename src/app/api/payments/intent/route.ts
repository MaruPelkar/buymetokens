import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe/client';
import { query } from '@/lib/db/client';
import { CreatePaymentIntentSchema } from '@/types/schemas';
import { Profile, User } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CreatePaymentIntentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { amount, recipientSlug, donorEmail, donorName, message, isAnonymous } = parsed.data;

    // Resolve recipient from slug
    const profileResult = await query<Profile & Pick<User, 'id'>>(
      `SELECT p.*, u.id AS user_id
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.slug = $1 AND p.is_public = true`,
      [recipientSlug]
    );

    if (!profileResult.rows.length) {
      return NextResponse.json({ error: 'Developer profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    if (amount < profile.minimum_donation) {
      return NextResponse.json(
        { error: `Minimum donation is $${profile.minimum_donation}` },
        { status: 400 }
      );
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      metadata: {
        recipientSlug,
        recipientUserId: profile.user_id,
        donorEmail: donorEmail ?? '',
        donorName: donorName ?? '',
        message: message ?? '',
        isAnonymous: String(isAnonymous),
      },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    console.error('Create payment intent error:', error);
    return NextResponse.json({ error: 'Failed to create payment' }, { status: 500 });
  }
}
