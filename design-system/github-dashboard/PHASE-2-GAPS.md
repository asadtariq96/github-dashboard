# Phase 2 — what the sample design needs that the codebase does not have

Phase 1 built every part of the reference that the current data supports. This file lists
what is left, what each item costs, and what I recommend. Nothing here is built yet.

Read the **Decide** column first. Items marked **Ask** change behaviour, not just data.

---

## A. Writes the app cannot make yet

### A1. Close a pull request — **built**

`closePullRequest` mutation, `POST /api/prs/close`, and a confirm step. The button sits in
the card's bottom toolbar and on the kebab menu, both on the right, away from Hide.

### A2. Remove from the merge queue — **built**

`dequeuePullRequest` mutation and `POST /api/prs/dequeue`. It appears on a queued card only,
in the expanded quick actions and the bottom toolbar, in amber, and it confirms first.

`DequeuePullRequestInput` names the pull request `id`, not `pullRequestId` like every other
mutation in `github.ts`. The route carries a one-line comment saying so.

### A3. Approve a production deployment — **already built**

No gap. The row fires it today.

---

## B. Data the query does not fetch

### B1. Check timing — **built**

`startedAt` and `completedAt` on `CheckRun`, plus `createdAt` on `StatusContext`, which has
no separate start and finish. `checkTiming` in `src/lib/checks.ts` reads "Failed · 2m ago"
for a finished run and "Running · 2m elapsed" for one still going. A run with no timestamp
reports its state alone.

### B2. Reply avatars in review threads — **built**

`ReviewThreadItem.replies` now holds `{ login, avatarUrl }` per person, deduplicated, in the
order they first replied. `replyCount` reads the comment connection's `totalCount`, so a
thread with thirty replies no longer reports nine.

### B3. Changed files — **declined**

Dropped by your call. The data is cheap if that changes:
`files(first: 100) { nodes { path additions deletions } }`, about 45 minutes including the
panel. It would make the expanded body three columns again.

### B4. Approvals as "1 of 2" — **recommend skip**

The count of approvals we can get. The number the branch requires comes from
`branchProtectionRule.requiredApprovingReviewCount`, which needs admin rights on every
repository. Without the denominator the number reads worse than the plain review state we
already show.

- Recommend: leave the review state as it is.

### B5. Labels — **recommend skip**

Neither the sample nor our own row spec shows them. No reason to fetch them.

---

## C. Things the GitHub API cannot give us

### C1. The list of conflicting files — **recommend drop**

The sample's conflict card lists each conflicting file, the function and the line. GitHub
does not expose conflicted hunks through any API. Getting them means fetching the base and
head trees and running a merge locally, or shelling out to `git`.

- Cost: a day at least, plus a clone of every repository on disk.
- Phase 1 instead links "Resolve conflicts" straight to GitHub's web editor.
- Recommend: keep the link, drop the panel.

### C2. Merge train inspection and "pause queue after batch" — **recommend drop**

No public API. Repository settings only.

- Phase 1 links "View queue" to the merge queue page, which shows the train.

### C3. Speculative merge-batch checks — **recommend drop**

The sample's queued card shows the batch's own CI (28/30). GitHub reports those against the
merge-queue branch, not the pull request. Reachable only by guessing the branch name.

---

## D. Behaviour conflicts — all four decided

### D1. Which action is the primary — **decided, built**

`allActionsFor` in `rowAction.ts` now ranks: approve deployment, **mark ready**, update
branch, re-run checks, merge. A draft that is behind its base now shows "Mark ready" and
puts "Update" on the caret menu.

Two orderings in that list are deliberate, and the comment above the function says so:

- Mark ready outranks Update. A draft blocks nobody, and updating its branch changes
  nothing until it is ready for review.
- Re-run checks outranks Merge. When checks are red, Merge must not sit under the pointer.

### D2. Tabs against the two-column body — **decided, built**

The sample draws a tab strip (Checks | Reviews) **and** shows both columns at once. Those
two cannot both be true. Resolved as: at 1280px and wider both panels show side by side and
the strip becomes a count summary. Below that, the tabs switch panels.

### D3. Which theme opens by default — **decided, built**

Light. `:root` in `globals.css` now carries the reference values and dark moved to
`[data-theme='dark']` plus an OS-dark media query. No stored choice means light, so the app
opens light on a dark operating system. The toggle cycles light, dark, system.

### D4. Density — **decided**

Cards are about 62px collapsed against the old 40px rows. Thirty pull requests now take
roughly 2.2 times the scroll. You chose the cards as drawn.

---

## E. Contrast: three places the sample fails and Phase 1 does not

The sample was drawn light-only and does not meet the 4.5:1 rule in three places. Phase 1
keeps the sample's hue and darkens the value.

