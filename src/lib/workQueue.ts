import type { PullRequestAssessment, RecentPullRequest } from '../types/pr';
import type { Mode } from './config';
import { blockedReason } from './status';

const SNOOZE_KEY = 'gh_dashboard_snoozed_prs';
const COMPLETED_KEY = 'gh_dashboard_recently_completed';
const COMPLETED_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type SnoozeMap = Record<string, number>;

export type RecentCompletion = Omit<RecentPullRequest, 'completedAt'> & { completedAt: number };

function readObject<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    return value && typeof value === 'object' ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

export function getSnoozed(): SnoozeMap {
  const stored = readObject<SnoozeMap>(SNOOZE_KEY, {});
  const now = Date.now();
  return Object.fromEntries(Object.entries(stored).filter(([, until]) => until > now));
}

export function saveSnoozed(value: SnoozeMap): void {
  try {
    localStorage.setItem(SNOOZE_KEY, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save snoozed PRs:', error);
  }
}

export function isSnoozed(value: SnoozeMap, id: string): boolean {
  return (value[id] || 0) > Date.now();
}

export function needsAction(mode: Mode, pr: PullRequestAssessment): boolean {
  const reason = blockedReason(mode, pr);
  if (!reason) return false;
  // A healthy merge queue is moving without the engineer. Queue failures still rank earlier.
  return !(mode === 'mine' && pr.isInMergeQueue && reason.rank === 8);
}

export function getRecentCompletions(): RecentCompletion[] {
  const now = Date.now();
  const stored = readObject<RecentCompletion[]>(COMPLETED_KEY, []);
  return (Array.isArray(stored) ? stored : []).filter(
    (item) => now - item.completedAt < COMPLETED_TTL_MS,
  );
}

export function recordCompletion(
  pr: PullRequestAssessment,
  outcome: RecentCompletion['outcome'],
): RecentCompletion[] {
  const next = [
    {
      id: pr.id,
      number: pr.number,
      title: pr.title,
      url: pr.url,
      repository: pr.repository.nameWithOwner,
      outcome,
      completedAt: Date.now(),
    },
    ...getRecentCompletions().filter((item) => item.id !== pr.id),
  ].slice(0, 50);
  try {
    localStorage.setItem(COMPLETED_KEY, JSON.stringify(next));
  } catch (error) {
    console.warn('Failed to save recently completed PRs:', error);
  }
  return next;
}
