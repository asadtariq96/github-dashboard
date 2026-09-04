'use client';

import React from 'react';
import type { ChangeDigest } from '../lib/visited';

export function ChangeSummary({ digest }: { digest: ChangeDigest | undefined }) {
  const summary = digest?.lines.length
    ? `${digest.lines[0]}${digest.lines.length > 1 ? ` · +${digest.lines.length - 1} more` : ''}`
    : 'Caught up — nothing changed since your last visit.';

  return (
    <div className="flex min-w-[16rem] flex-1 items-center gap-2" title={summary}>
      <span className="h-2 w-2 shrink-0 rounded-full bg-accent" />
      <span className="shrink-0 text-xs font-semibold text-ink">Since last look</span>
      <span className="min-w-0 truncate text-xs text-muted">{summary}</span>
    </div>
  );
}
