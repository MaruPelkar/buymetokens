import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { query } from '@/lib/db/client';
import { Profile, User } from '@/types';

export async function GET() {
  try {
    const session = await requireAuth();

    const result = await query<Profile & Pick<User, 'display_name' | 'avatar_url' | 'github_username' | 'email' | 'role'>>(
      `SELECT p.*,
              u.display_name, u.avatar_url, u.github_username, u.email, u.role
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.user_id = $1`,
      [session.userId]
    );

    if (!result.rows.length) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    return NextResponse.json(result.rows[0]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('GET /api/profile error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
