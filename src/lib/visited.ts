import { ActivityItem, PrActivityInfo, PullRequestAssessment } from '../types/pr';

const VISITED_STORAGE_KEY = 'gh_dashboard_visited_prs'; // { "repo#num": epochMs }
const SNAPSHOT_STORAGE_KEY = 'gh_dashboard_pr_snapshots';

interface PrSnapshot {
  checks: PullRequestAssessment['checks'];
  review: PullRequestAssessment['review'];
  mergeability: PullRequestAssessment['mergeability'];
  unresolvedThreadsCount: number;
}

export interface ChangeDigest {
  lines: string[];
  activity: NewActivity;
}

let visitedRaw: string | null = null;
let visitedMap: Record<string, number> = {};

function getVisitedMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VISITED_STORAGE_KEY);
    if (raw !== visitedRaw) {
      const parsed = raw ? JSON.parse(raw) : {};
      visitedMap = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      visitedRaw = raw;
    }
    return visitedMap;
  } catch (e) {
    console.warn('Failed to read visited PRs:', e);
  }
  return {};
}

export function recordVisit(key: string): void {
  try {
    const map = { ...getVisitedMap() };
    map[key] = Date.now();
    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save visited PR:', e);
  }
}

export function recordSnapshot(key: string, pr: PullRequestAssessment): void {
  try {
    const snapshots = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '{}');
    snapshots[key] = {
      checks: pr.checks,
      review: pr.review,
      mergeability: pr.mergeability,
      unresolvedThreadsCount: pr.unresolvedThreadsCount,
    } satisfies PrSnapshot;
    localStorage.setItem(SNAPSHOT_STORAGE_KEY, JSON.stringify(snapshots));
  } catch (e) {
    console.warn('Failed to save PR snapshot:', e);
  }
}

export function computeChangeDigest(
  pr: PullRequestAssessment,
  activity: PrActivityInfo | undefined,
  key: string,
): ChangeDigest {
  const fresh = computeNew(activity, key);
  const lines: string[] = [];
  const human = fresh.items.filter((item) => !item.bot);
  const commits = human.filter((item) => item.type === 'commit').length;
  const comments = human.filter((item) => item.type === 'comment').length;
  const reviews = human.filter((item) => item.type === 'review');
  if (commits) lines.push(`${commits} new commit${commits === 1 ? '' : 's'} pushed`);
  if (comments) lines.push(`${comments} new comment${comments === 1 ? '' : 's'}`);
  const changeRequests = reviews.filter((item) => item.state === 'changes_requested');
  const approvals = reviews.filter((item) => item.state === 'approved');
  if (changeRequests.length) lines.push(`${changeRequests[0].author} requested changes`);
  if (approvals.length) lines.push(`${approvals[0].author} approved`);

  try {
    const previous = JSON.parse(localStorage.getItem(SNAPSHOT_STORAGE_KEY) || '{}')[key] as
      | PrSnapshot
      | undefined;
    if (previous && previous.checks !== pr.checks) {
      lines.push(`Checks: ${previous.checks} → ${pr.checks}`);
    }
    if (previous && previous.review !== pr.review) {
      lines.push(`Review: ${previous.review} → ${pr.review}`);
    }
    if (previous && previous.mergeability !== pr.mergeability) {
      lines.push(`Mergeability: ${previous.mergeability} → ${pr.mergeability}`);
    }
    if (previous && previous.unresolvedThreadsCount !== pr.unresolvedThreadsCount) {
      const delta = pr.unresolvedThreadsCount - previous.unresolvedThreadsCount;
      lines.push(
        delta > 0
          ? `${delta} new unresolved thread${delta === 1 ? '' : 's'}`
          : `${Math.abs(delta)} thread${delta === -1 ? '' : 's'} resolved`,
      );
    }
  } catch {}

  return { lines, activity: fresh };
}

/** Mark a set of PRs seen as of now. Deliberate only; never on a timer or on focus. */
export function markAllSeen(keys: string[]): void {
  try {
    const map = { ...getVisitedMap() };
    const now = Date.now();
    for (const key of keys) map[key] = now;
    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to mark PRs seen:', e);
  }
}

export interface NewActivity {
  count: number; // human items only
  total: number; // incl. bots
  items: ActivityItem[];
  threshold: 'activity' | 'visited';
  thresholdTs: string; // ISO of the applied threshold
}

/**
 * Effective threshold = max(since-your-last-activity, since-last-visit).
 * Counts human items only; bots are included in `items` for the drawer.
 */
export function computeNew(activity: PrActivityInfo | undefined, key: string): NewActivity {
  if (!activity || !activity.items || activity.items.length === 0) {
    return { count: 0, total: 0, items: [], threshold: 'activity', thresholdTs: '' };
  }
  const visited = getVisitedMap()[key] || 0;
  const activityTs = new Date(activity.since).getTime();
  const effectiveMs = Math.max(activityTs, visited);
  const effective = new Date(effectiveMs).toISOString();
  const items = activity.items.filter((i) => new Date(i.ts).getTime() > effectiveMs);
  const humans = items.filter((i) => !i.bot);
  return {
    count: humans.length,
    total: items.length,
    items,
    threshold: visited > activityTs ? 'visited' : 'activity',
    thresholdTs: effective,
  };
}
