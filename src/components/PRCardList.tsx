'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { PrActivityInfo, PullRequestAssessment } from '../types/pr';
import type { Mode } from '../lib/config';
import type { RowActionId } from '../lib/rowAction';
import { CARD_SPRING, EASE_OUT, REORDER_SPRING, cardVariants, revealDelay } from '../lib/motion';
import { PRCard } from './pr-card/PRCard';

export { PRCard } from './pr-card/PRCard';

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
}: {
  prs: PullRequestAssessment[];
  mode: Mode;
  hiddenPRIds?: Set<string>;
  onToggleHidePR?: (id: string) => void;
  onRunAction?: (pr: PullRequestAssessment, action: RowActionId) => void;
  /** The action running on each PR, keyed by PR id. Several may run at once. */
  busy?: Record<string, RowActionId>;
  activity?: Record<string, PrActivityInfo>;
  onRefresh?: () => Promise<void> | void;
  selectedPRIds?: Set<string>;
  onToggleSelect?: (prId: string, shiftKey: boolean) => void;
}) {
  const [expandedPRs, setExpandedPRs] = useState<Record<string, boolean>>({});

  /**
   * The reveal is a first-paint effect. After that every card enters with no animation,
   * because rows arrive from a 30 second poll and an event stream, and movement during a
   * read makes the list hard to follow.
   *
   * This is a ref read during render, not state. State would flip a frame after mount and
   * re-render with a different `initial`, which cancels the reveal before it is seen.
   */
  const firstPass = useRef(true);
  useEffect(() => {
    firstPass.current = false;
  }, []);
  const revealing = firstPass.current;

  const toggleExpand = (id: string) => {
    setExpandedPRs((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  if (prs.length === 0) return null;

  return (
    <ul className="flex flex-col gap-3">
      {/*
        No `initial={false}` here. That prop suppresses the enter animation on the first
        render, which is the one render the reveal is for. Each card decides for itself:
        `hidden` on the first pass, `false` for anything that arrives later.
      */}
      <AnimatePresence mode="popLayout">
        {prs.map((pr, i) => (
          <motion.li
            key={pr.id}
            layout
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
              isExpanded={Boolean(expandedPRs[pr.id])}
              onToggleExpand={() => toggleExpand(pr.id)}
              isHidden={hiddenPRIds.has(pr.id)}
              onToggleHide={onToggleHidePR ? () => onToggleHidePR(pr.id) : undefined}
              onRunAction={onRunAction}
              busyAction={busy?.[pr.id] ?? null}
              activity={
                activity ? activity[`${pr.repository.nameWithOwner}#${pr.number}`] : undefined
              }
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
  );
}
