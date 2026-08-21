# 0004: Resilient Stale-While-Revalidate Caching, Stacked PR Detection, and Scoped Querying

We decided to implement a stale-while-revalidate error handling strategy with background retry backoff, automatic stacked PR branch dependency detection, and configurable search query scoping with sensible default-to-all semantics.

## Context

Network glitches, token expirations, and temporary GitHub 5xx responses should never blank out the dashboard while an engineer is working. Furthermore, modern development workflows frequently use stacked PRs (branches based on other feature branches rather than the repository default branch), which fundamentally changes merge readiness and sequencing.

## Decision

1. **Graceful Stale-While-Revalidate Cache**:
   - The backend cache retains the most recent valid PR assessment state indefinitely upon upstream fetch errors.
   - The UI displays a live synchronization indicator dot (Green: Healthy / Red: Stale Sync Error) alongside the precise `lastUpdated` timestamp.
   - Background poller continues retrying with exponential backoff on failures.
2. **Configurable GraphQL Query Scoping**:
   - Defaults to searching across all accessible repositories with `author:@me is:pr is:open`.
   - Allows narrowing via an optional `GITHUB_SEARCH_QUERY` environment variable (e.g., scoping to specific orgs or repos).
3. **Stacked PR Hierarchy Detection**:
   - The backend cross-references the `baseRefName` of each PR against the `headRefName` of all other open PRs in the same repository.
   - PRs based on non-default branches targeting other active PRs are tagged as `Stacked`, highlighting their parent dependency in the UI.
4. **Pure Web-First Presentation**:
   - Scoped strictly as a zero-dependency web dashboard without background push notifications.

## Consequences

- Dashboard remains functional and readable even during offline periods or GitHub API disruptions.
- Complex multi-PR stack workflows are immediately visible, preventing accidental out-of-order merges.
