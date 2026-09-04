'use client';

import React from 'react';
import type { PullRequestAssessment } from '../../types/pr';
import type { FilterChip } from '../FilterChips';

export interface RepoSummary {
  shortName: string;
  visibleCount: number;
  hidden: PullRequestAssessment[];
  snoozedCount: number;
}

export function EmptyQueue({
  activeView,
  activeViewLabel,
  selectedRepoSummary,
  onUnhideRepo,
  onViewSnoozed,
  onShowAll,
  activeChips,
  filterSummary,
  onClearFilters,
  hasSearchQuery,
}: {
  activeView: string;
  activeViewLabel: string;
  selectedRepoSummary: RepoSummary | null;
  onUnhideRepo: () => void;
  onViewSnoozed: () => void;
  onShowAll: () => void;
  activeChips: FilterChip[];
  filterSummary: string;
  onClearFilters: () => void;
  hasSearchQuery: boolean;
}) {
  return (
    <div className="rounded-md border border-line bg-surface px-6 py-16 text-center">
      <p className="text-sm text-muted">Nothing in {activeViewLabel}.</p>
      {selectedRepoSummary && selectedRepoSummary.hidden.length > 0 && (
        <div className="mt-3">
          <p className="text-sm text-dim">
            {selectedRepoSummary.hidden.length}{' '}
            {selectedRepoSummary.hidden.length === 1 ? 'pull request is' : 'pull requests are'}{' '}
            hidden in {selectedRepoSummary.shortName}.
          </p>
          <button
            onClick={onUnhideRepo}
            className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
          >
            Unhide {selectedRepoSummary.hidden.length}{' '}
            {selectedRepoSummary.hidden.length === 1 ? 'PR' : 'PRs'}
          </button>
        </div>
      )}
      {selectedRepoSummary &&
        selectedRepoSummary.visibleCount > 0 &&
        selectedRepoSummary.snoozedCount === selectedRepoSummary.visibleCount &&
        activeView !== 'snoozed' &&
        !hasSearchQuery && (
          <div className="mt-3">
            <p className="text-sm text-dim">
              {selectedRepoSummary.snoozedCount}{' '}
              {selectedRepoSummary.snoozedCount === 1
                ? 'open pull request is'
                : 'open pull requests are'}{' '}
              snoozed in {selectedRepoSummary.shortName}.
            </p>
            <button
              onClick={onViewSnoozed}
              className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
            >
              View snoozed PRs
            </button>
          </div>
        )}
      {selectedRepoSummary &&
        selectedRepoSummary.visibleCount > 0 &&
        selectedRepoSummary.snoozedCount !== selectedRepoSummary.visibleCount &&
        activeView !== 'all' &&
        !hasSearchQuery && (
          <div className="mt-3">
            <p className="text-sm text-dim">
              {selectedRepoSummary.visibleCount}{' '}
              {selectedRepoSummary.visibleCount === 1
                ? 'open pull request exists'
                : 'open pull requests exist'}{' '}
              in {selectedRepoSummary.shortName}, but none appear in {activeViewLabel}.
            </p>
            <button
              onClick={onShowAll}
              className="tap-safe mt-3 rounded-md border border-line-control bg-surface-raised px-3 py-1.5 text-sm font-medium text-ink shadow-sm transition-colors duration-instant ease-out hover:border-line-strong"
            >
              Show open PRs
            </button>
          </div>
        )}
      {activeChips.length > 0 && (
        <>
          <p className="mt-1 text-sm text-dim">
            {filterSummary} {activeChips.length === 1 ? 'is' : 'are'} still on.
          </p>
          <button
            onClick={onClearFilters}
            className="tap-safe mt-3 rounded-md border border-line-control bg-surface px-3 py-1.5 text-sm text-muted transition-colors duration-instant ease-out hover:text-ink"
          >
            Clear {activeChips.length === 1 ? activeChips[0].label.toLowerCase() : 'filters'}
          </button>
        </>
      )}
    </div>
  );
}
