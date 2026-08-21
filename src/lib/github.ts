import { getGraphQLUrl, getGitHubToken } from './config';

export async function executeRest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {}
): Promise<T> {
  const token = getGitHubToken();
  const endpoint = path.startsWith('http') ? path : `https://api.github.com/${path.replace(/^\//, '')}`;

  const res = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitHub-Dashboard-App',
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub REST request to ${path} failed with status ${res.status}: ${errText}`);
  }

  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return res.json();
  }
  return null as unknown as T;
}

export const UPDATE_BRANCH_MUTATION = `
mutation UpdatePullRequestBranch($input: UpdatePullRequestBranchInput!) {
  updatePullRequestBranch(input: $input) {
    pullRequest {
      id
      number
    }
  }
}
`;

export const MERGE_PR_MUTATION = `
mutation MergePullRequest($input: MergePullRequestInput!) {
  mergePullRequest(input: $input) {
    pullRequest {
      state
      merged
    }
  }
}
`;

export const ENQUEUE_PR_MUTATION = `
mutation EnqueuePullRequest($input: EnqueuePullRequestInput!) {
  enqueuePullRequest(input: $input) {
    mergeQueueEntry {
      state
      position
    }
  }
}
`;

export const PRS_GRAPHQL_QUERY = `
query FetchOpenPullRequests($query: String!) {
  search(query: $query, type: ISSUE, first: 50) {
    issueCount
    nodes {
      ... on PullRequest {
        id
        number
        title
        url
        isDraft
        state
        createdAt
        updatedAt
        headRefName
        baseRefName
        mergeable
        isInMergeQueue
        viewerCanUpdateBranch
        mergeStateStatus
        mergeQueueEntry {
          state
          position
          mergeQueue {
            url
          }
        }
        author {
          login
          avatarUrl
        }
        repository {
          nameWithOwner
          url
          mergeQueue {
            url
          }
          defaultBranchRef {
            name
          }
        }
        reviewDecision
        latestReviews(first: 20) {
          nodes {
            state
            author {
              login
            }
          }
        }
        reviewThreads(first: 50) {
          nodes {
            id
            isResolved
            path
            line
            comments(first: 10) {
              nodes {
                id
                body
                createdAt
                url
                author {
                  login
                  avatarUrl
                }
              }
            }
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 50) {
                  nodes {
                    __typename
                    ... on CheckRun {
                      id
                      name
                      status
                      conclusion
                      detailsUrl
                    }
                    ... on StatusContext {
                      id
                      context
                      state
                      targetUrl
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
`;

export async function executeGraphQL<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const token = getGitHubToken();
  const endpoint = getGraphQLUrl();

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitHub-Dashboard-App',
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub GraphQL request failed with status ${res.status}: ${errorText}`);
  }

  const json = await res.json();
  if (json.errors && json.errors.length > 0) {
    throw new Error(`GitHub GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`);
  }

  return json.data;
}
