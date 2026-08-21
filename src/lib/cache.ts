import { DashboardSyncResponse, PrActivityInfo, PullRequestAssessment } from '../types/pr';
import { executeGraphQL, executeRest, PRS_GRAPHQL_QUERY } from './github';
import { normalizePullRequests } from './normalizer';
import { getSearchQuery } from './config';
import { prEventEmitter } from './events';
import { fetchPrActivity } from './activity';

interface CacheState {
  prs: PullRequestAssessment[];
  lastUpdated: string;
  query: string;
  syncStatus: 'Healthy' | 'Syncing' | 'Stale Error';
  error?: string;
  activity: Record<string, PrActivityInfo>;
}

// In-memory cache singleton
let cache: CacheState = {
  prs: [],
  lastUpdated: new Date().toISOString(),
  query: '',
  syncStatus: 'Healthy',
  activity: {},
};

let syncPromise: Promise<CacheState> | null = null;
let lastSyncTimestamp = 0;
let lastActivitySyncTimestamp = 0;
const CACHE_TTL_MS = 25 * 1000; // 25s cache freshness window for 30s polling cycle
const ACTIVITY_TTL_MS = 5 * 60 * 1000; // per-PR timelines are heavy; refresh every 5 min

export async function getDashboardState(forceRefresh = false): Promise<CacheState> {
  const now = Date.now();
  const query = getSearchQuery();

  // Return cached result if fresh and not forced
  if (!forceRefresh && cache.prs.length > 0 && now - lastSyncTimestamp < CACHE_TTL_MS) {
    return cache;
  }

  // Deduplicate concurrent refresh requests
  if (syncPromise) {
    return syncPromise;
  }

  syncPromise = (async () => {
    cache.syncStatus = 'Syncing';
    cache.query = query;

    try {
      const data = await executeGraphQL<{
        search: {
          issueCount: number;
          nodes: any[];
        };
      }>(PRS_GRAPHQL_QUERY, { query });

      const rawNodes = (data?.search?.nodes || []).filter((n) => n && n.number);
      let prs = normalizePullRequests(rawNodes);

      // Per-PR "new activity since viewer's last action" (heavy; refresh on a longer TTL)
      const activityStale = forceRefresh || Date.now() - lastActivitySyncTimestamp > ACTIVITY_TTL_MS;
      let activity = cache.activity;
      if (activityStale && prs.length > 0) {
        const meLogin = prs[0]?.author?.login || '';
        const results = await Promise.allSettled(
          prs.map((p) =>
            fetchPrActivity(p.repository.nameWithOwner, p.number, meLogin).then((info) => ({
              key: `${p.repository.nameWithOwner}#${p.number}`,
              info,
            }))
          )
        );
        const next: Record<string, PrActivityInfo> = {};
        let failures = 0;
        for (const r of results) {
          if (r.status === 'fulfilled') {
            next[r.value.key] = r.value.info;
          } else {
            failures++;
            console.warn('pr activity fetch failed:', r.reason);
          }
        }
        if (failures === 0 || Object.keys(next).length > 0) {
          activity = next;
          lastActivitySyncTimestamp = Date.now();
        }
      }

      // Check for active merge_group workflow runs waiting for manual environment deployment approvals
      const mergeQueuePRs = prs.filter((p) => p.isInMergeQueue);
      if (mergeQueuePRs.length > 0) {
        // Collect distinct repositories that have PRs in merge queue
        const reposWithMQ = Array.from(new Set(mergeQueuePRs.map((p) => p.repository.nameWithOwner)));
        
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

              const waitingRuns = (runsData?.workflow_runs || []).filter((r) => r.status === 'waiting');

              for (const run of waitingRuns) {
                // Check if head_branch matches pr-XXXX
                const match = run.head_branch?.match(/pr-(\d+)/);
                if (match) {
                  const prNumber = parseInt(match[1], 10);
                  const matchingPR = prs.find(
                    (p) => p.repository.nameWithOwner === repoWithOwner && p.number === prNumber
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

                      const envName = pendingDeploys?.[0]?.environment?.name || 'production deployment';
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
          })
        );
      }

      cache = {
        prs,
        lastUpdated: new Date().toISOString(),
        query,
        syncStatus: 'Healthy',
        error: undefined,
        activity,
      };
      lastSyncTimestamp = Date.now();
      prEventEmitter.emit();
      return cache;
    } catch (err: any) {
      console.error('GitHub PR Sync Error:', err);
      // Graceful degradation: Retain stale data but mark error
      cache = {
        ...cache,
        syncStatus: 'Stale Error',
        error: err.message || 'Failed to sync with GitHub GraphQL API',
      };
      return cache;
    } finally {
      syncPromise = null;
    }
  })();

  return syncPromise;
}
