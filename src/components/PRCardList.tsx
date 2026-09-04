'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlarmClock,
  ArrowDown,
  ArrowUp,
  ExternalLink,
  EyeOff,
  Keyboard,
  RefreshCw,
  X,
} from 'lucide-react';
import { PrActivityInfo, PullRequestAssessment } from '../types/pr';
import type { Mode } from '../lib/config';
import type { RowActionId } from '../lib/rowAction';
import { CARD_SPRING, EASE_OUT, REORDER_SPRING, cardVariants, revealDelay } from '../lib/motion';
import {
  computeChangeDigest,
  recordSnapshot,
  recordVisit,
  type ChangeDigest,
} from '../lib/visited';
import { PRCard, type TabId } from './pr-card/PRCard';
import { CommandPalette, type PaletteCommand } from './CommandPalette';
import { ChangeSummary } from './ChangeSummary';

export { PRCard } from './pr-card/PRCard';

const SPLIT_STORAGE_KEY = 'gh_dashboard_inspector_split';
const MIN_MASTER_PERCENT = 32;
const MAX_MASTER_PERCENT = 60;

function maxMasterPercent(width: number): number {
  return Math.max(MIN_MASTER_PERCENT, Math.min(MAX_MASTER_PERCENT, ((width - 508) / width) * 100));
}

