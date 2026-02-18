import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const page = Math.max(1, parseInt(request.nextUrl.searchParams.get('page') ?? '1', 10));
    const offset = (page - 1) * PAGE_SIZE;

    const result = await query(
      `SELECT id, type, amount, currency, status, platform_fee,
              donor_email, donor_name, message, is_anonymous,
              stripe_payment_intent_id, stripe_fee, net_amount,
              created_at
       FROM transactions
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [session.userId, PAGE_SIZE, offset]
    );

    const countResult = await query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM transactions WHERE user_id = $1',
      [session.userId]
    );

    return NextResponse.json({
      transactions: result.rows,
      total: parseInt(countResult.rows[0]?.count ?? '0', 10),
      page,
      pageSize: PAGE_SIZE,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/transactions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
