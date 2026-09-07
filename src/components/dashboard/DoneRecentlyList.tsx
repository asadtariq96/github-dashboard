'use client';

import { CheckCircle2, ExternalLink } from 'lucide-react';
import type { RecentCompletion } from '../../lib/workQueue';

export function DoneRecentlyList({ items }: { items: RecentCompletion[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={`${item.id}-${item.completedAt}`}
          className="flex items-center gap-4 rounded-lg border border-line bg-surface px-5 py-4 shadow-sm"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ready-wash text-ready">
            <CheckCircle2 aria-hidden className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-ink hover:text-accent"
            >
              {item.title}
            </a>
            <p className="mt-0.5 text-xs text-dim">
              {item.repository} · #{item.number} · {item.outcome}{' '}
              {new Date(item.completedAt).toLocaleDateString()}
            </p>
          </div>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open pull request ${item.number} on GitHub`}
            className="rounded-full border border-line bg-surface-raised p-2 text-dim hover:text-ink"
          >
            <ExternalLink aria-hidden className="h-4 w-4" />
          </a>
        </li>
      ))}
    </ul>
  );
}

export function DoneRecentlyEmpty({ hasAny }: { hasAny: boolean }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-6 py-16 text-center">
      <CheckCircle2 aria-hidden className="mx-auto h-6 w-6 text-ready" />
      <p className="mt-3 text-sm text-muted">
        {hasAny
          ? 'No completed pull requests match these filters.'
          : 'Nothing completed in the last 7 days.'}
      </p>
      <p className="mt-1 text-xs text-dim">
        {hasAny
          ? 'Clear the active search or repository filter to see the full history.'
          : 'Recently merged and closed pull requests from GitHub will appear here.'}
      </p>
    </div>
  );
}
