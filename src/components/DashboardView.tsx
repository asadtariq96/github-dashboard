'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DashboardSyncResponse, PrActivityInfo, PullRequestAssessment } from '../types/pr';
import type { Mode } from '../lib/config';
import { PRCardList } from './PRCardList';
import { ThemeToggle } from './ThemeToggle';
import { ModeSwitch } from './ModeSwitch';
import { toast } from 'sonner';
import { ConfirmDialog, type ConfirmState } from './ConfirmDialog';
import { BatchToolbar } from './BatchToolbar';
import { actionById, failedRunUrls, type RowActionId } from '../lib/rowAction';
import { isBlocked } from '../lib/status';
import { DEFAULT_SORT, isSortId, makeComparator, type SortId } from '../lib/sort';
import { readDeskParams, writeDeskUrl, deskParamsSearch, type DeskParams } from '../lib/urlState';
import { SortMenu } from './SortMenu';
import { FilterChips, type FilterChip } from './FilterChips';
import { computeNew, markAllSeen } from '../lib/visited';
import {
  getRecentCompletions,
  getSnoozed,
  isSnoozed,
  needsAction,
  recordCompletion,
  saveSnoozed,
  type RecentCompletion,
  type SnoozeMap,
} from '../lib/workQueue';
import {
  Rail,
  countViews,
  defaultViewFor,
  isViewFor,
  matchesView,
  viewsFor,
  type ViewId,
} from './Rail';
import { RefreshCw, Search, AlertCircle, CheckCircle2, ExternalLink } from 'lucide-react';

const URL_WRITE_DEBOUNCE_MS = 300;

const HIDDEN_PRS_STORAGE_KEY = 'gh_dashboard_hidden_prs';
const RAIL_COLLAPSED_STORAGE_KEY = 'gh_dashboard_rail_collapsed';

