import {
  CheckRunItem,
  ChecksStatus,
  LifecycleStatus,
  MergeabilityStatus,
  PullRequestAssessment,
  ReviewStatus,
  ReviewThreadItem,
  ViewerReviewState,
} from '../types/pr';

interface RawComment {
  id: string;
  bodyText: string;
  bodyHTML: string;
  createdAt: string;
  url: string;
  author: {
    login: string;
    avatarUrl: string;
  };
}

interface RawReviewThread {
  id: string;
  isResolved: boolean;
  isOutdated?: boolean;
  viewerCanReply?: boolean;
  viewerCanResolve?: boolean;
  viewerCanUnresolve?: boolean;
  path: string;
  line: number | null;
  startLine?: number | null;
  diffSide?: string | null;
  resolvedBy?: { login: string } | null;
  comments: {
    totalCount?: number;
    nodes: RawComment[];
  };
}

interface RawCheckRunContext {
  __typename: 'CheckRun';
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  detailsUrl: string | null;
  isRequired?: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
}

interface RawStatusContext {
  __typename: 'StatusContext';
  id: string;
  context: string;
  state: string;
  targetUrl: string | null;
  isRequired?: boolean;
  createdAt?: string | null;
}

type RawContextNode = RawCheckRunContext | RawStatusContext;

interface RawPRNode {
  id: string;
  number: number;
  title: string;
  url: string;
  isDraft: boolean;
  state: string;
  createdAt: string;
  updatedAt: string;
  headRefName: string;
  baseRefName: string;
  additions?: number;
  deletions?: number;
  changedFiles?: number;
  bodyHTML?: string;
  mergeable: string; // 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  isInMergeQueue: boolean;
  viewerCanUpdateBranch?: boolean;
  viewerCanEnableAutoMerge?: boolean;
  autoMergeRequest?: { enabledAt?: string | null } | null;
  mergeStateStatus?: string; // 'BEHIND', 'BLOCKED', 'CLEAN', 'DIRTY', 'DRAFT', 'HAS_HOOKS', 'UNKNOWN', 'UNSTABLE'
  mergeQueueEntry?: {
    id?: string;
    state: string;
    position?: number;
    enqueuedAt?: string | null;
    estimatedTimeToMerge?: number | null;
    solo?: boolean | null;
    jump?: boolean | null;
    mergeQueue?: {
      url?: string;
    };
  } | null;
  author: {
    login: string;
    avatarUrl: string;
  };
  repository: {
    nameWithOwner: string;
    url: string;
    mergeQueue?: {
      url: string;
    } | null;
    defaultBranchRef?: {
      name: string;
    } | null;
  };
  reviewDecision?: string | null; // 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED'
  viewerLatestReview?: {
    state: string;
    submittedAt?: string | null;
  } | null;
  latestReviews?: {
    nodes: Array<{
      state: string;
      author?: {
        login: string;
      };
    }>;
  };
  reviewThreads?: {
    nodes: RawReviewThread[];
  };
  commits?: {
    nodes: Array<{
      commit: {
        committedDate?: string | null;
        statusCheckRollup?: {
          state: string;
          contexts?: {
            nodes: RawContextNode[];
          };
        };
      };
    }>;
  };
}

/** One entry per person, in the order they first replied. */
function dedupeByLogin(comments: RawComment[]): { login: string; avatarUrl?: string }[] {
  const seen = new Map<string, { login: string; avatarUrl?: string }>();
  for (const comment of comments) {
    const login = comment.author?.login;
    if (!login || seen.has(login)) continue;
    seen.set(login, { login, avatarUrl: comment.author?.avatarUrl || undefined });
  }
  return Array.from(seen.values());
}

const VIEWER_REVIEW_STATES: Record<string, ViewerReviewState> = {
  APPROVED: 'Approved',
  CHANGES_REQUESTED: 'Changes Requested',
  COMMENTED: 'Commented',
  DISMISSED: 'Dismissed',
  PENDING: 'Pending',
};

