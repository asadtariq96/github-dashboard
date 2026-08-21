'use client';

import React, { useState } from 'react';
import { PrActivityInfo, PullRequestAssessment } from '../types/pr';
import { computeNew, recordVisit } from '../lib/visited';
import {
  LifecycleBadge,
  ReviewBadge,
  ChecksBadge,
  MergeabilityBadge,
  ThreadsBadge,
} from './Badges';
import { PRDrawer } from './PRDrawer';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GitBranch,
  GitPullRequest,
  Layers,
  AlertCircle,
  EyeOff,
  Eye,
  GitMerge,
  Loader2,
  UserCheck,
} from 'lucide-react';

export type LayoutMode = 'compact' | 'spaced';
export type GridColumns = 1 | 2 | 3 | 4;

export function PRCard({
  pr,
  isExpanded,
  onToggleExpand,
  isHidden = false,
  onToggleHide,
  onMerge,
  isMerging = false,
  onApproveDeployment,
  isApprovingDeployment = false,
  onUpdateBranch,
  isUpdatingBranch = false,
  layoutMode = 'compact',
  activity,
}: {
  pr: PullRequestAssessment;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onMerge?: (pr: PullRequestAssessment) => void;
  isMerging?: boolean;
  onApproveDeployment?: (pr: PullRequestAssessment) => void;
  isApprovingDeployment?: boolean;
  onUpdateBranch?: (pr: PullRequestAssessment) => void;
  isUpdatingBranch?: boolean;
  layoutMode?: LayoutMode;
  activity?: PrActivityInfo;
}) {
  const updatedDate = new Date(pr.updatedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isWaitingApproval = Boolean(pr.mergeQueueInfo?.isWaitingForApproval);

  const prKey = `${pr.repository.nameWithOwner}#${pr.number}`;
  const newActivity = computeNew(activity, prKey);
  const hasNew = newActivity.count > 0;

  const handleExpand = () => {
    if (isExpanded) recordVisit(prKey); // closing the drawer = it has been seen
    onToggleExpand();
  };

  // Check if any status pill is actively shown
  const hasReviewBadge = pr.review === 'Approved' || pr.review === 'Changes Requested' || pr.review === 'Awaiting Author';
  const hasChecksBadge = pr.checks === 'Failing' || pr.checks === 'Running';
  const hasMergeBadge = pr.isInMergeQueue || pr.mergeability === 'Ready to Merge' || pr.mergeability === 'Merge Conflicts' || pr.mergeability === 'Behind Base Branch';
  const hasThreadsBadge = pr.unresolvedThreadsCount > 0;
  const hasDraftBadge = pr.isDraft;
  const hasAnyPill = hasReviewBadge || hasChecksBadge || hasMergeBadge || hasThreadsBadge || hasDraftBadge;

  return (
    <div
      className={`transition-all duration-150 flex flex-col justify-between ${
        layoutMode === 'spaced'
          ? 'rounded-lg border border-slate-800/80 bg-slate-900/40 shadow-sm overflow-hidden'
          : 'border-b border-slate-800/70 bg-slate-950/40'
      } ${
        isWaitingApproval
          ? 'bg-amber-950/25 border-l-4 border-l-amber-400'
          : ''
      } ${isExpanded ? 'bg-slate-900/70' : 'hover:bg-slate-900/40'}`}
    >
      {/* Main Clickable Header / Card Area */}
      <div
        onClick={handleExpand}
        className="p-3 cursor-pointer space-y-2 flex-1 flex flex-col justify-between"
      >
        <div className="space-y-1.5">
          {/* Top Line: PR Number, Title & Actions */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-1.5 min-w-0 flex-1">
              {isWaitingApproval ? (
                <UserCheck className="w-4 h-4 mt-0.5 flex-shrink-0 text-amber-400 animate-pulse" />
              ) : (
                <GitPullRequest
                  className={`w-4 h-4 mt-0.5 flex-shrink-0 ${
                    pr.isDraft ? 'text-slate-500' : 'text-emerald-400'
                  }`}
                />
              )}

              <div className="space-y-0.5 min-w-0 flex-1">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => {
                    e.stopPropagation();
                    recordVisit(prKey);
                  }}
                  className="font-medium text-slate-100 hover:text-sky-400 text-xs sm:text-sm leading-snug group flex items-baseline gap-1 break-words"
                >
                  <span className="text-sky-400 font-mono flex-shrink-0">#{pr.number}</span>
                  <span className="break-words">{pr.title}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center" />
                </a>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {isWaitingApproval && onApproveDeployment && (
                <button
                  onClick={() => onApproveDeployment(pr)}
                  disabled={isApprovingDeployment}
                  title="Approve and deploy manual environment gate"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow disabled:opacity-50 animate-pulse"
                >
                  {isApprovingDeployment ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <UserCheck className="w-3 h-3" />
                  )}
                  Approve
                </button>
              )}

              {pr.mergeability === 'Ready to Merge' && !pr.isInMergeQueue && !pr.isDraft && onMerge && (
                <button
                  onClick={() => onMerge(pr)}
                  disabled={isMerging}
                  title={pr.hasRepoMergeQueue ? 'Push to Merge Queue' : 'Merge to Main'}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors shadow disabled:opacity-50"
                >
                  {isMerging ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <GitMerge className="w-3 h-3" />
                  )}
                  {pr.hasRepoMergeQueue ? 'Queue' : 'Merge'}
                </button>
              )}

              {pr.canUpdateBranch && onUpdateBranch && (
                <button
                  onClick={() => onUpdateBranch(pr)}
                  disabled={isUpdatingBranch}
                  title="Update branch with latest changes from base branch"
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
                >
                  {isUpdatingBranch ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <GitBranch className="w-3 h-3 text-sky-400" />
                  )}
                  Update
                </button>
              )}

              {onToggleHide && (
                <button
                  onClick={onToggleHide}
                  title={isHidden ? 'Unhide PR' : 'Hide PR from dashboard'}
                  className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
                >
                  {isHidden ? (
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <EyeOff className="w-3.5 h-3.5 opacity-60 hover:opacity-100" />
                  )}
                </button>
              )}

              <button
                onClick={onToggleExpand}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>
            </div>
          </div>

          {/* Sub-metadata: Repository, Branches, Timestamp */}
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 flex-wrap">
            <span className="font-mono text-slate-300 font-medium bg-slate-900/80 px-1 py-0.2 rounded border border-slate-800 truncate max-w-[200px]">
              {pr.repository.nameWithOwner}
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-mono text-slate-400 text-[10px] truncate max-w-[180px]">
              <GitBranch className="w-2.5 h-2.5 text-slate-500 flex-shrink-0" />
              <span className="text-slate-300 truncate">{pr.headRefName}</span>
              <span className="text-slate-500">→</span>
              <span className="text-slate-300 truncate">{pr.baseRefName}</span>
            </span>
            <span>•</span>
            <span className="text-slate-500 text-[10px] flex-shrink-0">{updatedDate}</span>

            {hasNew && (
              <span
                title={`${newActivity.count} new ${
                  newActivity.count === 1 ? 'item' : 'items'
                } since ${
                  newActivity.threshold === 'visited'
                    ? 'your last visit'
                    : 'your last activity'
                }`}
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/40 flex-shrink-0"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                {newActivity.count} new
              </span>
            )}

            {pr.isStacked && (
              <span
                title={
                  pr.stackedParent
                    ? `Stacked on #${pr.stackedParent.prNumber}`
                    : `Targeting base branch: ${pr.baseRefName}`
                }
                className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-medium bg-indigo-950 text-indigo-300 border border-indigo-800 flex-shrink-0"
              >
                <Layers className="w-2.5 h-2.5" />
                Stacked
              </span>
            )}
          </div>
        </div>

        {/* Bottom Signal Pills (Only shown when active indicators exist) */}
        {hasAnyPill && (
          <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-slate-800/40">
            <LifecycleBadge status={pr.lifecycle} />
            <MergeabilityBadge
              status={pr.mergeability}
              isInMergeQueue={pr.isInMergeQueue}
              mergeQueueInfo={pr.mergeQueueInfo}
            />
            <ReviewBadge status={pr.review} />
            <ChecksBadge status={pr.checks} />
            <ThreadsBadge count={pr.unresolvedThreadsCount} />
          </div>
        )}
      </div>

      {/* Expanded Inspection Drawer */}
      {isExpanded && (
        <PRDrawer
          pr={pr}
          prKey={prKey}
          activity={activity}
          isHidden={isHidden}
          onToggleHide={onToggleHide}
          onMerge={onMerge}
          isMerging={isMerging}
          onApproveDeployment={onApproveDeployment}
          isApprovingDeployment={isApprovingDeployment}
          onUpdateBranch={onUpdateBranch}
          isUpdatingBranch={isUpdatingBranch}
        />
      )}
    </div>
  );
}

