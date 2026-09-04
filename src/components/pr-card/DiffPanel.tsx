'use client';

import React, { useEffect, useState } from 'react';
import type { PullRequestAssessment } from '../../types/pr';

interface PRFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
  truncated: boolean;
}

export function DiffPanel({ pr }: { pr: PullRequestAssessment }) {
  const [files, setFiles] = useState<PRFile[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <div className="max-h-[340px] overflow-y-auto px-5 py-4">
      <ul className="space-y-4">
        {files.map((f) => (
          <li key={f.filename} className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-mono text-xs text-ink">{f.filename}</span>
              <span className="rounded-full border border-line bg-surface-muted px-1.5 font-mono text-2xs text-muted">
                {f.status}
              </span>
              <span className="font-mono text-2xs tabular text-muted">
                +{f.additions} −{f.deletions}
              </span>
            </div>
            {f.patch && (
              <pre className="mt-2 overflow-x-auto rounded-md border border-line bg-surface-raised p-3 font-mono text-2xs leading-relaxed text-muted">
                {f.patch}
                {f.truncated && '\n… truncated'}
              </pre>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
