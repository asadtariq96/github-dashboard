'use client';

import React, { useEffect, useState } from 'react';
import {
  CircleAlert,
  CircleCheck,
  CircleSlash,
  ExternalLink,
  Loader2,
  Lock,
  Rocket,
} from 'lucide-react';
import type { CheckRunItem, MergeQueueDetail, PullRequestAssessment } from '../../types/pr';
import { checkState, sortedChecks } from '../../lib/checks';
import { compactAge } from '../../lib/time';
import { CountPill } from './ui';
import { CheckRow } from './ChecksPanel';
import { duration, PANEL_EMPTY, PANEL_HEAD, PANEL_LINK, PANEL_SCROLLER } from './panelChrome';

type StepState = 'done' | 'active' | 'waiting' | 'failed' | 'skipped';

interface Step {
  key: string;
  label: string;
  detail: string;
  state: StepState;
}

const STEP_TONE: Record<StepState, string> = {
  done: 'text-ready',
  active: 'text-accent',
  waiting: 'text-dim',
  failed: 'text-danger',
  skipped: 'text-faint',
};

function StepIcon({ state }: { state: StepState }) {
  if (state === 'active') {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-accent" />
      </span>
    );
  }
  if (state === 'failed') {
    return (
      <CircleAlert
        aria-hidden
        strokeWidth={2.5}
        className="h-4 w-4 shrink-0 fill-danger text-surface"
      />
    );
  }
  if (state === 'done') {
    return (
      <CircleCheck
        aria-hidden
        strokeWidth={2.5}
        className="h-4 w-4 shrink-0 fill-ready text-surface"
      />
    );
  }
  return (
    <span aria-hidden className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <span className="h-2.5 w-2.5 rounded-full border border-line-strong" />
    </span>
  );
}

/**
 * The queue has no step API, so the sequence is derived from the entry state, the
 * speculative rollup and the deployment hold.
 */
function buildSteps(pr: PullRequestAssessment, d: MergeQueueDetail): Step[] {
  const failed = d.state === 'UNMERGEABLE';
  const locked = d.state === 'LOCKED';
  const rollup = d.rollupState;
  const counts = d.checks.reduce(
    (acc, c) => {
      acc[checkState(c)] += 1;
      return acc;
    },
    { failed: 0, running: 0, passed: 0, skipped: 0 },
  );

  const hold = Boolean(pr.mergeQueueInfo?.isWaitingForApproval);
  const checksDone = rollup === 'SUCCESS';
  const checksFailed = rollup === 'FAILURE' || rollup === 'ERROR' || counts.failed > 0;

  const steps: Step[] = [
    {
      key: 'enqueued',
      label: 'Entered the queue',
      detail: d.enqueuedAt
        ? `${compactAge(d.enqueuedAt)}${d.enqueuer ? ` by ${d.enqueuer}` : ''}`
        : 'Queued',
      state: 'done',
    },
    {
      key: 'batch',
      label: d.solo ? 'Building alone' : 'Batched with the queue',
      detail:
        [
          d.position !== null ? `position ${d.position}` : null,
          d.solo ? 'pulled out of the batch' : null,
          d.jump ? 'jumped the queue' : null,
        ]
          .filter(Boolean)
          .join(' · ') || 'In a batch',
      state: 'done',
    },
    {
      key: 'checks',
      label: 'Speculative merge checks',
      detail: checksFailed
        ? `${counts.failed} failed of ${d.checkTotal}`
        : checksDone
          ? `all ${d.checkTotal} passed`
          : `${counts.passed} of ${d.checkTotal} passed, ${counts.running} running`,
      state: checksFailed ? 'failed' : checksDone ? 'done' : 'active',
    },
  ];

  if (hold || pr.mergeQueueInfo?.approvalStepName) {
    steps.push({
      key: 'approval',
      label: 'Deployment approval',
      detail: hold ? pr.mergeQueueInfo?.approvalStepName || 'Waiting for you' : 'Approved',
      state: hold ? 'failed' : 'done',
    });
  }

  const eta = d.estimatedTimeToMerge ? `about ${duration(d.estimatedTimeToMerge)} left` : null;

  steps.push({
    key: 'merge',
    label: 'Merge into the base branch',
    detail: failed
      ? 'The queue could not merge it'
      : locked
        ? 'The queue is locked'
        : d.state === 'MERGEABLE'
          ? 'Merging now'
          : hold
            ? 'Held until the deployment is approved'
            : // The entry state lags the rollup, so say so rather than look contradictory.
              checksDone
              ? ['Checks passed. Waiting for the queue to advance', eta].filter(Boolean).join(' · ')
              : (eta ?? 'Waiting on the steps above'),
    state: failed || locked ? 'failed' : d.state === 'MERGEABLE' ? 'active' : 'waiting',
  });

  return steps;
}