| Element | Sample | Contrast | Phase 1 | Contrast |
|---|---|---|---|---|
| Green button fill, white text | `#16a34a` | 2.98:1 | `#166534` | 5.6:1 |
| Amber text on white | `#d97706` | 3.2:1 | `#b45309` | 5.1:1 |
| Focusable control edge | `#e5e7eb` | 1.4:1 | `#8a93a3` | 3.1:1 |

`#e5e7eb` stays as the divider colour, where the 3:1 rule does not apply.

---

## F. Cleanup carried over

- `primaryLabel` and `drawerActionsFor` in `src/lib` no longer have callers.
- The live list at `/mine` was not checked against real data in this pass. The events
  stream holds the page open, so a headless screenshot never settles. Open it yourself.

---

## Phase 5 — done

### Every GitHub call now shows it is working

A write covers the mutation **and** the refresh that follows it, so nothing stops spinning
early. Five places changed:

- **The confirm dialog** used to fire and close. It now awaits the action, holds itself open
  with a spinner and a "Talking to GitHub…" line, and refuses Cancel, Escape and a backdrop
  click while busy.
- **The kebab** spins, so an action fired from the menu on a collapsed card still reports.
- **The header refresh icon** spins for the whole write, not only the refetch.
- **Thread reply and resolve** now await the list refresh before clearing their spinner.
- **One write at a time.** `handleRunAction` returns early when `busy` is set. A second start
  used to move the spinner off the first row.

### The merge queue gets its own tab

A queued pull request opens on **Merge queue**, not Checks. Checks stays a tab.

The queue builds a speculative merge commit, and it is *that* commit's checks that decide
whether the queue merges. They are a different set from the pull request's own: on #6607,
63 queue checks against 50 pull-request checks. The panel shows the queue's set.

The steps are derived, because GitHub publishes no step API: entered the queue, batched or
solo, speculative checks, deployment approval when one is held, then the merge. The entry
state lags the rollup, so when checks pass before the queue advances the merge step says so
rather than looking contradictory.

Detail comes from `POST /api/queue/detail`, which reads `mergeQueueEntry.headCommit
.statusCheckRollup`. It is too heavy for the list query. The panel polls every 15 seconds
while it is open, because the queue moves without touching the pull request.

### A queued pull request stays in the priority zone

It used to drop into "Everything else" the moment a deployment approval cleared, with
"Review" as its action. Now `blockedReason` keeps it until the queue merges it or gives up.
`UNMERGEABLE` and `LOCKED` rank second, just under a deployment waiting on you. A queue that
is merely working ranks last: worth watching, not blocking. The primary action for a queued
pull request is now "View queue", not "Review".

## Phase 4 — done

The aim was to remove the trips to github.com. What the card can now do without leaving it:

**Read the description.** A Description tab holds `bodyHTML`, GitHub's own rendered and
sanitized markdown. It resolves `#123` and `@mentions` against the repository, and handles
task lists, alert blocks, tables and fenced code the way the site does. No client-side
markdown library is involved, and it costs no extra request. The panel takes the full card
width, because prose needs it; checks and threads keep the two-pane layout.

**Work a review thread.** A thread opens in place and shows every comment with its rendered
body and author. Under it sit a reply box (⌘↵ sends) and a Resolve or Reopen button, gated on
`viewerCanReply`, `viewerCanResolve` and `viewerCanUnresolve` so no control appears that
GitHub would refuse. Routes: `POST /api/threads/reply` and `POST /api/threads/resolve`.

**Read a failing check.** A check row opens to show its summary, its annotations with file
and line, all of its steps with per-step status and duration, and the last 200 lines of the
job log. Detail is fetched per check on open, through `POST /api/checks/detail`; carrying it
on the list query would multiply an already heavy request by fifty checks per pull request.
The log tail comes from the Actions REST endpoint, keyed on the job id parsed out of
`detailsUrl`. A check with no readable log says so rather than failing quietly.

Verified against a real failing check: 26 steps, 3 annotations, 199 log lines.

### Still only on github.com

- Writing a new review, or approving one. Needs `addPullRequestReview`.
- Commenting on a line that has no thread yet.
- The diff itself. Declined in B3.
- Editing the description.

## Phase 3 — done

A1, A2, B1 and B2 are built. Section D is settled and built. B3 is declined, B4, B5 and all
of section C stay out.

Both new mutations were checked against the live GitHub schema with an unresolvable node id,
so neither was fired at a real pull request. The sync returns 19 pull requests with diff
counts, check timings and reply counts all present.

Nothing in section F changed: `primaryLabel` and `drawerActionsFor` still have no callers,
and the live list still needs your eyes rather than a headless screenshot.
