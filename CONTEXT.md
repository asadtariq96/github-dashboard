# GitHub Dashboard

A dashboard that aggregates, evaluates, and displays the lifecycle, review, check, and merge state of open pull requests across repositories.

## Language

### Core Entities

**Pull Request (PR)**:
A tracked proposal to merge changes from one branch into another in a GitHub repository.
_Avoid_: Patch, merge request

**Stacked PR**:
A pull request whose base branch points to the head branch of another active pull request within the same repository rather than the default branch.
_Avoid_: Dependent PR, chain PR, sub-PR

**Unresolved Comment Thread**:
A GitHub pull request review discussion thread whose status has not been marked as resolved (`isResolved: false`).
_Avoid_: Unanswered comment, pending comment, open issue

**Check Run Detail**:
A specific named CI/CD status check or workflow run associated with a PR commit, including its execution state, conclusion, and target log URL.
_Avoid_: Build step, task

### Status Taxonomies

**Lifecycle Dimension**:
The author-declared readiness state of the PR (`Draft` or `Ready for Review`).
_Avoid_: PR Mode, Visibility

**Review Dimension**:
The aggregate peer-review state evaluated from reviewer decisions (`Approved`, `Changes Requested`, `Review Required`, or `Awaiting Author`).
_Avoid_: Review score, approval status

**Checks Dimension**:
The aggregate validation state of CI/CD pipelines and commit status checks (`Passing`, `Failing` [required check failed], `Warning` [optional check failed / unstable], `Running`, `Pending`, or `None`).
_Avoid_: Build state, CI health

**Branch Update Action**:
A user-initiated command from the dashboard that synchronizes a pull request head branch with the latest commits from its base branch via GitHub's `updatePullRequestBranch` API.
_Avoid_: Git pull, rebase button

**Mergeability Dimension**:
The technical and policy readiness of the branch to merge into the base branch (`Ready to Merge` [requires explicit approval, passing checks, no conflicts, and non-draft], `In Merge Queue` [with sub-states: Queued, Running, or Waiting for Approval], `Merge Conflicts`, `Behind Base Branch`, or `Blocked by Policy`).
_Avoid_: Merge state, git status

**Merge Action**:
A user-initiated command from the dashboard that merges a ready PR or enqueues it into the repository's GitHub merge queue.
_Avoid_: Force merge, push to main

**Deployment Approval Action**:
A user-initiated command from the dashboard that programmatically approves a pending GitHub Actions protected environment deployment gate (e.g. `production_deployment`) via the REST API.
_Avoid_: Deploy button, gate bypass

**PR Status Assessment**:
The evaluated tuple of all five orthogonal status dimensions for a single Pull Request at a specific snapshot in time.
_Avoid_: Health check, overall status

### UI & Presentation

**Needs Attention Filter**:
A synthesized view filtering for PRs that require author action (e.g. failing checks, changes requested, merge conflicts, or unresolved threads).
_Avoid_: Broken PRs, urgent list

**Waiting Approval Priority**:
The highest ranking tier in the dashboard, automatically pinning pull requests waiting on manual CI/CD environment or deployment approvals to the top of all views.
_Avoid_: Pinned PR, sticky row

**PR Detail Drawer**:
An expandable inspection view under a PR row displaying actionable check failures and unresolved review thread excerpts.
_Avoid_: Modal, popup

**Signal-First Badge**:
A status badge rendered only when an active blocker, milestone, or notable state exists, omitting neutral or redundant baseline statuses.
_Avoid_: Static column badge, table header

**Density Variant**:
A presentation setting toggling between continuous compact rows (`Compact List`) and discrete elevated blocks (`Spaced Cards`), with customizable responsive grid columns (1 to 4 columns).
_Avoid_: Layout mode, grid view

**Hidden PR**:
A pull request explicitly excluded by the user from the primary dashboard view, persisted in local browser storage, and manageable via the Hidden PRs view.
_Avoid_: Muted PR, archived PR, deleted PR

**Event Stream (SSE)**:
A unidirectional Server-Sent Events HTTP connection streaming instantaneous PR cache invalidation events from the backend to the browser.
_Avoid_: WebSocket, long-polling

**Webhook Invalidation**:
An event-driven cache invalidation triggered immediately when a GitHub webhook payload arrives at the local receiver.
_Avoid_: Push notification, alert

**Sync Status**:
The operational state of the background synchronization poller (`Healthy`, `Syncing`, or `Stale Error`).
_Avoid_: Connection status, API state
