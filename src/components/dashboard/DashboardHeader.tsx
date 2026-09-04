'use client';

import React from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { Mode } from '../../lib/config';
import type { DashboardSyncResponse } from '../../types/pr';
import { ModeSwitch } from '../ModeSwitch';
import { ThemeToggle } from '../ThemeToggle';

export function DashboardHeader({
  mode,
  searchQuery,
  onSearchChange,
  data,
  totalCount,
  formattedTime,
  refreshing,
  loading,
  busyCount,
  onRefresh,
}: {
  mode: Mode;
  searchQuery: string;
  onSearchChange: (v: string) => void;
  data: DashboardSyncResponse | null;
  totalCount: number;
  formattedTime: string | null;
  refreshing: boolean;
  loading: boolean;
  busyCount: number;
  onRefresh: () => void;
}) {
  const otherAgeMs = (() => {
    const ages = data?.otherAges;
    if (!ages) return null;
    return ages[mode === 'mine' ? 'reviews' : 'mine'] ?? null;
  })();

  return (
    <header className="z-chrome flex h-header shrink-0 items-center gap-3 border-b border-line/80 bg-surface/90 px-4 backdrop-blur-xl sm:px-6">
      <div className="flex shrink-0 items-center gap-2.5">
        <span aria-hidden className="relative block h-5 w-5 text-accent">
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" />
          <span className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-current" />
          <span className="absolute bottom-0 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-current" />
        </span>
        <h1 className="font-display text-xl tracking-tight text-ink">PR Desk</h1>
      </div>

      <ModeSwitch mode={mode} activeCount={totalCount} otherAgeMs={otherAgeMs} />

      <div className="relative ml-auto hidden min-w-0 max-w-sm flex-1 sm:block">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-dim"
        />
        <input
          type="text"
          placeholder="Search"
          aria-label="Search pull requests"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-lg border border-line bg-surface-raised py-2 pl-9 pr-3 text-sm text-ink shadow-sm placeholder:text-dim focus:border-line-strong focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        />
      </div>

      {data && (
        <span className="hidden shrink-0 items-center gap-1.5 text-xs text-muted md:inline-flex">
          <span
            aria-hidden
            className={`h-1.5 w-1.5 rounded-full ${
              data.syncStatus === 'Healthy'
                ? 'bg-ready'
                : data.syncStatus === 'Syncing'
                  ? 'bg-info animate-pulse-dot'
                  : 'bg-danger'
            }`}
          />
          {formattedTime ? `Updated ${formattedTime}` : data.syncStatus}
        </span>
      )}

      <button
        onClick={onRefresh}
        disabled={refreshing || loading || busyCount > 0}
        aria-label={busyCount > 0 ? 'Working on a pull request' : 'Refresh'}
        title={
          busyCount > 0
            ? `Working on ${busyCount} pull request${busyCount === 1 ? '' : 's'}…`
            : 'Refresh'
        }
        className="tap-safe shrink-0 rounded-lg border border-line bg-surface-raised p-2 text-muted shadow-sm transition-all duration-instant ease-out hover:-translate-y-px hover:border-line-strong hover:text-ink disabled:opacity-50"
      >
        <RefreshCw
          aria-hidden
          className={`h-4 w-4 ${refreshing || busyCount > 0 ? 'animate-spin text-accent' : ''}`}
        />
      </button>

      <ThemeToggle />
    </header>
  );
}
