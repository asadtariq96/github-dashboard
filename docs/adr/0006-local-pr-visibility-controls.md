# 0006: Local PR Visibility Controls (Hide and Unhide)

We decided to add client-side PR visibility controls (Hide/Unhide) persisted in browser `localStorage`, with a dedicated "Hidden PRs" view toggle.

## Context

Developers often author long-lived reference PRs, work-in-progress experiments, or automated bot PRs that pollute the active triage view. Hiding these PRs without closing them keeps the dashboard focused on actionable work.

## Decision

1. **Client-Side Storage**: Store hidden PR identifiers (e.g. `repo#number` or GraphQL PR ID) in `localStorage` under `gh_dashboard_hidden_prs`.
2. **Hide Action**: Add a subtle "Hide" button/icon on each PR row and inside the detail drawer.
3. **Hidden PRs View Toggle**: Add a "Hidden (N)" filter button / toggle in the top filter bar that reveals all hidden PRs with an "Unhide" button to restore them to the main view.
4. **Action Counts**: Exclude hidden PRs from the active filter counts (All Open, Needs Attention, CI Failing, Ready to Merge) when viewing the normal dashboard.

## Consequences

- Instant personal filtering without needing GitHub server-side changes or DB schemas.
- Preserved across page reloads and browser restarts.
