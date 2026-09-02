'use client';

import React from 'react';
import { ExternalLink } from 'lucide-react';
import type { PullRequestAssessment } from '../../types/pr';
import { PANEL_HEAD, PANEL_LINK } from './panelChrome';

/**
 * `bodyHTML` is GitHub's own rendered, sanitized markdown, so it resolves `#123` and
 * `@mentions` against the repository the way the site does.
 */
export function DescriptionPanel({ pr }: { pr: PullRequestAssessment }) {
  return (
    <section className="min-w-0 p-4">
      <header className={PANEL_HEAD}>
        <span className="font-bold text-ink">Description</span>
        <a
          href={pr.url}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PANEL_LINK} ml-auto inline-flex items-center gap-1`}
        >
          Open on GitHub
          <ExternalLink aria-hidden strokeWidth={2} className="h-3 w-3" />
        </a>
      </header>

      {pr.bodyHTML ? (
        <div className="max-h-[480px] overflow-y-auto rounded-md border border-line p-4">
          <div className="md max-w-[80ch]" dangerouslySetInnerHTML={{ __html: pr.bodyHTML }} />
        </div>
      ) : (
        <p className="rounded-md border border-dashed border-line px-3 py-6 text-center text-xs text-dim">
          This pull request has no description.
        </p>
      )}
    </section>
  );
}
