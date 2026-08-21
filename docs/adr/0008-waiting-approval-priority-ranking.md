# 0008: Global Pinned Priority Ranking for Waiting Approval PRs

We decided to enforce a global priority ordering that pins all PRs in `Waiting Approval` state to the very top of all views (regardless of repository grouping or filters), styled with an amber attention border and urgent indicator.

## Context

Pull requests that have entered the merge queue and reached an environment protection gate (e.g., `production_deployment`) block the entire merge queue and deployment pipeline for that repository. They require immediate human review/approval before downstream PRs can proceed.

## Decision

1. **Global Priority Sorting**:
   - PRs with `mergeQueueInfo.isWaitingForApproval === true` are sorted to the absolute top of the list across all views.
   - When "Group by Repository" is enabled, repositories containing PRs waiting for approval appear first, and within each group, those PRs are pinned to the top.
2. **Distinct Visual Hierarchy**:
   - Highlighted with an amber-500 pulsating left border, amber tinted row background, and a prominent "Manual Approval Required" indicator.
   - Distinctive badge directing the user to the approval step in CI with a single click.

## Consequences

- Zero risk of missing a pipeline-blocking manual deployment gate.
- Consistent placement regardless of which tab or grouping mode is selected.
