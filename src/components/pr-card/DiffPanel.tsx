'use client';

import React, { useMemo, useRef, useState } from 'react';
import { PanelLeft, PanelLeftClose } from 'lucide-react';
import { PatchDiff } from '@pierre/diffs/react';
import { FileTree, useFileTree } from '@pierre/trees/react';
import type { PullRequestAssessment } from '../../types/pr';

interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
  truncated: boolean;
}

/** Without the `diff --git` line the parser reads the filename as `b/<path>`. */
function buildPatch(filename: string, patch: string): string {
  const body = patch.endsWith('\n') ? patch : `${patch}\n`;
  return `diff --git a/${filename} b/${filename}\n--- a/${filename}\n+++ b/${filename}\n${body}`;
}

const TREE_STORAGE_KEY = 'pr-desk:files-tree-width';
const MIN_TREE_WIDTH = 150;
const MAX_TREE_WIDTH = 520;
/** The diff needs more room than the tree, so the tree never takes more than half. */
const MAX_TREE_SHARE = 0.5;

function clampTreeWidth(px: number, available: number): number {
  const ceiling = Math.min(MAX_TREE_WIDTH, Math.max(MIN_TREE_WIDTH, available * MAX_TREE_SHARE));
  return Math.round(Math.max(MIN_TREE_WIDTH, Math.min(ceiling, px)));
}

