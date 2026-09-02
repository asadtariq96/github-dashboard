import { PrActivityInfo, PullRequestAssessment } from '../types/pr';
import { executeRest, getViewerLogin, searchAllPullRequests } from './github';
import { normalizePullRequests } from './normalizer';
import { getPageSize, getQueryKey, getSearchQueries, MODES, type Mode } from './config';
import { prEventEmitter } from './events';
import { fetchPrActivity } from './activity';
import { mapWithConcurrency } from './pool';
import { isBlocked } from './status';

interface CacheState {
  prs: PullRequestAssessment[];
  lastUpdated: string;
  query: string;
  syncStatus: 'Healthy' | 'Syncing' | 'Stale Error';
  error?: string;
  activity: Record<string, PrActivityInfo>;
  /** How many PRs the search matched, which can exceed the 50 the query returns. */
  matchedTotal: number;
  /** True when the search matched more than this list holds. */
  truncated: boolean;
  /** True when one of several searches failed and this list is incomplete. */
  partial: boolean;
}

interface ModeState {
  cache: CacheState;
  /**
   * The activity map lives here, not on `cache`. Sync replaces `cache` wholesale, so a
   * lazy fetch landing mid-sync would otherwise be dropped while its timestamp said fresh.
   */
  activity: Record<string, PrActivityInfo>;
  syncPromise: Promise<CacheState> | null;
  lastSyncTimestamp: number;
  /** Per-PR fetch time, keyed `repo#number`. Replaces one clock for the whole set. */
  activityFetchedAt: Map<string, number>;
  /** In-flight fetches, so two callers asking for the same PR share one request. */
  activityInFlight: Map<string, Promise<void>>;
}

const CACHE_TTL_MS = 25 * 1000; // 25s cache freshness window for 30s polling cycle
const ACTIVITY_TTL_MS = 5 * 60 * 1000; // per-PR timelines are heavy; refresh every 5 min
const ACTIVITY_CONCURRENCY = 6;

function emptyState(): ModeState {
  return {
    cache: {
      prs: [],
      lastUpdated: new Date().toISOString(),
      query: '',
      syncStatus: 'Healthy',
      activity: {},
      matchedTotal: 0,
      truncated: false,
      partial: false,
    },
    activity: {},
    syncPromise: null,
    lastSyncTimestamp: 0,
    activityFetchedAt: new Map(),
    activityInFlight: new Map(),
  };
}

// One cache slot per mode. Survives hot reload in development.
const globalForCache = globalThis as unknown as { prModeStates?: Map<Mode, ModeState> };
const modeStates: Map<Mode, ModeState> =
  globalForCache.prModeStates ?? new Map(MODES.map((m) => [m, emptyState()]));
if (process.env.NODE_ENV !== 'production') {
  globalForCache.prModeStates = modeStates;
}

function stateFor(mode: Mode): ModeState {
  let st = modeStates.get(mode);
  if (!st) {
    st = emptyState();
    modeStates.set(mode, st);
  }
  // A hot reload can hand back a state built by an earlier shape of this module.
  if (!(st.activityFetchedAt instanceof Map)) st.activityFetchedAt = new Map();
  if (!(st.activityInFlight instanceof Map)) st.activityInFlight = new Map();
  if (!st.activity) st.activity = st.cache?.activity ?? {};
  return st;
}

function keyToRef(key: string): { repo: string; number: number } | null {
  const at = key.lastIndexOf('#');
  if (at < 0) return null;
  const repo = key.slice(0, at);
  const number = Number(key.slice(at + 1));
  if (!repo || !Number.isFinite(number)) return null;
  return { repo, number };
}

/**
 * Fetch timelines for `keys` into a mode's activity map, skipping any that are fresh
 * and any already in flight. Capped concurrency; mutates `st.cache.activity` in place.
 */
