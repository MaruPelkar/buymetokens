import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { generateProfileBio, generateTagline } from '@/lib/openai/client';
import { getGitHubRepos, getContributions } from '@/lib/github/sync';
import pool from '@/lib/db/client';

export async function POST() {
  try {
    const session = await requireAuth();

    // Get user's GitHub username
    const userResult = await pool.query(
      'SELECT github_username FROM users WHERE id = $1',
      [session.userId]
    );

    const username = userResult.rows[0]?.github_username;

    if (!username) {
      return NextResponse.json(
        { error: 'GitHub username not found' },
        { status: 400 }
      );
    }

    // Get repos and contributions
    const repos = await getGitHubRepos(session.userId, 20);
    const currentYear = new Date().getFullYear();
    const contributions = await getContributions(session.userId, currentYear);

    // Calculate top languages
    const languageCount: Record<string, number> = {};
    repos.forEach((repo) => {
      if (repo.language) {
        languageCount[repo.language] = (languageCount[repo.language] || 0) + 1;
      }
    });

    const topLanguages = Object.entries(languageCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([lang]) => lang);

    // Generate bio and tagline
    const [bio, tagline] = await Promise.all([
      generateProfileBio({
        username,
        repos: repos.map((r) => ({
          name: r.name,
          description: r.description,
          language: r.language,
          stars: r.stars,
        })),
        totalContributions: contributions?.total_contributions || 0,
        topLanguages,
      }),
      generateTagline(username, topLanguages),
    ]);

    // Update profile with AI-generated content
    await pool.query(
      `UPDATE profiles
       SET ai_generated_bio = $1, tagline = $2
       WHERE user_id = $3`,
      [bio, tagline, session.userId]
    );

    return NextResponse.json({
      success: true,
      data: { bio, tagline },
    });
  } catch (error) {
    console.error('Bio generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate bio' },
      { status: 500 }
    );
  }
}
