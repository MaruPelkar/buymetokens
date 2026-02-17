import pool from '../db/client';
import { User } from '@/types';

interface GitHubUser {
  id: number;
  login: string;
  email: string;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
}

export async function exchangeCodeForToken(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID,
      client_secret: process.env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(`GitHub OAuth error: ${data.error_description}`);
  }

  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub user');
  }

  return response.json();
}

export async function getGitHubEmails(
  accessToken: string
): Promise<GitHubEmail[]> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });

  if (!response.ok) {
    throw new Error('Failed to fetch GitHub emails');
  }

  return response.json();
}

export async function findOrCreateUser(
  githubUser: GitHubUser,
  accessToken: string,
  email: string
): Promise<User> {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if user exists
    const existingUser = await client.query<User>(
      'SELECT * FROM users WHERE github_id = $1',
      [githubUser.id.toString()]
    );

    if (existingUser.rows.length > 0) {
      // Update existing user
      const updatedUser = await client.query<User>(
        `UPDATE users
         SET github_access_token = $1,
             display_name = $2,
             avatar_url = $3,
             last_login = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE github_id = $4
         RETURNING *`,
        [accessToken, githubUser.name, githubUser.avatar_url, githubUser.id.toString()]
      );

      await client.query('COMMIT');
      return updatedUser.rows[0];
    }

    // Create new user
    const newUser = await client.query<User>(
      `INSERT INTO users (
        email,
        github_id,
        github_username,
        github_access_token,
        display_name,
        avatar_url,
        last_login,
        email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, true)
      RETURNING *`,
      [
        email,
        githubUser.id.toString(),
        githubUser.login,
        accessToken,
        githubUser.name || githubUser.login,
        githubUser.avatar_url,
      ]
    );

    // Create default profile
    await client.query(
      `INSERT INTO profiles (user_id, slug, tagline)
       VALUES ($1, $2, $3)`,
      [newUser.rows[0].id, githubUser.login.toLowerCase(), 'GitHub Developer']
    );

    // Create balance record
    await client.query(
      `INSERT INTO balances (user_id)
       VALUES ($1)`,
      [newUser.rows[0].id]
    );

    await client.query('COMMIT');
    return newUser.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
