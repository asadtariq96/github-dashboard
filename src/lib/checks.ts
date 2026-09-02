import { CheckRunItem, PullRequestAssessment } from '../types/pr';

export type CheckState = 'failed' | 'running' | 'passed' | 'skipped';

const FAILED = ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
const SKIPPED = ['SKIPPED', 'NEUTRAL'];

export function checkState(check: CheckRunItem): CheckState {
  const conclusion = (check.conclusion || '').toUpperCase();
  if (FAILED.includes(conclusion)) return 'failed';
  if (SKIPPED.includes(conclusion)) return 'skipped';
  if (conclusion === 'SUCCESS') return 'passed';
  return 'running';
}

export const CHECK_STATE_LABEL: Record<CheckState, string> = {
  failed: 'Failed',
  running: 'Running',
  passed: 'Passed',
  skipped: 'Skipped',
};

export interface ChecksSummary {
  total: number;
  passed: number;
  failed: number;
  running: number;
  skipped: number;
}

export function summarizeChecks(pr: PullRequestAssessment): ChecksSummary {
  const summary: ChecksSummary = { total: 0, passed: 0, failed: 0, running: 0, skipped: 0 };
  for (const check of pr.checkRuns) {
    summary.total += 1;
    summary[checkState(check)] += 1;
  }
  return summary;
}

/**
 * "Failed · 2m ago" for a finished run, "Running · 2m elapsed" for one still going.
 * A run with no timestamps reports its state alone.
 */
export function checkTiming(check: CheckRunItem, state: CheckState): string {
  const label = CHECK_STATE_LABEL[state];
  const stamp = state === 'running' ? check.startedAt : check.completedAt || check.startedAt;
  if (!stamp) return label;

  const elapsed = elapsedText(stamp);
  if (!elapsed) return label;
  return state === 'running' ? `${label} · ${elapsed} elapsed` : `${label} · ${elapsed} ago`;
}

function elapsedText(iso: string): string | null {
  const seconds = (Date.now() - new Date(iso).getTime()) / 1000;
  if (!Number.isFinite(seconds) || seconds < 0) return null;
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

const STATE_ORDER: Record<CheckState, number> = { failed: 0, running: 1, passed: 2, skipped: 3 };

/** Failures first, then what is still running. That is the order the user reads for. */
export function sortedChecks(pr: PullRequestAssessment): CheckRunItem[] {
  return [...pr.checkRuns].sort((a, b) => STATE_ORDER[checkState(a)] - STATE_ORDER[checkState(b)]);
}
