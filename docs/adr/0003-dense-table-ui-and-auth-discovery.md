# 0003: Expandable Dense Table UI and Flexible GitHub Enterprise Authentication

We decided to build the dashboard UI as a dense, searchable table with expandable detail drawers (surfacing failed check names and unresolved thread snippets with deep-links) and support both public GitHub and GitHub Enterprise hosts via environment configuration with `gh auth token` fallback.

## Context

Pull request dashboards often fail either by being too sparse (requiring constant tab switching to GitHub to see why a check failed or what a comment said) or too heavy (trying to re-implement GitHub's code review editor). Authentication must seamlessly support local development workflows (`gh` CLI login) while allowing explicit GitHub Enterprise tokens and GraphQL endpoints.

## Decision

1. **Authentication & Host Configuration**:
   - Authenticate via `GITHUB_TOKEN` env var, falling back to dynamic `gh auth token` execution.
   - Configurable `GITHUB_GRAPHQL_ENDPOINT` (defaulting to `https://api.github.com/graphql`) to support GitHub Enterprise Cloud / Server.
2. **Dense Expandable Table UI**:
   - A high-density grid showing Repository, PR Title/Number, Branch, Updated time, and the 5 status dimension badges.
   - Expandable row drawer providing:
     - Specific failing/running check suite / check run names with direct links to logs.
     - Unresolved review threads with file path, line number, author, comment snippet, and deep-link to the GitHub thread.
3. **Repository Grouping and Actionable Quick-Filters**:
   - Filter bar supporting text search and quick status filters ("Needs Attention", "CI Failing", "Ready to Merge").
   - Ability to group or filter by repository.

## Consequences

- Engineers can diagnose and triage PR blockers entirely from the dashboard in seconds without opening multiple GitHub tabs.
- Works out-of-the-box locally without manual token entry if `gh` CLI is installed.
- Scope stays focused as a read-only assessment tool without building write/reply workflows.
