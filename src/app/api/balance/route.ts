import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';

export async function GET() {
  try {
    const session = await requireAuth();

    const result = await query(
      `SELECT
         b.available_balance,
         b.pending_balance,
         b.lifetime_received,
         b.lifetime_spent,
         b.currency,
         b.updated_at,
         pk.id             AS key_id,
         pk.key_prefix,
         pk.key_name,
         pk.synced_limit_remaining,
         pk.synced_usage,
         pk.last_synced_at,
         pk.is_active      AS key_active
       FROM balances b
       LEFT JOIN provisioned_keys pk
         ON pk.user_id = b.user_id AND pk.is_active = true
       WHERE b.user_id = $1
       LIMIT 1`,
      [session.userId]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Balance not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/balance error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