async function fetchActivityInto(
  st: ModeState,
  mode: Mode,
  keys: string[],
  force = false,
): Promise<void> {
  const now = Date.now();
  const wanted = keys.filter((key) => {
    if (st.activityInFlight.has(key)) return false;
    if (force) return true;
    const at = st.activityFetchedAt.get(key);
    return at === undefined || now - at > ACTIVITY_TTL_MS;
  });

  const pending = keys.map((k) => st.activityInFlight.get(k)).filter(Boolean) as Promise<void>[];

  if (wanted.length > 0) {
    const meLogin = await getViewerLogin();

    // Register before any request starts, so a second caller waits instead of refetching.
    const done = new Map<string, () => void>();
    for (const key of wanted) {
      st.activityInFlight.set(key, new Promise<void>((resolve) => done.set(key, resolve)));
    }

    await mapWithConcurrency(wanted, ACTIVITY_CONCURRENCY, async (key) => {
      const ref = keyToRef(key);
      try {
        if (ref) {
          const info = await fetchPrActivity(ref.repo, ref.number, meLogin);
          st.activity = { ...st.activity, [key]: info };
          st.activityFetchedAt.set(key, Date.now());
        }
      } catch (err) {
        console.warn(`pr activity fetch failed for ${key}:`, err);
      } finally {
        st.activityInFlight.delete(key);
        done.get(key)?.();
      }
    });
  }

  if (pending.length > 0) await Promise.allSettled(pending);
}

/** Activity for a specific set of PRs. Used by the lazy client endpoint. */
export async function getActivityFor(
  mode: Mode,
  keys: string[],
): Promise<Record<string, PrActivityInfo>> {
  const st = stateFor(mode);
  await fetchActivityInto(st, mode, keys);
  const out: Record<string, PrActivityInfo> = {};
  for (const key of keys) {
    const info = st.activity[key];
    if (info) out[key] = info;
  }
  return out;
}

/** Refresh every mode. A merge or an approval can change what appears in both. */
export async function refreshAllModes(): Promise<void> {
  await Promise.allSettled(MODES.map((m) => getDashboardState(m, true)));
}

/** Age in ms of the last successful sync for a mode, or null if never synced. */
export function getLastCheckedAge(mode: Mode): number | null {
  const st = stateFor(mode);
  return st.lastSyncTimestamp === 0 ? null : Date.now() - st.lastSyncTimestamp;
}

