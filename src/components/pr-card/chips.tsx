"use client";

import {
  CircleCheck,
  CircleX,
  FileText,
  GitMerge,
  Layers,
  ListChecks,
  MessageSquare,
  Rocket,
} from "lucide-react";
import type { PullRequestAssessment } from "../../types/pr";
import { summarizeChecks } from "../../lib/checks";
import { Chip } from "./ui";

function ChecksChip({ pr }: { pr: PullRequestAssessment }) {
  const { total, passed, failed, running } = summarizeChecks(pr);
  if (total === 0) return null;

  const Icon = failed > 0 ? CircleX : CircleCheck;
  const iconClass = failed > 0 ? "text-danger" : "text-ready";
  const detail = [
    `${passed} of ${total} checks passed`,
    failed > 0 ? `${failed} failed` : null,
    running > 0 ? `${running} running` : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Chip icon={Icon} iconClass={iconClass} title={detail}>
      <span className="tabular font-semibold text-ink">
        {passed}/{total}
      </span>
      {running > 0 && (
        <>
          <span aria-hidden className="h-3.5 w-px bg-line" />
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
          <span className="tabular">{running}</span>
        </>
      )}
      {failed > 0 && (
        <>
          <span aria-hidden className="h-3.5 w-px bg-line" />
          <span className="tabular font-semibold text-danger">
            {failed} failed
          </span>
        </>
      )}
    </Chip>
  );
}

/** Comments on the pull request itself, then unresolved threads on the code. */
function ConversationChip({ pr }: { pr: PullRequestAssessment }) {
  const comments = pr.prComments?.length ?? 0;
  const threads = pr.unresolvedThreadsCount;
  if (comments === 0 && threads === 0) return null;

  return (
    <Chip
      icon={MessageSquare}
      title={`${comments} comments, ${threads} unresolved review threads`}
    >
      {comments > 0 && (
        <span className="tabular font-semibold text-ink">{comments}</span>
      )}
      {comments > 0 && threads > 0 && (
        <span aria-hidden className="h-3.5 w-px bg-line" />
      )}
      {threads > 0 && (
        <span className="tabular font-semibold text-ink">
          {threads} <span className="font-medium text-muted">unresolved</span>
        </span>
      )}
    </Chip>
  );
}

/**
 * At most one state chip, then checks, then the conversation. The state chips are mutually
 * exclusive by construction, so the cluster never grows past four.
 */
export function StatusChips({ pr }: { pr: PullRequestAssessment }) {
  const queuePosition = pr.mergeQueueInfo?.position;

  return (
    <>
      {pr.mergeQueueInfo?.isWaitingForApproval ? (
        <Chip
          icon={Rocket}
          iconClass="text-warn"
          tone="warn"
          title={
            pr.mergeQueueInfo.approvalStepName ||
            "A deployment is waiting for your approval"
          }
        >
          Deploy hold
        </Chip>
      ) : pr.mergeability === "Merge Conflicts" ? (
        <Chip
          icon={GitMerge}
          iconClass="text-danger"
          tone="danger"
          title="Conflicts with the base branch"
        >
          Conflicts
        </Chip>
      ) : pr.isInMergeQueue ? (
        <Chip
          icon={ListChecks}
          iconClass="text-queue"
          tone="queue"
          title={
            queuePosition
              ? `Position ${queuePosition} in the merge queue`
              : "Waiting in the merge queue"
          }
        >
          {queuePosition ? `#${queuePosition} in queue` : "In queue"}
        </Chip>
      ) : pr.isDraft ? (
        <Chip
          icon={FileText}
          tone="draft"
          title="Draft. Reviewers are not notified."
        >
          Draft
        </Chip>
      ) : pr.mergeability === "Behind Base Branch" ? (
        <Chip
          icon={GitMerge}
          iconClass="text-warn"
          tone="warn"
          title="Behind the base branch"
        >
          Behind base
        </Chip>
      ) : null}

      <ChecksChip pr={pr} />

      <ConversationChip pr={pr} />

      {pr.review === "Changes Requested" && (
        <Chip
          icon={CircleX}
          iconClass="text-danger"
          tone="danger"
          title="A reviewer asked for changes"
        >
          Changes requested
        </Chip>
      )}

      {pr.isStacked && (
        <Chip
          icon={Layers}
          title={
            pr.stackedParent
              ? `Stacked on #${pr.stackedParent.prNumber}`
              : `Stacked on ${pr.baseRefName}`
          }
        >
          Stacked
        </Chip>
      )}
    </>
  );
}
