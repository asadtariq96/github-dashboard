'use client';

import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Check, EyeOff, GitMerge, Loader2, RefreshCw, X } from 'lucide-react';
import type { PullRequestAssessment } from '../types/pr';
import { BATCH_ACTIONS, supportsAction, type RowActionId } from '../lib/rowAction';
import { CARD_SPRING } from '../lib/motion';

const ACTION_ICON: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }>
> = {
  'update-branch': GitMerge,
  'rerun-checks': RefreshCw,
};

const ACTION_VERB: Record<string, string> = {
  'update-branch': 'Update',
  'rerun-checks': 'Re-run checks on',
};

const BUTTON =
  'inline-flex shrink-0 items-center gap-1.5 rounded-md border border-line-control bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors duration-instant ease-out hover:bg-surface-muted hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';

/**
 * Appears only while something is selected. It offers an action only when at least one
 * selected pull request actually supports it, so a button never sits there dead.
 */
export function BatchToolbar({
  selected,
  totalInView,
  onSelectAll,
  onClear,
  onRunBatch,
  onHideAll,
  running,
}: {
  selected: PullRequestAssessment[];
  totalInView: number;
  onSelectAll: () => void;
  onClear: () => void;
  onRunBatch: (action: RowActionId, prs: PullRequestAssessment[]) => void;
  onHideAll: () => void;
  /** The batch action in flight, or null. */
  running: RowActionId | null;
}) {
  const count = selected.length;

  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="region"
          aria-label={`${count} pull requests selected`}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={CARD_SPRING}
          className="fixed bottom-4 left-1/2 z-popover flex max-w-[calc(100vw-2rem)] -translate-x-1/2 flex-wrap items-center gap-2 rounded-lg border border-line-strong bg-surface-raised px-3 py-2 shadow-float"
        >
          <span className="shrink-0 text-xs font-semibold text-ink">
            <span className="tabular">{count}</span> selected
          </span>

          <span aria-hidden className="h-4 w-px shrink-0 bg-line" />

          {BATCH_ACTIONS.map((action) => {
            const eligible = selected.filter((pr) => supportsAction(pr, action));
            if (eligible.length === 0) return null;
            const Icon = ACTION_ICON[action];
            const busy = running === action;

            return (
              <button
                key={action}
                type="button"
                onClick={() => onRunBatch(action, eligible)}
                disabled={running !== null}
                className={BUTTON}
              >
                {busy ? (
                  <Loader2 aria-hidden className="h-[13px] w-[13px] animate-spin" />
                ) : (
                  <Icon aria-hidden strokeWidth={2} className="h-[13px] w-[13px] opacity-80" />
                )}
                {ACTION_VERB[action]} <span className="tabular">{eligible.length}</span>
              </button>
            );
          })}

          <button type="button" onClick={onHideAll} disabled={running !== null} className={BUTTON}>
            <EyeOff aria-hidden strokeWidth={2} className="h-[13px] w-[13px] opacity-80" />
            Hide <span className="tabular">{count}</span>
          </button>

          <span aria-hidden className="h-4 w-px shrink-0 bg-line" />

          {count < totalInView && (
            <button type="button" onClick={onSelectAll} className={BUTTON}>
              <Check aria-hidden strokeWidth={2} className="h-[13px] w-[13px] opacity-80" />
              Select all <span className="tabular">{totalInView}</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClear}
            aria-label="Clear the selection"
            className={`${BUTTON} px-1.5`}
          >
            <X aria-hidden strokeWidth={2} className="h-[13px] w-[13px]" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
