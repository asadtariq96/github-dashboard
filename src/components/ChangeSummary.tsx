'use client';

import React from 'react';
import type { ChangeDigest } from '../lib/visited';

export function ChangeSummary({ digest }: { digest: ChangeDigest | undefined }) {
  return (
    <div className="mb-3 rounded-lg border border-line bg-surface-raised p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-accent" />
        <h3 className="font-display text-lg text-ink">Since you last looked</h3>
      </div>
      {digest?.lines.length ? (
        <ul className="mt-3 space-y-2 text-sm text-muted">
          {digest.lines.map((line) => (
            <li key={line} className="flex gap-2">
              <span aria-hidden className="mt-2 h-1 w-1 shrink-0 rounded-full bg-faint" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">
          You’re caught up. Nothing changed since your last visit.
        </p>
      )}
    </div>
  );
}
