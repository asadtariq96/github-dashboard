'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  CircleCheck,
  CircleMinus,
  CircleX,
  ExternalLink,
  Loader2,
  ScrollText,
} from 'lucide-react';
import type { CheckDetail, CheckRunItem, CheckStep, PullRequestAssessment } from '../../types/pr';
import {
  checkState,
  checkTiming,
  sortedChecks,
  summarizeChecks,
  type CheckState,
} from '../../lib/checks';
import { CountPill } from './ui';
import {
  duration,
  ICON_BUTTON,
  PANEL_EMPTY,
  PANEL_HEAD,
  PANEL_LINK,
  panelRoot,
  panelScroller,
} from './panelChrome';

const ANNOTATION_TONE: Record<string, string> = {
  FAILURE: 'border-danger-border bg-danger-wash text-danger',
  WARNING: 'border-warn/40 bg-warn-wash text-warn',
  NOTICE: 'border-line bg-surface-muted text-muted',
};

export function CheckIcon({ state }: { state: CheckState }) {
  if (state === 'running') {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <span aria-hidden className="h-2.5 w-2.5 animate-pulse-dot rounded-full bg-accent" />
      </span>
    );
  }
  if (state === 'skipped') {
    return <CircleMinus aria-hidden strokeWidth={2} className="h-4 w-4 shrink-0 text-faint" />;
  }
  const Icon = state === 'failed' ? CircleX : CircleCheck;
  return (
    <Icon
      aria-hidden
      strokeWidth={2.5}
      className={`h-4 w-4 shrink-0 text-surface ${state === 'failed' ? 'fill-danger' : 'fill-ready'}`}
    />
  );
}

function StepRow({ step }: { step: CheckStep }) {
  const state = checkState({
    id: String(step.number),
    name: step.name,
    status: step.status,
    conclusion: step.conclusion,
    detailsUrl: null,
  });
  const took = duration(step.secondsToCompletion);

  return (
    <li className="flex items-center gap-2 py-1">
      <CheckIcon state={state} />
      <span className="min-w-0 flex-1 truncate text-2xs text-muted">{step.name}</span>
      {took && <span className="shrink-0 font-mono text-2xs tabular text-faint">{took}</span>}
    </li>
  );
}

