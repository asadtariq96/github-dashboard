# PR Desk — design brief

Copy this whole file into another model. It is self-contained. It assumes no access to the code.

---

## What the product is

PR Desk is a personal pull-request console. It runs on one developer's laptop, in a browser tab
that stays open all day. It is not a team tool. It has one user. There is no login, no multi-user
state and no server other than the developer's own machine.

It reads the GitHub API and shows two lists:

- **Mine** — pull requests the user wrote and has not merged.
- **Reviews** — pull requests other people wrote and asked the user to review.

Typical size is 10 to 30 open pull requests in Mine, and 5 to 10 in Reviews. They sit across three
or four repositories in one organisation.

## Who uses it

One backend and platform engineer. Expert with GitHub. Works from a large desktop screen. Keeps the
tab open beside an editor and a terminal. Checks it several times a day, for a few seconds each
time, between other work.

## The job it must do

The user opens the tab to answer one question:

> **What is waiting on me right now, and can I clear it from here?**

Everything else is secondary. GitHub already does browsing, code review, and writing comments, and
it does them better. This tool exists to find the blocked items faster than GitHub's own list does,
and to fire the small mechanical actions that unblock them without a page load.

A pull request is **blocked on you** when only you can move it forward. In Mine, that means one of:
a deployment waiting for the user's approval, a reviewer who asked for changes, a failing check, a
merge conflict, an unresolved review thread, or a branch behind its base. In Reviews, it means the
user has not reviewed it yet, or the author pushed new commits after the user's review.

## What the interface does today

A sticky 56px header holds the title, a Mine/Reviews switch, a search field, a sync indicator, a
refresh button and a theme toggle.

A left rail holds the views (Open, Needs you, Failing, Ready, In queue, Drafts, Hidden) with counts,
and a repository filter. It collapses to 56px.

The main column holds a filter bar (active-filter chips, a sort menu, a count), then a **Blocked on
you** section, then **Everything else**. Each pull request is one row. Clicking a row opens a detail
panel below it, inside the list.

## The data available

Fetched today, per pull request:

- Number, title, URL, author with avatar, repository, head and base branch names
- Created and updated timestamps
- Draft state, merge-queue state and position, whether a deployment waits for approval
- Whether the branch is stacked on another pull request
- Review decision (approved, changes requested, review required) and the user's own review state
- Every check run: name, status, conclusion, and a link to its logs. Often 50 of them
- Count of unresolved review threads
- A timeline of recent comments with author, time and body, used to compute unread counts

Not fetched today, but cheap to add — roughly ten lines of GraphQL each:

- Diff size: lines added, lines removed, files changed
- The list of changed file paths
- Which people are requested for review, and each person's own review state
- Labels

Not possible without new write calls the app has never made: snoozing a pull request, nudging a
reviewer, replying to a comment from inside the tool.

## Actions the row can fire

Exactly one action shows on a row, chosen by state, in this order:

1. Approve a waiting deployment
2. Update the branch from its base
3. Re-run the failed check jobs
4. Merge, or add to the merge queue
5. Mark a draft ready for review

The rest move into the detail panel. Merge and deployment approval ask for confirmation first.
Only "mark ready" can be undone, so only it offers an undo.

## Constraints

- **Density is high.** The user chose 8 out of 10. Rows are 40px minimum today. Fitting more pull
  requests on one screen matters more than breathing room.
- **Both themes.** Dark is the default. Light must work equally well, not as an afterthought.
- **Colour never carries a status alone.** Every state needs a word or an icon beside its colour.
- **Neutrals are at chroma zero.** No blue-grey, no warm grey. Pure neutral grounds.
- **Accessibility is not optional.** Text at 4.5:1, control edges at 3:1, pointer targets at 24px,
  touch targets at 44px, visible focus rings, no keyboard trap, no hover-only path to information.
- **No entrance animation.** State transitions only, on hover, press, focus and open. This is a
  deliberate decision, not an omission.
- **The list updates itself every 30 seconds** while the tab sits open. Any design that gives a row
  persistent keyboard focus must survive that row moving or vanishing mid-keypress.
- Local only. Browser storage is acceptable for what the user has seen and hidden.

## The current palette

Dark: ground `#0a0a0a`, surface `#171717`, raised `#212121`, text `#ededed`, muted `#a3a3a3`,
dim `#909090`, accent `#88b1ff`. Status: ready `#6fcf8f`, warning `#d4a03c`, danger `#e07a7a`,
queue `#a99bd1`, neutral info `#a3a3a3`.

Light: ground `#fafafa`, surface `#ffffff`, text `#171717`, muted `#525252`, dim `#6b6b6b`,
accent `#1f5fd0`. Status: ready `#1f7a45`, warning `#8a5a0a`, danger `#c1272d`, queue `#6d4bb8`.

Type: Fira Sans for the interface, Fira Code for numbers, branches and paths, ligatures off,
tabular figures wherever digits line up.

Feel free to propose a different palette. Say why.

## What to design

**One pull request.** Its collapsed state and its expanded state.

The collapsed state must let the user answer, without clicking:

- Is this blocked on me, and why?
- How urgent is it against the rows above and below it?
- Is there anything new since I last looked?
- What is the one thing I would do about it?

The expanded state must show:

- The check runs, with the failures first and a link to each log
- The review threads and recent comments, newest first
- The branch, and the secondary actions

Ignore what the app currently supports. Invent controls, invent data, invent a different frame if
the frame is the problem. Say what each idea would cost to build.

## What has already been tried

Do not propose these again unless you can say what you would change:

1. **Signal strip** — four fixed glyph slots for review, checks, threads and merge.
2. **Two-line brief** — title on top, a strip of labelled bubbles below.
3. **Gutter card** — a wide left gutter with one large severity glyph.
4. **Merge track** — a four-segment bar showing distance to merge.
5. **Pill cluster** — author avatar first, solid count pills on the right.
6. **Ledger** — a real table with sortable columns and rules between them.
7. **Command row** — keyboard-first; the meta cluster becomes a command strip on hover.
8. **Review faces** — reviewer avatars with rings that encode each person's review state.
9. **Diff card** — the add/delete bar, line counts and the file paths the change touches.
10. **Heat list** — the row warms with age, plus a bar for time spent waiting.
11. **Split panel** — 28px rows and a detail pane that is always open on the right.

The known weak spots across all eleven: none of them handle a pull request with 49 unresolved
threads gracefully, none of them make the merge queue feel different from ordinary waiting, and most of them spend their width on status rather
than on what the change actually is.

## Deliverable

Three to five ideas. For each one give:

- A name and one sentence on the idea
- What it gains and what it costs, plainly
- The collapsed row and the expanded panel, as HTML and CSS or as a precise description
- Any data or action it needs that the list above says we do not have
