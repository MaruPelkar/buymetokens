import pool from '../db/client';
import { fetchUserRepos, fetchUserContributions } from './client';

export async function syncGitHubData(userId: string, accessToken: string, username: string) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Fetch and sync repos
    const repos = await fetchUserRepos(accessToken);

    for (const repo of repos) {
      await client.query(
        `INSERT INTO github_repos (
          user_id, repo_id, name, full_name, description, url,
          stars, forks, language, topics, created_at, updated_at, synced_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP)
        ON CONFLICT (user_id, repo_id)
        DO UPDATE SET
          name = $3,
          full_name = $4,
          description = $5,
          url = $6,
          stars = $7,
          forks = $8,
          language = $9,
          topics = $10,
          updated_at = $12,
          synced_at = CURRENT_TIMESTAMP`,
        [
          userId,
          repo.repo_id,
          repo.name,
          repo.full_name,
          repo.description,
          repo.url,
          repo.stars,
          repo.forks,
          repo.language,
          JSON.stringify(repo.topics),
          repo.created_at,
          repo.updated_at,
        ]
      );
    }

    // Fetch and sync contributions for current year
    const currentYear = new Date().getFullYear();
    const contributions = await fetchUserContributions(accessToken, username, currentYear);

    await client.query(
      `INSERT INTO github_contributions (
        user_id, year, total_contributions, contribution_data, synced_at
      ) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
      ON CONFLICT (user_id, year)
      DO UPDATE SET
        total_contributions = $3,
        contribution_data = $4,
        synced_at = CURRENT_TIMESTAMP`,
      [
        userId,
        currentYear,
        contributions.total_contributions,
        JSON.stringify(contributions.contribution_data),
      ]
    );

    // Update profile's last sync time
    await client.query(
      `UPDATE profiles
       SET last_github_sync = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    return {
      repos: repos.length,
      contributions: contributions.total_contributions,
      syncedAt: new Date().toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error syncing GitHub data:', error);
    throw error;
  } finally {
    client.release();
  }
}

export async function getGitHubRepos(userId: string, limit = 20) {
  const result = await pool.query(
    `SELECT * FROM github_repos
     WHERE user_id = $1
     ORDER BY stars DESC, updated_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows;
}

export async function getFeaturedRepos(userId: string) {
  const result = await pool.query(
    `SELECT * FROM github_repos
     WHERE user_id = $1 AND is_featured = true
     ORDER BY stars DESC`,
    [userId]
  );

  return result.rows;
}

export async function getContributions(userId: string, year: number) {
  const result = await pool.query(
    `SELECT * FROM github_contributions
     WHERE user_id = $1 AND year = $2`,
    [userId, year]
  );

  return result.rows[0] || null;
}

export async function toggleFeaturedRepo(userId: string, repoId: string) {
  const result = await pool.query(
    `UPDATE github_repos
     SET is_featured = NOT is_featured
     WHERE user_id = $1 AND id = $2
     RETURNING is_featured`,
    [userId, repoId]
  );

  return result.rows[0]?.is_featured;
}
