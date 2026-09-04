'use client';

import React from 'react';
import { GitPullRequest, GitPullRequestDraft, ListChecks } from 'lucide-react';
import type { PullRequestAssessment } from '../../types/pr';
import { compactAge, longAge } from '../../lib/time';

export function PRStateIcon({ pr }: { pr: PullRequestAssessment }) {
  if (pr.isDraft) {
    return (
      <GitPullRequestDraft
        aria-label="Draft pull request"
        strokeWidth={2}
        className="h-[18px] w-[18px] shrink-0 text-dim"
      />
    );
  }
  if (pr.isInMergeQueue) {
    return (
      <ListChecks
        aria-label="In the merge queue"
        strokeWidth={2}
        className="h-[18px] w-[18px] shrink-0 text-queue"
      />
    );
  }
  return (
    <GitPullRequest
      aria-label={
        pr.mergeability === 'Merge Conflicts' ? 'Pull request with conflicts' : 'Open pull request'
      }
      strokeWidth={2}
      className={`h-[18px] w-[18px] shrink-0 ${
        pr.mergeability === 'Merge Conflicts' ? 'text-danger' : 'text-queue'
      }`}
    />
  );
}

export function TimePair({ pr, force = false }: { pr: PullRequestAssessment; force?: boolean }) {
  const stale = Date.now() - new Date(pr.updatedAt).getTime() > 7 * 86400 * 1000;
  return (
    <span
      className={`${force ? 'flex' : 'hidden 2xl:flex'} shrink-0 flex-col items-end text-2xs leading-tight text-dim`}
    >
      <span title={`Opened ${longAge(pr.createdAt)}`}>Opened {compactAge(pr.createdAt)}</span>
      <span title={`Updated ${longAge(pr.updatedAt)}`} className={stale ? 'text-warn' : undefined}>
        Updated {compactAge(pr.updatedAt)}
      </span>
    </span>
  );
}
