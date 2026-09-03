# PR Desk — design

What the app is and how it is built, as it stands. Every number here was read out of the
code, not remembered. When you change one, change it here too.

Superseded documents, all removed: `docs/adr/*`, `design-system/github-dashboard/MASTER.md`,
`BRIEF.md`, `ROW-SPEC.md`, `PHASE-2-GAPS.md`. Their history is in git.

---

## 1. What it is

A personal pull-request console. One developer, one laptop, a browser tab open all day. No
login, no server but your own, no database.

It answers one question:

> **What is waiting on me right now, and can I clear it from here?**

Two modes. **Mine** is what you wrote and have not merged. **Reviews** is what other people
asked you to look at. Typical size is 18 in Mine and 11 in Reviews, across seven
repositories.

The default workflow is a personal queue: **Act now** contains work only the engineer can
move, **Waiting** contains healthy background work, **Snoozed** holds deliberately deferred
items, and **Done recently** queries GitHub for PRs closed or merged in the last seven days.
Actions taken from the desk are added optimistically for five minutes while GitHub search catches
up. Snoozes remain browser-local and are never written to GitHub.

GitHub already does browsing, code review and writing comments better. This exists to find
the blocked items faster than GitHub's own list, and to clear them without a page load.

`blockedReason` in `src/lib/status.ts` supplies the detailed urgency ranking. `needsAction` in
`src/lib/workQueue.ts` turns that ranking into the **Act now** view while excluding a healthy
merge queue, which is moving without the engineer.

---

## 2. Architecture

Three tiers, all local. The browser never holds a GitHub token.

```
Browser                    Next.js server                  GitHub
────────────────────────   ─────────────────────────────    ──────────────────────
DashboardView              src/lib/cache.ts                 GraphQL
 filters, queue, inspector  Map<Mode, ModeState>             search(type: ISSUE)
 selection                  25s list TTL                     node(id) detail
localStorage                5min per-PR activity TTL         10 mutations
 hidden, visited, theme    src/lib/events.ts                REST
URL query                   prEventEmitter                   issues/:n/timeline
 view, repo, q, sort       src/lib/normalizer.ts             actions/runs
EventSource ◀───SSE──────   raw → assessment                 actions/jobs/:id/logs
30s poll ─────fetch─────▶  src/lib/config.ts
                            GITHUB_TOKEN, else gh auth token
```

**The cache is one file.** `src/lib/cache.ts` holds a plain `Map` in the server process, one
slot per mode. No Redis, no disk. It is pinned to `globalThis` in development so hot reload
does not drop it, and it dies with the server.

Two clocks, because the costs differ:

| Constant | Value | Covers | Why |
|---|---|---|---|
| `CACHE_TTL_MS` | 25s | The PR list | The browser polls every 30s, so a poll lands warm |
| `ACTIVITY_TTL_MS` | 5 min | One PR's timeline | Up to three REST pages each, too heavy per sync |
| `ACTIVITY_CONCURRENCY` | 6 | Parallel timeline fetches | A burst trips the secondary rate limit |
| `BATCH_CONCURRENCY` | 4 | Parallel batch writes | Same reason, and each write forces a resync |
| `QUEUE_POLL_MS` | 15s | The open merge queue panel | The queue moves without touching the PR |
| `LOG_TAIL_LINES` | 200 | Job log excerpt | Enough to see a failure, small enough to read |
| `MAX_KEYS` | 40 | Timelines per activity request | A wide view cannot ask for hundreds |
| `URL_WRITE_DEBOUNCE_MS` | 300 | Search typing | One search must not bury the history |

Three de-duplication mechanisms: `syncPromise` (ten callers share one GitHub call),
`activityInFlight` (registered before any request starts), and `mapWithConcurrency`.

The activity map lives on `st.activity`, not `st.cache.activity`, because a sync replaces
`st.cache` wholesale and would discard a lazy fetch that landed mid-sync.

