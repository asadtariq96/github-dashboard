import React from 'react';
import { PrActivityInfo, PullRequestAssessment } from '../types/pr';
import { computeNew } from '../lib/visited';
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  FileCode,
  Layers,
  UserCheck,
  GitMerge,
  GitBranch,
  EyeOff,
  Eye,
  Loader2,
  Check,
  AlertTriangle,
  Sparkles,
} from 'lucide-react';

function relTime(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function snippet(text: string): string {
  // strip markdown/HTML debris (tables, code fences, diff markers, tags), collapse, truncate
  return text
    .replace(/<[^>]+>/g, ' ')
    .replace(/[`#*|>_~-]{2,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}

export function PRDrawer({
  pr,
  prKey,
  activity,
  isHidden = false,
  onToggleHide,
  onMerge,
  isMerging = false,
  onApproveDeployment,
  isApprovingDeployment = false,
  onUpdateBranch,
  isUpdatingBranch = false,
}: {
  pr: PullRequestAssessment;
  prKey?: string;
  activity?: PrActivityInfo;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onMerge?: (pr: PullRequestAssessment) => void;
  isMerging?: boolean;
  onApproveDeployment?: (pr: PullRequestAssessment) => void;
  isApprovingDeployment?: boolean;
  onUpdateBranch?: (pr: PullRequestAssessment) => void;
  isUpdatingBranch?: boolean;
}) {
  const failedChecks = pr.checkRuns.filter(
    (c) => c.conclusion === 'FAILURE' || c.conclusion === 'TIMED_OUT' || c.conclusion === 'ACTION_REQUIRED'
  );
  const runningChecks = pr.checkRuns.filter((c) => c.status === 'IN_PROGRESS' || c.status === 'QUEUED');
  const passingChecks = pr.checkRuns.filter((c) => c.conclusion === 'SUCCESS');

  const newActivity = prKey ? computeNew(activity, prKey) : { count: 0, total: 0, items: [], threshold: 'activity' as const, thresholdTs: '' };
  const showNewSection = newActivity.items.length > 0;

  return (
    <div className="bg-slate-950/80 border-t border-slate-800/80 p-3.5 space-y-4 text-xs text-slate-300 animate-in fade-in duration-200">
      {/* Quick Action Bar (Approve Deployment, Merge/Queue & Hide) */}
      <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          {pr.mergeQueueInfo?.isWaitingForApproval && onApproveDeployment && (
            <button
              onClick={() => onApproveDeployment(pr)}
              disabled={isApprovingDeployment}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors shadow disabled:opacity-50 animate-pulse"
            >
              {isApprovingDeployment ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <UserCheck className="w-3.5 h-3.5" />
              )}
              Approve & Deploy Environment
            </button>
          )}

          {pr.mergeability === 'Ready to Merge' && !pr.isInMergeQueue && !pr.isDraft && (
            <button
              onClick={() => onMerge && onMerge(pr)}
              disabled={isMerging}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition-colors shadow-sm disabled:opacity-50"
            >
              {isMerging ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitMerge className="w-3.5 h-3.5" />
              )}
              {pr.hasRepoMergeQueue ? 'Push to Merge Queue' : 'Merge to Main'}
            </button>
          )}

          {pr.canUpdateBranch && onUpdateBranch && (
            <button
              onClick={() => onUpdateBranch(pr)}
              disabled={isUpdatingBranch}
              title="Update branch with latest changes from base branch"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs border border-slate-700 transition-colors shadow-sm disabled:opacity-50"
            >
              {isUpdatingBranch ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <GitBranch className="w-3.5 h-3.5 text-sky-400" />
              )}
              Update Branch
            </button>
          )}
        </div>

        {onToggleHide && (
          <button
            onClick={onToggleHide}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-[11px] font-medium text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors ml-auto"
          >
            {isHidden ? (
              <>
                <Eye className="w-3 h-3 text-emerald-400" />
                Unhide
              </>
            ) : (
              <>
                <EyeOff className="w-3 h-3 text-slate-400" />
                Hide
              </>
            )}
          </button>
        )}
      </div>

      {/* New activity since last visit/activity */}
      {showNewSection && (
        <div className="p-2.5 rounded bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              NEW SINCE {newActivity.threshold === 'visited' ? 'LAST VISIT' : 'LAST ACTIVITY'} ·{' '}
              {newActivity.count}
              {newActivity.total > newActivity.count ? ` (+${newActivity.total - newActivity.count} bot)` : ''}
            </span>
            <span className="text-[10px] text-slate-500">
              since {relTime(newActivity.thresholdTs)}
            </span>
          </div>
          <div className="space-y-1">
            {newActivity.items.map((it, idx) => (
              <a
                key={idx}
                href={it.url}
                target="_blank"
                rel="noopener noreferrer"
                className={`flex items-start gap-1.5 p-1 rounded hover:bg-slate-900/70 transition-colors ${
                  it.bot ? 'opacity-60' : ''
                }`}
              >
                <span
                  className={`flex-shrink-0 mt-0.5 px-1 rounded text-[9px] font-bold border ${
                    it.type === 'review'
                      ? 'bg-indigo-950/60 text-indigo-300 border-indigo-800'
                      : it.type === 'commit'
                        ? 'bg-slate-800 text-slate-300 border-slate-700'
                        : 'bg-sky-950/60 text-sky-300 border-sky-800'
                  }`}
                >
                  {it.type === 'review' ? 'RE' : it.type === 'commit' ? 'CM' : 'GC'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-mono text-[10px] text-slate-300">{it.author}</span>
                    {it.type === 'review' && it.state && (
                      <span
                        className={`px-1 rounded text-[9px] font-bold border ${
                          it.state === 'approved'
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-800'
                            : it.state === 'changes_requested'
                              ? 'bg-red-950/60 text-red-300 border-red-800'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {it.state.replace('_', ' ')}
                      </span>
                    )}
                    <span className="text-[9px] text-slate-500 flex-shrink-0">{relTime(it.ts)}</span>
                  </span>
                  {it.text && (
                    <span className="block text-[10px] text-slate-400 line-clamp-1 break-words">
                      {snippet(it.text)}
                    </span>
                  )}
                </span>
                <ExternalLink className="w-2.5 h-2.5 text-slate-600 flex-shrink-0 mt-1" />
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Merge Queue Details if present */}
      {pr.isInMergeQueue && pr.mergeQueueInfo && (
        <div className="p-2.5 rounded bg-purple-950/40 border border-purple-800/60 text-xs text-purple-200 space-y-2">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-purple-300 flex items-center gap-1.5">
              <GitMerge className="w-3.5 h-3.5 text-purple-400" />
              Merge Queue: {pr.mergeQueueInfo.state}
              {pr.mergeQueueInfo.position && ` (#${pr.mergeQueueInfo.position})`}
            </span>
            {pr.mergeQueueInfo.url && (
              <a
                href={pr.mergeQueueInfo.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-200 underline inline-flex items-center gap-1"
              >
                View Queue <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {pr.mergeQueueInfo.isWaitingForApproval && (
            <div className="p-2 rounded bg-amber-950/60 border border-amber-800/80 text-amber-200 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" />
                <span className="font-medium">
                  {pr.mergeQueueInfo.approvalStepName}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {onApproveDeployment && (
                  <button
                    onClick={() => onApproveDeployment(pr)}
                    disabled={isApprovingDeployment}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow disabled:opacity-50 transition-colors"
                  >
                    {isApprovingDeployment ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <UserCheck className="w-3 h-3" />
                    )}
                    Approve
                  </button>
                )}
                {pr.mergeQueueInfo.approvalStepUrl && (
                  <a
                    href={pr.mergeQueueInfo.approvalStepUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-200 font-semibold underline text-xs flex-shrink-0"
                  >
                    Run Logs <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Stacked PR info if applicable */}
      {pr.isStacked && (
        <div className="p-2 rounded bg-indigo-950/30 border border-indigo-900/50 text-xs text-indigo-200 space-y-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-indigo-300">
            <Layers className="w-3.5 h-3.5" /> Stacked Branch
          </div>
          <p className="text-slate-300">
            Base <code className="bg-slate-900 px-1 py-0.2 rounded text-indigo-200">{pr.baseRefName}</code>{' '}
            {pr.stackedParent ? (
              <>
                targets parent PR{' '}
                <a
                  href={pr.stackedParent.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-400 underline font-medium inline-flex items-center gap-0.5"
                >
                  #{pr.stackedParent.prNumber} <ExternalLink className="w-2.5 h-2.5" />
                </a>
              </>
            ) : (
              'targets a non-default branch.'
            )}
          </p>
        </div>
      )}

      {/* Two Grid Columns inside Drawer for Checks & Comments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
        {/* CI/CD Checks Detail */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              Status Checks ({pr.checkRuns.length})
            </h4>
          </div>

          {pr.checkRuns.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">No checks reported.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {failedChecks.map((check) => (
                <div
                  key={check.id}
                  className={`flex items-center justify-between p-1.5 rounded text-xs ${
                    check.isRequired
                      ? 'bg-rose-950/40 border border-rose-900/60 text-rose-200'
                      : 'bg-amber-950/30 border border-amber-900/50 text-amber-200'
                  }`}
                >
                  <div className="flex items-center gap-1.5 truncate">
                    {check.isRequired ? (
                      <XCircle className="w-3.5 h-3.5 text-rose-400 flex-shrink-0" />
                    ) : (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                    )}
                    <span className="font-medium truncate">{check.name}</span>
                    {!check.isRequired && (
                      <span className="text-[10px] text-amber-400/80 bg-amber-950/60 px-1 rounded flex-shrink-0">
                        Optional
                      </span>
                    )}
                  </div>
                  {check.detailsUrl && (
                    <a
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`ml-2 underline flex-shrink-0 text-[11px] ${
                        check.isRequired ? 'text-rose-400 hover:text-rose-200' : 'text-amber-400 hover:text-amber-200'
                      }`}
                    >
                      Logs
                    </a>
                  )}
                </div>
              ))}

              {runningChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-1.5 rounded bg-sky-950/30 border border-sky-900/40 text-xs"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <Clock className="w-3.5 h-3.5 text-sky-400 animate-pulse flex-shrink-0" />
                    <span className="font-medium text-sky-200 truncate">{check.name}</span>
                  </div>
                  {check.detailsUrl && (
                    <a
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-400 hover:text-sky-200 ml-2 underline flex-shrink-0 text-[11px]"
                    >
                      View
                    </a>
                  )}
                </div>
              ))}

              {passingChecks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-center justify-between p-1 rounded bg-slate-900/50 border border-slate-800/80 text-[11px] text-slate-400"
                >
                  <div className="flex items-center gap-1.5 truncate">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                    <span className="truncate">{check.name}</span>
                  </div>
                  {check.detailsUrl && (
                    <a
                      href={check.detailsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-slate-300 ml-2 flex-shrink-0"
                    >
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Unresolved Comments */}
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5">
            <h4 className="font-semibold text-slate-200 flex items-center gap-1.5 text-xs">
              Unresolved Comments ({pr.unresolvedThreads.length})
            </h4>
          </div>

          {pr.unresolvedThreads.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">No unresolved threads.</p>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {pr.unresolvedThreads.map((thread) => (
                <div
                  key={thread.id}
                  className="p-2 rounded bg-amber-950/30 border border-amber-900/50 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between text-slate-400">
                    <div className="flex items-center gap-1 font-mono text-[10px] text-amber-200 truncate">
                      <FileCode className="w-3 h-3 text-amber-400 flex-shrink-0" />
                      <span className="truncate max-w-[140px]">{thread.path}</span>
                      {thread.line && <span>:{thread.line}</span>}
                    </div>
                    <a
                      href={thread.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-200 font-medium underline ml-2 text-[10px] flex-shrink-0"
                    >
                      GitHub <ExternalLink className="w-2.5 h-2.5 inline" />
                    </a>
                  </div>
                  <div className="flex items-start gap-1.5">
                    <span className="font-semibold text-slate-300 flex-shrink-0 text-[11px]">
                      @{thread.author}:
                    </span>
                    <p className="text-slate-200 line-clamp-2 italic text-[11px]">
                      "{thread.bodyPreview}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