function CheckBody({ detail }: { detail: CheckDetail }) {
  const failures = detail.annotations.filter((a) => a.annotationLevel === 'FAILURE');
  const others = detail.annotations.filter((a) => a.annotationLevel !== 'FAILURE');
  const annotations = [...failures, ...others];

  return (
    <div className="flex flex-col gap-3 border-t border-line-subtle bg-surface-muted/40 px-3 py-2.5">
      {detail.summary && (
        <div>
          <h5 className="pb-1 text-2xs font-semibold uppercase tracking-wider text-dim">Summary</h5>
          <div className="md text-xs" dangerouslySetInnerHTML={{ __html: detail.summary }} />
        </div>
      )}

      {annotations.length > 0 && (
        <div>
          <h5 className="pb-1 text-2xs font-semibold uppercase tracking-wider text-dim">
            Annotations {annotations.length}
          </h5>
          <ul className="flex flex-col gap-1">
            {annotations.map((a, i) => (
              <li
                key={i}
                className={`rounded-sm border px-2 py-1.5 text-2xs ${
                  ANNOTATION_TONE[a.annotationLevel || 'NOTICE']
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate font-mono font-semibold">
                    {a.path}
                    {a.startLine !== null && `:${a.startLine}`}
                  </span>
                  {a.blobUrl && (
                    <a
                      href={a.blobUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open ${a.path} on GitHub`}
                      className={`${ICON_BUTTON} ml-auto`}
                    >
                      <ExternalLink aria-hidden strokeWidth={2} className="h-3 w-3" />
                    </a>
                  )}
                </span>
                <span className="mt-0.5 block whitespace-pre-wrap text-ink">{a.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {detail.steps.length > 0 && (
        <div>
          <h5 className="pb-1 text-2xs font-semibold uppercase tracking-wider text-dim">Steps</h5>
          <ul>
            {detail.steps.map((step) => (
              <StepRow key={step.number} step={step} />
            ))}
          </ul>
        </div>
      )}

      {detail.logTail && (
        <div>
          <h5 className="pb-1 text-2xs font-semibold uppercase tracking-wider text-dim">
            Last lines of the log
          </h5>
          <pre className="max-h-56 overflow-auto rounded-sm border border-line bg-canvas p-2 font-mono text-2xs leading-relaxed text-muted">
            {detail.logTail}
          </pre>
        </div>
      )}

      {detail.logError && <p className="text-2xs text-dim">{detail.logError}</p>}

      {!detail.summary &&
        annotations.length === 0 &&
        detail.steps.length === 0 &&
        !detail.logTail &&
        !detail.logError && (
          <p className="text-2xs text-dim">This check reported no steps, output or annotations.</p>
        )}
    </div>
  );
}

export function CheckRow({ check }: { check: CheckRunItem }) {
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<CheckDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = checkState(check);
  const wantsLog = state === 'failed' || state === 'running';

  const toggle = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (detail || loading) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checks/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkId: check.id, withLog: wantsLog }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
      setDetail(json.detail);
    } catch (err: any) {
      setError(err.message || 'Could not load this check');
    } finally {
      setLoading(false);
    }
  };

  return (
    <li className="defer-row">
      <div className="flex items-center gap-2.5 px-3 py-2 transition-colors duration-instant ease-out hover:bg-surface-hover">
        <CheckIcon state={state} />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          <span className="block truncate text-xs font-semibold text-ink">{check.name}</span>
          <span className="block text-2xs text-dim">
            {checkTiming(check, state)}
            {check.isRequired === false && ' · optional'}
          </span>
        </button>

        {wantsLog && (
          <ScrollText
            aria-label="A log is available for this check"
            strokeWidth={2}
            className="h-3 w-3 shrink-0 text-faint"
          />
        )}

        {check.detailsUrl && (
          <a
            href={check.detailsUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${check.name} on GitHub`}
            className={ICON_BUTTON}
          >
            <ExternalLink aria-hidden strokeWidth={2} className="h-[13px] w-[13px]" />
          </a>
        )}

        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? `Hide detail for ${check.name}` : `Show detail for ${check.name}`}
          className={ICON_BUTTON}
        >
          <ChevronDown
            aria-hidden
            strokeWidth={2}
            className={`h-3.5 w-3.5 transition-transform duration-fast ease-out ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {open && (
        <>
          {loading && (
            <p className="flex items-center gap-2 border-t border-line-subtle px-3 py-2.5 text-2xs text-dim">
              <Loader2 aria-hidden className="h-3.5 w-3.5 animate-spin" />
              Loading the check…
            </p>
          )}
          {error && (
            <p className="border-t border-line-subtle px-3 py-2.5 text-2xs text-danger">{error}</p>
          )}
          {detail && <CheckBody detail={detail} />}
        </>
      )}
    </li>
  );
}

export function ChecksPanel({ pr, fill = false }: { pr: PullRequestAssessment; fill?: boolean }) {
  const { total, failed, running } = summarizeChecks(pr);
  const checks = sortedChecks(pr);
  const subtext = [
    failed > 0 ? `${failed} failed` : null,
    running > 0 ? `${running} running` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <section className={panelRoot(fill)}>
      <header className={PANEL_HEAD}>
        <span className="font-bold text-ink">Checks</span>
        <CountPill>{total}</CountPill>
        {subtext && <span className="text-xs text-dim">{subtext}</span>}
        <a
          href={`${pr.url}/checks`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PANEL_LINK} ml-auto`}
        >
          View all checks
        </a>
      </header>

      {checks.length === 0 ? (
        <p className={PANEL_EMPTY}>No checks reported on this pull request.</p>
      ) : (
        <ul className={panelScroller(fill)}>
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </ul>
      )}
    </section>
  );
}