**Three ways a change reaches the screen**, all ending on a warm cache: a webhook to
`refreshAllModes()` to `prEventEmitter.emit()` to SSE to a refetch (seconds, needs a tunnel);
the refresh button; and the 30s poll as the fallback that always works.
When `GITHUB_WEBHOOK_SECRET` is configured, the webhook verifies GitHub's SHA-256 signature
before invalidating. The app binds to localhost by default and must not be exposed without that
protection because mutation routes use the operator's GitHub token.

**Failure is graceful.** A failed sync keeps the old list and flips `syncStatus` to
`Stale Error`. The list renders under an error banner rather than going blank.

---

## 3. The frame

- A sticky **72px header**: title, Mine/Reviews switch, search, sync dot and time, refresh,
  theme toggle.
- A **260px left rail**, collapsing to 68px. Work-queue views come first, followed by diagnostic
  views with live counts and a repository filter. The collapse keeps the toggle and view icons on
  fixed rows and hides the repository section completely, so nothing shifts vertically.
- A filter bar: active-filter chips, a sort menu, a count, and Mark all seen.
- A stack of cards, 16px apart.

**Filters and sort live in the URL** (`view`, `repo`, `q`, `sort`), so the back button
restores a filter set and a link carries one. Only non-default values are written. Picking a
view, repository or sort pushes; typing replaces after 300ms.

**Sort** has four orders: Priority (blocked first, the default), Updated newest, Updated
oldest, Opened newest. The control is a `menuitemradio` menu with `aria-checked`, not
`aria-sort`, which is only valid on a column header.

---

## 4. The card

One pull request. It is about 62px at full width; a two-line identity block plus status chips
does not fit the 40px a dense row would want, and that is the trade the layout makes. In the
narrow master column, title readability takes priority and status wraps below it.

```
▌ ▾ ⑂  Add streaming support to event bus consumer   #2457      +312 −48 ▬▬  ⊘ 18/21 ●2  ⌸ 7     Opened 3w ago    [ Add to queue ▾ ]
       ▤ unity/gateway-api · ⑂ feat/streaming → main                                              Updated 1h ago
▲ 3px severity edge
```

Left to right: severity edge, selection checkbox, chevron, state icon, title with number
chip, diff and its bar, status chips, both timestamps, unread count, one primary action.

**Status is never carried by colour alone.** Every chip has a word or an icon.

**Chips**, at most one state chip and never more than four in total: Deploy hold, Conflicts,
queue position, Draft, Behind base — then checks (`18/21` plus a divided running count),
unresolved threads, Changes requested, Stacked.

**Two timestamps, and neither replaces the other.** Opened 3 weeks ago and touched an hour
ago is healthy. Opened 3 weeks ago and untouched for two is dead. Updated turns amber past
seven days.

**The severity edge** is 3px on the card's left border: danger, ready, queue, draft, or a
neutral strong line.

### The primary action

`allActionsFor` in `src/lib/rowAction.ts` lists what a state offers, in order, and the card
shows the first. Two orderings are deliberate:

1. `approve-deployment`
2. `mark-ready` — **above** update-branch: a draft blocks nobody, and updating its branch
   changes nothing until it is ready for review
3. `update-branch`
4. `rerun-checks` — **above** merge: when checks are red, Merge must not sit under the pointer
5. `merge`

`close` and `dequeue` are deliberately absent from that list, so neither can ever land as the
primary. They live on the expanded toolbar, on the right, away from Hide. Both confirm first.

A conflicted card shows **Resolve conflicts**, linking to GitHub's web editor. A queued card
shows **View queue**. Otherwise a card with no action shows **Review**.

### Inspector

