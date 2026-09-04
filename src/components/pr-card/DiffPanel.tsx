'use client';

import React, { useMemo, useState } from 'react';
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

function buildPatch(filename: string, patch: string): string {
  const body = patch.endsWith('\n') ? patch : `${patch}\n`;
  return `--- a/${filename}\n+++ b/${filename}\n${body}`;
}

export function DiffPanel({ pr }: { pr: PullRequestAssessment }) {
  const [files, setFiles] = useState<PRFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<'unified' | 'split'>('unified');
  const [selected, setSelected] = useState<string | null>(null);

  const paths = useMemo(() => (files || []).map((f) => f.filename), [files]);

  const { model } = useFileTree({
    paths,
    search: true,
    initialExpansion: 'open',
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
    <div className="px-5 py-4">
      <div className="mb-3 flex flex-wrap items-center gap-2">
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
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
        <div className="max-h-[340px] min-w-0 overflow-auto rounded-md border border-line">
          <FileTree model={model} style={{ height: '340px' }} />
        </div>
        <ul className="max-h-[340px] min-w-0 space-y-6 overflow-y-auto pr-1">
          {shown.map((f) => {
            const idx = paths.indexOf(f.filename);
            return (
              <li key={f.filename} id={`diff-file-${idx}`} className="min-w-0 scroll-mt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-mono text-xs text-ink">{f.filename}</span>
                  <span className="rounded-full border border-line bg-surface-muted px-1.5 font-mono text-2xs text-muted">
                    {f.status}
                  </span>
                  <span className="font-mono text-2xs tabular text-muted">
                    +{f.additions} −{f.deletions}
                  </span>
                </div>
                {f.patch ? (
                  <div className="mt-2 overflow-hidden rounded-md border border-line">
                    <PatchDiff
                      patch={buildPatch(f.filename, f.patch)}
                      options={{ diffStyle: layout, disableFileHeader: true }}
                    />
                    {f.truncated && (
                      <p className="border-t border-line bg-surface-raised px-3 py-1 font-mono text-2xs text-dim">
                        … truncated at 200 lines
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-dim">No textual diff available.</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
