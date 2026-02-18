import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query, transaction } from '@/lib/db/client';
import { UpdateProfileSchema } from '@/types/schemas';
import { PoolClient } from 'pg';

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();
    const parsed = UpdateProfileSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Slug availability check (if changing slug)
    if (data.slug) {
      const existing = await query<{ user_id: string }>(
        'SELECT user_id FROM profiles WHERE slug = $1',
        [data.slug]
      );
      if (existing.rows.length && existing.rows[0].user_id !== session.userId) {
        return NextResponse.json({ error: 'Slug is already taken' }, { status: 409 });
      }
    }

    await transaction(async (client: PoolClient) => {
      // Build dynamic profile UPDATE
      const profileFields: string[] = [];
      const profileValues: unknown[] = [];
      let idx = 1;

      const profileUpdateMap: Record<string, unknown> = {};
      if (data.slug !== undefined) profileUpdateMap.slug = data.slug;
      if (data.tagline !== undefined) profileUpdateMap.tagline = data.tagline;
      if (data.bio !== undefined) profileUpdateMap.bio = data.bio;
      if (data.donation_message !== undefined) profileUpdateMap.donation_message = data.donation_message;
      if (data.minimum_donation !== undefined) profileUpdateMap.minimum_donation = data.minimum_donation;
      if (data.suggested_amounts !== undefined) profileUpdateMap.suggested_amounts = JSON.stringify(data.suggested_amounts);

      for (const [col, val] of Object.entries(profileUpdateMap)) {
        profileFields.push(`${col} = $${idx++}`);
        profileValues.push(val);
      }

      if (profileFields.length > 0) {
        profileValues.push(session.userId);
        await client.query(
          `UPDATE profiles SET ${profileFields.join(', ')} WHERE user_id = $${idx}`,
          profileValues
        );
      }

      // User-level fields
      const userFields: string[] = [];
      const userValues: unknown[] = [];
      let uidx = 1;

      if (data.display_name !== undefined) {
        userFields.push(`display_name = $${uidx++}`);
        userValues.push(data.display_name);
      }
      if (data.onboarding_completed === true) {
        userFields.push(`onboarding_completed = $${uidx++}`);
        userValues.push(true);
      }

      if (userFields.length > 0) {
        userValues.push(session.userId);
        await client.query(
          `UPDATE users SET ${userFields.join(', ')} WHERE id = $${uidx}`,
          userValues
        );
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('PATCH /api/profile/update error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