export function DiffPanel({ pr, fill = false }: { pr: PullRequestAssessment; fill?: boolean }) {
  const [files, setFiles] = useState<PRFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'unified' | 'split'>('unified');
  const [selected, setSelected] = useState<string | null>(null);
  const [treeOpen, setTreeOpen] = useState(true);
  const [treeWidth, setTreeWidth] = useState(208);
  const [resizing, setResizing] = useState(false);
  const treeWidthRef = useRef(208);
  const resizingRef = useRef(false);
  const dragRectRef = useRef<DOMRect | null>(null);
  const rafRef = useRef<number | null>(null);
  const pendingXRef = useRef(0);
  const gridRef = useRef<HTMLDivElement>(null);
  React.useEffect(
    () => () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    },
    [],
  );

  React.useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(TREE_STORAGE_KEY));
      if (Number.isFinite(stored) && stored >= MIN_TREE_WIDTH && stored <= MAX_TREE_WIDTH) {
        treeWidthRef.current = stored;
        setTreeWidth(stored);
      }
    } catch {}
  }, []);

  /*
   * A drag writes the CSS variable straight to the node. Going through state would
   * re-render every diff in the list on each pointer event, and the geometry is
   * measured once on pointer down so no move reads layout back. Moves are coalesced
   * so that at most one column change is laid out per frame.
   */
  const applyWidth = (clientX: number) => {
    const grid = gridRef.current;
    const rect = dragRectRef.current ?? grid?.getBoundingClientRect();
    if (!grid || !rect) return;
    const next = clampTreeWidth(clientX - rect.left, rect.width);
    treeWidthRef.current = next;
    grid.style.setProperty('--tree-width', `${next}px`);
  };

  const dragTo = (clientX: number) => {
    pendingXRef.current = clientX;
    if (rafRef.current !== null) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null;
      applyWidth(pendingXRef.current);
    });
  };

  const commitWidth = (next = treeWidthRef.current) => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    resizingRef.current = false;
    dragRectRef.current = null;
    setResizing(false);
    setTreeWidth(next);
    try {
      localStorage.setItem(TREE_STORAGE_KEY, String(next));
    } catch {}
  };

  const paths = useMemo(() => (files || []).map((f) => f.filename), [files]);

  const { model } = useFileTree({
    paths,
    search: true,
    initialExpansion: 'open',
    /*
     * `itemHeight` shortens the row without the `compact` density preset, whose 0.8
     * factor breaks the container query that hides the truncation ellipsis.
     */
    itemHeight: 24,
    onSelectionChange: (selectedPaths) => {
      const next = selectedPaths[0] ?? null;
      setSelected(next);
      if (next) {
        document
          .getElementById(`diff-file-${paths.indexOf(next)}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
  });

  // `useFileTree` builds the model once, so the paths that arrive with the fetch
  // never reach it on their own.
  React.useEffect(() => {
    if (paths.length > 0) model.resetPaths(paths);
  }, [model, paths]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/prs/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ repo: pr.repository.nameWithOwner, number: pr.number }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
        if (!cancelled) setFiles(json.files || []);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load files');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pr.repository.nameWithOwner, pr.number]);

  if (error) return <p className="px-5 py-4 text-sm text-danger">{error}</p>;
  if (!files) return <p className="px-5 py-4 text-sm text-muted">Loading changed files…</p>;
  if (files.length === 0)
    return <p className="px-5 py-4 text-sm text-muted">No file changes reported.</p>;

  const shown = selected ? files.filter((f) => f.filename === selected) : files;

  return (
    <div className={`px-5 py-4 ${fill ? 'flex min-h-0 flex-1 flex-col' : ''}`}>
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setTreeOpen((open) => !open)}
          aria-expanded={treeOpen}
          aria-label={treeOpen ? 'Hide the file tree' : 'Show the file tree'}
          title={treeOpen ? 'Hide the file tree' : 'Show the file tree'}
          className="pointer-safe inline-flex items-center justify-center rounded-md border border-transparent p-1 text-dim transition-colors duration-instant ease-out hover:border-line hover:bg-surface hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
        >
          {treeOpen ? (
            <PanelLeftClose aria-hidden strokeWidth={1.5} className="h-4 w-4" />
          ) : (
            <PanelLeft aria-hidden strokeWidth={1.5} className="h-4 w-4" />
          )}
        </button>
        <span className="text-xs text-dim">
          {files.length} file{files.length === 1 ? '' : 's'}
          {selected ? ` · showing ${selected}` : ''}
        </span>
        <div className="ml-auto flex items-center gap-1 rounded-md border border-line bg-surface-raised p-0.5">
          {(['unified', 'split'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setLayout(mode)}
              aria-pressed={layout === mode}
              className={`rounded px-2 py-1 font-mono text-2xs capitalize ${
                layout === mode ? 'bg-surface-muted text-ink' : 'text-dim hover:text-ink'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
        {selected && (
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="text-xs text-accent hover:underline"
          >
            Show all
          </button>
        )}
      </div>
      <div
        ref={gridRef}
        className={`flex min-w-0 flex-col gap-3 md:grid md:gap-0 ${fill ? 'min-h-0 flex-1' : ''}`}
        style={
          treeOpen
            ? ({
                '--tree-width': `${treeWidth}px`,
                gridTemplateColumns: 'var(--tree-width) 13px minmax(0, 1fr)',
              } as React.CSSProperties)
            : undefined
        }
      >
        {treeOpen && (
          <div
            className={`min-w-0 overflow-hidden rounded-md border border-line ${
              fill ? 'min-h-0' : 'h-[340px]'
            }`}
          >
            {/* The tree virtualizes and scrolls itself, so the wrapper must not scroll too. */}
            <FileTree model={model} style={{ height: '100%', minHeight: '240px' }} />
          </div>
        )}

        {treeOpen && (
          <div
            role="separator"
            aria-label="Resize the file tree"
            aria-orientation="vertical"
            aria-valuemin={MIN_TREE_WIDTH}
            aria-valuemax={MAX_TREE_WIDTH}
            aria-valuenow={treeWidth}
            tabIndex={0}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              resizingRef.current = true;
              dragRectRef.current = gridRef.current?.getBoundingClientRect() ?? null;
              setResizing(true);
              dragTo(event.clientX);
            }}
            onPointerMove={(event) => {
              if (resizingRef.current) dragTo(event.clientX);
            }}
            onPointerUp={(event) => {
              if (!resizingRef.current) return;
              event.currentTarget.releasePointerCapture(event.pointerId);
              commitWidth();
            }}
            onLostPointerCapture={() => {
              if (resizingRef.current) commitWidth();
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
              event.preventDefault();
              const available = gridRef.current?.clientWidth ?? 0;
              const next = clampTreeWidth(
                treeWidth + (event.key === 'ArrowRight' ? 16 : -16),
                available,
              );
              treeWidthRef.current = next;
              commitWidth(next);
            }}
            className="group hidden cursor-col-resize items-center justify-center self-stretch outline-none md:flex"
          >
            <span
              className={`h-full w-px rounded-full transition-all duration-instant group-hover:w-1 group-hover:bg-accent group-focus-visible:w-1 group-focus-visible:bg-accent ${
                resizing ? 'w-1 bg-accent' : 'bg-line-strong'
              }`}
            />
          </div>
        )}
        <ul
          className={`min-w-0 space-y-6 overflow-y-auto pl-3 pr-1 ${
            fill ? 'min-h-0' : 'max-h-[340px]'
          }`}
        >
          {shown.map((f) => {
            const idx = paths.indexOf(f.filename);
            return (
              <li
                key={f.filename}
                id={`diff-file-${idx}`}
                className="defer-block min-w-0 scroll-mt-2"
              >
                {f.patch ? (
                  <div className="overflow-hidden rounded-md border border-line">
                    {/*
                      `disableFileHeader` renders an empty diff in @pierre/diffs 1.3.6,
                      so the library's own header carries the filename and the counts.
                    */}
                    <PatchDiff
                      patch={buildPatch(f.filename, f.patch)}
                      options={{ diffStyle: layout }}
                      renderHeaderMetadata={() => (
                        <span className="rounded-full border border-line bg-surface-muted px-1.5 font-mono text-2xs text-muted">
                          {f.status}
                        </span>
                      )}
                    />
                    {f.truncated && (
                      <p className="border-t border-line bg-surface-raised px-3 py-1 font-mono text-2xs text-dim">
                        … truncated at 200 lines
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-md border border-dashed border-line px-3 py-2">
                    <span className="truncate font-mono text-xs text-ink">{f.filename}</span>
                    <p className="text-2xs text-dim">
                      {f.status} &middot; no textual diff available
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
