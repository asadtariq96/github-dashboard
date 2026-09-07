'use client';

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Book,
  Check,
  ChevronDown,
  CircleMinus,
  CircleSlash,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  GitBranch,
  GitMerge,
  ListChecks,
  Loader2,
  MessageSquare,
  RefreshCw,
  Rocket,
  Train,
} from 'lucide-react';
import type { PrActivityInfo, PullRequestAssessment } from '../../types/pr';
import type { Mode } from '../../lib/config';
import {
  allActionsFor,
  reverseActionsFor,
  type RowAction,
  type RowActionId,
} from '../../lib/rowAction';
import { blockedReason } from '../../lib/status';
import { EASE_OUT, FADE_IN } from '../../lib/motion';
import { summarizeChecks } from '../../lib/checks';
import { computeNew, recordSnapshot, recordVisit } from '../../lib/visited';
import { PRStateIcon, TimePair } from './CardMeta';
import { StatusChips } from './chips';
import dynamic from 'next/dynamic';
const ChecksPanel = dynamic(() => import('./ChecksPanel').then((m) => m.ChecksPanel), {
  loading: () => <p className="px-5 py-4 text-sm text-muted">Loading checks…</p>,
});
const ThreadsPanel = dynamic(() => import('./ThreadsPanel').then((m) => m.ThreadsPanel), {
  loading: () => <p className="px-5 py-4 text-sm text-muted">Loading threads…</p>,
});
const DescriptionPanel = dynamic(
  () => import('./DescriptionPanel').then((m) => m.DescriptionPanel),
  { loading: () => <p className="px-5 py-4 text-sm text-muted">Loading description…</p> },
);
const MergeQueuePanel = dynamic(() => import('./MergeQueuePanel').then((m) => m.MergeQueuePanel), {
  loading: () => <p className="px-5 py-4 text-sm text-muted">Loading merge queue…</p>,
});
const DiffPanel = dynamic(() => import('./DiffPanel').then((m) => m.DiffPanel), {
  loading: () => <p className="px-5 py-4 text-sm text-muted">Loading changed files…</p>,
});
import { ActionButton, CountPill, DiffBar, DiffStat, SplitButton, type MenuItem } from './ui';

export type TabId = 'description' | 'queue' | 'checks' | 'threads' | 'files';

const TABS: { id: TabId; label: string; icon: typeof ListChecks }[] = [
  { id: 'description', label: 'Description', icon: FileText },
  { id: 'queue', label: 'Merge queue', icon: Train },
  { id: 'checks', label: 'Checks', icon: ListChecks },
  { id: 'threads', label: 'Threads', icon: MessageSquare },
  { id: 'files', label: 'Files', icon: FileText },
];

const ACTION_ICON: Record<
  RowActionId,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  'approve-deployment': Rocket,
  'update-branch': GitMerge,
  'rerun-checks': RefreshCw,
  merge: Check,
  'mark-ready': Check,
  dequeue: CircleMinus,
  close: CircleSlash,
};

const SPLIT_TONE: Record<RowActionId, 'accent' | 'ready' | 'danger'> = {
  'approve-deployment': 'danger',
  'update-branch': 'accent',
  'rerun-checks': 'accent',
  merge: 'ready',
  'mark-ready': 'accent',
  dequeue: 'accent',
  close: 'danger',
};

const REVERSE_TONE: Record<string, 'danger' | 'warn'> = {
  close: 'danger',
  dequeue: 'warn',
};