export function normalizePullRequests(rawNodes: RawPRNode[]): PullRequestAssessment[] {
  // Step 1: Map raw PRs to intermediate structure
  const rawAssessments = rawNodes.map((pr) => {
    // 1. Lifecycle
    const lifecycle: LifecycleStatus = pr.isDraft ? 'Draft' : 'Ready for Review';

    // 2. Review Dimension
    let review: ReviewStatus = 'Review Required';
    if (pr.reviewDecision === 'APPROVED') {
      review = 'Approved';
    } else if (pr.reviewDecision === 'CHANGES_REQUESTED') {
      review = 'Changes Requested';
    } else if (pr.reviewDecision === 'REVIEW_REQUIRED') {
      review = 'Review Required';
    } else {
      // Fallback to checking latestReviews
      const reviews = pr.latestReviews?.nodes || [];
      const hasChangesRequested = reviews.some((r) => r.state === 'CHANGES_REQUESTED');
      const hasApproval = reviews.some((r) => r.state === 'APPROVED');

      if (hasChangesRequested) review = 'Changes Requested';
      else if (hasApproval) review = 'Approved';
      else review = 'Review Required';
    }

    // 2b. The viewer's own standing. Drives /reviews.
    const viewerReview = VIEWER_REVIEW_STATES[pr.viewerLatestReview?.state || ''] || 'None';
    const viewerReviewedAt = pr.viewerLatestReview?.submittedAt || undefined;
    const lastCommitAt = pr.commits?.nodes?.[0]?.commit?.committedDate || undefined;
    const viewerReviewStale = Boolean(
      viewerReviewedAt &&
      lastCommitAt &&
      new Date(lastCommitAt).getTime() > new Date(viewerReviewedAt).getTime(),
    );

    // 3. Checks Dimension & Check Runs extraction
    const rollup = pr.commits?.nodes?.[0]?.commit?.statusCheckRollup;
    const rollupState = rollup?.state; // SUCCESS, FAILURE, PENDING, EXPECTED, ERROR
    const rawContexts = rollup?.contexts?.nodes || [];

    const checkRuns: CheckRunItem[] = rawContexts.map((c) => {
      const name = c.__typename === 'CheckRun' ? c.name : c.context;
      const lowerName = name.toLowerCase();
      // Heuristic for known non-gating/advisory checks across common repos (e.g. codecov)
      const isOptional =
        lowerName.includes('codecov') ||
        lowerName.includes('claude review') ||
        lowerName.includes('docs preview');

      if (c.__typename === 'CheckRun') {
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          conclusion: c.conclusion,
          detailsUrl: c.detailsUrl,
          isRequired: !isOptional,
          startedAt: c.startedAt || undefined,
          completedAt: c.completedAt || undefined,
        };
      } else {
        const done = c.state !== 'PENDING';
        return {
          id: c.id,
          name: c.context,
          status: done ? 'COMPLETED' : 'IN_PROGRESS',
          conclusion:
            c.state === 'SUCCESS'
              ? 'SUCCESS'
              : c.state === 'FAILURE' || c.state === 'ERROR'
                ? 'FAILURE'
                : null,
          detailsUrl: c.targetUrl,
          isRequired: !isOptional,
          startedAt: c.createdAt || undefined,
          completedAt: done ? c.createdAt || undefined : undefined,
        };
      }
    });

    const hasFailedRequiredCheck = checkRuns.some(
      (c) =>
        c.isRequired &&
        (c.conclusion === 'FAILURE' ||
          c.conclusion === 'TIMED_OUT' ||
          c.conclusion === 'ACTION_REQUIRED'),
    );
    const hasFailedNonRequiredCheck = checkRuns.some(
      (c) =>
        !c.isRequired &&
        (c.conclusion === 'FAILURE' ||
          c.conclusion === 'TIMED_OUT' ||
          c.conclusion === 'ACTION_REQUIRED'),
    );
    const hasRunningCheck = checkRuns.some(
      (c) => c.status === 'IN_PROGRESS' || c.status === 'QUEUED',
    );

    let checks: ChecksStatus = 'None';
    if (hasFailedRequiredCheck) {
      checks = 'Failing';
    } else if (hasFailedNonRequiredCheck || pr.mergeStateStatus === 'UNSTABLE') {
      checks = 'Warning';
    } else if (rollupState === 'SUCCESS') {
      checks = 'Passing';
    } else if (rollupState === 'FAILURE' || rollupState === 'ERROR') {
      checks = hasFailedRequiredCheck ? 'Failing' : 'Warning';
    } else if (rollupState === 'PENDING' || rollupState === 'EXPECTED' || hasRunningCheck) {
      checks = hasRunningCheck ? 'Running' : 'Pending';
    } else if (checkRuns.length > 0) {
      checks = 'Passing';
    }

    // 4. Unresolved Review Threads
    const threads = pr.reviewThreads?.nodes || [];
    const unresolvedThreads: ReviewThreadItem[] = threads
      .filter((t) => !t.isResolved && t.comments?.nodes?.length > 0)
      .map((t) => {
        const raw = t.comments.nodes;
        const firstComment = raw[0];
        const lastComment = raw[raw.length - 1];
        const replies = raw.slice(1);
        return {
          id: t.id,
          isResolved: t.isResolved,
          isOutdated: Boolean(t.isOutdated),
          path: t.path,
          line: t.line,
          startLine: t.startLine ?? null,
          diffSide: t.diffSide || 'RIGHT',
          resolvedBy: t.resolvedBy?.login,
          viewerCanReply: t.viewerCanReply !== false,
          viewerCanResolve: Boolean(t.viewerCanResolve),
          viewerCanUnresolve: Boolean(t.viewerCanUnresolve),
          author: lastComment?.author?.login || firstComment?.author?.login || 'Unknown',
          authorAvatarUrl: lastComment?.author?.avatarUrl || firstComment?.author?.avatarUrl,
          bodyPreview: lastComment?.bodyText || firstComment?.bodyText || '',
          createdAt: lastComment?.createdAt || firstComment?.createdAt || '',
          url: lastComment?.url || firstComment?.url || pr.url,
          replyCount: Math.max((t.comments.totalCount ?? raw.length) - 1, 0),
          replies: dedupeByLogin(replies),
          comments: raw.map((c) => ({
            id: c.id,
            author: c.author?.login || 'ghost',
            authorAvatarUrl: c.author?.avatarUrl || undefined,
            bodyHTML: c.bodyHTML || '',
            bodyText: c.bodyText || '',
            createdAt: c.createdAt,
            url: c.url,
          })),
        };
      });

    // 5. Mergeability Dimension & Merge Queue State
    const inQueue = Boolean(pr.isInMergeQueue || pr.mergeQueueEntry);
    let mergeability: MergeabilityStatus = 'Unknown';

    // Find any check run explicitly waiting for manual approval or human gate
    const approvalCheck = checkRuns.find((c) => {
      const name = c.name.toLowerCase();
      const conclusion = c.conclusion?.toLowerCase();
      return (
        conclusion === 'action_required' ||
        (c.status === 'IN_PROGRESS' &&
          (name.includes('approval') ||
            name.includes('manual') ||
            name.includes('gate') ||
            name.includes('deploy') ||
            name.includes('promote') ||
            name.includes('review')))
      );
    });

    const mergeQueueInfo = inQueue
      ? {
          state: pr.mergeQueueEntry?.state || 'QUEUED',
          position: pr.mergeQueueEntry?.position,
          url: pr.mergeQueueEntry?.mergeQueue?.url || `${pr.repository.url}/queue`,
          isWaitingForApproval: Boolean(approvalCheck),
          approvalStepName: approvalCheck?.name,
          approvalStepUrl: approvalCheck?.detailsUrl || undefined,
          entryId: pr.mergeQueueEntry?.id,
          enqueuedAt: pr.mergeQueueEntry?.enqueuedAt || undefined,
          estimatedTimeToMerge: pr.mergeQueueEntry?.estimatedTimeToMerge ?? undefined,
          solo: Boolean(pr.mergeQueueEntry?.solo),
          jump: Boolean(pr.mergeQueueEntry?.jump),
        }
      : undefined;

    const canUpdateBranch = Boolean(pr.viewerCanUpdateBranch || pr.mergeStateStatus === 'BEHIND');

    const checksUnfinished = checks === 'Running' || checks === 'Pending';

    if (inQueue) {
      mergeability = 'In Merge Queue';
    } else if (pr.mergeable === 'CONFLICTING') {
      mergeability = 'Merge Conflicts';
    } else if (pr.mergeStateStatus === 'BEHIND') {
      mergeability = 'Behind Base Branch';
    } else if (pr.mergeable === 'MERGEABLE') {
      // Must pass review, required checks, and not be draft to be Ready to Merge
      if (review !== 'Approved' || checks === 'Failing' || checksUnfinished || pr.isDraft) {
        mergeability = 'Blocked by Policy';
      } else {
        mergeability = 'Ready to Merge';
      }
    } else {
      if (checks === 'Failing' || checksUnfinished || review !== 'Approved')
        mergeability = 'Blocked by Policy';
      else mergeability = 'Unknown';
    }

    // Needs Attention synthesis: failing required checks, changes requested, merge conflicts, or unresolved threads
    const needsAttention =
      checks === 'Failing' ||
      review === 'Changes Requested' ||
      mergeability === 'Merge Conflicts' ||
      mergeability === 'Behind Base Branch' ||
      unresolvedThreads.length > 0;

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      repository: {
        nameWithOwner: pr.repository.nameWithOwner,
        url: pr.repository.url,
      },
      defaultBranch: pr.repository.defaultBranchRef?.name || 'main',
      author: {
        login: pr.author?.login || 'ghost',
        avatarUrl: pr.author?.avatarUrl || '',
      },
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      isDraft: pr.isDraft,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      additions: pr.additions ?? 0,
      deletions: pr.deletions ?? 0,
      changedFiles: pr.changedFiles ?? 0,
      bodyHTML: pr.bodyHTML ?? '',
      lifecycle,
      review,
      checks,
      mergeability,
      unresolvedThreadsCount: unresolvedThreads.length,
      isStacked: false,
      viewerReview,
      viewerReviewedAt,
      lastCommitAt,
      viewerReviewStale,
      needsAttention,
      isInMergeQueue: inQueue,
      hasRepoMergeQueue: Boolean(pr.repository.mergeQueue),
      canUpdateBranch,
      autoMergeEnabled: Boolean(pr.autoMergeRequest),
      canEnableAutoMerge: Boolean(pr.viewerCanEnableAutoMerge),
      mergeQueueInfo,
      checkRuns,
      unresolvedThreads,
    };
  });

  // Step 2: Stacked PR detection
  // A PR is stacked if its baseRefName matches the headRefName of another open PR in the same repository
  const headMap = new Map<string, (typeof rawAssessments)[0]>();
  for (const pr of rawAssessments) {
    headMap.set(`${pr.repository.nameWithOwner}:${pr.headRefName}`, pr);
  }

  return rawAssessments.map((pr) => {
    const parentKey = `${pr.repository.nameWithOwner}:${pr.baseRefName}`;
    const parentPR = headMap.get(parentKey);

    const isStacked =
      Boolean(parentPR) ||
      (pr.baseRefName !== pr.defaultBranch &&
        pr.baseRefName !== 'master' &&
        pr.baseRefName !== 'main');

    return {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      repository: pr.repository,
      author: pr.author,
      headRefName: pr.headRefName,
      baseRefName: pr.baseRefName,
      isDraft: pr.isDraft,
      createdAt: pr.createdAt,
      updatedAt: pr.updatedAt,
      additions: pr.additions,
      deletions: pr.deletions,
      changedFiles: pr.changedFiles,
      bodyHTML: pr.bodyHTML,
      lifecycle: pr.lifecycle,
      review: pr.review,
      checks: pr.checks,
      mergeability: pr.mergeability,
      unresolvedThreadsCount: pr.unresolvedThreadsCount,
      isStacked,
      stackedParent: parentPR
        ? {
            prNumber: parentPR.number,
            title: parentPR.title,
            url: parentPR.url,
            headRefName: parentPR.headRefName,
          }
        : undefined,
      viewerReview: pr.viewerReview,
      viewerReviewedAt: pr.viewerReviewedAt,
      lastCommitAt: pr.lastCommitAt,
      viewerReviewStale: pr.viewerReviewStale,
      needsAttention: pr.needsAttention,
      isInMergeQueue: pr.isInMergeQueue,
      hasRepoMergeQueue: pr.hasRepoMergeQueue,
      canUpdateBranch: pr.canUpdateBranch,
      autoMergeEnabled: pr.autoMergeEnabled,
      canEnableAutoMerge: pr.canEnableAutoMerge,
      mergeQueueInfo: pr.mergeQueueInfo,
      checkRuns: pr.checkRuns,
      unresolvedThreads: pr.unresolvedThreads,
    };
  });
}
