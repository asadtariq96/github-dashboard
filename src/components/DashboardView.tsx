'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { DashboardSyncResponse, PrActivityInfo, PullRequestAssessment } from '../types/pr';
import type { Mode } from '../lib/config';
import { PRCardList } from './PRCardList';
import { toast } from 'sonner';
import { ConfirmDialog, type ConfirmState } from './ConfirmDialog';
import { BatchToolbar } from './BatchToolbar';
import { actionById, type RowActionId } from '../lib/rowAction';
import { buildActionCall, confirmDetailFor, postApi } from '../lib/prApi';
import { filterPrs } from '../lib/filterPrs';
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
import { Rail, countViews, defaultViewFor, isViewFor, viewsFor, type ViewId } from './Rail';
import { RefreshCw, Search, AlertCircle } from 'lucide-react';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { DoneRecentlyEmpty, DoneRecentlyList } from './dashboard/DoneRecentlyList';
import { EmptyQueue } from './dashboard/EmptyQueue';

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
  const post = postApi;

  const runAction = async (pr: PullRequestAssessment, id: RowActionId) => {
    const call = buildActionCall(pr, id);
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
      detail: confirmDetailFor(id, pr) ?? pr.title,
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
    const list = filterPrs(prs, {
      mode,
      activeView,
      selectedRepo,
      searchQuery,
      hiddenPRIds,
      snoozedUntil,
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

  /** Keys for the rows currently on screen, used to lazily fill their activity timelines. */
  const visibleKeys = useMemo(
    () => filteredPRs.map((pr) => `${pr.repository.nameWithOwner}#${pr.number}`),
    [filteredPRs],
  );

  /**
   * Fetch timelines for the rows on screen, and only those. The server eagerly refreshes
   * actionable PRs, so this fills whatever else the current view is showing.
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

  const BATCH_LABEL: Partial<Record<RowActionId, string>> = {
    'update-branch': 'Update branches',
    'rerun-checks': 'Re-run checks',
  };

  const handleRunBatch = (action: RowActionId, prs: PullRequestAssessment[]) => {
    if (batchRunning) return;
    const label = BATCH_LABEL[action] ?? 'Run batch';
    const preview = prs
      .slice(0, 5)
      .map((pr) => `#${pr.number}`)
      .join(', ');
    const more = prs.length > 5 ? ` and ${prs.length - 5} more` : '';
    setConfirm({
      title: `${label} on ${prs.length} pull request${prs.length === 1 ? '' : 's'}?`,
      detail: `${preview}${more}\n\nRuns 4 at a time to stay under GitHub's rate limit.`,
      confirmLabel: label,
      run: () => runBatch(action, prs),
    });
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
        const call = buildActionCall(pr, action);
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
    <div className="flex h-dvh min-h-0 flex-col overflow-hidden">
      <DashboardHeader
        mode={mode}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        data={data}
        totalCount={totalCount}
        formattedTime={formattedTime}
        refreshing={refreshing}
        loading={loading}
        busyCount={busyCount}
        onRefresh={() => fetchDashboardState(true)}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden sm:flex-row">
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

        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden px-4 py-3 sm:px-6 lg:px-8">
          <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface/75 p-2 shadow-sm backdrop-blur-sm">
            <div className="shrink-0 px-1">
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-dim">
                {mode === 'mine' ? 'Your workspace' : 'Review inbox'}
              </p>
              <h2 className="font-display text-xl capitalize leading-none tracking-tight text-ink">
                {activeViewLabel}
              </h2>
            </div>

            <span aria-hidden className="hidden h-7 w-px bg-line sm:block" />

            <div className="relative min-w-[12rem] flex-1 sm:hidden">
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

            <span className="shrink-0 px-1 font-mono text-xs tabular text-dim">
              {activeView === 'done-recently' ? shownDoneRecently.length : filteredPRs.length} shown
            </span>

            {activeChips.length > 0 && (
              <div className="min-w-0">
                <FilterChips chips={activeChips} onClearAll={clearAllFilters} />
              </div>
            )}

            {unreadTotal > 0 && (
              <button
                onClick={handleMarkAllSeen}
                className="tap-safe inline-flex shrink-0 items-center gap-1.5 rounded-md border border-accent/30 bg-accent-wash px-2 py-1 text-xs font-medium text-accent transition-colors duration-instant ease-out hover:border-accent"
              >
                Mark {unreadTotal} seen
              </button>
            )}

            {activeView !== 'done-recently' && (
              <div className="ml-auto flex shrink-0 items-center">
                <SortMenu value={sortId} onChange={setSortId} />
              </div>
            )}
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

          <div className="min-h-0 flex-1 overflow-hidden">
            {loading ? (
              <div className="scroll-region h-full overflow-y-auto rounded-md border border-line bg-surface px-6 py-20 text-center">
                <RefreshCw aria-hidden className="mx-auto h-6 w-6 animate-spin text-accent" />
                <p className="mt-3 text-sm text-muted">Loading pull requests…</p>
              </div>
            ) : activeView === 'done-recently' ? (
              <div className="scroll-region h-full overflow-y-auto pb-4 pr-1">
                {shownDoneRecently.length > 0 ? (
                  <DoneRecentlyList items={shownDoneRecently} />
                ) : (
                  <DoneRecentlyEmpty hasAny={doneRecently.length > 0} />
                )}
              </div>
            ) : filteredPRs.length === 0 ? (
              <div className="scroll-region h-full overflow-y-auto pb-4 pr-1">
                <EmptyQueue
                  activeView={activeView}
                  activeViewLabel={activeViewLabel}
                  selectedRepoSummary={selectedRepoSummary}
                  onUnhideRepo={unhideSelectedRepo}
                  onViewSnoozed={() => setActiveView('snoozed')}
                  onShowAll={() => setActiveView('all')}
                  activeChips={activeChips}
                  filterSummary={filterSummary}
                  onClearFilters={clearAllFilters}
                  hasSearchQuery={searchQuery.trim() !== ''}
                />
              </div>
            ) : (
              <PRCardList prs={filteredPRs} {...listProps} />
            )}
          </div>
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
        onRunBatch={(action, prs) => handleRunBatch(action, prs)}
        onHideAll={hideSelected}
        running={batchRunning}
      />

      <ConfirmDialog state={confirm} onCancel={() => setConfirm(null)} />
    </div>
  );
}