Selecting a row opens a persistent right-side inspector without moving the queue. On desktop,
the divider is resizable from 32–60% (while preserving at least 480px for the inspector), is
keyboard adjustable, and remembers its width in the browser. Queue cards retain every summary
field and reflow them onto additional rows as the master column narrows. The inspector shell is
stable while navigating between PRs, avoiding a repeated entrance animation; opening and closing
animate the grid tracks directly. Below the desktop breakpoint it becomes a bounded bottom drawer.
A queued pull request opens on **Merge queue**; everything else opens on **Checks**. Description
takes the full card width because prose needs it; Checks and Threads sit side by side when there is
room.

The inspector starts with a **Since you last looked** digest. GitHub timeline activity supplies
new comments, reviews and commits; a browser-local snapshot adds check, review, mergeability and
thread-count transitions. The snapshot is recorded only after the digest is computed.

Keyboard controls operate the current queue: `J`/`K` move, `1`–`4` select inspector tabs, `G`
opens GitHub, `S` snoozes, `H` hides, `R` refreshes, and `⌘K` or `?` opens the command palette.

- **Description** — `bodyHTML`, GitHub's own rendered and sanitized markdown, so issue refs
  and mentions resolve against the repository. No markdown library, no extra request.
- **Merge queue** — derived steps, because GitHub publishes no step API: entered the queue,
  batched or solo, speculative checks, deployment approval when held, then the merge. It
  shows the checks on the queue's **speculative merge commit**, which is a different commit
  from the PR's head and is what actually decides whether the queue merges. On one real PR
  that was 63 queue checks against the PR's own 50.
- **Checks** — failures first. A row opens to its summary, annotations with file and line,
  every step with its duration, and the last 200 log lines. Fetched per check on open.
- **Threads** — every comment rendered, a reply box (⌘↵ sends) and Resolve or Reopen, each
  gated on `viewerCanReply`, `viewerCanResolve` and `viewerCanUnresolve` so no control
  appears that GitHub would refuse.

Scrollers cap at 340px, the description at 480px.

---

## 5. Writes

Ten routes. Each runs its mutation then refreshes **both** modes before answering, because a
merge changes what appears in each.

| Route | GitHub call |
|---|---|
| `/api/prs/merge` | `enqueuePullRequest`, else `mergePullRequest` |
| `/api/prs/close` | `closePullRequest` |
| `/api/prs/dequeue` | `dequeuePullRequest` — takes **`id`**, not `pullRequestId` |
| `/api/prs/update-branch` | `updatePullRequestBranch` |
| `/api/prs/mark-ready` | `markPullRequestReadyForReview` |
| `/api/prs/convert-draft` | `convertPullRequestToDraft`, the undo for mark-ready |
| `/api/prs/rerun-checks` | REST `actions/runs/:id/rerun-failed-jobs` |
| `/api/prs/approve-deployment` | REST `actions/runs/:id/pending_deployments` |
| `/api/threads/reply` | `addPullRequestReviewThreadReply` |
| `/api/threads/resolve` | `resolveReviewThread` / `unresolveReviewThread` |

**Progress is never silent.** `busy` is a record keyed by PR id, so several rows work at once
and each holds its own spinner for the authoritative write. The follow-up cache refresh runs in
the background so a successful mutation, toast, and inspector dismissal land together. A row
whose primary control is a link, and so cannot hold a spinner, gets a standalone one. The
confirm dialog holds itself open with a spinner until GitHub answers. A second write on the
*same* PR is refused.

**Selection** with shift for a range drives a floating toolbar. It offers an action only when
a selected PR supports it, so no button sits there dead. Batch covers `update-branch` and
`rerun-checks` only; merge, close, dequeue and deployment approval each need reading one at a
time.

**Toasts stack** (Sonner, five visible, 6s). A single slot used to drop a message silently
whenever two writes finished together.

---

## 6. Tokens

