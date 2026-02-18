import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query, transaction } from '@/lib/db/client';
import { disableKey } from '@/lib/openrouter/keys';
import { PoolClient } from 'pg';

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ keyId: string }> }
) {
  try {
    const session = await requireAuth();
    const { keyId } = await params;

    const existing = await query<{ openrouter_key_hash: string }>(
      'SELECT openrouter_key_hash FROM provisioned_keys WHERE id = $1 AND user_id = $2 AND is_active = true',
      [keyId, session.userId]
    );

    if (!existing.rows.length) {
      return NextResponse.json({ error: 'Key not found' }, { status: 404 });
    }

    const { openrouter_key_hash } = existing.rows[0];

    // Disable on OpenRouter first (best effort)
    try {
      await disableKey(openrouter_key_hash);
    } catch (err) {
      console.error('Failed to disable key on OpenRouter:', err);
      // Continue — mark revoked in DB regardless
    }

    await transaction(async (client: PoolClient) => {
      await client.query(
        `UPDATE provisioned_keys
         SET is_active = false, revoked_at = NOW()
         WHERE id = $1`,
        [keyId]
      );
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('DELETE /api/api-keys/[keyId] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
