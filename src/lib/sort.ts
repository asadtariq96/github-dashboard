import type { PullRequestAssessment } from '../types/pr';
import type { Mode } from './config';
import { compareBlocked } from './status';

export type SortId = 'priority' | 'updated' | 'stale' | 'opened';

export interface SortSpec {
  id: SortId;
  /** The field the order reads. */
  field: string;
  /** The direction, in words. The control states both. */
  direction: string;
  /** Short form for the button face. */
  short: string;
}

export const SORTS: SortSpec[] = [
  { id: 'priority', field: 'Priority', direction: 'blocked on you first', short: 'Priority' },
  { id: 'updated', field: 'Last updated', direction: 'newest first', short: 'Updated ↓' },
  { id: 'stale', field: 'Last updated', direction: 'oldest first', short: 'Updated ↑' },
  { id: 'opened', field: 'Opened', direction: 'newest first', short: 'Opened ↓' },
];

export const DEFAULT_SORT: SortId = 'priority';

export function isSortId(value: string): value is SortId {
  return SORTS.some((s) => s.id === value);
}

export function sortSpec(id: SortId): SortSpec {
  return SORTS.find((s) => s.id === id) ?? SORTS[0];
}

function time(iso: string): number {
  return new Date(iso).getTime();
}

/**
 * The chosen order applies inside each group, never across them. The priority zone
 * stays a zone whatever the sort says.
 */
export function makeComparator(
  mode: Mode,
  id: SortId,
  unreadOf: (pr: PullRequestAssessment) => number,
): (a: PullRequestAssessment, b: PullRequestAssessment) => number {
  switch (id) {
    case 'updated':
      return (a, b) => time(b.updatedAt) - time(a.updatedAt);
    case 'stale':
      return (a, b) => time(a.updatedAt) - time(b.updatedAt);
    case 'opened':
      return (a, b) => time(b.createdAt) - time(a.createdAt);
    default:
      return (a, b) => compareBlocked(mode, a, b, unreadOf);
  }
}
