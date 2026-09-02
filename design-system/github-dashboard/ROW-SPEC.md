# Design one row

Design a single list item for a personal GitHub pull-request dashboard. One developer, one large
desktop screen, a browser tab left open all day. They glance at it for a few seconds at a time to
answer one question: **what is waiting on me, and can I clear it from here?**

Design the row in two states: **collapsed** (the list item) and **expanded** (the detail that opens
under it, in place, not a modal).

## The collapsed row must carry all of this

**Identity**

- Title
- Number
- Repository name
- Head branch and base branch

**The change**

- Lines added and lines removed

**Status.** A pull request holds several of these at once. Failing checks *and* approved is normal.
Show more than one without the row growing. Every status carries its number:

| Status | Number it carries |
|---|---|
| Checks | how many passed of how many ran, and how many still running |
| Review threads | how many are unresolved (this can be 49) |
| Approvals | how many of how many the policy needs |
| Merge queue | position in the queue |
| Merge conflicts | none |
| Draft | none |
| Production deploy waiting for manual approval | none |

**Two separate times.** Both matter and one cannot replace the other:

- How long ago the pull request was opened
- How long ago anything last happened on it

Opened 3 weeks ago, touched an hour ago: healthy. Opened an hour ago, untouched: fine. Opened
3 weeks ago, untouched for 2: dead.

**Unread** — whether anything happened since the user last opened it, and how many.

## Actions

One primary action on the row, chosen by state. The rest may live behind a menu.

- Merge
- Add to merge queue
- Approve production deployment (only when a pipeline holds for manual approval)
- Update branch from base
- Re-run failed checks
- Mark draft ready for review
- Resolve merge conflicts
- **Close on GitHub** — a real write other people see. Needs a confirm step.
- **Hide from desk** — local to this browser, reversible, no confirm.

Close and Hide must not look alike or sit together unmarked.

## The expanded state shows

- Every check run, failures first, each with a link to its log. There are often 50.
- The review threads and recent comments, newest first.
- The changed files.
- The secondary actions.

## Constraints

- **Dense.** 8 out of 10. More rows on screen beats breathing room. Aim under 50px if you can.
- **Dark and light**, both first class. Dark is the default.
- **Colour never carries a status alone.** Every state needs a word or an icon too.
- **Neutrals at chroma zero.** No blue-grey, no warm grey.
- Text contrast 4.5:1, control edges 3:1, pointer targets 24px, visible focus rings, nothing
  reachable by hover alone.
- **No entrance or list animation.** Hover, press, focus and open transitions only.
- Do not put a person on the row. Reviewer avatars and "waiting on X" were considered and rejected.

## Palette and type in use

Dark: ground `#0a0a0a`, surface `#171717`, raised `#212121`, text `#ededed`, muted `#a3a3a3`,
dim `#909090`, accent `#88b1ff`. Status: ready `#6fcf8f`, warn `#d4a03c`, danger `#e07a7a`,
queue `#a99bd1`.

Light: ground `#fafafa`, surface `#ffffff`, text `#171717`, muted `#525252`, dim `#6b6b6b`,
accent `#1f5fd0`. Status: ready `#1f7a45`, warn `#8a5a0a`, danger `#c1272d`, queue `#6d4bb8`.

Fira Sans for the interface, Fira Code for numbers, branches and paths. Ligatures off. Tabular
figures wherever digits line up. Propose something different if you can say why.

## The actual problem

Everything above has to fit and still read in under a second. That is the design brief. Say what
you traded away.

## Deliverable

Three or four options. For each: a name, one sentence on the idea, what it gains and what it costs,
and the collapsed row plus the expanded panel as working HTML and CSS.
