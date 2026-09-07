'use client';

import { ExternalLink } from 'lucide-react';
import type { PullRequestAssessment } from '../../types/pr';
import { PANEL_HEAD, PANEL_LINK, panelRoot } from './panelChrome';

/**
 * `bodyHTML` is GitHub's own rendered, sanitized markdown, so it resolves `#123` and
 * `@mentions` against the repository the way the site does.
 */
export function DescriptionPanel({
  pr,
  fill = false,
}: {
  pr: PullRequestAssessment;
  fill?: boolean;
}) {
  return (
    <section className={panelRoot(fill)}>
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
        <div
          className={`overflow-y-auto rounded-md border border-line p-4 ${
            fill ? 'min-h-0 flex-1' : 'max-h-[480px]'
          }`}
        >
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
