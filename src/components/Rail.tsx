'use client';

import React from 'react';
import {
  Inbox,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Layers,
  FileText,
  EyeOff,
  Eye,
  GitPullRequest,
  Clock,
  Folder,
  FolderGit2,
  PanelLeft,
  PanelLeftClose,
  type LucideIcon,
} from 'lucide-react';
import type { Mode } from '../lib/config';
import type { PullRequestAssessment } from '../types/pr';
import { blockedReason, isBlocked } from '../lib/status';

export type MineViewId =
  | 'all'
  | 'needs-attention'
  | 'failing'
  | 'ready'
  | 'in-queue'
  | 'drafts'
  | 'hidden';

export type ReviewsViewId = 'needs-review' | 'review-stale' | 'approved-by-me' | 'all' | 'hidden';

export type ViewId = MineViewId | ReviewsViewId;

interface ViewSpec {
  id: ViewId;
  label: string;
  icon: LucideIcon;
  tone: string;
  /** Membership test. `hidden` is handled by the caller, which owns that state. */
  match?: (pr: PullRequestAssessment) => boolean;
}

const MINE_VIEWS: ViewSpec[] = [
  { id: 'all', label: 'Open', icon: Inbox, tone: 'text-muted' },
  {
    id: 'needs-attention',
    label: 'Needs you',
    icon: AlertTriangle,
    tone: 'text-warn',
    match: (pr) => isBlocked('mine', pr),
  },
  {
    id: 'failing',
    label: 'Failing',
    icon: XCircle,
    tone: 'text-danger',
    match: (pr) => pr.checks === 'Failing',
  },
  {
    id: 'ready',
    label: 'Ready',
    icon: CheckCircle2,
    tone: 'text-ready',
    match: (pr) => pr.mergeability === 'Ready to Merge' && !pr.isInMergeQueue,
  },
  {
    id: 'in-queue',
    label: 'In queue',
    icon: Layers,
    tone: 'text-queue',
    match: (pr) => pr.isInMergeQueue,
  },
  { id: 'drafts', label: 'Drafts', icon: FileText, tone: 'text-dim', match: (pr) => pr.isDraft },
  { id: 'hidden', label: 'Hidden', icon: EyeOff, tone: 'text-dim' },
];

const REVIEWS_VIEWS: ViewSpec[] = [
  {
    id: 'needs-review',
    label: 'Needs your review',
    icon: GitPullRequest,
    tone: 'text-warn',
    match: (pr) => blockedReason('reviews', pr)?.rank === 1,
  },
  {
    id: 'review-stale',
    label: 'Reviewed, then pushed',
    icon: Clock,
    tone: 'text-warn',
    match: (pr) => blockedReason('reviews', pr)?.rank === 2,
  },
  {
    id: 'approved-by-me',
    label: 'Approved by you',
    icon: CheckCircle2,
    tone: 'text-ready',
    match: (pr) => pr.viewerReview === 'Approved' && !pr.viewerReviewStale,
  },
  { id: 'all', label: 'All requests', icon: Inbox, tone: 'text-muted' },
  { id: 'hidden', label: 'Hidden', icon: EyeOff, tone: 'text-dim' },
];

export function viewsFor(mode: Mode): ViewSpec[] {
  return mode === 'reviews' ? REVIEWS_VIEWS : MINE_VIEWS;
}

export function defaultViewFor(mode: Mode): ViewId {
  return mode === 'reviews' ? 'needs-review' : 'needs-attention';
}

export function isViewFor(mode: Mode, id: string): id is ViewId {
  return viewsFor(mode).some((v) => v.id === id);
}

/** Does a PR belong in this view? Callers pass `hidden` themselves. */
export function matchesView(mode: Mode, id: ViewId, pr: PullRequestAssessment): boolean {
  const spec = viewsFor(mode).find((v) => v.id === id);
  if (!spec || !spec.match) return true;
  return spec.match(pr);
}

export function countViews(
  mode: Mode,
  visible: PullRequestAssessment[],
  hiddenCount: number,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const spec of viewsFor(mode)) {
    if (spec.id === 'hidden') counts.hidden = hiddenCount;
    else if (!spec.match) counts[spec.id] = visible.length;
    else counts[spec.id] = visible.filter(spec.match).length;
  }
  return counts;
}

const ITEM_BASE =
  'tap-safe flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors duration-instant ease-out lg:px-3';
const ITEM_ON = 'bg-accent-wash text-accent';
const ITEM_OFF = 'text-muted hover:bg-surface-hover hover:text-ink';

/**
 * Labels show on the mobile strip and on the wide rail. The 56px icon rail hides them.
 * Collapsing removes the `lg` reveal so the rail stays narrow at every width.
 */
function labelVis(collapsed: boolean): string {
  return collapsed ? 'hidden max-sm:inline' : 'hidden max-sm:inline lg:inline';
}
function countVis(collapsed: boolean): string {
  return collapsed ? 'hidden max-sm:contents' : 'hidden max-sm:contents lg:contents';
}

function Count({ n, active }: { n: number; active: boolean }) {
  return (
    <span
      className={`ml-auto shrink-0 font-mono text-2xs tabular ${active ? 'text-accent' : 'text-dim'}`}
    >
      {n}
    </span>
  );
}