export function PRCardList({
  prs,
  mode,
  hiddenPRIds = new Set(),
  onToggleHidePR,
  onRunAction,
  busy,
  activity,
  onRefresh,
  selectedPRIds,
  onToggleSelect,
  snoozedUntil = {},
  onSnooze,
}: {
  prs: PullRequestAssessment[];
  mode: Mode;
  hiddenPRIds?: Set<string>;
  onToggleHidePR?: (id: string) => void;
  onRunAction?: (pr: PullRequestAssessment, action: RowActionId) => void;
  busy?: Record<string, RowActionId>;
  activity?: Record<string, PrActivityInfo>;
  onRefresh?: () => Promise<void> | void;
  selectedPRIds?: Set<string>;
  onToggleSelect?: (prId: string, shiftKey: boolean) => void;
  snoozedUntil?: Record<string, number>;
  onSnooze?: (pr: PullRequestAssessment, until: number | null) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('checks');
  const [digests, setDigests] = useState<Record<string, ChangeDigest>>({});
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(50);
  const [masterPercent, setMasterPercent] = useState(43);
  const [resizing, setResizing] = useState(false);
  const masterPercentRef = useRef(43);
  const resizingRef = useRef(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const firstPass = useRef(true);
  useEffect(() => {
    firstPass.current = false;
    try {
      const stored = Number(localStorage.getItem(SPLIT_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= MIN_MASTER_PERCENT && stored <= MAX_MASTER_PERCENT) {
        masterPercentRef.current = stored;
        setMasterPercent(stored);
      }
    } catch {}
  }, []);
  const revealing = firstPass.current;
  const activePR = prs.find((pr) => pr.id === activeId) ?? null;

  useEffect(() => {
    if (!activePR || !workspaceRef.current) return;
    const workspace = workspaceRef.current;
    const clamp = () => {
      const next = Math.min(masterPercentRef.current, maxMasterPercent(workspace.clientWidth));
      masterPercentRef.current = next;
      setMasterPercent(next);
    };
    clamp();
    const observer = new ResizeObserver(clamp);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [activePR]);

  useEffect(() => {
    if (activeId && !prs.some((pr) => pr.id === activeId)) setActiveId(null);
  }, [activeId, prs]);

  useEffect(() => {
    setVisibleCount(50);
  }, [prs.length]);

  const visiblePRs = prs.slice(0, visibleCount);

  const inspect = useCallback(
    (pr: PullRequestAssessment) => {
      const key = `${pr.repository.nameWithOwner}#${pr.number}`;
      const digest = computeChangeDigest(pr, activity?.[key], key);
      setDigests((current) => ({ ...current, [pr.id]: digest }));
      setActiveId(pr.id);
      setActiveTab(pr.isInMergeQueue ? 'queue' : 'checks');
      recordVisit(key);
      recordSnapshot(key, pr);
    },
    [activity],
  );

  const move = useCallback(
    (delta: number) => {
      if (!prs.length) return;
      const current = activeId ? prs.findIndex((pr) => pr.id === activeId) : -1;
      inspect(prs[(current + delta + prs.length) % prs.length]);
    },
    [activeId, inspect, prs],
  );

  const updateSplit = (clientX: number) => {
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;
    const maxForAvailableWidth = maxMasterPercent(rect.width);
    const next = Math.max(
      MIN_MASTER_PERCENT,
      Math.min(maxForAvailableWidth, ((clientX - rect.left) / rect.width) * 100),
    );
    masterPercentRef.current = next;
    setMasterPercent(next);
  };

  const commitSplit = (next = masterPercentRef.current) => {
    resizingRef.current = false;
    setResizing(false);
    try {
      localStorage.setItem(SPLIT_STORAGE_KEY, String(next));
    } catch {}
  };

  const commands = useMemo<PaletteCommand[]>(
    () => [
      { label: 'Next pull request', hint: 'J', icon: ArrowDown, run: () => move(1) },
      { label: 'Previous pull request', hint: 'K', icon: ArrowUp, run: () => move(-1) },
      ...(activePR
        ? [
            {
              label: 'Open selected pull request on GitHub',
              hint: 'G',
              icon: ExternalLink,
              run: () => window.open(activePR.url, '_blank', 'noopener,noreferrer'),
            },
            {
              label: 'Snooze selected pull request until tomorrow',
              hint: 'S',
              icon: AlarmClock,
              run: () => onSnooze?.(activePR, Date.now() + 24 * 60 * 60 * 1000),
            },
            {
              label: 'Hide selected pull request',
              hint: 'H',
              icon: EyeOff,
              run: () => onToggleHidePR?.(activePR.id),
            },
          ]
        : []),
      { label: 'Refresh dashboard', hint: 'R', icon: RefreshCw, run: () => void onRefresh?.() },
    ],
    [activePR, move, onRefresh, onSnooze, onToggleHidePR],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((value) => !value);
        return;
      }
      if (paletteOpen || document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement;
      if (target.matches('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === '?') setPaletteOpen(true);
      else if (key === 'j') move(1);
      else if (key === 'k') move(-1);
      else if (key === 'enter' && !activePR && prs[0]) inspect(prs[0]);
      else if (key === 'escape' && activePR) setActiveId(null);
      else if (key === 'g' && activePR) window.open(activePR.url, '_blank', 'noopener,noreferrer');
      else if (key === 'h' && activePR) onToggleHidePR?.(activePR.id);
      else if (key === 's' && activePR) onSnooze?.(activePR, Date.now() + 24 * 60 * 60 * 1000);
      else if (key === 'r') void onRefresh?.();
      else if (activePR && ['1', '2', '3', '4', '5'].includes(key)) {
        const tabs: TabId[] = activePR.isInMergeQueue
          ? ['description', 'queue', 'checks', 'threads', 'files']
          : ['description', 'checks', 'threads', 'files'];
        const next = tabs[Number(key) - 1];
        if (next) setActiveTab(next);
      } else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activePR, inspect, move, onRefresh, onSnooze, onToggleHidePR, paletteOpen, prs]);

  if (prs.length === 0) return null;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      {!activePR && (
        <div className="mb-1 flex justify-end">
          <button
            onClick={() => setPaletteOpen(true)}
            className="inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs text-dim hover:bg-surface-hover hover:text-ink"
          >
            <Keyboard aria-hidden className="h-3.5 w-3.5" />
            Commands
            <kbd className="rounded border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-2xs">
              ⌘K
            </kbd>
          </button>
        </div>
      )}
      <div
        ref={workspaceRef}
        data-inspecting={activePR ? 'true' : 'false'}
        data-resizing={resizing ? 'true' : 'false'}
        style={{ '--master-width': `${masterPercent}%` } as React.CSSProperties}
        className={`pr-workspace grid min-h-0 flex-1 items-stretch overflow-hidden ${
          activePR ? 'xl:grid-rows-[100%]' : ''
        }`}
      >
        <div className="scroll-region min-h-0 min-w-0 overflow-y-auto pb-6 pr-1">
          <ul className="flex min-w-0 flex-col gap-4">
            <AnimatePresence mode="popLayout">
              {visiblePRs.map((pr, i) => (
                <motion.li
                  key={pr.id}
                  layout="position"
                  initial={revealing ? 'hidden' : false}
                  animate="shown"
                  exit="gone"
                  variants={cardVariants}
                  transition={{
                    layout: REORDER_SPRING,
                    default: revealing
                      ? { duration: 0.3, ease: EASE_OUT, delay: revealDelay(i) }
                      : CARD_SPRING,
                  }}
                >
                  <PRCard
                    pr={pr}
                    mode={mode}
                    isExpanded={false}
                    contained
                    inspected={activeId === pr.id}
                    onToggleExpand={() => inspect(pr)}
                    isHidden={hiddenPRIds.has(pr.id)}
                    onToggleHide={onToggleHidePR ? () => onToggleHidePR(pr.id) : undefined}
                    onRunAction={onRunAction}
                    busyAction={busy?.[pr.id] ?? null}
                    activity={activity?.[`${pr.repository.nameWithOwner}#${pr.number}`]}
                    onRefresh={onRefresh}
                    selected={selectedPRIds?.has(pr.id) ?? false}
                    onToggleSelect={
                      onToggleSelect ? (shiftKey) => onToggleSelect(pr.id, shiftKey) : undefined
                    }
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {visibleCount < prs.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + 50)}
              className="mt-4 w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm font-medium text-muted shadow-sm transition-colors hover:border-line-strong hover:text-ink"
            >
              Show {Math.min(50, prs.length - visibleCount)} more of {prs.length - visibleCount}{' '}
              remaining
            </button>
          )}
        </div>

        {activePR && (
          <div
            role="separator"
            aria-label="Resize pull request list and inspector"
            aria-orientation="vertical"
            aria-valuemin={MIN_MASTER_PERCENT}
            aria-valuemax={MAX_MASTER_PERCENT}
            aria-valuenow={Math.round(masterPercent)}
            tabIndex={0}
            onPointerDown={(event) => {
              if (!activePR) return;
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              resizingRef.current = true;
              setResizing(true);
              updateSplit(event.clientX);
            }}
            onPointerMove={(event) => {
              if (resizingRef.current) updateSplit(event.clientX);
            }}
            onPointerUp={(event) => {
              if (!resizingRef.current) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              commitSplit();
            }}
            onLostPointerCapture={() => {
              if (resizingRef.current) commitSplit();
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const availableMax = workspaceRef.current
                ? maxMasterPercent(workspaceRef.current.clientWidth)
                : MAX_MASTER_PERCENT;
              const next = Math.max(
                MIN_MASTER_PERCENT,
                Math.min(availableMax, masterPercent + (event.key === 'ArrowRight' ? 2 : -2)),
              );
              masterPercentRef.current = next;
              setMasterPercent(next);
              commitSplit(next);
            }}
            className="group hidden cursor-col-resize items-center justify-center outline-none xl:flex xl:self-stretch"
          >
            <span
              className={`h-full w-px rounded-full transition-all duration-instant group-hover:w-1 group-hover:bg-accent group-focus-visible:w-1 group-focus-visible:bg-accent ${
                resizing ? 'w-1 bg-accent' : 'bg-line-strong'
              }`}
            />
          </div>
        )}

        <AnimatePresence mode="wait">
          {activePR && (
            <motion.aside
              key="inspector"
              aria-label={`Inspector for pull request ${activePR.number}`}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 8 }}
              transition={{ duration: 0.16, ease: EASE_OUT }}
              className="scroll-region fixed inset-x-3 bottom-3 z-drawer max-h-[85dvh] min-w-0 overflow-y-auto rounded-lg bg-canvas p-2 shadow-float xl:static xl:z-auto xl:flex xl:h-full xl:max-h-none xl:min-h-0 xl:flex-col xl:overflow-hidden xl:rounded-none xl:bg-transparent xl:p-0 xl:pr-1 xl:shadow-none"
            >
              <div className="mb-2 flex items-center gap-2 px-1">
                <Keyboard aria-hidden className="h-3.5 w-3.5 text-dim" />
                <span className="text-xs text-dim">J/K navigate · 1–5 tabs · ⌘K commands</span>
                <button
                  onClick={() => setActiveId(null)}
                  aria-label="Close inspector"
                  className="ml-auto rounded-full p-1 text-dim hover:bg-surface-muted hover:text-ink"
                >
                  <X aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-line bg-surface/75 px-3 py-2 shadow-sm">
                <ChangeSummary digest={digests[activePR.id]} />
                <span aria-hidden className="hidden h-5 w-px bg-line 2xl:block" />
                <span className="text-xs text-dim">Set aside</span>
                <button
                  onClick={() => onSnooze?.(activePR, Date.now() + 24 * 60 * 60 * 1000)}
                  className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  Tomorrow
                </button>
                <button
                  onClick={() => onSnooze?.(activePR, Date.now() + 7 * 24 * 60 * 60 * 1000)}
                  className="rounded-md border border-line bg-surface-raised px-2 py-1 text-xs text-muted hover:text-ink"
                >
                  Next week
                </button>
                {snoozedUntil[activePR.id] && (
                  <button
                    onClick={() => onSnooze?.(activePR, null)}
                    className="px-2 text-xs text-accent hover:underline"
                  >
                    Wake now
                  </button>
                )}
              </div>
              <div className="scroll-region min-h-0 xl:flex-1 xl:overflow-y-auto">
                <PRCard
                  key={activePR.id}
                  pr={activePR}
                  mode={mode}
                  isExpanded
                  fillAvailable
                  hideStats
                  onToggleExpand={() => setActiveId(null)}
                  isHidden={hiddenPRIds.has(activePR.id)}
                  onToggleHide={onToggleHidePR ? () => onToggleHidePR(activePR.id) : undefined}
                  onRunAction={onRunAction}
                  busyAction={busy?.[activePR.id] ?? null}
                  activity={activity?.[`${activePR.repository.nameWithOwner}#${activePR.number}`]}
                  onRefresh={onRefresh}
                  activeTab={activeTab}
                  onTabChange={setActiveTab}
                />
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        commands={commands}
      />
    </div>
  );
}
