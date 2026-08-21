# 0010: One-Click Environment Deployment Approval via GitHub Actions REST API

We decided to support direct, programmatic approval of pending environment deployments directly from the dashboard using the GitHub Actions REST API.

## Context

When a PR enters the merge queue and triggers an environment protection rule (e.g. `production_deployment` gate), navigating to GitHub Actions to click "Review deployments" -> "Approve and deploy" is an extra manual step. GitHub provides a REST API endpoint to approve pending deployment reviews programmatically.

## Decision

1. **API Endpoint (`POST /api/prs/approve-deployment`)**:
   - Accepts `repoWithOwner` (e.g. `Unity-Technologies/unity-gateway`) and `runId` (GitHub Actions workflow run ID).
   - Fetches `/repos/{owner}/{repo}/actions/runs/{runId}/pending_deployments` to get the list of `environment_ids`.
   - Sends a `POST` request to `/repos/{owner}/{repo}/actions/runs/{runId}/pending_deployments` with:
     ```json
     {
       "environment_ids": [11461056146],
       "state": "approved",
       "comment": "Approved via GitHub PR Dashboard"
     }
     ```
   - Triggers immediate backend cache invalidation and SSE broadcast.
2. **Dashboard UI Action**:
   - For any PR in `Waiting Approval` status, display a prominent green **"Approve & Deploy"** button next to the badge.
   - Confirm with the user before submitting the approval to prevent accidental production deployments.

## Consequences

- Direct one-click unblocking of the merge queue and production deployments without leaving the dashboard.
- Requires standard deployment approval permissions on the repository (inherited from the user's `gh auth token` / `GITHUB_TOKEN`).