export function PRCardList({
  prs,
  hiddenPRIds = new Set(),
  onToggleHidePR,
  onMergePR,
  mergingPRId,
  onApproveDeployment,
  approvingPRId,
  onUpdateBranch,
  updatingBranchPRId,
  layoutMode = 'compact',
  gridColumns = 2,
  activity,
}: {
  prs: PullRequestAssessment[];
  hiddenPRIds?: Set<string>;
  onToggleHidePR?: (id: string) => void;
  onMergePR?: (pr: PullRequestAssessment) => void;
  mergingPRId?: string | null;
  onApproveDeployment?: (pr: PullRequestAssessment) => void;
  approvingPRId?: string | null;
  onUpdateBranch?: (pr: PullRequestAssessment) => void;
  updatingBranchPRId?: string | null;
  layoutMode?: LayoutMode;
  gridColumns?: GridColumns;
  activity?: Record<string, PrActivityInfo>;
}) {
  const [expandedPRs, setExpandedPRs] = useState<Record<string, boolean>>({});

  const toggleExpand = (id: string) => {
    setExpandedPRs((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (prs.length === 0) {
    return (
      <div className="bg-slate-900/40 border border-slate-800 rounded-lg p-12 text-center text-slate-400 space-y-2">
        <GitPullRequest className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-base font-medium text-slate-300">No Pull Requests match the selected filter.</p>
        <p className="text-xs text-slate-500">All clear or try clearing your search queries.</p>
      </div>
    );
  }

  // Responsive Grid classes based on chosen columns
  const getGridClasses = () => {
    if (layoutMode === 'compact') {
      if (gridColumns === 1) return 'grid grid-cols-1 divide-y divide-slate-800/70';
      if (gridColumns === 2) return 'grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:gap-px bg-slate-800/70';
      if (gridColumns === 3) return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 divide-y md:divide-y-0 gap-px bg-slate-800/70';
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 divide-y md:divide-y-0 gap-px bg-slate-800/70';
    } else {
      // Spaced Cards
      if (gridColumns === 1) return 'grid grid-cols-1 gap-2.5';
      if (gridColumns === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-2.5';
      if (gridColumns === 3) return 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5';
      return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-2.5';
    }
  };

  return (
    <div
      className={
        layoutMode === 'spaced'
          ? getGridClasses()
          : `rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden shadow-xl ${getGridClasses()}`
      }
    >
      {prs.map((pr) => (
        <PRCard
          key={pr.id}
          pr={pr}
          isExpanded={Boolean(expandedPRs[pr.id])}
          onToggleExpand={() => toggleExpand(pr.id)}
          isHidden={hiddenPRIds.has(pr.id)}
          onToggleHide={onToggleHidePR ? () => onToggleHidePR(pr.id) : undefined}
          onMerge={onMergePR}
          isMerging={mergingPRId === pr.id}
          onApproveDeployment={onApproveDeployment}
          isApprovingDeployment={approvingPRId === pr.id}
          onUpdateBranch={onUpdateBranch}
          isUpdatingBranch={updatingBranchPRId === pr.id}
          layoutMode={layoutMode}
          activity={activity ? activity[`${pr.repository.nameWithOwner}#${pr.number}`] : undefined}
        />
      ))}
    </div>
  );
}
