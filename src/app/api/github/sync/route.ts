import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { syncGitHubData } from '@/lib/github/sync';
import pool from '@/lib/db/client';

export async function POST() {
  try {
    const session = await requireAuth();

    // Get user's GitHub access token
    const userResult = await pool.query(
      'SELECT github_access_token, github_username FROM users WHERE id = $1',
      [session.userId]
    );

    const user = userResult.rows[0];

    if (!user?.github_access_token || !user?.github_username) {
      return NextResponse.json(
        { error: 'GitHub access token not found' },
        { status: 400 }
      );
    }

    // Sync GitHub data
    const syncResult = await syncGitHubData(
      session.userId,
      user.github_access_token,
      user.github_username
    );

    return NextResponse.json({
      success: true,
      data: syncResult,
    });
  } catch (error) {
    console.error('GitHub sync error:', error);
    return NextResponse.json(
      { error: 'Failed to sync GitHub data' },
      { status: 500 }
    );
  }
}