Light uses warm editorial neutrals and a sparing coral accent inspired by Opensource UI, and is
the theme the app opens in. Dark is derived from the same ramps. Three states: no stamp means
light, `[data-theme='dark']` and a
`prefers-color-scheme: dark` media query both give dark, and the toggle cycles light, dark,
system.

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f7f7f4` | `#141412` |
| `--surface` | `#fffefa` | `#1c1c1a` |
| `--surface-raised` | `#ffffff` | `#232320` |
| `--surface-hover` | `#f7f6f1` | `#292925` |
| `--surface-muted` | `#f1f0eb` | `#30302b` |
| `--border` | `#e6e4de` | `#343430` |
| `--border-subtle` | `#efede8` | `#2a2a27` |
| `--border-strong` | `#d2cfc7` | `#4b4a44` |
| `--border-control` | `#aaa69d` | `#706e66` |
| `--text` | `#1d1d1b` | `#f4f2ec` |
| `--text-muted` | `#575650` | `#cbc7bd` |
| `--text-dim` | `#77746c` | `#9f9b91` |
| `--text-faint` | `#aaa69e` | `#716e67` |
| `--accent` | `#c92f4c` | `#ff8298` |
| `--accent-fill` | `#242422` | `#f4f2ec` |
| `--ready` | `#16a34a` | `#4ade80` |
| `--ready-fill` | `#166534` | `#166534` |
| `--warn` | `#b45309` | `#fbbf24` |
| `--danger` | `#dc2626` | `#f87171` |
| `--queue` | `#7c3aed` | `#a78bfa` |

`--accent`, `--ready`, `--warn` and `--danger` are for text and icons; the `-fill` variants
are for a filled control that carries white text. They differ because the pair has to pass
contrast, not because the theme changed.

**Geometry.** Radius 8 / 12 / 18. Space 4 / 8 / 12 / 16 / 24 / 32. Header 72px, rail 260px
collapsing to 68px. Pointer target 24px, touch target 44px.

**Type.** Inter at 400/500/600/700 for the interface, JetBrains Mono at 400/500/600 for
numbers, branches and paths. Body 13px at 1.4. Scale: 11 / 12 / 13 / 14 / 16 / 20 / 28.
Tabular figures wherever digits line up.

### Three deliberate deviations from the reference

The reference design was drawn light-only and fails 4.5:1 in three places. Each keeps its hue
and gains value.

| Element | Reference | Contrast | Here | Contrast |
|---|---|---|---|---|
| Green button fill, white text | `#16a34a` | 2.98:1 | `#166534` | 5.6:1 |
| Amber text on white | `#d97706` | 3.2:1 | `#b45309` | 5.1:1 |
| Focusable control edge | `#e5e7eb` | 1.4:1 | `#8a93a3` | 3.1:1 |

`#e5e7eb` stays as the divider colour, where the 3:1 rule does not apply.

---

## 7. Motion

**Motion 13** (`motion/react`), chosen over GSAP because every animation here is a React
state change: a card leaving the list needs `AnimatePresence`, which CSS cannot do, and a
card springing open needs `layout`, which animates geometry by transform so nothing animates
height. Costs about 70kB on `/mine`.

Values live in `src/lib/motion.ts`, which repeats the CSS numbers because the library cannot
read custom properties. Change both together.

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | 120ms | Hover, press, row highlight |
| `--dur-fast` | 180ms | Chip, badge and count changes |
| `--dur-base` | 260ms | Panel and sheet opens |
| `--dur-exit` | 170ms | Every exit, about 65% of the entrance |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Anything arriving |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Anything leaving |
| `CARD_SPRING` | stiffness 420, damping 34, mass 0.9 | Floating surfaces and list reflow |
| `REORDER_SPRING` | stiffness 320, damping 32, mass 1 | Rows moving after a sort |

**List reveal**, first paint only: opacity 0 to 1, translateY 8px to 0, 300ms, 30ms apart,
capped at 300ms total. Each card carries `initial="hidden"` on the first pass and
`initial={false}` after, so a row arriving from the poll or the event stream never moves.

Two traps, both hit while building it:

