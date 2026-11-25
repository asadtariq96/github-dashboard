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
The aggregate validation state of CI/CD pipelines and commit status checks (`Passing`, `Failing` [a required check failed], `Warning` [an optional check failed, or GitHub reports the pull request `UNSTABLE`], `Running`, `Pending`, or `None`). A check counts as required when GitHub's merge verdict says it blocks the merge, not when its name appears in a local list.
_Avoid_: Build state, CI health

**Branch Update Action**:
A user-initiated command from the dashboard that synchronizes a pull request head branch with the latest commits from its base branch via GitHub's `updatePullRequestBranch` API.
_Avoid_: Git pull, rebase button

**Mergeability Dimension**:
The technical and policy readiness of the branch to merge into the base branch (`Ready to Merge` [GitHub reports the pull request mergeable — `CLEAN`, `UNSTABLE`, or `HAS_HOOKS` — and the dashboard holds an explicit approval on a non-draft], `In Merge Queue` [with sub-states: Queued, Running, or Waiting for Approval], `Merge Conflicts`, `Behind Base Branch`, or `Blocked by Policy`).
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
Rank 1 of the eight blocked-on-you ranks, holding pull requests waiting on a manual deployment approval at the top under the default priority sort.
_Avoid_: Pinned PR, sticky row

**Priority Zone**:
The former **Blocked on you** split above **Everything else**. It was replaced by the explicit **Act now** and **Waiting** work-queue views; `blockedReason` still supplies the urgency ranking within views.
_Avoid_: Using this term for the current interface

**PR Card**:
The unit of the list. One pull request carrying identity, diff, status chips, both timestamps and one primary action. Selecting it opens the persistent inspector.
_Avoid_: Row, table row, tile

**PR Inspector**:
The resizable detail pane beside the work queue. It holds the Description, Merge queue, Checks, Threads and Files tabs. A button in the card header expands it to the whole window, and `Esc` leaves that mode. Below the desktop breakpoint it becomes a bounded bottom drawer.
_Avoid_: Modal, popup, expanded row

**Status Chip**:
A bordered label rendered only when an active blocker, milestone, or notable state exists, carrying a word or an icon beside its colour. Neutral baseline states are omitted.
_Avoid_: Badge, pill, static column badge

**Awaiting Review Chip**:
The status chip that takes the state slot when every check passes, the pull request is not a draft, and the only remaining blocker is a review GitHub still requires (`Blocked by Policy` with `Review Required`). It states the wait in words, because the row otherwise looks finished.
_Avoid_: Pending approval, needs reviewer

**Severity Edge**:
The former 3px coloured left border of a PR card. It was removed. Urgency now reads from the sort order, the state icon and the status chips.
_Avoid_: Using this term for the current interface

**Primary Action**:
The single action a PR card shows, chosen from the ordered list in `allActionsFor`. Actions that undo progress, closing and dequeuing, are excluded from that list and can never appear here.
_Avoid_: CTA, main button

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
The operational state of the server-side cache (`Healthy`, `Syncing`, or `Stale Error`). There is no background poller; the browser polls and the cache refreshes lazily behind a 25 second freshness window.
_Avoid_: Connection status, API state, poller status

**Speculative Merge Commit**:
The commit GitHub's merge queue builds to test a pull request together with the entries ahead of it. Its own checks, not the pull request's, decide whether the queue merges.
_Avoid_: Merge commit, batch commit

**Merge Queue Step**:
One stage of a queued pull request's progress, derived from the entry state, the speculative rollup and any deployment hold. GitHub publishes no step API.
_Avoid_: Pipeline stage, queue phase

**Thread Reply / Thread Resolution**:
A user-initiated comment added to an existing review thread, or a change to that thread's resolved state, both issued from the dashboard and gated on what GitHub says the viewer may do.
_Avoid_: Comment, close thread

**Unread Activity**:
Comments, reviews and commits by other people on a pull request since the viewer's own last activity on it or last visit, whichever is later.
_Avoid_: New comments, notifications

**Batch Selection**:
A set of pull requests picked by checkbox, with shift selecting a range, driving actions that are safe to fire across many at once. Merging, closing, dequeuing and approving a deployment are excluded.
_Avoid_: Bulk edit, multi-select mode
