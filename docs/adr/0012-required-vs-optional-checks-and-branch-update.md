# 0012: Required vs Optional Status Checks and One-Click Branch Updates

We decided to partition CI/CD status check evaluation into required vs non-required checks (surfacing non-required check failures as amber warnings rather than merge-blocking red errors) and added direct branch update triggers from the dashboard.

## Context

Optional/advisory status checks (such as `codecov/patch`, coverage drops, or non-blocking linters) frequently fail or warn without blocking PR mergeability. Labeling the entire PR with a red `CI Failing` badge blocks the developer's triage when the PR is actually mergeable. Furthermore, updating a branch against the base branch requires navigating to GitHub.

## Decision

1. **Required vs Optional Checks Separation**:
   - The GraphQL rollup queries `isRequired(pullRequestNumber: $number)` on all check runs and status contexts.
   - **`CI Failing` (Red)**: Triggered only when a *required* check fails.
   - **`CI Warning` (Amber)**: Triggered when non-required/optional checks fail (e.g. `codecov/patch`) or when GitHub reports `mergeStateStatus: "UNSTABLE"`.
   - PRs with only optional check failures remain eligible for `Ready to Merge`.
2. **One-Click Branch Updates**:
   - When a branch can be updated (`viewerCanUpdateBranch` or `mergeStateStatus: "BEHIND"`), an **"Update"** / **"Update Branch"** button is displayed on the card.
   - Executes the GraphQL `updatePullRequestBranch` mutation via `/api/prs/update-branch`.

## Consequences

- PRs like `#6461` (failing only optional codecov) are correctly recognized as `Ready to Merge` with a subtle amber `CI Warning` badge instead of a false-alarm red failure.
- Developers can synchronize out-of-date branches with a single click.