const ICON_BUTTON =
  'pointer-safe inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-raised p-1.5 text-dim shadow-sm transition-all duration-instant ease-out hover:-translate-y-px hover:border-line-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export function PRCard({
  pr,
  mode,
  isExpanded,
  onToggleExpand,
  isHidden = false,
  onToggleHide,
  onRunAction,
  busyAction = null,
  activity,
  onRefresh,
  defaultTab,
  openFirstThread = false,
  selected = false,
  inspected = false,
  contained = false,
  fillAvailable = false,
  hideStats = false,
  onToggleSelect,
  activeTab,
  onTabChange,
  inspectorTools,
  headerNotice,
}: {
  pr: PullRequestAssessment;
  mode: Mode;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
  onRunAction?: (pr: PullRequestAssessment, action: RowActionId) => void;
  busyAction?: RowActionId | null;
  activity?: PrActivityInfo;
  /** Called after a write the card made itself, such as a thread reply. Awaited. */
  onRefresh?: () => Promise<void> | void;
  defaultTab?: TabId;
  openFirstThread?: boolean;
  selected?: boolean;
  /** Highlights the row currently shown in the desktop inspector. */
  inspected?: boolean;
  /** Reflows the complete summary when the card lives in the narrower master column. */
  contained?: boolean;
  /** Stretch an expanded card to the height supplied by its inspector column. */
  fillAvailable?: boolean;
  /** Inspector headers trade duplicated summary stats for more title room. */
  hideStats?: boolean;
  /** Shift held means select the range from the last one picked. */
  onToggleSelect?: (shiftKey: boolean) => void;
  activeTab?: TabId;
  onTabChange?: (tab: TabId) => void;
  inspectorTools?: React.ReactNode;
  headerNotice?: React.ReactNode;
}) {
  // A queued pull request opens on the queue, because that is what decides its fate.
  const [internalTab, setInternalTab] = useState<TabId>(
    defaultTab ?? (pr.isInMergeQueue ? 'queue' : 'checks'),
  );
  const tab = activeTab ?? internalTab;
  const setTab = (next: TabId) => {
    setInternalTab(next);
    onTabChange?.(next);
  };

  const prKey = `${pr.repository.nameWithOwner}#${pr.number}`;
  const newActivity = computeNew(activity, prKey);
  const blocked = blockedReason(mode, pr);
  const { total: checkTotal } = summarizeChecks(pr);
  const threadTotal = pr.unresolvedThreads.length;
  const hasConflicts = pr.mergeability === 'Merge Conflicts';

  const actions = onRunAction ? allActionsFor(pr) : [];
  const primary: RowAction | undefined = actions[0];
  const secondary = actions.slice(1);
  const reverse = onRunAction ? reverseActionsFor(pr) : [];

  const visit = () => {
    recordVisit(prKey);
    recordSnapshot(prKey, pr);
  };

  const actionMenuItems: MenuItem[] = secondary.map((action) => ({
    id: action.id,
    label: action.label,
    icon: ACTION_ICON[action.id],
    onSelect: () => onRunAction!(pr, action.id),
    disabled: busyAction !== null,
  }));

  // The list item belongs to whoever renders the list, so this returns the card itself.
  return (
    <article
      aria-selected={onToggleSelect ? selected : undefined}
      className={`overflow-hidden rounded-lg border bg-surface shadow-sm transition-all duration-fast ease-out ${
        fillAvailable ? 'h-full' : ''
      } ${
        selected || inspected
          ? 'border-accent shadow-md'
          : isExpanded
            ? 'border-line-strong shadow-md'
            : 'border-line hover:border-line-strong hover:shadow-md'
      }`}
    >
      <div className={fillAvailable ? 'flex h-full min-h-0 flex-col' : ''}>
        <div
          onClick={onToggleExpand}
          className={`flex cursor-pointer select-none items-center transition-colors duration-instant ease-out hover:bg-surface-hover ${
            contained ? 'flex-wrap gap-2 px-3 py-2.5' : 'flex-wrap gap-3 px-4 py-3'
          }`}
        >
          <div
            className={`flex min-w-0 ${
              contained ? 'w-full items-start gap-2' : 'flex-[1_1_20rem] items-center gap-3'
            }`}
          >
            {onToggleSelect && (
              /*
               * The handler is on click, not change. A change event's nativeEvent is a
               * plain Event and carries no shiftKey, so range select cannot read it
               * there. Space on a focused checkbox fires click too, so this covers the
               * keyboard as well.
               */
              <input
                type="checkbox"
                checked={selected}
                readOnly
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect(e.shiftKey);
                }}
                aria-label={`Select pull request ${pr.number}`}
                className={`shrink-0 cursor-pointer accent-accent-fill ${contained ? 'mt-1 h-3.5 w-3.5' : 'pointer-safe'}`}
              />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onToggleExpand();
              }}
              aria-expanded={isExpanded}
              aria-label={
                isExpanded
                  ? `Hide detail for pull request ${pr.number}`
                  : `Show detail for pull request ${pr.number}`
              }
              className={
                contained
                  ? 'shrink-0 rounded p-0.5 text-dim hover:bg-surface-muted hover:text-ink'
                  : ICON_BUTTON
              }
            >
              <ChevronDown
                aria-hidden
                strokeWidth={2}
                className={`h-4 w-4 transition-transform duration-fast ease-out ${
                  isExpanded ? 'rotate-180' : ''
                }`}
              />
            </button>

            <PRStateIcon pr={pr} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <a
                  href={pr.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={pr.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    visit();
                  }}
                  className={`${contained ? 'line-clamp-2 text-[13px] leading-snug' : isExpanded ? 'break-words text-[15px]' : 'truncate text-[15px]'} tracking-[-0.01em] hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent ${
                    newActivity.count > 0 ? 'font-bold text-ink' : 'font-semibold text-ink'
                  }`}
                >
                  {pr.title}
                </a>
                <span className="shrink-0 rounded-full border border-line bg-surface-muted px-2 py-0.5 font-mono text-2xs font-medium tabular text-muted">
                  #{pr.number}
                </span>
              </div>

              <div
                className={`mt-1 text-xs text-dim ${contained ? 'space-y-1' : 'flex flex-wrap items-center gap-x-3 gap-y-1'}`}
              >
                <div className="flex min-w-0 items-start gap-1.5">
                  <Book aria-hidden strokeWidth={2} className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="break-all" title={pr.repository.nameWithOwner}>
                    {pr.repository.nameWithOwner}
                  </span>
                </div>
                <div className="flex min-w-0 items-start gap-1.5 font-mono text-2xs text-muted">
                  <GitBranch aria-hidden strokeWidth={2} className="mt-0.5 h-3 w-3 shrink-0" />
                  <span
                    className="min-w-0 break-all"
                    title={`${pr.headRefName} → ${pr.baseRefName}`}
                  >
                    {pr.headRefName}{' '}
                    <span aria-hidden className="text-faint">
                      →
                    </span>{' '}
                    {pr.baseRefName}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div
            className={`${
              hideStats ? 'hidden' : contained ? 'flex' : 'hidden lg:flex'
            } min-w-0 flex-wrap items-center gap-2 ${contained ? 'max-w-full flex-1' : 'shrink-0'}`}
          >
            {pr.additions + pr.deletions > 0 && (
              <span
                title={`${pr.additions} additions, ${pr.deletions} deletions across ${pr.changedFiles} files`}
                className="flex shrink-0 items-center gap-1.5"
              >
                <DiffStat additions={pr.additions} deletions={pr.deletions} />
                {!contained && <DiffBar additions={pr.additions} deletions={pr.deletions} />}
              </span>
            )}
            <StatusChips pr={pr} />
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            className={`${contained ? 'ml-auto flex-wrap' : 'ml-auto'} flex shrink-0 items-center gap-2.5`}
          >
            <TimePair pr={pr} />

            {newActivity.count > 0 && (
              <span
                title={`${newActivity.count} unread comments`}
                className="hidden h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-accent-wash px-1 text-2xs font-semibold tabular text-accent md:inline-flex"
              >
                {newActivity.count}
                <span className="sr-only"> unread comments</span>
              </span>
            )}

            {/*
                Not every state puts its action on a control that can hold a spinner: a
                conflicted row shows a link, and a batch can drive any row. This reports
                the work wherever it came from.
              */}
            {busyAction && (
              <Loader2
                aria-label={`Working on pull request ${pr.number}`}
                className="h-3.5 w-3.5 shrink-0 animate-spin text-accent"
              />
            )}

            {hasConflicts ? (
              <ActionButton
                compact={contained}
                icon={GitMerge}
                tone="fillWarn"
                href={`${pr.url}/conflicts`}
                title="Resolve the conflicts in GitHub's web editor"
              >
                Resolve conflicts
              </ActionButton>
            ) : primary ? (
              <SplitButton
                compact={contained}
                icon={ACTION_ICON[primary.id]}
                tone={SPLIT_TONE[primary.id]}
                onClick={() => onRunAction!(pr, primary.id)}
                busy={busyAction === primary.id}
                menuItems={actionMenuItems}
                menuLabel={`More actions for pull request ${pr.number}`}
              >
                {primary.label}
              </SplitButton>
            ) : pr.isInMergeQueue ? (
              <ActionButton
                compact={contained}
                icon={ListChecks}
                href={pr.mergeQueueInfo?.url || pr.url}
                title="Open the merge queue on GitHub"
              >
                View queue
              </ActionButton>
            ) : (
              <ActionButton
                compact={contained}
                icon={ExternalLink}
                href={pr.url}
                title="Open this pull request on GitHub"
              >
                Review
              </ActionButton>
            )}
            {inspectorTools}
          </div>
        </div>
        {headerNotice}

        {/* Motion owns the accordion reveal; the list only moves the surrounding rows. */}
        <AnimatePresence initial={false}>
          {isExpanded && (
            <motion.div
              key="body"
              className={
                fillAvailable ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'overflow-hidden'
              }
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: 0.28, ease: EASE_OUT },
                opacity: FADE_IN,
              }}
            >
              <div className="flex flex-wrap items-center gap-2 border-y border-line bg-surface-hover px-5">
                <div
                  role="tablist"
                  aria-label={`Detail for pull request ${pr.number}`}
                  className="flex items-center gap-1"
                >
                  {TABS.filter((item) => item.id !== 'queue' || pr.isInMergeQueue).map((item) => {
                    const selected = item.id === tab;
                    const count = item.id === 'checks' ? checkTotal : threadTotal;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => setTab(item.id)}
                        className={`-mb-px flex items-center gap-1.5 border-b-2 px-3.5 py-2.5 text-sm transition-colors duration-instant ease-out focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent ${
                          selected
                            ? 'border-accent font-semibold text-accent'
                            : 'border-transparent font-medium text-muted hover:text-ink'
                        }`}
                      >
                        <item.icon
                          aria-hidden
                          strokeWidth={2}
                          className="h-[15px] w-[15px] opacity-80"
                        />
                        {item.label}
                        {(item.id === 'checks' || item.id === 'threads') && (
                          <CountPill active={selected}>{count}</CountPill>
                        )}
                      </button>
                    );
                  })}
                </div>

                {blocked && (
                  <p className="hidden items-center gap-2 py-2.5 xl:flex">
                    <span aria-hidden className="h-3.5 w-px bg-line" />
                    <span className="text-xs font-medium text-warn">{blocked.label}</span>
                  </p>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2 py-2">
                  {secondary.map((action) => (
                    <ActionButton
                      key={action.id}
                      icon={ACTION_ICON[action.id]}
                      onClick={() => onRunAction!(pr, action.id)}
                      busy={busyAction === action.id}
                      disabled={busyAction !== null}
                    >
                      {action.label}
                    </ActionButton>
                  ))}
                  {pr.isInMergeQueue && (
                    <ActionButton
                      icon={CircleMinus}
                      tone="warn"
                      onClick={() => onRunAction!(pr, 'dequeue')}
                      busy={busyAction === 'dequeue'}
                      disabled={busyAction !== null}
                    >
                      Remove from queue
                    </ActionButton>
                  )}
                  {pr.isInMergeQueue && pr.mergeQueueInfo?.url && (
                    <ActionButton icon={ListChecks} href={pr.mergeQueueInfo.url}>
                      View queue
                    </ActionButton>
                  )}
                </div>
              </div>

              {/* One tab, one panel, the whole width. The panel scrolls itself when it fills. */}
              <div
                className={
                  fillAvailable ? 'flex min-h-0 flex-1 flex-col overflow-hidden' : 'min-h-0'
                }
              >
                {tab === 'description' ? (
                  <DescriptionPanel pr={pr} fill={fillAvailable} />
                ) : tab === 'files' ? (
                  <DiffPanel pr={pr} fill={fillAvailable} />
                ) : tab === 'queue' ? (
                  <MergeQueuePanel pr={pr} fill={fillAvailable} />
                ) : tab === 'checks' ? (
                  <ChecksPanel pr={pr} fill={fillAvailable} />
                ) : (
                  <ThreadsPanel
                    pr={pr}
                    unreadSinceMs={
                      newActivity.thresholdTs ? new Date(newActivity.thresholdTs).getTime() : 0
                    }
                    onChanged={onRefresh ?? (() => undefined)}
                    openFirst={openFirstThread}
                    fill={fillAvailable}
                  />
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-hover px-4 py-3">
                {actions.map((action) => (
                  <ActionButton
                    key={action.id}
                    icon={ACTION_ICON[action.id]}
                    tone={action.id === 'merge' ? 'fillReady' : 'outline'}
                    onClick={() => onRunAction!(pr, action.id)}
                    busy={busyAction === action.id}
                    disabled={busyAction !== null}
                  >
                    {action.label}
                  </ActionButton>
                ))}
                {hasConflicts && (
                  <ActionButton icon={GitMerge} tone="fillWarn" href={`${pr.url}/conflicts`}>
                    Resolve conflicts
                  </ActionButton>
                )}

                <span className="ml-auto flex flex-wrap items-center gap-2">
                  {reverse.map((action) => (
                    <ActionButton
                      key={action.id}
                      icon={ACTION_ICON[action.id]}
                      tone={REVERSE_TONE[action.id]}
                      onClick={() => onRunAction!(pr, action.id)}
                      busy={busyAction === action.id}
                      disabled={busyAction !== null}
                    >
                      {action.label}
                    </ActionButton>
                  ))}
                  {onToggleHide && (
                    <ActionButton icon={isHidden ? Eye : EyeOff} onClick={onToggleHide}>
                      {isHidden ? 'Show on desk' : 'Hide from desk'}
                    </ActionButton>
                  )}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  );
}
