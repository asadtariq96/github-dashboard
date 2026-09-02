import { PullRequestAssessment } from '../types/pr';

export type RowActionId =
  | 'approve-deployment'
  | 'update-branch'
  | 'rerun-checks'
  | 'merge'
  | 'mark-ready'
  | 'dequeue'
  | 'close';

export interface RowAction {
  id: RowActionId;
  label: string;
  /** Destructive actions get a confirm step and the danger fill. */
  confirm: boolean;
  tone: 'danger' | 'neutral';
}

/**
 * Every action this PR state offers, in precedence order. Two orderings are deliberate.
 * Mark ready outranks Update: a draft blocks nobody, and updating its branch changes
 * nothing until it is ready for review. Re-run checks outranks Merge: when checks are red,
 * Merge must not be the control under the pointer.
 */
export function allActionsFor(pr: PullRequestAssessment): RowAction[] {
  const actions: RowAction[] = [];

  if (pr.mergeQueueInfo?.isWaitingForApproval) {
    actions.push({
      id: 'approve-deployment',
      label: 'Approve deploy',
      confirm: true,
      tone: 'danger',
    });
  }
  if (pr.isDraft) {
    actions.push({ id: 'mark-ready', label: 'Mark ready', confirm: false, tone: 'neutral' });
  }
  if (pr.mergeability === 'Behind Base Branch' || pr.canUpdateBranch) {
    actions.push({ id: 'update-branch', label: 'Update', confirm: false, tone: 'neutral' });
  }
  if (pr.checks === 'Failing' && failedRunUrls(pr).length > 0) {
    actions.push({ id: 'rerun-checks', label: 'Re-run checks', confirm: false, tone: 'neutral' });
  }
  if (pr.mergeability === 'Ready to Merge' && !pr.isInMergeQueue && !pr.isDraft) {
    actions.push({
      id: 'merge',
      label: pr.hasRepoMergeQueue ? 'Queue' : 'Merge',
      confirm: true,
      tone: 'danger',
    });
  }

  return actions;
}

/** The one action the row shows. */
export function rowActionFor(pr: PullRequestAssessment): RowAction | null {
  return allActionsFor(pr)[0] ?? null;
}

export const CLOSE_ACTION: RowAction = {
  id: 'close',
  label: 'Close on GitHub',
  confirm: true,
  tone: 'danger',
};

export const DEQUEUE_ACTION: RowAction = {
  id: 'dequeue',
  label: 'Remove from queue',
  confirm: true,
  tone: 'neutral',
};

/**
 * Actions that undo progress rather than make it. They are deliberately absent from
 * `allActionsFor`, so neither can ever land on the card as the primary control.
 */
export function reverseActionsFor(pr: PullRequestAssessment): RowAction[] {
  return pr.isInMergeQueue ? [DEQUEUE_ACTION, CLOSE_ACTION] : [CLOSE_ACTION];
}

/** Whether this pull request offers the action at all. Drives the batch toolbar. */
export function supportsAction(pr: PullRequestAssessment, id: RowActionId): boolean {
  return allActionsFor(pr).some((a) => a.id === id);
}

/**
 * Actions safe to fire across a selection. Merge, close, dequeue and deployment approval
 * are deliberately absent: each one needs its own confirmation and its own consequences
 * read one at a time.
 */
export const BATCH_ACTIONS: RowActionId[] = ['update-branch', 'rerun-checks'];

export function actionById(pr: PullRequestAssessment, id: RowActionId): RowAction | null {
  return (
    allActionsFor(pr).find((a) => a.id === id) ??
    reverseActionsFor(pr).find((a) => a.id === id) ??
    null
  );
}

/** Details URLs of failed check runs, which carry the workflow run ids to re-run. */
export function failedRunUrls(pr: PullRequestAssessment): string[] {
  return pr.checkRuns
    .filter((c) => {
      const conclusion = (c.conclusion || '').toUpperCase();
      return conclusion === 'FAILURE' || conclusion === 'TIMED_OUT' || conclusion === 'CANCELLED';
    })
    .map((c) => c.detailsUrl || '')
    .filter((url) => /\/actions\/runs\/\d+/.test(url));
}
