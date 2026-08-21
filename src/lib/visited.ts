import { ActivityItem, PrActivityInfo } from '../types/pr';

const VISITED_STORAGE_KEY = 'gh_dashboard_visited_prs'; // { "repo#num": epochMs }

export function getVisitedMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(VISITED_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    console.warn('Failed to read visited PRs:', e);
  }
  return {};
}

export function recordVisit(key: string): void {
  try {
    const map = getVisitedMap();
    map[key] = Date.now();
    localStorage.setItem(VISITED_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.warn('Failed to save visited PR:', e);
  }
}

export interface NewActivity {
  count: number;      // human items only
  total: number;      // incl. bots
  items: ActivityItem[];
  threshold: 'activity' | 'visited';
  thresholdTs: string; // ISO of the applied threshold
}

/**
 * Effective threshold = max(since-your-last-activity, since-last-visit).
 * Counts human items only; bots are included in `items` for the drawer.
 */
export function computeNew(
  activity: PrActivityInfo | undefined,
  key: string,
  nowMs = Date.now()
): NewActivity {
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
