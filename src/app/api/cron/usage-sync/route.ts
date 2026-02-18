import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';
import { getKeyStatus } from '@/lib/openrouter/keys';

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const keysResult = await query<{
    id: string;
    user_id: string;
    openrouter_key_hash: string;
  }>(
    'SELECT id, user_id, openrouter_key_hash FROM provisioned_keys WHERE is_active = true'
  );

  const results = await Promise.allSettled(
    keysResult.rows.map(async (key) => {
      const status = await getKeyStatus(key.openrouter_key_hash);

      await query(
        `UPDATE provisioned_keys
         SET synced_limit_remaining = $1,
             synced_usage = $2,
             last_synced_at = NOW()
         WHERE id = $3`,
        [status.limit_remaining, status.usage, key.id]
      );

      await query(
        `UPDATE balances
         SET available_balance = $1, updated_at = NOW()
         WHERE user_id = $2`,
        [status.limit_remaining, key.user_id]
      );
    })
  );

  const failed = results.filter((r) => r.status === 'rejected');
  if (failed.length) {
    console.error(`usage-sync: ${failed.length} key(s) failed to sync`, failed);
  }

  return NextResponse.json({
    synced: keysResult.rows.length,
    failed: failed.length,
  });
}
