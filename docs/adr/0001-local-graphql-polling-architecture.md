# 0001: Local GraphQL Polling Architecture with In-Memory Caching

We decided to build the GitHub dashboard as a single-user local tool using a background poller that queries GitHub's GraphQL API periodically, caching the result in-memory for the frontend to query via REST.

## Context

Tracking detailed pull request state (review threads, unresolved comments, check suites, merge queue status) across multiple open PRs requires high data density. Using GitHub REST endpoints requires multiple roundtrips per PR (review comments, reviews, check runs, merge state), rapidly hitting API rate limits. Additionally, full real-time WebSockets or external webhooks introduce unnecessary operational overhead for a single-user local utility.

## Decision

1. **Local-Only Single-User Model**: The application runs locally on the user's machine, authenticating via the local `gh` CLI token (`gh auth token`) or personal access token (PAT).
2. **GraphQL Background Polling**: A backend background job periodically issues a targeted GraphQL query fetching open PRs authored by the user along with their nested review threads, checks, and merge queue state.
3. **In-Memory Cache & REST Endpoint**: The backend holds the latest normalized PR assessment state in memory and serves it to the frontend via a simple REST endpoint (`GET /api/prs`). The frontend polls this endpoint on an interval.

## Consequences

- No external database or webhook infrastructure needed.
- Efficient use of GitHub GraphQL point-budget (costing ~1 point per search query vs dozens of REST calls).
- State resets if the local process terminates, but recovers on the next poll cycle.
