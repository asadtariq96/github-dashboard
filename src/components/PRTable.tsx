'use client';

import React, { useState } from 'react';
import { PullRequestAssessment } from '../types/pr';
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

export function PRRow({
  pr,
  isExpanded,
  onToggleExpand,
  isHidden = false,
  onToggleHide,
  onMerge,
  isMerging = false,
}: {
  pr: PullRequestAssessment;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onMerge?: (pr: PullRequestAssessment) => void;
  isMerging?: boolean;
}) {
  const updatedDate = new Date(pr.updatedAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const isWaitingApproval = Boolean(pr.mergeQueueInfo?.isWaitingForApproval);

  return (
    <>
      <tr
        onClick={onToggleExpand}
        className={`border-b border-slate-800/80 cursor-pointer transition-colors duration-150 ${
          isWaitingApproval
            ? 'bg-amber-950/40 hover:bg-amber-950/60 border-l-4 border-l-amber-400'
            : isExpanded
            ? 'bg-slate-900/90'
            : pr.needsAttention
            ? 'hover:bg-slate-900/50 bg-slate-950/40 border-l-4 border-l-amber-500/70'
            : 'hover:bg-slate-900/50 bg-slate-950/40'
        }`}
      >
        {/* Expand / Collapse Icon */}
        <td className="py-2.5 px-2 w-7 text-slate-400 text-center">
          {isExpanded ? (
            <ChevronDown className="w-3.5 h-3.5 text-slate-300 mx-auto" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 text-slate-400 mx-auto" />
          )}
        </td>

        {/* PR Title, Repo & Branch */}
        <td className="py-2.5 px-2">
          <div className="flex items-start gap-1.5 min-w-0">
            {isWaitingApproval ? (
              <UserCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400 animate-pulse" />
            ) : (
              <GitPullRequest
                className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${
                  pr.isDraft ? 'text-slate-500' : 'text-emerald-400'
                }`}
              />
            )}
            <div className="space-y-0.5 min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="font-medium text-slate-100 hover:text-sky-400 text-xs flex items-center gap-1 group"
                >
                  <span className="font-semibold text-sky-400 flex-shrink-0">#{pr.number}</span>
                  <span className="break-words font-medium">{pr.title}</span>
                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>

                {isWaitingApproval && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500 text-slate-950 shadow-sm animate-pulse flex-shrink-0">
                    <UserCheck className="w-2.5 h-2.5" />
                    APPROVAL
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

                {!isWaitingApproval && pr.needsAttention && (
                  <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded text-[10px] font-medium bg-amber-950 text-amber-300 border border-amber-800 flex-shrink-0">
                    <AlertCircle className="w-2.5 h-2.5" />
                    Action
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 text-[11px] text-slate-400 truncate">
                <span className="font-mono text-slate-400 font-medium truncate">
                  {pr.repository.nameWithOwner}
                </span>
                <span>•</span>
                <span className="inline-flex items-center gap-1 text-slate-400 font-mono text-[10px] truncate">
                  <GitBranch className="w-2.5 h-2.5 text-slate-400 flex-shrink-0" />
                  {pr.headRefName} → {pr.baseRefName}
                </span>
                <span>•</span>
                <span className="text-slate-500 text-[10px] flex-shrink-0">{updatedDate}</span>
              </div>
            </div>
          </div>
        </td>

        {/* 1. Lifecycle */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-16">
          <LifecycleBadge status={pr.lifecycle} />
        </td>

        {/* 2. Review */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-20">
          <ReviewBadge status={pr.review} />
        </td>

        {/* 3. Checks */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-18">
          <ChecksBadge status={pr.checks} />
        </td>

        {/* 4. Mergeability */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-28" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-center gap-1">
            <MergeabilityBadge
              status={pr.mergeability}
              isInMergeQueue={pr.isInMergeQueue}
              mergeQueueInfo={pr.mergeQueueInfo}
            />

            {pr.mergeability === 'Ready to Merge' && !pr.isInMergeQueue && !pr.isDraft && onMerge && (
              <button
                onClick={() => onMerge(pr)}
                disabled={isMerging}
                title={pr.hasRepoMergeQueue ? 'Push to Merge Queue' : 'Merge to Main'}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors shadow-sm disabled:opacity-50"
              >
                {isMerging ? (
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                ) : (
                  <GitMerge className="w-2.5 h-2.5" />
                )}
                {pr.hasRepoMergeQueue ? 'Queue' : 'Merge'}
              </button>
            )}
          </div>
        </td>

        {/* 5. Threads */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-12">
          <ThreadsBadge count={pr.unresolvedThreadsCount} />
        </td>

        {/* Quick Hide/Unhide Button */}
        <td className="py-2 px-1 text-center whitespace-nowrap w-7" onClick={(e) => e.stopPropagation()}>
          {onToggleHide && (
            <button
              onClick={onToggleHide}
              title={isHidden ? 'Unhide PR' : 'Hide PR from dashboard'}
              className="p-1 rounded text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              {isHidden ? (
                <Eye className="w-3 h-3 text-emerald-400" />
              ) : (
                <EyeOff className="w-3 h-3 opacity-60 hover:opacity-100" />
              )}
            </button>
          )}
        </td>
      </tr>

      {/* Expandable Inspection Drawer */}
      {isExpanded && (
        <tr>
          <td colSpan={8} className="p-0 border-b border-slate-800">
            <PRDrawer
              pr={pr}
              isHidden={isHidden}
              onToggleHide={onToggleHide}
              onMerge={onMerge}
              isMerging={isMerging}
            />
          </td>
        </tr>
      )}
    </>
  );
}

export function PRTable({
  prs,
  hiddenPRIds = new Set(),
  onToggleHidePR,
  onMergePR,
  mergingPRId,
}: {
  prs: PullRequestAssessment[];
  hiddenPRIds?: Set<string>;
  onToggleHidePR?: (id: string) => void;
  onMergePR?: (pr: PullRequestAssessment) => void;
  mergingPRId?: string | null;
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

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900/30 shadow-xl">
      <table className="w-full text-left border-collapse text-xs table-fixed">
        <thead>
          <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 font-semibold text-[11px] tracking-wider uppercase">
            <th className="py-2.5 px-2 w-7 text-center"></th>
            <th className="py-2.5 px-2">Pull Request & Repository</th>
            <th className="py-2.5 px-1.5 w-16 text-center">Mode</th>
            <th className="py-2.5 px-1.5 w-20 text-center">Review</th>
            <th className="py-2.5 px-1.5 w-18 text-center">CI</th>
            <th className="py-2.5 px-1.5 w-28 text-center">Merge</th>
            <th className="py-2.5 px-1.5 w-12 text-center">💬</th>
            <th className="py-2.5 px-1 w-7 text-center"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-normal">
          {prs.map((pr) => (
            <PRRow
              key={pr.id}
              pr={pr}
              isExpanded={Boolean(expandedPRs[pr.id])}
              onToggleExpand={() => toggleExpand(pr.id)}
              isHidden={hiddenPRIds.has(pr.id)}
              onToggleHide={onToggleHidePR ? () => onToggleHidePR(pr.id) : undefined}
              onMerge={onMergePR}
              isMerging={mergingPRId === pr.id}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
