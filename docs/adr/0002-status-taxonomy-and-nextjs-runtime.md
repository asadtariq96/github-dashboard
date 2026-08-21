# 0002: Orthogonal PR Status Taxonomy and Next.js Monolithic Runtime

We decided to structure PR status into five orthogonal categories (Lifecycle, Review, Checks, Mergeability, and Review Threads) and implement the entire system as a single Next.js standalone application.

## Context

Pull requests have multi-dimensional status states that cannot be captured accurately by a single enum or an unconstrained flat list of tags. A PR can simultaneously be "Approved", "CI Running", and have "Unresolved Comments". Furthermore, running separate backend and frontend processes introduces port management, CORS, and startup coordination overhead for a local-first utility.

## Decision

1. **Orthogonal Status Taxonomy**: The domain model evaluates five independent dimensions for every open PR:
   - **Lifecycle**: `Draft` | `Ready for Review`
   - **Review**: `Approved` | `Changes Requested` | `Review Required` | `Awaiting Author`
   - **Checks**: `Passing` | `Failing` | `Running` | `Pending` | `None`
   - **Mergeability**: `Ready to Merge` | `In Merge Queue` | `Merge Conflicts` | `Behind Base Branch` | `Blocked by Policy`
   - **Review Threads**: Count and details of `Unresolved Comment Threads`
2. **Next.js Single-Process Architecture**: Built as a Next.js application where API Routes / Route Handlers manage background synchronization, cache state, and GitHub GraphQL communication, while React Server/Client Components render the dashboard.
3. **Configurable Sync Cadence with Manual Invalidation**: Polling defaults to a configurable interval (30s) and exposes an endpoint (`POST /api/refresh`) for manual, immediate cache invalidation.

## Consequences

- Clean separation of concerns in the UI; flags never clash or overwrite each other.
- Single command (`npm run dev`) to start the entire dashboard.
- Explicit visibility into exact merge blockers without needing to navigate to GitHub.
