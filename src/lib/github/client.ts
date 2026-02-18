import { Octokit } from '@octokit/rest';

export function createGitHubClient(accessToken: string) {
  return new Octokit({
    auth: accessToken,
  });
}

export async function fetchUserRepos(accessToken: string) {
  const octokit = createGitHubClient(accessToken);

  try {
    const { data } = await octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
      visibility: 'public',
    });

    return data.map((repo) => ({
      repo_id: repo.id,
      name: repo.name,
      full_name: repo.full_name,
      description: repo.description,
      url: repo.html_url,
      stars: repo.stargazers_count,
      forks: repo.forks_count,
      language: repo.language,
      topics: repo.topics || [],
      created_at: repo.created_at,
      updated_at: repo.updated_at,
    }));
  } catch (error) {
    console.error('Error fetching GitHub repos:', error);
    throw error;
  }
}

export async function fetchUserContributions(
  accessToken: string,
  username: string,
  year: number
) {
  const octokit = createGitHubClient(accessToken);

  try {
    const fromDate = `${year}-01-01T00:00:00Z`;
    const toDate = `${year}-12-31T23:59:59Z`;

    const query = `
      query($username: String!, $from: DateTime!, $to: DateTime!) {
        user(login: $username) {
          contributionsCollection(from: $from, to: $to) {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }
    `;

    const { user } = await octokit.graphql<any>(query, {
      username,
      from: fromDate,
      to: toDate,
    });

    return {
      total_contributions:
        user.contributionsCollection.contributionCalendar.totalContributions,
      contribution_data: user.contributionsCollection.contributionCalendar.weeks,
    };
  } catch (error) {
    console.error('Error fetching GitHub contributions:', error);
    throw error;
  }
}
