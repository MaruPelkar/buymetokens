import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query, transaction } from '@/lib/db/client';
import { createProvisionedKey } from '@/lib/openrouter/keys';
import { CreateApiKeySchema } from '@/types/schemas';
import { PoolClient } from 'pg';

export async function GET() {
  try {
    const session = await requireAuth();

    const result = await query(
      `SELECT id, key_name, key_prefix, is_active, synced_limit_remaining,
              synced_usage, last_synced_at, created_at, revoked_at
       FROM provisioned_keys
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [session.userId]
    );

    return NextResponse.json({ keys: result.rows });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = CreateApiKeySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    // Only one active key per user
    const existing = await query(
      'SELECT id FROM provisioned_keys WHERE user_id = $1 AND is_active = true',
      [session.userId]
    );
    if (existing.rows.length) {
      return NextResponse.json(
        { error: 'You already have an active API key. Revoke it before creating a new one.' },
        { status: 409 }
      );
    }

    const keyName = parsed.data.name ?? 'Default';
    const { plaintext, hash, prefix } = await createProvisionedKey(keyName);

    let newKeyId: string;
    await transaction(async (client: PoolClient) => {
      const result = await client.query<{ id: string }>(
        `INSERT INTO provisioned_keys (user_id, key_name, openrouter_key_hash, key_prefix)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [session.userId, keyName, hash, prefix]
      );
      newKeyId = result.rows[0].id;
    });

    return NextResponse.json({
      id: newKeyId!,
      key_name: keyName,
      key_prefix: prefix,
      // plaintext returned ONCE — never stored, never returned again
      plaintext,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('POST /api/api-keys error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
