import {
  PullRequestAssessment,
  LifecycleStatus,
  ReviewStatus,
  ChecksStatus,
  MergeabilityStatus,
  CheckRunItem,
  ReviewThreadItem,
} from '../types/pr';

interface RawComment {
  id: string;
  body: string;
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
  path: string;
  line: number | null;
  comments: {
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
}

interface RawStatusContext {
  __typename: 'StatusContext';
  id: string;
  context: string;
  state: string;
  targetUrl: string | null;
  isRequired?: boolean;
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
  mergeable: string; // 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN'
  isInMergeQueue: boolean;
  viewerCanUpdateBranch?: boolean;
  mergeStateStatus?: string; // 'BEHIND', 'BLOCKED', 'CLEAN', 'DIRTY', 'DRAFT', 'HAS_HOOKS', 'UNKNOWN', 'UNSTABLE'
  mergeQueueEntry?: {
    state: string;
    position?: number;
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
        };
      } else {
        return {
          id: c.id,
          name: c.context,
          status: c.state === 'PENDING' ? 'IN_PROGRESS' : 'COMPLETED',
          conclusion: c.state === 'SUCCESS' ? 'SUCCESS' : c.state === 'FAILURE' || c.state === 'ERROR' ? 'FAILURE' : null,
          detailsUrl: c.targetUrl,
          isRequired: !isOptional,
        };
      }
    });

    const hasFailedRequiredCheck = checkRuns.some(
      (c) =>
        c.isRequired &&
        (c.conclusion === 'FAILURE' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED')
    );
    const hasFailedNonRequiredCheck = checkRuns.some(
      (c) =>
        !c.isRequired &&
        (c.conclusion === 'FAILURE' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED')
    );
    const hasRunningCheck = checkRuns.some((c) => c.status === 'IN_PROGRESS' || c.status === 'QUEUED');

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
        const firstComment = t.comments.nodes[0];
        const lastComment = t.comments.nodes[t.comments.nodes.length - 1];
        return {
          id: t.id,
          isResolved: t.isResolved,
          path: t.path,
          line: t.line,
          author: lastComment?.author?.login || firstComment?.author?.login || 'Unknown',
          authorAvatarUrl: lastComment?.author?.avatarUrl || firstComment?.author?.avatarUrl,
          bodyPreview: lastComment?.body || firstComment?.body || '',
          createdAt: lastComment?.createdAt || firstComment?.createdAt || '',
          url: lastComment?.url || firstComment?.url || pr.url,
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
        }
      : undefined;

    const canUpdateBranch = Boolean(
      pr.viewerCanUpdateBranch || pr.mergeStateStatus === 'BEHIND'
    );

    if (inQueue) {
      mergeability = 'In Merge Queue';
    } else if (pr.mergeable === 'CONFLICTING') {
      mergeability = 'Merge Conflicts';
    } else if (pr.mergeable === 'MERGEABLE') {
      // Must pass review, required checks, and not be draft to be Ready to Merge
      if (review !== 'Approved' || checks === 'Failing' || pr.isDraft) {
        mergeability = 'Blocked by Policy';
      } else {
        mergeability = 'Ready to Merge';
      }
    } else {
      if (checks === 'Failing' || review !== 'Approved') mergeability = 'Blocked by Policy';
      else mergeability = 'Unknown';
    }

    // Needs Attention synthesis: failing required checks, changes requested, merge conflicts, or unresolved threads
    const needsAttention =
      checks === 'Failing' ||
      review === 'Changes Requested' ||
      mergeability === 'Merge Conflicts' ||
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
      lifecycle,
      review,
      checks,
      mergeability,
      unresolvedThreadsCount: unresolvedThreads.length,
      isStacked: false,
      needsAttention,
      isInMergeQueue: inQueue,
      hasRepoMergeQueue: Boolean(pr.repository.mergeQueue),
      canUpdateBranch,
      mergeQueueInfo,
      checkRuns,
      unresolvedThreads,
    };
  });

  // Step 2: Stacked PR detection
  // A PR is stacked if its baseRefName matches the headRefName of another open PR in the same repository
  const headMap = new Map<string, typeof rawAssessments[0]>();
  for (const pr of rawAssessments) {
    headMap.set(`${pr.repository.nameWithOwner}:${pr.headRefName}`, pr);
  }

  return rawAssessments.map((pr) => {
    const parentKey = `${pr.repository.nameWithOwner}:${pr.baseRefName}`;
    const parentPR = headMap.get(parentKey);

    const isStacked = Boolean(parentPR) || (pr.baseRefName !== pr.defaultBranch && pr.baseRefName !== 'master' && pr.baseRefName !== 'main');

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
      needsAttention: pr.needsAttention,
      isInMergeQueue: pr.isInMergeQueue,
      hasRepoMergeQueue: pr.hasRepoMergeQueue,
      canUpdateBranch: pr.canUpdateBranch,
      mergeQueueInfo: pr.mergeQueueInfo,
      checkRuns: pr.checkRuns,
      unresolvedThreads: pr.unresolvedThreads,
    };
  });
}