- The first-pass flag must be a **ref read during render**, not state. State flips a frame
  after mount, re-renders with a different `initial`, and cancels the reveal.
- `AnimatePresence` must **not** carry `initial={false}`. That prop exists to suppress the
  enter animation on the first render, which is the one render the reveal is for.

**Rules.** Prefer transform and opacity. The master/detail workspace is the one deliberate
layout transition: its grid tracks animate so opening and closing the inspector does not make
components jump. Exits are shorter than entrances. Never depend on an animation-end event for
correctness. Every animation shows cause and effect. Nothing blocks input.

`back.out(1.4)` was tried and dropped: the overshoot reads as sloppy on dense data.

### Reduced motion

Two mechanisms, because CSS and Motion are separate systems.

`MotionConfig reducedMotion="user"` wraps the app. With Reduce motion on, Motion drops every
transform and layout animation and renders the final state at once, keeping opacity, so the
reveal becomes a cross-fade and the spring and reorder snap.

`globals.css` holds the CSS block, and it **exempts `.animate-spin` and `.animate-pulse-dot`**
at a slower rate. The blanket rule used to freeze them at their first frame. A stopped spinner
reads as a hung request, so suppressing status feedback makes the interface worse for exactly
the people the setting protects. **Do not remove the exemption.**

---

## 8. Accessibility

Not optional, and it has already changed decisions.

- Text 4.5:1, non-text and control edges 3:1. See the three deviations in section 6.
- Pointer targets 24px, touch 44px, visible focus rings everywhere.
- No hover-only path to information or to a control.
- Status never carried by colour alone.
- The card is not a `role="button"`. It holds links and buttons, and interactive content
  inside a control is invalid. Click-to-inspect is a mouse convenience; the chevron is the
  accessible control.
- Range select reads `shiftKey` from **click**, not change. A change event's `nativeEvent` is
  a plain `Event` and carries no modifier keys.
- The list refreshes every 30 seconds, so anything holding row focus must survive that row
  moving or vanishing.

---

## 9. Decisions worth not relitigating

**Rejected, with the reason.**

- **An in-place accordion for PR details.** It made the work queue move while reading and lost
  context when navigating. The persistent, resizable inspector keeps the queue visible instead.
- **Preset filter pills.** That is the rail, which already has the same six views with live
  counts. Two controls for one job.
- **`react-markdown`.** `bodyHTML` is GitHub's own renderer and strictly higher fidelity.
- **Density variants and a 1–4 column grid.** Both built, both removed as noise.
- **Reviewer avatars and "waiting on X" on the card.** No person on the card. Faces appear
  only inside a thread.
- **A blue `--info`.** Sharing the accent would make a transient state look like a focus ring.
- **A `+n` chip overflow.** The filter chip set caps at two, one repository and one search
  term. A control that can never light up is an anti-pattern.
- **Bulk close and bulk convert-draft.** Each needs its own confirmation and its own
  consequences read one at a time.

**Not possible.** GitHub exposes no conflicted hunks, no merge-train inspection, no queue
pause, and no per-PR speculative batch CI outside the queue entry. Approvals as "1 of 2"
needs branch-protection admin rights on every repository.

**Still only on github.com.** Writing or approving a review, starting a thread on a line that
has none, the diff itself, and editing the description.

---

## 10. Paging the search

The list query nests review threads and check runs, so a wide search page times out at
GitHub's edge with a 502 long before the response is ready. Measured: 502s start around 15
nodes on an account with many open pull requests, and 10 is stable.

A small `first` alone is safe but silently drops every match past the first page. So the
search connection is walked by cursor instead: pages of **10**, up to **6** of them, covering
60 matches. `getPageSize` returns 10 for both modes, because the timeout is a GitHub-side
limit and has nothing to do with which mode is asking.

`truncated` on the response still means the search matched more than the walk returned, and
the UI says so rather than pretending the list is complete.
