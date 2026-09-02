import { execSync } from 'child_process';

export function getGitHubToken(): string {
  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.trim() !== '') {
    return process.env.GITHUB_TOKEN.trim();
  }

  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore'],
    });
    return token.trim();
  } catch {
    throw new Error('No GITHUB_TOKEN environment variable set and `gh auth token` failed.');
  }
}

export function getGraphQLUrl(): string {
  return process.env.GITHUB_GRAPHQL_ENDPOINT || 'https://api.github.com/graphql';
}

export type Mode = 'mine' | 'reviews';

export const MODES: Mode[] = ['mine', 'reviews'];

export function isMode(value: string | null | undefined): value is Mode {
  return value === 'mine' || value === 'reviews';
}

/**
 * `review-requested:@me` also matches every team you belong to, which at this org is
 * 577 open PRs against 5 asked of you directly. `user-review-requested` is the direct-only
 * qualifier. Team queues need `team-review-requested:ORG/TEAM` and are opt-in through the
 * environment override, which splits on `|` to run several searches and merge them.
 */
export function getSearchQueries(mode: Mode): string[] {
  const override =
    mode === 'reviews' ? process.env.GITHUB_REVIEWS_SEARCH_QUERY : process.env.GITHUB_SEARCH_QUERY;
  if (override) {
    return override
      .split('|')
      .map((q) => q.trim())
      .filter(Boolean);
  }
  if (mode === 'reviews') {
    // Two searches. GitHub drops you from `user-review-requested` once you review, so the
    // "already reviewed" views need `reviewed-by` or they can never light up.
    return [
      'is:pr is:open -author:@me user-review-requested:@me sort:updated-desc',
      'is:pr is:open -author:@me reviewed-by:@me sort:updated-desc',
    ];
  }
  return ['author:@me is:pr is:open sort:updated-desc'];
}

export function getQueryKey(mode: Mode): string {
  return getSearchQueries(mode).join(' | ');
}

/**
 * The list query nests check runs and review threads, so GitHub times out well before
 * 50 nodes. Measured: 50 fails with a 502, 25 completes in about 8.5s.
 */
export function getPageSize(mode: Mode): number {
  const raw = Number(process.env.GITHUB_PAGE_SIZE);
  if (Number.isFinite(raw) && raw > 0) return Math.min(raw, 50);
  return mode === 'reviews' ? 25 : 50;
}