function SectionLabel({ children, collapsed }: { children: React.ReactNode; collapsed: boolean }) {
  if (collapsed) return <div className="hidden pt-3 sm:block" />;
  return (
    <div className="hidden px-3 pb-1 pt-4 font-mono text-2xs uppercase tracking-[0.14em] text-dim lg:block">
      {children}
    </div>
  );
}

interface RailProps {
  mode: Mode;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  activeView: ViewId;
  onSelectView: (v: ViewId) => void;
  viewCounts: Record<string, number>;
  repositories: string[];
  repoCounts: Record<string, number>;
  totalCount: number;
  selectedRepo: string;
  onSelectRepo: (repo: string) => void;
}

export function Rail({
  mode,
  collapsed,
  onToggleCollapsed,
  activeView,
  onSelectView,
  viewCounts,
  repositories,
  repoCounts,
  totalCount,
  selectedRepo,
  onSelectRepo,
}: RailProps) {
  const views = viewsFor(mode).filter((v) => v.id !== 'hidden' || (viewCounts.hidden ?? 0) > 0);
  const showRepos = repositories.length > 1;
  const LABEL_VIS = labelVis(collapsed);
  const COUNT_VIS = countVis(collapsed);
  const width = collapsed ? 'sm:w-rail-collapsed' : 'sm:w-rail-collapsed lg:w-rail';

  return (
    <nav
      aria-label="Views and repositories"
      className={`sticky top-header z-chrome shrink-0 bg-canvas max-sm:w-full max-sm:border-b max-sm:border-line sm:h-[calc(100dvh-var(--header-height))] sm:overflow-y-auto sm:border-r sm:border-line sm:py-2 ${width}`}
    >
      <div className="hidden justify-end px-2 pt-1 lg:flex">
        <button
          onClick={onToggleCollapsed}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="pointer-safe inline-flex items-center justify-center rounded-md p-1.5 text-dim transition-colors duration-instant ease-out hover:bg-surface-hover hover:text-ink"
        >
          {collapsed ? (
            <PanelLeft aria-hidden strokeWidth={1.5} className="h-4 w-4" />
          ) : (
            <PanelLeftClose aria-hidden strokeWidth={1.5} className="h-4 w-4" />
          )}
        </button>
      </div>

      <SectionLabel collapsed={collapsed}>Views</SectionLabel>

      <ul className="flex gap-0.5 px-2 max-sm:overflow-x-auto max-sm:py-2 sm:flex-col">
        {views.map(({ id, label, icon: Icon, tone }) => {
          const active = activeView === id;
          const n = viewCounts[id] ?? 0;
          const ShownIcon = id === 'hidden' && active ? Eye : Icon;
          return (
            <li key={id} className="shrink-0">
              <button
                onClick={() => onSelectView(id)}
                aria-current={active ? 'page' : undefined}
                aria-label={`${label}, ${n} pull request${n === 1 ? '' : 's'}`}
                title={label}
                className={`${ITEM_BASE} ${active ? ITEM_ON : ITEM_OFF}`}
              >
                <ShownIcon
                  aria-hidden
                  strokeWidth={1.5}
                  className={`h-4 w-4 shrink-0 ${active ? 'text-accent' : tone}`}
                />
                <span className={`${LABEL_VIS} truncate`}>{label}</span>
                <span className={COUNT_VIS}>
                  <Count n={n} active={active} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      {showRepos && (
        <>
          <SectionLabel collapsed={collapsed}>Repositories</SectionLabel>

          <ul className="flex gap-0.5 px-2 max-sm:overflow-x-auto max-sm:pb-2 sm:flex-col sm:pb-4">
            <li className="shrink-0">
              <button
                onClick={() => onSelectRepo('all')}
                aria-current={selectedRepo === 'all' ? 'true' : undefined}
                aria-label={`All repositories, ${totalCount} pull requests`}
                title="All repositories"
                className={`${ITEM_BASE} ${selectedRepo === 'all' ? ITEM_ON : ITEM_OFF}`}
              >
                <FolderGit2 aria-hidden strokeWidth={1.5} className="h-4 w-4 shrink-0" />
                <span className={`${LABEL_VIS} truncate`}>All repos</span>
                <span className={COUNT_VIS}>
                  <Count n={totalCount} active={selectedRepo === 'all'} />
                </span>
              </button>
            </li>

            {repositories.map((repo) => {
              const active = selectedRepo === repo;
              const short = repo.split('/')[1] ?? repo;
              const n = repoCounts[repo] ?? 0;
              return (
                <li key={repo} className="shrink-0">
                  <button
                    onClick={() => onSelectRepo(repo)}
                    aria-current={active ? 'true' : undefined}
                    aria-label={`${repo}, ${n} pull request${n === 1 ? '' : 's'}`}
                    title={repo}
                    className={`${ITEM_BASE} ${active ? ITEM_ON : ITEM_OFF}`}
                  >
                    <Folder aria-hidden strokeWidth={1.5} className="h-4 w-4 shrink-0" />
                    <span className={`${LABEL_VIS} truncate font-mono text-xs`}>{short}</span>
                    <span className={COUNT_VIS}>
                      <Count n={n} active={active} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </nav>
  );
}
