import { PullRequestAssessment } from '../types/pr';
import type { Mode } from './config';

/** The queue gave up on this entry. It needs a person, not more waiting. */
export function queueFailed(pr: PullRequestAssessment): boolean {
  const state = pr.mergeQueueInfo?.state;
  return state === 'UNMERGEABLE' || state === 'LOCKED';
}

const QUEUE_WORKING_LABEL: Record<string, string> = {
  QUEUED: 'Waiting in the merge queue',
  AWAITING_CHECKS: 'Merge queue is running checks',
  MERGEABLE: 'Merge queue is merging it',
};

/**
 * What the queue is doing, or null once it is done with this pull request. A queued entry
 * stays in the priority zone until it merges or fails, so an approval does not make the
 * row vanish while the queue is still working.
 */
export function queueProgressLabel(pr: PullRequestAssessment): string | null {
  if (!pr.isInMergeQueue) return null;
  const state = pr.mergeQueueInfo?.state || 'QUEUED';
  if (state === 'UNMERGEABLE') return 'Merge queue cannot merge it';
  if (state === 'LOCKED') return 'Merge queue is locked';
  return QUEUE_WORKING_LABEL[state] ?? 'In the merge queue';
}

export function primaryLabel(pr: PullRequestAssessment): string | null {
  if (pr.mergeQueueInfo?.isWaitingForApproval) return 'Needs approval';
  if (pr.checks === 'Failing') return 'Checks failing';
  if (pr.review === 'Changes Requested') return 'Changes requested';
  if (pr.mergeability === 'Merge Conflicts') return 'Conflicts';
  if (pr.mergeability === 'Behind Base Branch') return 'Behind base';
  if (pr.unresolvedThreadsCount > 0)
    return `${pr.unresolvedThreadsCount} thread${pr.unresolvedThreadsCount === 1 ? '' : 's'}`;
  if (pr.isInMergeQueue) return 'In merge queue';
  if (pr.mergeability === 'Ready to Merge' && !pr.isDraft) return 'Ready';
  if (pr.isDraft) return 'Draft';
  if (pr.checks === 'Running') return 'Checks running';
  return null;
}

export interface BlockedReason {
  /** 1 is the most urgent. Lower sorts first. */
  rank: number;
  label: string;
}

/**
 * Why this PR is blocked on the viewer, or null when it is not.
 * The rank order is fixed by the design system: the thing only you can unblock comes
 * first, mechanical fixes come last. Detailed rail views and priority sorting both read
 * this function, so they cannot disagree.
 */
export function blockedReason(mode: Mode, pr: PullRequestAssessment): BlockedReason | null {
  if (mode === 'reviews') {
    if (pr.viewerReview === 'None' || pr.viewerReview === 'Pending') {
      return { rank: 1, label: 'Needs your review' };
    }
    if (pr.viewerReviewStale) return { rank: 2, label: 'Pushed since your review' };
    return null;
  }

  if (pr.mergeQueueInfo?.isWaitingForApproval)
    return { rank: 1, label: 'Waiting for your approval' };
  if (queueFailed(pr)) return { rank: 2, label: queueProgressLabel(pr) as string };
  if (pr.review === 'Changes Requested') return { rank: 3, label: 'Changes requested' };
  if (pr.checks === 'Failing') return { rank: 4, label: 'Checks failing' };
  if (pr.mergeability === 'Merge Conflicts') return { rank: 5, label: 'Merge conflicts' };
  if (pr.unresolvedThreadsCount > 0) {
    const n = pr.unresolvedThreadsCount;
    return { rank: 6, label: `${n} unresolved thread${n === 1 ? '' : 's'}` };
  }
  if (pr.mergeability === 'Behind Base Branch') return { rank: 7, label: 'Behind base branch' };
  // A working queue is last. It is not waiting on you, but you want to watch it land.
  if (pr.isInMergeQueue) return { rank: 8, label: queueProgressLabel(pr) as string };
  return null;
}

export function isBlocked(mode: Mode, pr: PullRequestAssessment): boolean {
  return blockedReason(mode, pr) !== null;
}

/**
 * Rank first, then unread activity, then recency. Unread floats a PR up inside its
 * band and never moves it between bands.
 */
export function compareBlocked(
  mode: Mode,
  a: PullRequestAssessment,
  b: PullRequestAssessment,
  unreadOf: (pr: PullRequestAssessment) => number,
): number {
  const ra = blockedReason(mode, a)?.rank ?? 99;
  const rb = blockedReason(mode, b)?.rank ?? 99;
  if (ra !== rb) return ra - rb;

  const ua = unreadOf(a) > 0 ? 0 : 1;
  const ub = unreadOf(b) > 0 ? 0 : 1;
  if (ua !== ub) return ua - ub;

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}
