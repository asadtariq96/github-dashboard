'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardSyncResponse, PullRequestAssessment } from '../types/pr';
import { PRCardList, LayoutMode, GridColumns } from './PRCardList';
import {
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  GitMerge,
  GitPullRequest,
  AlertCircle,
  FolderGit2,
  EyeOff,
  Eye,
  Rows,
  LayoutGrid,
} from 'lucide-react';

type FilterTab = 'all' | 'needs-attention' | 'failing' | 'ready' | 'in-queue' | 'drafts' | 'hidden';

const HIDDEN_PRS_STORAGE_KEY = 'gh_dashboard_hidden_prs';
const GRID_COLS_STORAGE_KEY = 'gh_dashboard_grid_cols';
const LAYOUT_MODE_STORAGE_KEY = 'gh_dashboard_layout_mode';

export function DashboardView() {
  const [data, setData] = useState<DashboardSyncResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filters & Settings
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('all');
  const [groupByRepo, setGroupByRepo] = useState(false);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('spaced');
  const [gridColumns, setGridColumns] = useState<GridColumns>(2);
  const [hiddenPRIds, setHiddenPRIds] = useState<Set<string>>(new Set());
  const [mergingPRId, setMergingPRId] = useState<string | null>(null);
  const [approvingPRId, setApprovingPRId] = useState<string | null>(null);
  const [updatingBranchPRId, setUpdatingBranchPRId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Load preferences from localStorage
  useEffect(() => {
    try {
      const storedHidden = localStorage.getItem(HIDDEN_PRS_STORAGE_KEY);
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) setHiddenPRIds(new Set(parsed));
      }

      const storedCols = localStorage.getItem(GRID_COLS_STORAGE_KEY);
      if (storedCols) {
        const cols = parseInt(storedCols, 10);
        if (cols >= 1 && cols <= 4) setGridColumns(cols as GridColumns);
      }

      const storedMode = localStorage.getItem(LAYOUT_MODE_STORAGE_KEY);
      if (storedMode === 'compact' || storedMode === 'spaced') {
        setLayoutMode(storedMode);
      }
    } catch (e) {
      console.warn('Failed to read preferences from localStorage:', e);
    }
  }, []);

  const handleSetGridColumns = (cols: GridColumns) => {
    setGridColumns(cols);
    try {
      localStorage.setItem(GRID_COLS_STORAGE_KEY, cols.toString());
    } catch (e) {
      console.warn('Failed to save grid cols preference:', e);
    }
  };

  const handleSetLayoutMode = (mode: LayoutMode) => {
    setLayoutMode(mode);
    try {
      localStorage.setItem(LAYOUT_MODE_STORAGE_KEY, mode);
    } catch (e) {
      console.warn('Failed to save layout mode preference:', e);
    }
  };

  // Toggle hide / unhide PR
  const handleToggleHidePR = (id: string) => {
    setHiddenPRIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      try {
        localStorage.setItem(HIDDEN_PRS_STORAGE_KEY, JSON.stringify(Array.from(next)));
      } catch (e) {
        console.warn('Failed to save hidden PRs to localStorage:', e);
      }
      return next;
    });
  };

  // Merge / Enqueue PR
  const handleMergePR = async (pr: PullRequestAssessment) => {
    const actionLabel = pr.hasRepoMergeQueue ? 'add this PR to the merge queue' : 'merge this PR directly into main';
    const confirmed = window.confirm(
      `Are you sure you want to ${actionLabel} for:\n\n#${pr.number} - ${pr.title}?`
    );
    if (!confirmed) return;

    setMergingPRId(pr.id);
    setError(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/prs/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prId: pr.id,
          enqueue: Boolean(pr.hasRepoMergeQueue),
          mergeMethod: 'SQUASH',
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Merge request failed');
      }

      setActionSuccessMessage(
        `Successfully ${pr.hasRepoMergeQueue ? 'enqueued' : 'merged'} PR #${pr.number}!`
      );
      setTimeout(() => setActionSuccessMessage(null), 6000);
      await fetchDashboardState(true);
    } catch (err: any) {
      setError(`Failed to process PR #${pr.number}: ${err.message}`);
    } finally {
      setMergingPRId(null);
    }
  };

  // Programmatically approve deployment gate
  const handleApproveDeployment = async (pr: PullRequestAssessment) => {
    if (!pr.mergeQueueInfo?.runId) return;

    const confirmed = window.confirm(
      `Are you sure you want to approve and trigger deployment for:\n\n#${pr.number} - ${pr.title}\n(${pr.mergeQueueInfo.approvalStepName || 'Manual Approval'})?`
    );
    if (!confirmed) return;

    setApprovingPRId(pr.id);
    setError(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/prs/approve-deployment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repoWithOwner: pr.repository.nameWithOwner,
          runId: pr.mergeQueueInfo.runId,
          environmentIds: pr.mergeQueueInfo.environmentIds,
          comment: `Approved via GitHub PR Dashboard for #${pr.number}`,
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Deployment approval failed');
      }

      setActionSuccessMessage(
        `Successfully approved environment deployment for #${pr.number}!`
      );
      setTimeout(() => setActionSuccessMessage(null), 6000);
      await fetchDashboardState(true);
    } catch (err: any) {
      setError(`Failed to approve deployment for PR #${pr.number}: ${err.message}`);
    } finally {
      setApprovingPRId(null);
    }
  };

  // Update Branch with base branch changes
  const handleUpdateBranch = async (pr: PullRequestAssessment) => {
    const confirmed = window.confirm(
      `Update branch for #${pr.number} (${pr.headRefName}) with latest changes from ${pr.baseRefName}?`
    );
    if (!confirmed) return;

    setUpdatingBranchPRId(pr.id);
    setError(null);
    setActionSuccessMessage(null);

    try {
      const res = await fetch('/api/prs/update-branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prId: pr.id }),
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Failed to update branch');
      }

      setActionSuccessMessage(`Successfully updated branch for #${pr.number}!`);
      setTimeout(() => setActionSuccessMessage(null), 6000);
      await fetchDashboardState(true);
    } catch (err: any) {
      setError(`Failed to update branch for PR #${pr.number}: ${err.message}`);
    } finally {
      setUpdatingBranchPRId(null);
    }
  };

  // Polling function
  const fetchDashboardState = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const endpoint = manual ? '/api/refresh' : '/api/prs';
      const method = manual ? 'POST' : 'GET';
      const res = await fetch(endpoint, { method });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: DashboardSyncResponse = await res.json();
      setData(json);
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

    // 1. Connect to SSE Stream for instant webhook-driven updates
    let eventSource: EventSource | null = null;
    try {
      eventSource = new EventSource('/api/events');
      eventSource.addEventListener('update', () => {
        console.log('[SSE] Received live update event from server');
        fetchDashboardState(false);
      });
      eventSource.onerror = (e) => {
        console.warn('[SSE] EventSource connection issue, falling back to interval:', e);
      };
    } catch (e) {
      console.warn('[SSE] EventSource init failed:', e);
    }

    // 2. Periodic polling interval as heartbeat/safety net
    const interval = setInterval(() => {
      fetchDashboardState(false);
    }, 30000);

    return () => {
      clearInterval(interval);
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  const prs = data?.prs || [];

  // Distinct repositories
  const repositories = useMemo(() => {
    const set = new Set<string>();
    prs.forEach((pr) => set.add(pr.repository.nameWithOwner));
    return Array.from(set).sort();
  }, [prs]);

  // Filtered and Sorted PR list (Waiting Approval PRs ALWAYS sorted to the top)
  const filteredPRs = useMemo(() => {
    const list = prs.filter((pr) => {
      const isHidden = hiddenPRIds.has(pr.id);

      // Hidden tab specifically shows only hidden PRs
      if (activeTab === 'hidden') {
        if (!isHidden) return false;
      } else {
        // Normal tabs exclude hidden PRs
        if (isHidden) return false;

        // Tab filter
        if (activeTab === 'needs-attention' && !pr.needsAttention) return false;
        if (activeTab === 'failing' && pr.checks !== 'Failing') return false;
        if (activeTab === 'ready' && (pr.mergeability !== 'Ready to Merge' || pr.isInMergeQueue)) return false;
        if (activeTab === 'in-queue' && !pr.isInMergeQueue) return false;
        if (activeTab === 'drafts' && !pr.isDraft) return false;
      }

      // Repository filter
      if (selectedRepo !== 'all' && pr.repository.nameWithOwner !== selectedRepo) return false;

      // Search query filter
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const matchesNumber = pr.number.toString().includes(q);
        const matchesTitle = pr.title.toLowerCase().includes(q);
        const matchesRepo = pr.repository.nameWithOwner.toLowerCase().includes(q);
        const matchesBranch = pr.headRefName.toLowerCase().includes(q);
        if (!matchesNumber && !matchesTitle && !matchesRepo && !matchesBranch) return false;
      }

      return true;
    });

    // PRIORITY SORT: Waiting for approval at the absolute top, then by updatedAt descending
    return list.sort((a, b) => {
      const aWaiting = a.mergeQueueInfo?.isWaitingForApproval ? 1 : 0;
      const bWaiting = b.mergeQueueInfo?.isWaitingForApproval ? 1 : 0;
      if (aWaiting !== bWaiting) {
        return bWaiting - aWaiting;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [prs, activeTab, selectedRepo, searchQuery, hiddenPRIds]);

  // Grouped by repo map (Groups containing Waiting Approval appear first, and PRs inside are sorted)
  const groupedPRs = useMemo(() => {
    if (!groupByRepo) return null;
    const map = new Map<string, PullRequestAssessment[]>();
    filteredPRs.forEach((pr) => {
      const repo = pr.repository.nameWithOwner;
      if (!map.has(repo)) map.set(repo, []);
      map.get(repo)!.push(pr);
    });

    // Sort repository groups so repos with Waiting Approval PRs appear first
    const sortedEntries = Array.from(map.entries()).sort(([repoA, prsA], [repoB, prsB]) => {
      const aHasWaiting = prsA.some((p) => p.mergeQueueInfo?.isWaitingForApproval) ? 1 : 0;
      const bHasWaiting = prsB.some((p) => p.mergeQueueInfo?.isWaitingForApproval) ? 1 : 0;
      if (aHasWaiting !== bHasWaiting) {
        return bHasWaiting - aHasWaiting;
      }
      return repoA.localeCompare(repoB);
    });

    return new Map(sortedEntries);
  }, [filteredPRs, groupByRepo]);

  // Quick stats excluding hidden PRs
  const visiblePRs = useMemo(() => prs.filter((p) => !hiddenPRIds.has(p.id)), [prs, hiddenPRIds]);
  const hiddenCount = useMemo(() => prs.filter((p) => hiddenPRIds.has(p.id)).length, [prs, hiddenPRIds]);

  const totalCount = visiblePRs.length;
  const attentionCount = visiblePRs.filter((p) => p.needsAttention).length;
  const failingCount = visiblePRs.filter((p) => p.checks === 'Failing').length;
  const readyCount = visiblePRs.filter((p) => p.mergeability === 'Ready to Merge' && !p.isInMergeQueue).length;
  const inQueueCount = visiblePRs.filter((p) => p.isInMergeQueue).length;
  const draftCount = visiblePRs.filter((p) => p.isDraft).length;

  const formattedTime = data?.lastUpdated
    ? new Date(data.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className="w-full max-w-[98%] mx-auto px-2 sm:px-4 py-4 space-y-4">
      {/* Top Header & Sync Status */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
              <GitPullRequest className="w-5 h-5 text-emerald-400" />
              GitHub PR Dashboard
            </h1>
            {data && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[11px] font-medium border ${
                  data.syncStatus === 'Healthy'
                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800/60'
                    : data.syncStatus === 'Syncing'
                    ? 'bg-sky-950/60 text-sky-300 border-sky-800/60'
                    : 'bg-rose-950/60 text-rose-300 border-rose-800/60'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    data.syncStatus === 'Healthy'
                      ? 'bg-emerald-400'
                      : data.syncStatus === 'Syncing'
                      ? 'bg-sky-400 animate-ping'
                      : 'bg-rose-400'
                  }`}
                />
                {data.syncStatus}
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Query: <code className="text-slate-300 bg-slate-900 px-1 py-0.2 rounded font-mono text-[10px]">{data?.query || 'author:@me is:pr is:open'}</code>
            {formattedTime && <span className="ml-2">• Synced at {formattedTime}</span>}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchDashboardState(true)}
            disabled={refreshing || loading}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-200 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-sky-400' : 'text-slate-400'}`} />
            {refreshing ? 'Syncing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error alert banner if any */}
      {error && (
        <div className="p-4 rounded-md bg-rose-950/50 border border-rose-800 text-rose-200 text-xs sm:text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Error: </span>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Action Success banner */}
      {actionSuccessMessage && (
        <div className="p-4 rounded-md bg-emerald-950/50 border border-emerald-800 text-emerald-200 text-xs sm:text-sm flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <span className="font-medium">{actionSuccessMessage}</span>
        </div>
      )}

      {/* Quick Filter Pill Buttons */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-xs">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border ${
            activeTab === 'all'
              ? 'bg-slate-100 text-slate-900 border-slate-100'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200 hover:bg-slate-800'
          }`}
        >
          All ({totalCount})
        </button>

        <button
          onClick={() => setActiveTab('needs-attention')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            activeTab === 'needs-attention'
              ? 'bg-amber-500 text-slate-950 font-bold border-amber-500'
              : 'bg-slate-900 text-amber-400 border-amber-900/60 hover:bg-amber-950/40'
          }`}
        >
          <AlertCircle className="w-3 h-3" />
          Attention ({attentionCount})
        </button>

        <button
          onClick={() => setActiveTab('failing')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            activeTab === 'failing'
              ? 'bg-rose-500 text-white font-bold border-rose-500'
              : 'bg-slate-900 text-rose-400 border-rose-900/60 hover:bg-rose-950/40'
          }`}
        >
          <AlertTriangle className="w-3 h-3" />
          Failing ({failingCount})
        </button>

        <button
          onClick={() => setActiveTab('ready')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            activeTab === 'ready'
              ? 'bg-emerald-500 text-slate-950 font-bold border-emerald-500'
              : 'bg-slate-900 text-emerald-400 border-emerald-900/60 hover:bg-emerald-950/40'
          }`}
        >
          <GitMerge className="w-3 h-3" />
          Ready ({readyCount})
        </button>

        <button
          onClick={() => setActiveTab('in-queue')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            activeTab === 'in-queue'
              ? 'bg-purple-600 text-white font-bold border-purple-500'
              : 'bg-slate-900 text-purple-400 border-purple-900/60 hover:bg-purple-950/40'
          }`}
        >
          <GitMerge className="w-3 h-3" />
          In Queue ({inQueueCount})
        </button>

        <button
          onClick={() => setActiveTab('drafts')}
          className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ${
            activeTab === 'drafts'
              ? 'bg-slate-300 text-slate-900 font-bold border-slate-300'
              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
          }`}
        >
          Drafts ({draftCount})
        </button>

        {hiddenCount > 0 && (
          <button
            onClick={() => setActiveTab(activeTab === 'hidden' ? 'all' : 'hidden')}
            className={`px-2.5 py-1 rounded-full font-medium transition-colors border flex items-center gap-1 ml-auto ${
              activeTab === 'hidden'
                ? 'bg-purple-600 text-white font-bold border-purple-500 shadow-sm'
                : 'bg-slate-900 text-purple-400 border-purple-900/60 hover:bg-purple-950/40'
            }`}
          >
            {activeTab === 'hidden' ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
            {activeTab === 'hidden' ? 'Hidden View' : `Hidden (${hiddenCount})`}
          </button>
        )}
      </div>

      {/* Search & Repository Filter Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-800">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by title, #number, repo, branch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-md pl-8 pr-3 py-1 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Repository selector & Layout Switcher */}
        <div className="flex items-center gap-2">
          {repositories.length > 1 && (
            <>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-md px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Repos ({repositories.length})</option>
                {repositories.map((repo) => (
                  <option key={repo} value={repo}>
                    {repo}
                  </option>
                ))}
              </select>

              <button
                onClick={() => setGroupByRepo(!groupByRepo)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium border flex items-center gap-1 transition-colors ${
                  groupByRepo
                    ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700'
                    : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                }`}
              >
                <FolderGit2 className="w-3 h-3" />
                Group
              </button>
            </>
          )}

          {/* Density & Multi-Column Switcher */}
          <div className="flex items-center gap-1.5 bg-slate-950 rounded-md border border-slate-800 p-0.5">
            {/* View Mode */}
            <div className="flex items-center">
              <button
                onClick={() => handleSetLayoutMode('compact')}
                title="Compact List"
                className={`p-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                  layoutMode === 'compact'
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Rows className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => handleSetLayoutMode('spaced')}
                title="Spaced Cards"
                className={`p-1 rounded text-xs font-medium flex items-center gap-1 transition-colors ${
                  layoutMode === 'spaced'
                    ? 'bg-slate-800 text-slate-100 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="w-px h-3.5 bg-slate-800" />

            {/* Column Selector */}
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4].map((num) => (
                <button
                  key={num}
                  onClick={() => handleSetGridColumns(num as GridColumns)}
                  title={`${num} Column${num > 1 ? 's' : ''}`}
                  className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-colors ${
                    gridColumns === num
                      ? 'bg-emerald-600 text-slate-950 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                  }`}
                >
                  {num}C
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main PR List Content */}
      {loading ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-16 text-center text-slate-400 space-y-3">
          <RefreshCw className="w-8 h-8 text-emerald-400 mx-auto animate-spin" />
          <p className="text-sm font-medium text-slate-300">Fetching open pull requests from GitHub...</p>
        </div>
      ) : groupByRepo && groupedPRs ? (
        <div className="space-y-6">
          {Array.from(groupedPRs.entries()).map(([repoName, repoPrs]) => (
            <div key={repoName} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                <FolderGit2 className="w-3.5 h-3.5 text-slate-500" />
                {repoName}
                <span className="font-normal text-slate-500">({repoPrs.length})</span>
              </h3>
              <PRCardList
                prs={repoPrs}
                hiddenPRIds={hiddenPRIds}
                onToggleHidePR={handleToggleHidePR}
                onMergePR={handleMergePR}
                mergingPRId={mergingPRId}
                onApproveDeployment={handleApproveDeployment}
                approvingPRId={approvingPRId}
                onUpdateBranch={handleUpdateBranch}
                updatingBranchPRId={updatingBranchPRId}
                layoutMode={layoutMode}
                activity={data?.activity}
                gridColumns={gridColumns}
              />
            </div>
          ))}
        </div>
      ) : (
        <PRCardList
          prs={filteredPRs}
          hiddenPRIds={hiddenPRIds}
          onToggleHidePR={handleToggleHidePR}
          onMergePR={handleMergePR}
          mergingPRId={mergingPRId}
          onApproveDeployment={handleApproveDeployment}
          approvingPRId={approvingPRId}
          onUpdateBranch={handleUpdateBranch}
          updatingBranchPRId={updatingBranchPRId}
          layoutMode={layoutMode}
          activity={data?.activity}
          gridColumns={gridColumns}
        />
      )}
    </div>
  );
}
