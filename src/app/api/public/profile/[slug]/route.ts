import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/client';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    const result = await query(
      `SELECT p.slug, p.tagline, p.bio, p.donation_message,
              p.minimum_donation, p.suggested_amounts,
              p.total_supporters, p.total_received_usd,
              u.display_name, u.avatar_url, u.github_username
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.slug = $1 AND p.is_public = true`,
      [slug]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    console.error('GET /api/public/profile/[slug] error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
