import { execSync } from 'child_process';

export function getGitHubToken(): string {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim() !== '') {
    return process.env.GITHUB_TOKEN.trim();
  }

  try {
    const token = execSync('gh auth token', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    return token.trim();
  } catch {
    throw new Error('No GITHUB_TOKEN environment variable set and `gh auth token` failed.');
  }
}

export function getGraphQLUrl(): string {
  return process.env.GITHUB_GRAPHQL_ENDPOINT || 'https://api.github.com/graphql';
}

export function getSearchQuery(): string {
  return process.env.GITHUB_SEARCH_QUERY || 'author:@me is:pr is:open';
}