export async function getDashboardState(mode: Mode, forceRefresh = false): Promise<CacheState> {
  const now = Date.now();
  const st = stateFor(mode);
  const queries = getSearchQueries(mode);
  const query = getQueryKey(mode);
  const first = getPageSize(mode);

  // Return cached result if fresh and not forced
  if (!forceRefresh && st.cache.prs.length > 0 && now - st.lastSyncTimestamp < CACHE_TTL_MS) {
    return st.cache;
  }

  // Deduplicate concurrent refresh requests
  if (st.syncPromise) {
    return st.syncPromise;
  }

  st.syncPromise = (async () => {
    st.cache.syncStatus = 'Syncing';
    st.cache.query = query;

    try {
      // Reviews mode needs two searches; GitHub ANDs qualifiers so they cannot be combined.
      const settled = await Promise.allSettled(queries.map((q) => searchAllPullRequests(q, first)));

      const failures = settled.filter((r) => r.status === 'rejected');
      if (failures.length === settled.length) {
        throw (failures[0] as PromiseRejectedResult).reason;
      }
      for (const f of failures) {
        console.warn('search query failed:', (f as PromiseRejectedResult).reason);
      }

      const byId = new Map<string, any>();
      let matchedTotal = 0;
      let pageCapped = false;
      for (const r of settled) {
        if (r.status !== 'fulfilled') continue;
        matchedTotal += r.value.issueCount;
        pageCapped = pageCapped || r.value.truncated;
        for (const n of r.value.nodes) {
          if (n && n.number && !byId.has(n.id)) byId.set(n.id, n);
        }
      }

      const truncated = byId.size < matchedTotal || pageCapped;
      let prs = normalizePullRequests(Array.from(byId.values()));

      // Only the priority zone refreshes on sync. Everything else is fetched lazily
      // by the client for the rows it is actually showing.
      const blockedKeys = prs
        .filter((p) => isBlocked(mode, p))
        .map((p) => `${p.repository.nameWithOwner}#${p.number}`);
      await fetchActivityInto(st, mode, blockedKeys, forceRefresh);

      // Check for active merge_group workflow runs waiting for manual environment deployment approvals
      const mergeQueuePRs = prs.filter((p) => p.isInMergeQueue);
      if (mergeQueuePRs.length > 0) {
        // Collect distinct repositories that have PRs in merge queue
        const reposWithMQ = Array.from(
          new Set(mergeQueuePRs.map((p) => p.repository.nameWithOwner)),
        );

        await Promise.allSettled(
          reposWithMQ.map(async (repoWithOwner) => {
            try {
              const runsData = await executeRest<{
                workflow_runs: Array<{
                  id: number;
                  name: string;
                  status: string;
                  head_branch: string;
                  html_url: string;
                }>;
              }>(`repos/${repoWithOwner}/actions/runs?event=merge_group&per_page=15`);

              const waitingRuns = (runsData?.workflow_runs || []).filter(
                (r) => r.status === 'waiting',
              );

              for (const run of waitingRuns) {
                // Check if head_branch matches pr-XXXX
                const match = run.head_branch?.match(/pr-(\d+)/);
                if (match) {
                  const prNumber = parseInt(match[1], 10);
                  const matchingPR = prs.find(
                    (p) => p.repository.nameWithOwner === repoWithOwner && p.number === prNumber,
                  );
                  if (matchingPR && matchingPR.mergeQueueInfo) {
                    // Fetch pending deployments for this run
                    try {
                      const pendingDeploys = await executeRest<
                        Array<{
                          environment?: { id: number; name: string; html_url?: string };
                          current_user_can_approve?: boolean;
                        }>
                      >(`repos/${repoWithOwner}/actions/runs/${run.id}/pending_deployments`);

                      const envIds = (pendingDeploys || [])
                        .map((d) => d.environment?.id)
                        .filter((id): id is number => typeof id === 'number');

                      const envName =
                        pendingDeploys?.[0]?.environment?.name || 'production deployment';
                      const envUrl = run.html_url;

                      matchingPR.mergeQueueInfo.isWaitingForApproval = true;
                      matchingPR.mergeQueueInfo.approvalStepName = `Manual Approval (${envName})`;
                      matchingPR.mergeQueueInfo.approvalStepUrl = envUrl;
                      matchingPR.mergeQueueInfo.runId = run.id;
                      matchingPR.mergeQueueInfo.environmentIds = envIds;
                      matchingPR.needsAttention = true; // Mark as needs attention
                    } catch {
                      // Fallback: mark waiting for approval pointing to run URL
                      matchingPR.mergeQueueInfo.isWaitingForApproval = true;
                      matchingPR.mergeQueueInfo.approvalStepName = 'Manual Approval (Deployment)';
                      matchingPR.mergeQueueInfo.approvalStepUrl = run.html_url;
                      matchingPR.mergeQueueInfo.runId = run.id;
                      matchingPR.needsAttention = true;
                    }
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to inspect merge_group runs for ${repoWithOwner}:`, e);
            }
          }),
        );
      }

      st.cache = {
        prs,
        lastUpdated: new Date().toISOString(),
        query,
        syncStatus: 'Healthy',
        error: undefined,
        activity: st.activity,
        matchedTotal,
        truncated,
        partial: failures.length > 0,
      };
      st.lastSyncTimestamp = Date.now();
      prEventEmitter.emit(mode);
      return st.cache;
    } catch (err: any) {
      console.error('GitHub PR Sync Error:', err);
      // Graceful degradation: Retain stale data but mark error
      st.cache = {
        ...st.cache,
        syncStatus: 'Stale Error',
        error: err.message || 'Failed to sync with GitHub GraphQL API',
      };
      return st.cache;
    } finally {
      st.syncPromise = null;
    }
  })();

  return st.syncPromise;
}