const STATE_LABEL: Record<string, string> = {
  QUEUED: 'Queued',
  AWAITING_CHECKS: 'Running checks',
  MERGEABLE: 'Merging',
  UNMERGEABLE: 'Cannot merge',
  LOCKED: 'Locked',
};

/** The queue moves without touching the pull request, so this panel keeps its own clock. */
const QUEUE_POLL_MS = 15000;

export function MergeQueuePanel({ pr }: { pr: PullRequestAssessment }) {
  const [detail, setDetail] = useState<MergeQueueDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async (first: boolean) => {
      if (first) setLoading(true);
      try {
        const res = await fetch('/api/queue/detail', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prId: pr.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
        setDetail(json.detail);
        setError(null);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Could not load the merge queue entry');
      } finally {
        if (!cancelled && first) setLoading(false);
      }
    };

    void load(true);
    const timer = setInterval(() => void load(false), QUEUE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [pr.id]);

  const queueChecks: CheckRunItem[] = detail
    ? sortedChecks({ ...pr, checkRuns: detail.checks })
    : [];

  return (
    <section className="min-w-0 p-4">
      <header className={PANEL_HEAD}>
        <span className="font-bold text-ink">Merge queue</span>
        {detail && <CountPill>{STATE_LABEL[detail.state] ?? detail.state}</CountPill>}
        {detail?.configuration?.mergingStrategy && (
          <span className="text-xs text-dim">
            {detail.configuration.mergeMethod?.toLowerCase()} &middot;{' '}
            {detail.configuration.mergingStrategy.toLowerCase()}
          </span>
        )}
        <a
          href={pr.mergeQueueInfo?.url || pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PANEL_LINK} ml-auto inline-flex items-center gap-1`}
        >
          Open the queue
          <ExternalLink aria-hidden strokeWidth={2} className="h-3 w-3" />
        </a>
      </header>

      {loading && (
        <p className="flex items-center gap-2 rounded-md border border-line px-3 py-6 text-xs text-dim">
          <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
          Reading the queue&hellip;
        </p>
      )}

      {error && (
        <p className="rounded-md border border-danger-border bg-danger-wash px-3 py-4 text-xs text-danger">
          {error}
        </p>
      )}

      {detail && (
        <>
          <ol className="mb-4 rounded-md border border-line">
            {buildSteps(pr, detail).map((step, i, all) => (
              <li
                key={step.key}
                className={`flex items-start gap-2.5 px-3 py-2 ${
                  i < all.length - 1 ? 'border-b border-line-subtle' : ''
                }`}
              >
                <span className="mt-px">
                  <StepIcon state={step.state} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-xs font-semibold ${STEP_TONE[step.state]}`}>
                    {step.label}
                  </span>
                  <span className="block text-2xs text-dim">{step.detail}</span>
                </span>
              </li>
            ))}
          </ol>

          {pr.mergeQueueInfo?.isWaitingForApproval && pr.mergeQueueInfo.approvalStepUrl && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-warn/40 bg-warn-wash px-3 py-2 text-2xs text-warn">
              <Rocket aria-hidden strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
              The queue is held until you approve the deployment.
              <a
                href={pr.mergeQueueInfo.approvalStepUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto shrink-0 font-semibold underline"
              >
                See the run
              </a>
            </p>
          )}

          {detail.state === 'LOCKED' && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-danger-border bg-danger-wash px-3 py-2 text-2xs text-danger">
              <Lock aria-hidden strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
              The queue is locked. Nothing merges until it clears.
            </p>
          )}

          {detail.state === 'UNMERGEABLE' && (
            <p className="mb-4 flex items-center gap-2 rounded-md border border-danger-border bg-danger-wash px-3 py-2 text-2xs text-danger">
              <CircleSlash aria-hidden strokeWidth={2} className="h-3.5 w-3.5 shrink-0" />
              The queue gave up on this entry. Remove it, fix the branch and queue it again.
            </p>
          )}

          <h5 className="flex items-center gap-2 pb-2 text-xs">
            <span className="font-bold text-ink">Checks on the merge commit</span>
            <CountPill>{detail.checkTotal}</CountPill>
            {detail.headSha && (
              <span className="font-mono text-2xs text-faint">{detail.headSha.slice(0, 7)}</span>
            )}
          </h5>

          {queueChecks.length === 0 ? (
            <p className={PANEL_EMPTY}>The queue has not reported any checks yet.</p>
          ) : (
            <ul className={PANEL_SCROLLER}>
              {queueChecks.map((check) => (
                <CheckRow key={check.id} check={check} />
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
