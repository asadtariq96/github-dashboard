# 0007: Dashboard-Initiated PR Merge and Merge Queue Enqueueing

We decided to add one-click merge and merge queue enqueue capabilities directly from the dashboard UI via GitHub GraphQL mutations with explicit client confirmation.

## Context

When a PR passes all CI checks and reviews, navigating to GitHub to click "Merge" or "Add to merge queue" is unnecessary friction. Triggering the merge directly from the dashboard streamlines the developer workflow.

## Decision

1. **API Endpoint (`POST /api/prs/merge`)**:
   - Accepts `prId` (GraphQL Node ID), `mergeMethod` (`SQUASH` | `MERGE` | `REBASE`, defaulting to `SQUASH`), and `enqueue` boolean.
   - For repositories with merge queues enabled, calls `enqueuePullRequest(input: { pullRequestId })`.
   - For standard repositories, calls `mergePullRequest(input: { pullRequestId, mergeMethod })`.
   - On success, triggers an immediate backend cache invalidation and SSE broadcast.
2. **Dashboard UI Action Button**:
   - When a PR has `mergeability === 'Ready to Merge'` and is not draft or in queue:
     - Displays an emerald **"Merge"** or **"Add to Queue"** button in both the PR row and detail drawer.
     - Confirmation modal / confirmation state to prevent accidental one-click merges.

## Consequences

- Direct one-click pipeline progression from dashboard without leaving the interface.
- Automatically respects repository merge queue settings.
