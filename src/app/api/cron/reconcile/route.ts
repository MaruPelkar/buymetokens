import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [dbBalances, keyLimits] = await Promise.all([
    query<{ total: string }>(
      'SELECT COALESCE(SUM(available_balance), 0)::text AS total FROM balances'
    ),
    query<{ total: string }>(
      'SELECT COALESCE(SUM(synced_limit_remaining), 0)::text AS total FROM provisioned_keys WHERE is_active = true'
    ),
  ]);

  const dbTotal = parseFloat(dbBalances.rows[0]?.total ?? '0');
  const keyTotal = parseFloat(keyLimits.rows[0]?.total ?? '0');
  const diff = Math.abs(dbTotal - keyTotal);

  if (diff > 0.01) {
    console.warn(
      `reconcile: balance drift detected — DB total $${dbTotal.toFixed(4)}, ` +
        `OpenRouter key limits $${keyTotal.toFixed(4)}, diff $${diff.toFixed(4)}`
    );
  }

  return NextResponse.json({ dbTotal, keyTotal, diff, driftDetected: diff > 0.01 });
}
