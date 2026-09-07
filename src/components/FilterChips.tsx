'use client';

import { X } from 'lucide-react';

export interface FilterChip {
  id: string;
  /** What the filter is. */
  label: string;
  /** What it is set to. */
  value: string;
  onRemove: () => void;
}

/**
 * The row wraps and never clips. There is no `+n` overflow because the set caps at two:
 * one repository and one search term.
 */
export function FilterChips({
  chips,
  onClearAll,
}: {
  chips: FilterChip[];
  onClearAll: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div role="group" aria-label="Active filters" className="flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <span
          key={chip.id}
          className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-line bg-surface-raised py-1 pl-2.5 pr-1.5 text-xs shadow-sm"
        >
          <span className="shrink-0 text-dim">{chip.label}</span>
          <span className="min-w-0 truncate text-ink" title={chip.value}>
            {chip.value}
          </span>
          <button
            onClick={chip.onRemove}
            aria-label={`Remove ${chip.label} filter: ${chip.value}`}
            title={`Remove ${chip.label} filter`}
            className="pointer-safe inline-flex shrink-0 items-center justify-center rounded-sm text-dim transition-colors duration-instant ease-out hover:text-ink"
          >
            <X aria-hidden strokeWidth={2} className="h-3 w-3" />
          </button>
        </span>
      ))}

      {chips.length > 1 && (
        <button
          onClick={onClearAll}
          className="pointer-safe rounded-sm px-1 text-xs text-accent transition-colors duration-instant ease-out hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