export function DashboardView({ mode }: { mode: Mode }) {
  const [data, setData] = useState<DashboardSyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeView, setActiveView] = useState<ViewId>(() => defaultViewFor(mode));
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [sortId, setSortId] = useState<SortId>(DEFAULT_SORT);
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [seenVersion, setSeenVersion] = useState(0);
  const requestedActivity = useRef<Set<string>>(new Set());
  const [hiddenPRIds, setHiddenPRIds] = useState<Set<string>>(new Set());
  /**
   * One entry per pull request with a write in flight, so several rows can work at once.
   * A single slot used to mean starting a second write moved the spinner off the first row.
   */
  const [busy, setBusy] = useState<Record<string, RowActionId>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [selectedPRIds, setSelectedPRIds] = useState<Set<string>>(new Set());
  /**
   * GitHub search is eventually consistent after a close. Keep successfully closed PRs
   * off the desk until a refresh confirms the search result has caught up.
   */
  const [removedPRIds, setRemovedPRIds] = useState<Set<string>>(new Set());
  const [snoozedUntil, setSnoozedUntil] = useState<SnoozeMap>({});
  const [recentCompletions, setRecentCompletions] = useState<RecentCompletion[]>([]);
  const [batchRunning, setBatchRunning] = useState<RowActionId | null>(null);
  /** Anchor for a shift-click range. */
  const lastPickedId = useRef<string | null>(null);
  const [urlLoaded, setUrlLoaded] = useState(false);
  const lastUrlParams = useRef<DeskParams | null>(null);

  useEffect(() => {
    try {
      const storedHidden = localStorage.getItem(HIDDEN_PRS_STORAGE_KEY);
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) setHiddenPRIds(new Set(parsed));
      }

      if (localStorage.getItem(RAIL_COLLAPSED_STORAGE_KEY) === '1') setRailCollapsed(true);
      setSnoozedUntil(getSnoozed());
      setRecentCompletions(getRecentCompletions());
    } catch (e) {
      console.warn('Failed to read preferences from localStorage:', e);
    }
  }, []);

  useEffect(() => {
    setActiveView((current) => (isViewFor(mode, current) ? current : defaultViewFor(mode)));
    setSelectedRepo('all');
    requestedActivity.current = new Set();
  }, [mode]);

  const urlDefaults = useMemo<DeskParams>(
    () => ({ view: defaultViewFor(mode), repo: 'all', q: '', sort: DEFAULT_SORT }),
    [mode],
  );

  /**
   * The URL is the record of what the list is showing, so the back button restores a
   * filter set and a link carries one. Read it once on mount, then on every popstate.
   */
  useEffect(() => {
    const apply = (search: string) => {
      const p = readDeskParams(search);
      setActiveView(p.view && isViewFor(mode, p.view) ? p.view : defaultViewFor(mode));
      setSelectedRepo(p.repo || 'all');
      setSearchQuery(p.q || '');
      setSortId(p.sort && isSortId(p.sort) ? p.sort : DEFAULT_SORT);
    };

    apply(window.location.search);
    setUrlLoaded(true);

    const onPopState = () => apply(window.location.search);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [mode]);

  /**
   * Typing replaces the current entry so one search does not bury the history. Picking a
   * view, a repository or a sort pushes, because those are the steps worth stepping back over.
   */
  useEffect(() => {
    if (!urlLoaded) return;
    const params: DeskParams = {
      view: activeView,
      repo: selectedRepo,
      q: searchQuery,
      sort: sortId,
    };
    if (deskParamsSearch(params, urlDefaults) === window.location.search) {
      lastUrlParams.current = params;
      return;
    }

    const previous = lastUrlParams.current;
    const onlySearchChanged =
      previous !== null &&
      previous.view === params.view &&
      previous.repo === params.repo &&
      previous.sort === params.sort;

    const write = () => {
      writeDeskUrl(params, urlDefaults, onlySearchChanged ? 'replace' : 'push');
      lastUrlParams.current = params;
    };

    if (!onlySearchChanged) {
      write();
      return;
    }
    const timer = setTimeout(write, URL_WRITE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [urlLoaded, activeView, selectedRepo, searchQuery, sortId, urlDefaults]);

  const handleToggleRail = () => {
    setRailCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(RAIL_COLLAPSED_STORAGE_KEY, next ? '1' : '0');
      } catch (e) {
        console.warn('Failed to save sidebar state:', e);
      }
      return next;
    });
  };

  const handleToggleHidePR = (id: string) => {
    setHiddenPRIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        localStorage.setItem(HIDDEN_PRS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save hidden PRs to localStorage:', e);
      }
      return next;
    });
  };

  const handleSnooze = (pr: PullRequestAssessment, until: number | null) => {
    setSnoozedUntil((current) => {
      const next = { ...current };
      if (until) next[pr.id] = until;
      else delete next[pr.id];
      saveSnoozed(next);
      return next;
    });
    toast.success(
      until
        ? `Snoozed #${pr.number} until ${new Date(until).toLocaleDateString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}`
        : `Woke #${pr.number}`,
    );
  };

  /** Each action names its endpoint, its body, and what it says when it lands. */
  const ACTION_CALLS: Record<
    RowActionId,
    (pr: PullRequestAssessment) => { url: string; body: unknown; done: string }
  > = {
    'approve-deployment': (pr) => ({
      url: '/api/prs/approve-deployment',
      body: {
        repoWithOwner: pr.repository.nameWithOwner,
        runId: pr.mergeQueueInfo?.runId,
        environmentIds: pr.mergeQueueInfo?.environmentIds,
        comment: `Approved from PR Desk for #${pr.number}`,
      },
      done: `Approved deployment for #${pr.number}`,
    }),
    'update-branch': (pr) => ({
      url: '/api/prs/update-branch',
      body: { prId: pr.id },
      done: `Updated #${pr.number} from ${pr.baseRefName}`,
    }),
    'rerun-checks': (pr) => ({
      url: '/api/prs/rerun-checks',
      body: { repo: pr.repository.nameWithOwner, detailsUrls: failedRunUrls(pr) },
      done: `Re-running failed jobs on #${pr.number}`,
    }),
    merge: (pr) => ({
      url: '/api/prs/merge',
      body: { prId: pr.id, enqueue: Boolean(pr.hasRepoMergeQueue), mergeMethod: 'SQUASH' },
      done: pr.hasRepoMergeQueue ? `Added #${pr.number} to the queue` : `Merged #${pr.number}`,
    }),
    'mark-ready': (pr) => ({
      url: '/api/prs/mark-ready',
      body: { prId: pr.id },
      done: `#${pr.number} is ready for review`,
    }),
    dequeue: (pr) => ({
      url: '/api/prs/dequeue',
      body: { prId: pr.id },
      done: `Removed #${pr.number} from the queue`,
    }),
    close: (pr) => ({
      url: '/api/prs/close',
      body: { prId: pr.id },
      done: `Closed #${pr.number}`,
    }),
  };

  const post = async (url: string, body: unknown): Promise<string> => {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
    return json?.message || '';
  };

  const runAction = async (pr: PullRequestAssessment, id: RowActionId) => {
    const call = ACTION_CALLS[id](pr);
    setBusy((current) => ({ ...current, [pr.id]: id }));
    try {
      await post(call.url, call.body);
      if (id === 'close' || (id === 'merge' && !pr.hasRepoMergeQueue)) {
        setRecentCompletions(recordCompletion(pr, id === 'merge' ? 'Merged' : 'Closed'));
      }
      if (id === 'close') {
        setRemovedPRIds((current) => new Set(current).add(pr.id));
        setSelectedPRIds((current) => {
          if (!current.has(pr.id)) return current;
          const next = new Set(current);
          next.delete(pr.id);
          return next;
        });
      }
      // Mark ready is the only one of these GitHub can actually reverse.
      toast.success(call.done, {
        action:
          id === 'mark-ready'
            ? {
                label: 'Undo',
                onClick: () => {
                  void (async () => {
                    try {
                      await post('/api/prs/convert-draft', { prId: pr.id });
                      toast.success(`#${pr.number} is a draft again`);
                      await fetchDashboardState(true);
                    } catch (err: any) {
                      toast.error(`Could not undo: ${err.message}`);
                    }
                  })();
                },
              }
            : undefined,
      });
      // The mutation response is authoritative. Close the confirmation/inspector in the
      // same render as the success toast; refreshing the rest of the dashboard is follow-up
      // reconciliation and must not keep the pre-mutation UI on screen.
      void fetchDashboardState(true);
    } catch (err: any) {
      toast.error(`#${pr.number}: ${err.message}`);
    } finally {
      setBusy((current) => {
        const next = { ...current };
        delete next[pr.id];
        return next;
      });
    }
  };

  const busyCount = Object.keys(busy).length;

  const CONFIRM_DETAIL: Partial<Record<RowActionId, (pr: PullRequestAssessment) => string>> = {
    merge: (pr) => `${pr.title}\n\nThis cannot be undone.`,
    'approve-deployment': (pr) =>
      `${pr.mergeQueueInfo?.approvalStepName || 'Manual approval'} on ${pr.repository.nameWithOwner}. This cannot be undone.`,
    close: (pr) =>
      `${pr.title}\n\nEveryone watching the pull request sees this. Reopening it is possible, but only on GitHub.`,
    dequeue: (pr) =>
      `${pr.title}\n\nThe queue drops its speculative checks and the pull requests behind it re-run.`,
  };

  const handleRunAction = (pr: PullRequestAssessment, id: RowActionId) => {
    const action = actionById(pr, id);
    if (!action) return;
    // One write at a time. A second start would move the spinner off the first row.
    // Other rows are free to run at the same time. Only this row's own writes queue up.
    if (busy[pr.id]) return;

    if (!action.confirm) {
      void runAction(pr, id);
      return;
    }

    setConfirm({
      title: `${action.label} on #${pr.number}?`,
      detail: CONFIRM_DETAIL[id]?.(pr) ?? pr.title,
      confirmLabel: action.label,
      run: () => runAction(pr, id),
    });
  };

  const fetchDashboardState = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const endpoint = manual ? '/api/refresh' : '/api/prs';
      const method = manual ? 'POST' : 'GET';
      const res = await fetch(`${endpoint}?mode=${mode}`, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardSyncResponse = await res.json();
      setData(json);
      setRemovedPRIds((current) => {
        if (current.size === 0) return current;
        const returnedIds = new Set(json.prs.map((pr) => pr.id));
        const next = new Set(Array.from(current).filter((id) => returnedIds.has(id)));
        return next.size === current.size ? current : next;
      });
      setError(json.error || null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard state');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardState(false);

    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource(`/api/events?mode=${mode}`);
      eventSource.addEventListener('update', () => fetchDashboardState(false));
      eventSource.onerror = () => {};
    } catch {}

    const interval = setInterval(() => fetchDashboardState(false), 30000);
    return () => {
      clearInterval(interval);
      eventSource?.close();
    };
  }, [mode]);

  const prs = useMemo(
    () => (data?.prs || []).filter((pr) => !removedPRIds.has(pr.id)),
    [data?.prs, removedPRIds],
  );

  const repositories = useMemo(() => {
    const set = new Set<string>();
    prs.forEach((pr) => set.add(pr.repository.nameWithOwner));
    return Array.from(set).sort();
  }, [prs]);

  const unreadOf = useCallback(
    (pr: PullRequestAssessment) => {
      const key = `${pr.repository.nameWithOwner}#${pr.number}`;
      return computeNew(data?.activity?.[key], key).count;
    },
    // seenVersion forces a recompute after Mark all seen; computeNew reads localStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, seenVersion],
  );

  const filteredPRs = useMemo(() => {
    const list = prs.filter((pr) => {
      const isHidden = hiddenPRIds.has(pr.id);
      const snoozed = isSnoozed(snoozedUntil, pr.id);
      if (activeView === 'hidden') {
        if (!isHidden) return false;
      } else {
        if (isHidden) return false;
        if (activeView === 'snoozed') {
          if (!snoozed) return false;
        } else {
          if (snoozed || activeView === 'done-recently') return false;
          if (activeView === 'act-now' && !needsAction(mode, pr)) return false;
          if (activeView === 'waiting' && needsAction(mode, pr)) return false;
          if (
            activeView !== 'act-now' &&
            activeView !== 'waiting' &&
            !matchesView(mode, activeView, pr)
          )
            return false;
        }
      }
      if (selectedRepo !== 'all' && pr.repository.nameWithOwner !== selectedRepo) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        if (
          !pr.number.toString().includes(q) &&
          !pr.title.toLowerCase().includes(q) &&
          !pr.repository.nameWithOwner.toLowerCase().includes(q) &&
          !pr.headRefName.toLowerCase().includes(q) &&
          !pr.author.login.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });

    return list.sort(makeComparator(mode, sortId, unreadOf));
  }, [
    prs,
    mode,
    activeView,
    selectedRepo,
    searchQuery,
    sortId,
    hiddenPRIds,
    snoozedUntil,
    unreadOf,
  ]);

  /**
   * The priority zone only appears on the unfiltered view. Every other view either is
   * the blocked set already, or is a deliberate narrowing the zone would fight.
   */
  const visibleKeys = useMemo(
    () => filteredPRs.map((pr) => `${pr.repository.nameWithOwner}#${pr.number}`),
    [filteredPRs],
  );

  /**
   * Fetch timelines for the rows on screen, and only those. The server already refreshed
   * the priority zone, so this covers whatever else the current view is showing.
   */
  useEffect(() => {
    const missing = visibleKeys.filter(
      (key) => !data?.activity?.[key] && !requestedActivity.current.has(key),
    );
    if (missing.length === 0) return;

    missing.forEach((key) => requestedActivity.current.add(key));
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/activity?mode=${mode}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ keys: missing }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json: { activity: Record<string, PrActivityInfo> } = await res.json();
        if (cancelled || !json.activity) return;
        setData((current) =>
          current ? { ...current, activity: { ...current.activity, ...json.activity } } : current,
        );
      } catch (err) {
        // A missing timeline costs an unread count, not the page. Allow a later retry.
        missing.forEach((key) => requestedActivity.current.delete(key));
        console.warn('activity fetch failed:', err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visibleKeys, data?.activity, mode]);

  const unreadTotal = useMemo(
    () => filteredPRs.reduce((sum, pr) => sum + (unreadOf(pr) > 0 ? 1 : 0), 0),
    [filteredPRs, unreadOf],
  );

  /**
   * Shift picks the range from the last one picked, measured against the visible order, so
   * a range still works across the blocked zone and everything else.
   */
  const handleToggleSelect = (prId: string, shiftKey: boolean) => {
    setSelectedPRIds((prev) => {
      const next = new Set(prev);
      const anchor = lastPickedId.current;

      if (shiftKey && anchor && anchor !== prId) {
        const order = filteredPRs.map((p) => p.id);
        const from = order.indexOf(anchor);
        const to = order.indexOf(prId);
        if (from !== -1 && to !== -1) {
          const [lo, hi] = from < to ? [from, to] : [to, from];
          for (const id of order.slice(lo, hi + 1)) next.add(id);
          lastPickedId.current = prId;
          return next;
        }
      }

      if (next.has(prId)) next.delete(prId);
      else next.add(prId);
      lastPickedId.current = prId;
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedPRIds(new Set());
    lastPickedId.current = null;
  };

  /**
   * Four at a time. A burst is what trips GitHub's secondary rate limit, and each call
   * also forces a server-side refresh of both modes.
   */
  const BATCH_CONCURRENCY = 4;

  const BATCH_WORDS: Partial<Record<RowActionId, { doing: string; did: string }>> = {
    'update-branch': { doing: 'Updating', did: 'Updated' },
    'rerun-checks': { doing: 'Re-running checks on', did: 'Re-ran checks on' },
  };

  const runBatch = async (action: RowActionId, prs: PullRequestAssessment[]) => {
    if (batchRunning) return;
    const words = BATCH_WORDS[action] ?? { doing: 'Working on', did: 'Finished' };
    const noun = (n: number) => `${n} pull request${n === 1 ? '' : 's'}`;
    const toastId = toast.loading(`${words.doing} ${noun(prs.length)}…`);
    setBatchRunning(action);

    let done = 0;
    const failures: string[] = [];
    const queue = [...prs];

    const worker = async () => {
      while (queue.length > 0) {
        const pr = queue.shift();
        if (!pr) return;
        const call = ACTION_CALLS[action](pr);
        setBusy((current) => ({ ...current, [pr.id]: action }));
        try {
          await post(call.url, call.body);
          done += 1;
        } catch (err: any) {
          failures.push(`#${pr.number}: ${err.message}`);
        } finally {
          setBusy((current) => {
            const next = { ...current };
            delete next[pr.id];
            return next;
          });
          toast.loading(`${words.doing} ${done + failures.length} of ${prs.length}…`, {
            id: toastId,
          });
        }
      }
    };

    await Promise.all(Array.from({ length: Math.min(BATCH_CONCURRENCY, prs.length) }, worker));

    if (failures.length === 0) {
      toast.success(`${words.did} ${noun(done)}`, { id: toastId });
    } else {
      toast.error(`${words.did} ${noun(done)}, ${failures.length} failed`, {
        id: toastId,
        description: failures.slice(0, 3).join('\n'),
      });
    }

    setBatchRunning(null);
    clearSelection();
    await fetchDashboardState(true);
  };

  const hideSelected = () => {
    const ids = Array.from(selectedPRIds);
    setHiddenPRIds((prev) => {
      const next = new Set(prev);
      for (const id of ids) next.add(id);
      try {
        localStorage.setItem(HIDDEN_PRS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save hidden PRs to localStorage:', e);
      }
      return next;
    });
    toast.success(`Hid ${ids.length} from the desk`, {
      action: {
        label: 'Undo',
        onClick: () => {
          setHiddenPRIds((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.delete(id);
            try {
              localStorage.setItem(HIDDEN_PRS_STORAGE_KEY, JSON.stringify(Array.from(next)));
            } catch (e) {
              console.warn('Failed to save hidden PRs to localStorage:', e);
            }
            return next;
          });
        },
      },
    });
    clearSelection();
  };

  const handleMarkAllSeen = () => {
    markAllSeen(visibleKeys);
    setSeenVersion((v) => v + 1);
  };

  const showZone = false;
  const zonePRs = useMemo(
    () => (showZone ? filteredPRs.filter((pr) => isBlocked(mode, pr)) : []),
    [showZone, filteredPRs, mode],
  );
  const restPRs = useMemo(
    () => (showZone ? filteredPRs.filter((pr) => !isBlocked(mode, pr)) : filteredPRs),
    [showZone, filteredPRs, mode],
  );

  const visiblePRs = useMemo(() => prs.filter((p) => !hiddenPRIds.has(p.id)), [prs, hiddenPRIds]);
  const hiddenCount = useMemo(
    () => prs.filter((p) => hiddenPRIds.has(p.id)).length,
    [prs, hiddenPRIds],
  );

  const doneRecently = useMemo<RecentCompletion[]>(() => {
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const optimisticCutoff = Date.now() - 5 * 60 * 1000;
    const confirmedIds = new Set((data?.recentPRs || []).map((item) => item.id));
    const byId = new Map(
      recentCompletions
        .filter(
          (item) =>
            item.completedAt >= cutoff &&
            (item.completedAt >= optimisticCutoff || confirmedIds.has(item.id)),
        )
        .map((item) => [item.id, item] as const),
    );
    for (const item of data?.recentPRs || []) {
      const completedAt = new Date(item.completedAt).getTime();
      if (completedAt < cutoff) continue;
      byId.set(item.id, { ...item, completedAt });
    }
    return Array.from(byId.values()).sort((a, b) => b.completedAt - a.completedAt);
  }, [data?.recentPRs, recentCompletions]);

  const shownDoneRecently = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return doneRecently.filter((item) => {
      if (selectedRepo !== 'all' && item.repository !== selectedRepo) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.repository.toLowerCase().includes(q) ||
        item.number.toString().includes(q)
      );
    });
  }, [doneRecently, searchQuery, selectedRepo]);

  const viewCounts = useMemo(() => {
    const counts = countViews(mode, visiblePRs, hiddenCount);
    const awake = visiblePRs.filter((pr) => !isSnoozed(snoozedUntil, pr.id));
    counts.all = awake.length;
    counts['act-now'] = awake.filter((pr) => needsAction(mode, pr)).length;
    counts.waiting = awake.filter((pr) => !needsAction(mode, pr)).length;
    counts.snoozed = visiblePRs.filter((pr) => isSnoozed(snoozedUntil, pr.id)).length;
    counts['done-recently'] = doneRecently.length;
    return counts;
  }, [mode, visiblePRs, hiddenCount, snoozedUntil, doneRecently.length]);

  const repoCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const pr of visiblePRs) {
      const repo = pr.repository.nameWithOwner;
      counts[repo] = (counts[repo] || 0) + 1;
    }
    return counts;
  }, [visiblePRs]);

  const selectedRepoSummary = useMemo(() => {
    if (selectedRepo === 'all') return null;
    const repoPRs = prs.filter((pr) => pr.repository.nameWithOwner === selectedRepo);
    const hidden = repoPRs.filter((pr) => hiddenPRIds.has(pr.id));
    const snoozed = repoPRs.filter(
      (pr) => !hiddenPRIds.has(pr.id) && isSnoozed(snoozedUntil, pr.id),
    );
    return {
      shortName: selectedRepo.split('/')[1] ?? selectedRepo,
      visibleCount: repoPRs.length - hidden.length,
      hidden,
      snoozedCount: snoozed.length,
    };
  }, [prs, selectedRepo, hiddenPRIds, snoozedUntil]);

  const unhideSelectedRepo = () => {
    if (!selectedRepoSummary?.hidden.length) return;
    const ids = new Set(selectedRepoSummary.hidden.map((pr) => pr.id));
    setHiddenPRIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => next.delete(id));
      try {
        localStorage.setItem(HIDDEN_PRS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save hidden PRs to localStorage:', e);
      }
      return next;
    });
    toast.success(
      `Unhid ${ids.size} pull request${ids.size === 1 ? '' : 's'} in ${selectedRepoSummary.shortName}`,
    );
  };

  const clearAllFilters = () => {
    setSelectedRepo('all');
    setSearchQuery('');
  };

  const activeChips = useMemo<FilterChip[]>(() => {
    const chips: FilterChip[] = [];
    if (selectedRepo !== 'all') {
      chips.push({
        id: 'repo',
        label: 'Repo',
        value: selectedRepo.split('/')[1] ?? selectedRepo,
        onRemove: () => setSelectedRepo('all'),
      });
    }
    if (searchQuery.trim() !== '') {
      chips.push({
        id: 'q',
        label: 'Search',
        value: searchQuery.trim(),
        onRemove: () => setSearchQuery(''),
      });
    }
    return chips;
  }, [selectedRepo, searchQuery]);

  const filterSummary = activeChips
    .map((chip, i) => `${i === 0 ? chip.label : chip.label.toLowerCase()} ${chip.value}`)
    .join(' and ');

  const totalCount = visiblePRs.length;
  const activeViewLabel =
    viewsFor(mode)
      .find((v) => v.id === activeView)
      ?.label.toLowerCase() ?? 'this view';
  const otherAgeMs = useMemo(() => {
    const ages = data?.otherAges;
    if (!ages) return null;
    const key = mode === 'mine' ? 'reviews' : 'mine';
    return ages[key] ?? null;
  }, [data, mode]);

  const formattedTime = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const listProps = {
    mode,
    hiddenPRIds,
    onToggleHidePR: handleToggleHidePR,
    onRunAction: handleRunAction,
    busy,
    activity: data?.activity,
    onRefresh: () => fetchDashboardState(true),
    selectedPRIds,
    onToggleSelect: handleToggleSelect,
    snoozedUntil,
    onSnooze: handleSnooze,
  };

  const selectedPRs = useMemo(
    () => filteredPRs.filter((pr) => selectedPRIds.has(pr.id)),
    [filteredPRs, selectedPRIds],
  );

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-chrome flex h-header items-center gap-3 border-b border-line/80 bg-surface/90 px-4 backdrop-blur-xl sm:px-6">
        <div className="flex shrink-0 items-center gap-2.5">
          <span aria-hidden className="relative block h-5 w-5 text-accent">
            <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" />
            <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current" />
            <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
            <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current" />
            <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" />
          </span>
          <h1 className="font-display text-xl tracking-tight text-ink">PR Desk</h1>
        </div>

        <ModeSwitch mode={mode} activeCount={totalCount} otherAgeMs={otherAgeMs} />

        <div className="relative ml-auto hidden min-w-0 max-w-sm flex-1 sm:block">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
          />
          <input
            type="text"
            placeholder="Search"
            aria-label="Search pull requests"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm text-ink shadow-sm placeholder:text-dim focus:border-line-strong focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
          />
        </div>

        {data && (
          <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted md:inline-flex">
            <span
              aria-hidden
              className={`h-1.5 w-1.5 rounded-full ${
                data.syncStatus === 'Healthy'
                  ? 'bg-ready'
                  : data.syncStatus === 'Syncing'
                    ? 'bg-info animate-pulse-dot'
                    : 'bg-danger'
              }`}
            />
            {formattedTime ? `Updated ${formattedTime}` : data.syncStatus}
          </span>
        )}

        <button
          onClick={() => fetchDashboardState(true)}
          disabled={refreshing || loading || busyCount > 0}
          aria-label={busyCount > 0 ? 'Working on a pull request' : 'Refresh'}
          title={
            busyCount > 0
              ? `Working on ${busyCount} pull request${busyCount === 1 ? '' : 's'}…`
              : 'Refresh'
          }
          className="tap-safe shrink-0 rounded-lg border border-line bg-surface-raised p-2 text-muted shadow-sm transition-all duration-instant ease-out hover:-translate-y-px hover:border-line-strong hover:text-ink disabled:opacity-50"
        >
          <RefreshCw
            aria-hidden
            className={`h-4 w-4 ${refreshing || busyCount > 0 ? 'animate-spin text-accent' : ''}`}
          />
        </button>

        <ThemeToggle />
      </header>

      <div className="flex flex-col sm:flex-row">
        <Rail
          mode={mode}
          collapsed={railCollapsed}
          onToggleCollapsed={handleToggleRail}
          activeView={activeView}
          onSelectView={setActiveView}
          viewCounts={viewCounts}
          repositories={repositories}
          repoCounts={repoCounts}
          totalCount={totalCount}
          selectedRepo={selectedRepo}
          onSelectRepo={setSelectedRepo}
        />

        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-1.5 font-mono text-2xs uppercase tracking-[0.16em] text-dim">
                {mode === 'mine' ? 'Your workspace' : 'Review inbox'}
              </p>
              <h2 className="font-display text-2xl capitalize tracking-tight text-ink sm:text-[34px] sm:leading-none">
                {activeViewLabel}
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              {mode === 'mine'
                ? 'A focused view of what is moving, blocked, or ready to ship.'
                : 'Requests that need a thoughtful pass before they can move forward.'}
            </p>
          </div>
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-start gap-3 rounded-md border border-danger/25 bg-danger/5 px-3 py-2 text-sm text-danger"
            >
              <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {data?.truncated && (
            <div
              role="status"
              className="mb-4 rounded-md border border-warn/25 bg-warn/5 px-3 py-2 text-sm text-warn"
            >
              Showing the first {data.prs.length} of {data.matchedTotal} matches. Narrow the query
              to see the rest.
            </div>
          )}

          {data?.partial && (
            <div
              role="status"
              className="mb-4 rounded-md border border-warn/25 bg-warn/5 px-3 py-2 text-sm text-warn"
            >
              One search failed. This list is incomplete.
            </div>
          )}

          <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/75 p-2 shadow-sm backdrop-blur-sm">
            <div className="relative min-w-0 flex-1 sm:hidden">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
              />
              <input
                type="text"
                placeholder="Search"
                aria-label="Search pull requests"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="tap-safe w-full rounded-md border border-line-control bg-surface py-2 pl-8 pr-2 text-sm text-ink placeholder:text-dim focus:border-accent focus:outline-none"
              />
            </div>

            <span className="px-1.5 font-mono text-xs tabular text-dim">
              {activeView === 'done-recently' ? shownDoneRecently.length : filteredPRs.length} shown
            </span>

            {unreadTotal > 0 && (
              <button
                onClick={handleMarkAllSeen}
                className="tap-safe inline-flex items-center gap-1.5 rounded-md border border-accent/30 bg-accent-wash px-2 py-1 text-xs font-medium text-accent transition-colors duration-instant ease-out hover:border-accent"
              >
                Mark {unreadTotal} seen
              </button>
            )}

            {activeView !== 'done-recently' && (
              <div className="ml-auto flex items-center gap-2">
                <SortMenu value={sortId} onChange={setSortId} />
              </div>
            )}
          </div>

          {activeChips.length > 0 && (
            <div className="mb-3">
              <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
            </div>
          )}

          {loading ? (
            <div className="rounded-md border border-line bg-surface px-6 py-20 text-center">
              <RefreshCw aria-hidden className="mx-auto h-6 w-6 animate-spin text-accent" />
              <p className="mt-3 text-sm text-muted">Loading pull requests…</p>
            </div>
          ) : (
            <>
              {activeView === 'done-recently' ? (
                shownDoneRecently.length > 0 ? (
                  <ul className="flex flex-col gap-3">
                    {shownDoneRecently.map((item) => (
                      <li
                        key={`${item.id}-${item.completedAt}`}
                        className="flex items-center gap-4 rounded-lg border border-line bg-surface px-5 py-4 shadow-sm"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ready-wash text-ready">
                          <CheckCircle2 aria-hidden className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-ink hover:text-accent"
                          >
                            {item.title}
                          </a>
                          <p className="mt-0.5 text-xs text-dim">
                            {item.repository} · #{item.number} · {item.outcome}{' '}
                            {new Date(item.completedAt).toLocaleDateString()}
                          </p>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open pull request ${item.number} on GitHub`}
                          className="rounded-full border border-line bg-surface-raised p-2 text-dim hover:text-ink"
                        >
                          <ExternalLink aria-hidden className="h-4 w-4" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="rounded-lg border border-line bg-surface px-6 py-16 text-center">
                    <CheckCircle2 aria-hidden className="mx-auto h-6 w-6 text-ready" />
                    <p className="mt-3 text-sm text-muted">
                      {doneRecently.length > 0
                        ? 'No completed pull requests match these filters.'
                        : 'Nothing completed in the last 7 days.'}
                    </p>
                    <p className="mt-1 text-xs text-dim">
                      {doneRecently.length > 0
                        ? 'Clear the active search or repository filter to see the full history.'
                        : 'Recently merged and closed pull requests from GitHub will appear here.'}
                    </p>
                  </div>
                )
              ) : (
                <>
                  {zonePRs.length > 0 && (
                    <section aria-labelledby="zone-heading" className="mb-8">
                      <h2
                        id="zone-heading"
                        className="mb-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.14em] text-warn"
                      >
                        <span aria-hidden className="h-2.5 w-0.5 rounded-full bg-warn" />
                        Blocked on you
                        <span className="tabular text-dim">{zonePRs.length}</span>
                      </h2>
                      <PRCardList prs={zonePRs} {...listProps} />
                    </section>
                  )}

                  {restPRs.length > 0 && showZone && zonePRs.length > 0 && (
                    <h2 className="mb-2 flex items-center gap-2 font-mono text-2xs uppercase tracking-[0.14em] text-dim">
                      Everything else
                      <span className="tabular">{restPRs.length}</span>
                    </h2>
                  )}

                  {restPRs.length === 0 && zonePRs.length === 0 ? (
                    <div className="rounded-md border border-line bg-surface px-6 py-16 text-center">
                      <p className="text-sm text-muted">Nothing in {activeViewLabel}.</p>
                      {selectedRepoSummary && selectedRepoSummary.hidden.length > 0 && (
                        <div className="mt-3">
                          <p className="text-sm text-dim">
                            {selectedRepoSummary.hidden.length}{' '}
                            {selectedRepoSummary.hidden.length === 1
                              ? 'pull request is'
                              : 'pull requests are'}{' '}
                            hidden in {selectedRepoSummary.shortName}.
                          </p>
                          <button
                            onClick={unhideSelectedRepo}
                            className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
                          >
                            Unhide {selectedRepoSummary.hidden.length}{' '}
                            {selectedRepoSummary.hidden.length === 1 ? 'PR' : 'PRs'}
                          </button>
                        </div>
                      )}
                      {selectedRepoSummary &&
                        selectedRepoSummary.visibleCount > 0 &&
                        selectedRepoSummary.snoozedCount === selectedRepoSummary.visibleCount &&
                        activeView !== 'snoozed' &&
                        searchQuery.trim() === '' && (
                          <div className="mt-3">
                            <p className="text-sm text-dim">
                              {selectedRepoSummary.snoozedCount}{' '}
                              {selectedRepoSummary.snoozedCount === 1
                                ? 'open pull request is'
                                : 'open pull requests are'}{' '}
                              snoozed in {selectedRepoSummary.shortName}.
                            </p>
                            <button
                              onClick={() => setActiveView('snoozed')}
                              className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
                            >
                              View snoozed PRs
                            </button>
                          </div>
                        )}
                      {selectedRepoSummary &&
                        selectedRepoSummary.visibleCount > 0 &&
                        selectedRepoSummary.snoozedCount !== selectedRepoSummary.visibleCount &&
                        activeView !== 'all' &&
                        searchQuery.trim() === '' && (
                          <div className="mt-3">
                            <p className="text-sm text-dim">
                              {selectedRepoSummary.visibleCount}{' '}
                              {selectedRepoSummary.visibleCount === 1
                                ? 'open pull request exists'
                                : 'open pull requests exist'}{' '}
                              in {selectedRepoSummary.shortName}, but none appear in{' '}
                              {activeViewLabel}.
                            </p>
                            <button
                              onClick={() => setActiveView('all')}
                              className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
                            >
                              Show open PRs
                            </button>
                          </div>
                        )}
                      {activeChips.length > 0 && (
                        <>
                          <p className="mt-1 text-sm text-dim">
                            {filterSummary} {activeChips.length === 1 ? 'is' : 'are'} still on.
                          </p>
                          <button
                            onClick={clearAllFilters}
                            className="tap-safe mt-3 rounded-md border border-line-control bg-surface px-3 py-1.5 text-sm text-muted transition-colors duration-instant ease-out hover:text-ink"
                          >
                            Clear{' '}
                            {activeChips.length === 1
                              ? activeChips[0].label.toLowerCase()
                              : 'filters'}
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <PRCardList prs={restPRs} {...listProps} />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>

      <BatchToolbar
        selected={selectedPRs}
        totalInView={filteredPRs.length}
        onSelectAll={() => {
          setSelectedPRIds(new Set(filteredPRs.map((pr) => pr.id)));
          lastPickedId.current = null;
        }}
        onClear={clearSelection}
        onRunBatch={(action, prs) => void runBatch(action, prs)}
        onHideAll={hideSelected}
        running={batchRunning}
      />

      <ConfirmDialog state={confirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}
