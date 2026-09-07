'use client';

import type { ChangeDigest } from '../lib/visited';

export function ChangeSummary({ digest }: { digest: ChangeDigest | undefined }) {
  if (!digest?.lines.length) return null;
  const summary = `${digest.lines[0]}${digest.lines.length > 1 ? ` · +${digest.lines.length - 1} more` : ''}`;

  return (
    <p
      className="border-t border-line px-4 py-1.5 text-xs text-muted"
      title={digest.lines.join('\n')}
    >
      {summary}
    </p>
  );
}
