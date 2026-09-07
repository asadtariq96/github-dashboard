'use client';

import Link from 'next/link';
import type { Mode } from '../lib/config';

interface ModeSwitchProps {
  mode: Mode;
  /** Count for the active mode. The other mode reports an age instead. */
  activeCount: number;
  /** Milliseconds since the inactive mode was last checked, or null if never. */
  otherAgeMs: number | null;
}

const OTHER: Record<Mode, { href: string; label: string }> = {
  mine: { href: '/reviews', label: 'Reviews' },
  reviews: { href: '/mine', label: 'Mine' },
};

const HERE: Record<Mode, string> = { mine: 'Mine', reviews: 'Reviews' };

/** "4m" style age. The inactive mode never shows a count, which would be stale. */
function formatAge(ms: number | null): string {
  if (ms === null) return 'not checked';
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function ModeSwitch({ mode, activeCount, otherAgeMs }: ModeSwitchProps) {
  const other = OTHER[mode];

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-line bg-surface-muted p-1"
      role="group"
      aria-label="Pull request mode"
    >
      <span
        aria-current="page"
        className="inline-flex items-center gap-2 rounded-md bg-surface-raised px-2.5 py-1.5 text-sm font-medium text-ink shadow-sm"
      >
        {HERE[mode]}
        <span className="font-mono text-2xs tabular">{activeCount}</span>
      </span>

      <Link
        href={other.href}
        className="tap-safe inline-flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-muted transition-colors duration-instant ease-out hover:bg-surface-raised hover:text-ink"
        title={`${other.label}, checked ${formatAge(otherAgeMs)}`}
      >
        {other.label}
        <span className="font-mono text-2xs text-dim">{formatAge(otherAgeMs)}</span>
      </Link>
    </div>
  );
}
