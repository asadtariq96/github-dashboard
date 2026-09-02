export const PANEL_HEAD = 'flex items-center gap-2 pb-2.5 text-sm';

export const PANEL_LINK =
  'text-xs font-medium text-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

export const PANEL_SCROLLER =
  'max-h-[340px] divide-y divide-line-subtle overflow-y-auto rounded-md border border-line';

export const PANEL_EMPTY =
  'rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-dim';

export const ICON_BUTTON =
  'pointer-safe inline-flex shrink-0 items-center justify-center rounded-sm text-faint transition-colors duration-instant ease-out hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent';

/** Whole seconds under a minute, then minutes and seconds. */
export function duration(seconds: number | null | undefined): string | null {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return null;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
}
