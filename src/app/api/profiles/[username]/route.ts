import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db/client';
import { getGitHubRepos, getFeaturedRepos, getContributions } from '@/lib/github/sync';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  try {
    const username = params.username;

    // Get profile data
    const profileResult = await pool.query(
      `SELECT
        p.*,
        u.github_username,
        u.avatar_url,
        u.display_name,
        u.id as user_id
       FROM profiles p
       JOIN users u ON p.user_id = u.id
       WHERE p.slug = $1 AND p.is_public = true`,
      [username]
    );

    if (profileResult.rows.length === 0) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    const profile = profileResult.rows[0];

    // Get featured repos (or top repos if no featured)
    let repos = await getFeaturedRepos(profile.user_id);
    if (repos.length === 0) {
      repos = await getGitHubRepos(profile.user_id, 6);
    }

    // Get contributions for current year
    const currentYear = new Date().getFullYear();
    const contributions = await getContributions(profile.user_id, currentYear);

    // Increment view count
    await pool.query(
      'UPDATE profiles SET view_count = view_count + 1 WHERE id = $1',
      [profile.id]
    );

    return NextResponse.json({
      profile: {
        slug: profile.slug,
        bio: profile.bio || profile.ai_generated_bio,
        tagline: profile.tagline,
        donation_message: profile.donation_message,
        social_links: profile.social_links,
        github_username: profile.github_username,
        avatar_url: profile.avatar_url,
        display_name: profile.display_name,
        view_count: profile.view_count + 1,
      },
      repos: repos.slice(0, 6),
      contributions: contributions
        ? {
            total: contributions.total_contributions,
            data: contributions.contribution_data,
          }
        : null,
    });
  } catch (error) {
    console.error('Get public profile error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
