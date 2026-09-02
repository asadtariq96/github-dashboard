import { getGraphQLUrl, getGitHubToken } from './config';

export async function executeRest<T>(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: any;
    headers?: Record<string, string>;
  } = {},
): Promise<T> {
  const token = getGitHubToken();
  const endpoint = path.startsWith('http')
    ? path
    : `https://api.github.com/${path.replace(/^\//, '')}`;

  const res = await fetch(endpoint, {
    method: options.method || 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'GitHub-Dashboard-App',
      ...options.headers,
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

export const MARK_READY_MUTATION = `
mutation MarkReady($input: MarkPullRequestReadyForReviewInput!) {
  markPullRequestReadyForReview(input: $input) {
    pullRequest {
      id
      isDraft
    }
  }
}
`;

export const CLOSE_PR_MUTATION = `
mutation ClosePullRequest($input: ClosePullRequestInput!) {
  closePullRequest(input: $input) {
    pullRequest {
      id
      number
      state
    }
  }
}
`;

export const DEQUEUE_PR_MUTATION = `
mutation DequeuePullRequest($input: DequeuePullRequestInput!) {
  dequeuePullRequest(input: $input) {
    mergeQueueEntry {
      state
    }
  }
}
`;

export const RESOLVE_THREAD_MUTATION = `
mutation ResolveThread($input: ResolveReviewThreadInput!) {
  resolveReviewThread(input: $input) {
    thread {
      id
      isResolved
    }
  }
}
`;

export const UNRESOLVE_THREAD_MUTATION = `
mutation UnresolveThread($input: UnresolveReviewThreadInput!) {
  unresolveReviewThread(input: $input) {
    thread {
      id
      isResolved
    }
  }
}
`;

export const REPLY_TO_THREAD_MUTATION = `
mutation ReplyToThread($input: AddPullRequestReviewThreadReplyInput!) {
  addPullRequestReviewThreadReply(input: $input) {
    comment {
      id
      url
    }
  }
}
`;

/**
 * Per-check detail, fetched only when a check row opens. These fields are far too heavy to
 * carry on the list query, which already pulls 50 checks for every pull request.
 */
export const CHECK_DETAIL_QUERY = `
query CheckDetail($id: ID!) {
  node(id: $id) {
    ... on CheckRun {
      id
      name
      status
      conclusion
      startedAt
      completedAt
      detailsUrl
      permalink
      databaseId
      title
      summary
      text
      checkSuite {
        workflowRun {
          databaseId
          event
          url
        }
      }
      steps(first: 50) {
        nodes {
          number
          name
          status
          conclusion
          startedAt
          completedAt
          secondsToCompletion
        }
      }
      annotations(first: 30) {
        nodes {
          annotationLevel
          message
          title
          path
          rawDetails
          blobUrl
          location {
            start {
              line
            }
            end {
              line
            }
          }
        }
      }
    }
  }
}
`;

/**
 * The queue runs its own checks against the speculative merge commit, which is a different
 * commit from the pull request's head. Those checks are what decides whether the queue
 * merges, so the merge queue tab shows them instead of the pull request's own.
 */
export const QUEUE_DETAIL_QUERY = `
query QueueDetail($id: ID!) {
  node(id: $id) {
    ... on PullRequest {
      id
      mergeQueueEntry {
        id
        state
        position
        enqueuedAt
        estimatedTimeToMerge
        solo
        jump
        enqueuer {
          login
        }
        mergeQueue {
          url
          configuration {
            mergeMethod
            mergingStrategy
            maximumEntriesToBuild
            minimumEntriesToMerge
            checkResponseTimeout
          }
        }
        headCommit {
          oid
          statusCheckRollup {
            state
            contexts(first: 100) {
              totalCount
              nodes {
                __typename
                ... on CheckRun {
                  id
                  name
                  status
                  conclusion
                  detailsUrl
                  startedAt
                  completedAt
                }
                ... on StatusContext {
                  id
                  context
                  state
                  targetUrl
                  createdAt
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

export const CONVERT_TO_DRAFT_MUTATION = `
mutation ConvertToDraft($input: ConvertPullRequestToDraftInput!) {
  convertPullRequestToDraft(input: $input) {
    pullRequest {
      id
      isDraft
    }
  }
}
`;

export const PRS_GRAPHQL_QUERY = `
query FetchOpenPullRequests($query: String!, $first: Int!) {
  search(query: $query, type: ISSUE, first: $first) {
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
        additions
        deletions
        changedFiles
        bodyHTML
        mergeable
        isInMergeQueue
        viewerCanUpdateBranch
        mergeStateStatus
        mergeQueueEntry {
          id
          state
          position
          enqueuedAt
          estimatedTimeToMerge
          solo
          jump
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
        viewerLatestReview {
          state
          submittedAt
        }
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
            isOutdated
            viewerCanReply
            viewerCanResolve
            viewerCanUnresolve
            path
            line
            startLine
            diffSide
            resolvedBy {
              login
            }
            comments(first: 20) {
              totalCount
              nodes {
                id
                bodyText
                bodyHTML
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
              committedDate
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
                      startedAt
                      completedAt
                    }
                    ... on StatusContext {
                      id
                      context
                      state
                      targetUrl
                      createdAt
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

/**
 * True when GitHub rejected an id rather than failing. That is a bad request from the
 * caller, so a route should answer 404 and not 500.
 */
export function isUnknownNode(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /Could not resolve to a node/i.test(message);
}

export async function executeGraphQL<T>(
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
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
    throw new Error(
      `GitHub GraphQL errors: ${json.errors.map((e: { message: string }) => e.message).join(', ')}`,
    );
  }

  return json.data;
}

export const VIEWER_GRAPHQL_QUERY = `
query FetchViewer {
  viewer {
    login
  }
}
`;

let viewerLogin: string | null = null;

/** The authenticated user's login. Memoized for the process lifetime. */
export async function getViewerLogin(): Promise<string> {
  if (viewerLogin) return viewerLogin;
  const data = await executeGraphQL<{ viewer: { login: string } }>(VIEWER_GRAPHQL_QUERY);
  viewerLogin = data?.viewer?.login || '';
  return viewerLogin;
}
