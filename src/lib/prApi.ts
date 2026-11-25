import type { PullRequestAssessment } from '../types/pr';
import { failedRunUrls, type RowActionId } from './rowAction';

export interface ActionCall {
  url: string;
  body: unknown;
  done: string;
}

export function buildActionCall(pr: PullRequestAssessment, id: RowActionId): ActionCall {
  switch (id) {
    case 'approve-deployment':
      return {
        url: '/api/prs/approve-deployment',
        body: {
          repoWithOwner: pr.repository.nameWithOwner,
          runId: pr.mergeQueueInfo?.runId,
          environmentIds: pr.mergeQueueInfo?.environmentIds,
          comment: `Approved from PR Desk for #${pr.number}`,
        },
        done: `Approved deployment for #${pr.number}`,
      };
    case 'update-branch':
      return {
        url: '/api/prs/update-branch',
        body: { prId: pr.id },
        done: `Updated #${pr.number} from ${pr.baseRefName}`,
      };
    case 'rerun-checks':
      return {
        url: '/api/prs/rerun-checks',
        body: { repo: pr.repository.nameWithOwner, detailsUrls: failedRunUrls(pr) },
        done: `Re-running failed jobs on #${pr.number}`,
      };
    case 'merge':
      return {
        url: '/api/prs/merge',
        body: { prId: pr.id, enqueue: Boolean(pr.hasRepoMergeQueue), mergeMethod: 'SQUASH' },
        done: pr.hasRepoMergeQueue ? `Added #${pr.number} to the queue` : `Merged #${pr.number}`,
      };
    case 'auto-merge':
      return {
        url: '/api/prs/auto-merge',
        body: { prId: pr.id, mergeMethod: 'SQUASH' },
        done: `#${pr.number} merges once checks pass`,
      };
    case 'mark-ready':
      return {
        url: '/api/prs/mark-ready',
        body: { prId: pr.id },
        done: `#${pr.number} is ready for review`,
      };
    case 'dequeue':
      return {
        url: '/api/prs/dequeue',
        body: { prId: pr.id },
        done: `Removed #${pr.number} from the queue`,
      };
    case 'close':
      return {
        url: '/api/prs/close',
        body: { prId: pr.id },
        done: `Closed #${pr.number}`,
      };
  }
}

export function confirmDetailFor(id: RowActionId, pr: PullRequestAssessment): string | undefined {
  switch (id) {
    case 'merge':
      return `${pr.title}\n\nThis cannot be undone.`;
    case 'auto-merge':
      return `${pr.title}\n\nGitHub merges it as soon as every required check passes. Nobody looks at it again first.`;
    case 'approve-deployment':
      return `${pr.mergeQueueInfo?.approvalStepName || 'Manual approval'} on ${pr.repository.nameWithOwner}. This cannot be undone.`;
    case 'close':
      return `${pr.title}\n\nEveryone watching the pull request sees this. Reopening it is possible, but only on GitHub.`;
    case 'dequeue':
      return `${pr.title}\n\nThe queue drops its speculative checks and the pull requests behind it re-run.`;
    default:
      return undefined;
  }
}

export async function postApi(url: string, body: unknown): Promise<string> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
  return json?.message || '';
}
