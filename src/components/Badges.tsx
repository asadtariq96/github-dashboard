import React from 'react';
import {
  LifecycleStatus,
  ReviewStatus,
  ChecksStatus,
  MergeabilityStatus,
  MergeQueueInfo,
} from '../types/pr';
import {
  FileCode,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  GitMerge,
  GitBranch,
  MessageSquare,
  ShieldAlert,
  Loader2,
  ExternalLink,
  UserCheck,
} from 'lucide-react';

/**
 * Signal-First Badges: Neutral states (e.g., "Ready for review", "Pending review",
 * "Passing CI", "0 threads", "Blocked by Policy") return null to eliminate noise.
 */

export function LifecycleBadge({ status }: { status: LifecycleStatus }) {
  if (status === 'Draft') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-800 text-slate-300 border border-slate-700">
        <FileCode className="w-3 h-3 text-slate-400" />
        Draft
      </span>
    );
  }
  return null; // Omit normal "Ready" state
}

export function ReviewBadge({ status }: { status: ReviewStatus }) {
  switch (status) {
    case 'Approved':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/70 text-emerald-300 border border-emerald-700/60">
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Approved
        </span>
      );
    case 'Changes Requested':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/70 text-rose-300 border border-rose-700/70 animate-pulse">
          <XCircle className="w-3 h-3 text-rose-400" />
          Changes Requested
        </span>
      );
    case 'Awaiting Author':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-700/60">
          <Clock className="w-3 h-3 text-amber-400" />
          Awaiting Author
        </span>
      );
    case 'Review Required':
    default:
      return null; // Omit standard pending review
  }
}

export function ChecksBadge({ status }: { status: ChecksStatus }) {
  switch (status) {
    case 'Failing':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-700/70 animate-pulse">
          <XCircle className="w-3 h-3 text-rose-400" />
          CI Failing
        </span>
      );
    case 'Warning':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/70 text-amber-300 border border-amber-700/60">
          <AlertTriangle className="w-3 h-3 text-amber-400" />
          CI Warning
        </span>
      );
    case 'Running':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-sky-950/60 text-sky-300 border border-sky-700/60">
          <Loader2 className="w-3 h-3 text-sky-400 animate-spin" />
          CI Running
        </span>
      );
    case 'Passing':
    case 'Pending':
    case 'None':
    default:
      return null; // Omit standard passing/none checks
  }
}

export function MergeabilityBadge({
  status,
  isInMergeQueue,
  mergeQueueInfo,
}: {
  status: MergeabilityStatus;
  isInMergeQueue: boolean;
  mergeQueueInfo?: MergeQueueInfo;
}) {
  if (isInMergeQueue || status === 'In Merge Queue') {
    if (mergeQueueInfo?.isWaitingForApproval && mergeQueueInfo.approvalStepUrl) {
      return (
        <a
          href={mergeQueueInfo.approvalStepUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition-colors shadow-md animate-pulse"
          title={`Waiting for manual approval in: ${mergeQueueInfo.approvalStepName || 'CI pipeline'}. Click to view step.`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          <span>Waiting Approval</span>
          <ExternalLink className="w-2.5 h-2.5 opacity-80" />
        </a>
      );
    }

    const queueUrl = mergeQueueInfo?.url;
    const badgeContent = (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-purple-950/80 text-purple-200 border border-purple-700/60">
        <GitMerge className="w-3 h-3 text-purple-400 animate-pulse" />
        In Merge Queue{mergeQueueInfo?.position ? ` (#${mergeQueueInfo.position})` : ''}
        {queueUrl && <ExternalLink className="w-2.5 h-2.5 opacity-70 ml-0.5" />}
      </span>
    );

    if (queueUrl) {
      return (
        <a
          href={queueUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="hover:opacity-90 inline-block"
        >
          {badgeContent}
        </a>
      );
    }

    return badgeContent;
  }

  switch (status) {
    case 'Ready to Merge':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60">
          <GitMerge className="w-3 h-3 text-emerald-400" />
          Ready to Merge
        </span>
      );
    case 'Merge Conflicts':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-950/90 text-rose-300 border border-rose-700/80 animate-pulse">
          <AlertTriangle className="w-3 h-3 text-rose-400" />
          Merge Conflicts
        </span>
      );
    case 'Behind Base Branch':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-950/60 text-amber-300 border border-amber-700/60">
          <GitBranch className="w-3 h-3 text-amber-400" />
          Behind Base
        </span>
      );
    case 'Blocked by Policy':
    default:
      return null; // Omit standard blocked by policy
  }
}

export function ThreadsBadge({ count }: { count: number }) {
  if (count === 0) {
    return null; // Omit 0 comments
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-950/80 text-amber-300 border border-amber-700/70">
      <MessageSquare className="w-3 h-3 text-amber-400" />
      {count} unresolved
    </span>
  );
}
