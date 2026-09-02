# Design System Master File

> **LOGIC:** When you build a page, first look for `design-system/github-dashboard/pages/[page-name].md`.
> If that file exists, its rules **override** this master file.
> If that file does not exist, obey the rules below.

---

**Project:** GitHub Dashboard
**Generated:** 2026-09-01 (revision 4)
**Category:** Developer Tool — pull request review console
**Design Dials:** Variance 7/10 (Balanced / Modern) | Motion 6/10 (Standard) | Density 8/10 (Dense / Dashboard)
**Themes:** Dark and light. Dark is the default.
**Palette:** Carbon + Electric — neutral black ground, one electric blue accent.

**Out of scope for this revision:** comment box, request review, bulk actions,
`j`/`k` navigation, the mobile sheet. Each is named where it would otherwise be assumed.

### Source of this file

These dataset rows were verified and used:

| Source | Row | Use |
|---|---|---|
| `products.csv` | RPA / Automation Dashboard | Status colour strategy: running, failed, queued, completed |
| `products.csv` | Analytics Dashboard | Dense grid and drill-down pattern |
| `styles.csv` | `data-dense-dashboard` (active) | Primary style, grid and density tokens |
| `styles.csv` | `real-time-monitoring` (supplemental) | Live state indicator and connection state |
| Reference sites | `transitions.dev`, `canvasui.dev`, `beui.dev`, `aicss.dev` | Zero-chroma neutral ramp, single accent |
| `typography.csv` | Dashboard Data (Fira Code + Fira Sans) | Type pairing |
| `motion.csv` | Stagger List — Subtle and Standard tiers | Motion tokens and list reveal |
| `ux-guidelines.csv` | Chip Collection Reflow, Compact Label Overflow, Text Reflow, ARIA Labels, Table Handling | Accessibility and layout rules |

The product decisions in **Product Brief**, **The Two Modes**, **Actions** and
**Data Freshness Contract** come from a requirements session, not from the datasets.
Where a dataset default conflicts with them, those sections win.

These generated defaults were rejected:

- **"Hero + Features + CTA" landing pattern.** This product is a console. It has no landing page.
- **The whole `colors.csv` slate ramp (`#0F172A` ground, Tailwind status hues).** It reads as
  machine-built. The ground carried a blue tint and all five status colours came off the Tailwind
  ramp. The reference sites do the opposite. `beui.dev` states it outright: `oklch(15% 0 0)`.
  The ground is now neutral black at chroma zero.
- **Green accent (`#22C55E`).** Green already means *approved* here. An accent in the same hue would
  destroy the status code.
- **A blue `--info`.** Electric blue is the accent. Sharing it with *checks running* would make a
  transient state look like a focus ring. `--info` is now neutral, and the running state carries a
  spinner icon.
- **`back.out(1.4)` list easing.** `motion.csv` states the overshoot reads as sloppy on dense data.
  The PR list uses the Subtle tier easing instead. The Standard tier budget goes to the drawer.
- **Flat Design "no shadows at all".** A popover on a dark canvas needs one shadow to separate it.
  Every other surface stays flat.
- **`#DC2626` as the light-theme danger colour.** It measures 4.41:1 on the hover surface. That fails AA.

---

## Global Rules

### Theme mechanics

Dark is the default. A light system preference switches to light. An explicit choice always wins.

```css
:root { color-scheme: dark; /* dark tokens */ }
:root[data-theme="light"] { color-scheme: light; /* light tokens */ }
@media (prefers-color-scheme: light) {
  :root:not([data-theme="dark"]) { color-scheme: light; /* light tokens */ }
}
```

Define every token in all three places. Never let a colour exist in one theme only.

### Colour Palette — Dark

All ratios are measured against the four dark surfaces. The stated number is the worst case.

**Surfaces**

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0A0A0A` | Page canvas |
| `--surface` | `#171717` | Rows, cards, panels |
| `--surface-raised` | `#212121` | Drawer, popovers, inputs, inert chips |
| `--surface-hover` | `#242424` | Hover and pressed state |

Every surface sits at chroma zero. No hue tints the ground.

**Text**

| Token | Hex | Worst ratio | Rule |
|---|---|---|---|
| `--text` | `#EDEDED` | 13.26:1 | Titles and body text |
| `--text-muted` | `#A3A3A3` | 6.15:1 | Metadata, labels, timestamps |
| `--text-dim` | `#909090` | 4.86:1 | Lowest text tier. Still passes AA |

**Lines**

| Token | Value | Worst ratio | Use |
|---|---|---|---|
| `--border` | `rgba(255,255,255,0.09)` | — | Decorative separators only |
| `--border-strong` | `rgba(255,255,255,0.16)` | — | Card and section edges |
| `--border-control` | `#707070` | 3.13:1 | Boundary of an input or a control |

WCAG 1.4.11 asks for 3:1 on a boundary that identifies a control. `--border` and `--border-strong`
do not reach 3:1. Do not use them to draw the edge of a control.

**Status roles**

| Token | Hex | Worst ratio | Meaning |
|---|---|---|---|
| `--ready` | `#6FCF8F` | 8.13:1 | Approved. Ready to merge |
| `--warn` | `#D4A03C` | 6.57:1 | Awaiting author. Check warning. Behind base |
| `--danger` | `#E07A7A` | 5.35:1 | Changes requested. Check failed. Conflicts |
| `--info` | `#A3A3A3` | 6.15:1 | Checks running. Neutral notice |
| `--queue` | `#A99BD1` | 6.13:1 | In merge queue |

**Action**

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#88B1FF` | Focus ring, link, primary button fill |
| `--accent-on` | `#0A0A0A` | Text on a primary button. 9.22:1 |
| `--accent-wash` | `rgba(136,177,255,0.14)` | Selected row, active filter chip |

### Colour Palette — Light

Ratios are measured against the three light surfaces.

**Surfaces**

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#FAFAFA` | Page canvas |
| `--surface` | `#FFFFFF` | Rows, cards, panels |
| `--surface-raised` | `#FFFFFF` | Drawer and popovers. Separate them with a border |
| `--surface-hover` | `#F2F2F2` | Hover and pressed state |

**Text**

| Token | Hex | Worst ratio |
|---|---|---|
| `--text` | `#171717` | 16.01:1 |
| `--text-muted` | `#525252` | 6.98:1 |
| `--text-dim` | `#6B6B6B` | 4.76:1 |

**Lines**

| Token | Value | Worst ratio | Use |
|---|---|---|---|
| `--border` | `#E6E6E6` | — | Decorative separators only |
| `--border-strong` | `#D4D4D4` | — | Card and section edges |
| `--border-control` | `#767676` | 4.06:1 | Boundary of an input or a control |

**Status roles**

| Token | Hex | Worst ratio | Meaning |
|---|---|---|---|
| `--ready` | `#1F7A45` | 4.78:1 | Approved. Ready to merge |
| `--warn` | `#8A5A0A` | 5.29:1 | Awaiting author. Check warning. Behind base |
| `--danger` | `#C1272D` | 5.22:1 | Changes requested. Check failed. Conflicts |
| `--info` | `#6B6B6B` | 4.76:1 | Checks running. Neutral notice |
| `--queue` | `#6D4BB8` | 5.60:1 | In merge queue |

**Action**

| Token | Hex | Use |
|---|---|---|
| `--accent` | `#1F5FD0` | Focus ring, link, primary button fill |
| `--accent-on` | `#FFFFFF` | Text on a primary button. 5.82:1 |
| `--accent-wash` | `rgba(31,95,208,0.10)` | Selected row, active filter chip |

**Rules for both themes.**

- Colour alone must never carry a status. Each status needs a text label or an icon.
  The colour rail on a row is decorative. It repeats a label that is already visible.
- The accent is not a status colour, and no status colour is the accent. The accent marks focus,
  links and the one primary action. The five status hues stay reserved for meaning.
- Keep every neutral at chroma zero. A grey with a hue in it is the tell this palette replaced.

### Typography

- **Mono: Fira Code** — PR numbers, branch names, SHAs, check names, counts, file paths
- **Sans: Fira Sans** — all other interface text

One family in two forms holds the interface together. This is the point of the pairing.

```
https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Fira+Sans:wght@400;500;600;700&display=swap
```

Load both through `next/font/google`. Bind them to `--font-mono` and `--font-sans`.

Turn Fira Code ligatures off in the interface. A branch name must not join `->` into one glyph.

```css
.mono { font-family: var(--font-mono); font-variant-ligatures: none; }
```

**Type scale (dense)**

| Token | Size | Line height | Use |
|---|---|---|---|
| `--text-2xs` | 11px | 1.4 | Badge labels. Never smaller |
| `--text-xs` | 12px | 1.5 | Metadata, counts |
| `--text-sm` | 13px | 1.5 | Row body, secondary text |
| `--text-base` | 14px | 1.5 | PR title, primary text |
| `--text-lg` | 16px | 1.4 | Panel and drawer headings |
| `--text-xl` | 20px | 1.3 | Section heading |
| `--text-2xl` | 28px | 1.2 | Page heading and large counts |

Never set interface text below 11px.

Use `font-variant-numeric: tabular-nums` on every count, timestamp and PR number.
Tabular figures stop a column from moving when a value changes.

Keep a long value readable. Let a URL, a branch name or a title reflow.

```css
.value { overflow-wrap: anywhere; min-width: 0; }
```

Never apply `word-break: break-all` to a title or to prose.

### Spacing Variables

*Density: 8/10 — Dense / Dashboard*

| Token | Value | Use |
|---|---|---|
| `--space-1` | `4px` | Icon gaps, inline spacing |
| `--space-2` | `8px` | Standard padding, chip padding |
| `--space-3` | `12px` | Row padding, card padding |
| `--space-4` | `16px` | Gaps between groups |
| `--space-6` | `24px` | Section margins |
| `--space-8` | `32px` | Page margins |

**Fixed sizes**

| Token | Value | Use |
|---|---|---|
| `--row-height` | `40px` | Compact list row |
| `--header-height` | `56px` | Sticky app header |
| `--rail-width` | `240px` | Left navigation rail |
| `--rail-width-collapsed` | `56px` | Icon-only rail |
| `--target-min` | `24px` | Smallest pointer target on a mouse |
| `--tap-min` | `44px` | Smallest control on a touch device |

A 40px row is correct for a mouse. It is too small for a finger.
Grow every control to 44px under `@media (pointer: coarse)`.

### Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | `8px` | Badges, chips |
| `--radius-md` | `10px` | Rows, buttons, inputs |
| `--radius-lg` | `14px` | Cards, drawer, popovers |
| `--radius-full` | `999px` | Status dot, avatar |

### Elevation

The interface is flat. Show depth with surface colour and a border.
Use one shadow only, and only on a layer that floats above the page.

| Token | Theme | Value |
|---|---|---|
| `--shadow-float` | Dark | `0 1px 0 rgba(248,250,252,0.06) inset, 0 12px 32px rgba(0,0,0,0.45)` |
| `--shadow-float` | Light | `0 1px 2px rgba(15,23,42,0.06), 0 12px 28px rgba(15,23,42,0.10)` |

### Z-Index Scale

| Layer | Value |
|---|---|
| Base content | `0` |
| Sticky header, rail, filter bar | `10` |
| PR detail drawer | `20` |
| Dropdown, popover, command palette | `40` |
| Toast | `100` |
| Modal, confirm dialog | `1000` |

---

## Product Brief

PR Desk is a local, single-user console for your own GitHub work.

It answers **"what is blocked on me right now"** first. It answers **"what changed since I looked"**
second. Two different jobs get two different routes.

It runs on one machine. It reads the token from `gh auth token`. Nothing is deployed or shared.

Use is mixed. The tab stays open for hours. It also gets worked through in short sessions.
The interface must serve both. Nothing may key off page load alone.

---

## App Frame

```
┌──────────────────────────────────────────────────────────┐
│  PR Desk   Mine 12 · Reviews 4    search   sync ● 12:04  │  56px, z-10
├──────────┬───────────────────────────────────────────────┤
│ VIEWS    │  BLOCKED ON YOU                        3      │  priority zone
│ · Open   │  ▌ Approve deploy · svc-gateway #2841         │  no cap
│ · Needs  │  ▌ Changes requested · #2839                  │
│   you  4 │  ▌ Checks failing · #2836                     │
│ · Failing├───────────────────────────────────────────────┤
│ · Ready  │  layout · columns          24 open · 3 unread │  filter bar
│ · Queue  ├───────────────────────────────────────────────┤
│ · Drafts │  ▌ PR title                    ▲3  CI  2h     │  40px rows
│ · Hidden │  ╰─ drawer opens here, in place               │  z-20
│          │                                               │
│ REPOS    │                                               │
│ · repo 4 │                                               │
└──────────┴───────────────────────────────────────────────┘
```

1. **App header, 56px, sticky.** Product mark, mode switch with counts, global search,
   sync state, last sync time, refresh control, theme toggle.
2. **Left rail, 240px.** Views for the active mode. Repository list below, shared by both modes.
   The rail collapses to 56px icons below 1024px. It becomes a horizontal scroll strip below 640px.
3. **Priority zone.** Everything blocked on you, ranked. It has no cap.
4. **Filter bar.** Layout and column controls, result count, unread count.
5. **PR list.** Compact rows by default. Spaced cards as an option. One to four columns.
6. **PR detail drawer.** It opens in place, under the selected row. It is not a modal.
7. **Toast.** Bottom right. It carries the result of an action and any undo.

---

## The Two Modes

`/` redirects to `/mine`. Each route is bookmarkable and survives a reload.

| | `/mine` | `/reviews` |
|---|---|---|
| Query | `author:@me is:pr is:open` | `user-review-requested:@me` and `reviewed-by:@me` |
| Question | What is blocking me shipping | Who am I blocking |
| Views | Open · Needs you · Failing · Ready · In queue · Drafts · Hidden | Needs your review · Reviewed, then pushed · Approved by you · Hidden |

Both queries come from environment variables. An override splits on `|` to run several
searches and merge the results.

Use `user-review-requested`, never `review-requested`. The second folds in every team you
belong to: measured here, 8 PRs against 577. Team queues need `team-review-requested:ORG/TEAM`,
which takes a team name and not `@me`. They are a separate feature, not a review queue.

Reviews mode needs a second search, `reviewed-by:@me`. GitHub removes you from
`user-review-requested` the moment you submit a review, so **Reviewed, then pushed** and
**Approved by you** can never light up from the first query alone.

Never show one view set in both modes. A view that can never light up trains the reader to
stop looking at the rail. `Ready`, `In queue` and `Drafts` describe the author's state.
They mean nothing when you are the reviewer.

### Blocked on you

The definition changes with the mode. Both definitions must agree with the priority zone.

**On `/mine`,** a PR is blocked on you when any of these hold:

| Condition | Why it is yours |
|---|---|
| Waiting for deployment approval | Only you can press the button |
| Changes requested | The ball is in your court |
| Checks failing | You must fix or re-run |
| Merge conflicts | You must resolve |
| Unresolved review threads | Someone asked you a question |
| Behind base branch | You have an Update branch control |

**On `/reviews`,** a PR is blocked on you when:

| Condition |
|---|
| Review requested and you have not reviewed |
| You approved, and they have pushed since |

Someone else's failing checks are not your problem. Do not import the `/mine` rule.

### Priority zone rank

1. Waiting for deployment approval
2. Changes requested
3. Checks failing
4. Merge conflicts
5. Unresolved review threads
6. Behind base branch

Unread human activity floats a PR up inside its band. It never moves a PR between bands.

The zone shows everything. A cap would hide a blocked PR behind a control, and preventing that
is the only reason the zone exists.

The zone appears on the unfiltered view only. Every other view either **is** the blocked set
already, or is a deliberate narrowing the zone would fight. On a blocked view the list itself
carries the rank, so the ordering is the same either way.

One function decides whether a PR is blocked, and the rail counts and the zone both read it.
Two separate rules drift apart, and then the count and the list disagree.

---

## Actions

One action shows in the row. The drawer holds the rest. Seven controls on a 40px row would
destroy the density this system is built for.

**Row precedence:** Approve deployment → Update branch → Re-run checks → Merge → Mark ready.

Re-run checks sits above Merge on purpose. When checks are red, Merge must not be the control
under the pointer.

| Action | Confirm | Recovery |
|---|---|---|
| Merge | Yes | None. Warn plainly |
| Approve deployment | Yes | None. Warn plainly |
| Update branch | No | None. Result toast only |
| Re-run checks | No | None. Result toast only |
| Mark ready | No | **Real undo.** `convertPullRequestToDraft` |
| Hide | No | Real undo. Local state |

Only offer Undo where the action can genuinely be reversed. Update branch writes a merge
commit and re-running checks starts a workflow; GitHub gives back no way to undo either.
A control labelled Undo that cannot undo is worse than no control.

Every action runs three states: pending, then confirmed or reverted.
A revert shows a toast that carries the reason. It never fails in silence.

---

## User Journey

### Search

- `/` moves focus to the search field. `Esc` clears it and returns focus to the list.
- Search matches title, PR number, author, repository and branch name.
- Debounce the query by 150ms. Never block a keystroke.
- Search runs in the active mode. When the other mode also has matches, show a line that
  says how many and links to it. Never merge the two lists.
- Search reads only what is loaded. The query caps at 50 per mode.
  Past that, say "showing the first 50". Never let the count lie.

### Filter

- Filters live in the bar as chips. Each chip shows its value and a remove control.
- The chip row wraps. It never clips. The set caps at two, one repository and one search term,
  so there is no `+n` overflow control. A control that can never light up is worse than none.
- Every filter writes to the URL. The view, the repository and the sort push a history entry.
  Typing in search replaces the current entry, so one query cannot bury the history.
  The back button restores the previous filter set.
- The rail carries the views and the repository filter. There is no separate repository control.

### Sort

- One sort is active at a time. The control states the field and the direction.
- The control is a menu of `menuitemradio` items. The active item carries `aria-checked`.
  `aria-sort` is not used. It is valid only on a column header, and this list has none.
- Four orders: priority, last updated newest first, last updated oldest first, opened newest first.
- The default order is the priority rank, then unread, then last update, newest first.
- The sort orders rows inside a group. It never folds the priority zone into the rest.

### Group

- Group by repository is removed. The rail's repository filter answers the same question better.

### Seen and unread

- A PR clears when you open it. The watermark is `max(your last activity, your last visit)`.
- A **Mark all seen** control clears the rest. It is always deliberate, never automatic.
- Never clear unread on window focus or on a timer. The tab stays open for hours.
  Anything automatic marks things read while you are away from the desk, and then the
  count cannot be trusted.

### Empty states

- Name the filter that hides every row. Offer one control that clears it.
- Never show a bare "No results" line.

### Keyboard

| Key | Action |
|---|---|
| `/` | Focus search |
| `Esc` | Close the drawer, then clear search |

`j` and `k` list navigation is deliberately absent. The list updates live while the tab is open,
so a roving focus model must survive a row moving under the pointer mid-keypress.
Add it only with that solved.

Every shortcut needs a visible control that does the same job.

## Data Freshness Contract

The interface states three sync states. They match `DashboardSyncResponse.syncStatus`.

| State | Header shows | Rows |
|---|---|---|
| `Healthy` | A steady dot in `--ready` and the last sync time | Live |
| `Syncing` | A pulsing dot in `--info` and the last sync time | Previous rows stay in place |
| `Stale Error` | A steady dot in `--danger`, the age of the data, and a Retry control | Kept, and marked stale |

### Refresh rules

- The cache is keyed by query. Each mode holds its own rows, its own sync time and its own error.
- The active route polls every 30 seconds. The inactive route does not poll.
- The inactive mode shows the **age** of its last check, never a count that might be wrong.
  A stale count that looks live is worse than no count.
- A route switch paints the cached list at once, then revalidates behind it.
- Review timelines are fetched only for PRs in the current filtered view, and always for
  everything in the priority zone. Never for the whole result set.
- Cap timeline fetches at 6 at once. A burst of concurrent requests is what trips
  GitHub's secondary rate limits, not the hourly ceiling.

### Rules

- Keep the rows on an error. An empty screen loses the reader's place.
- Never show stale data as if it were live.
- A revert shows a toast that carries the reason. It never fails in silence.
- The pulse on `Syncing` stops under `prefers-reduced-motion`.

### State that lives in the browser

Seen watermarks and hidden PRs live in `localStorage`. They are per browser and per machine.
Clearing site data loses them. This is acceptable while the tool runs on one machine only.

---

## Component Specs

All examples use tokens. Never write a raw hex value in a component.

### Status Badge (signal first)

A badge appears only when a real blocker or milestone exists. Never render a neutral baseline state.

```css
.badge {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-2xs);
  line-height: 1.4;
  font-weight: 500;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.badge-danger {
  background: color-mix(in srgb, var(--danger) 12%, transparent);
  color: var(--danger);
  border: 1px solid color-mix(in srgb, var(--danger) 30%, transparent);
}
```

Give each badge a text label. An icon alone is not enough.

A badge label stays on one line. Bound only a value you cannot predict.
Give any truncated value an operable control that shows it in full. A hover tooltip is not enough.

### PR Row

```css
.pr-row {
  display: grid;
  grid-template-columns: 3px 1fr auto;
  align-items: center;
  gap: var(--space-3);
  min-height: var(--row-height);
  padding: var(--space-2) var(--space-3);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  transition: background var(--dur-instant) var(--ease-out);
  cursor: pointer;
}

.pr-row:hover { background: var(--surface-hover); }
.pr-row[aria-selected="true"] { background: var(--accent-wash); }

.pr-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
  scroll-margin-top: var(--header-height);
}

@media (pointer: coarse) {
  .pr-row { min-height: var(--tap-min); }
}
```

The 3px first column is the status rail. It repeats the visible label. Set `aria-hidden="true"` on it.

### Button

```css
.btn-primary {
  background: var(--accent);
  color: var(--accent-on);
  min-height: 32px;
  padding: 0 var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  font-weight: 600;
  transition: opacity var(--dur-instant) var(--ease-out);
  cursor: pointer;
}

.btn-danger { background: var(--danger); color: var(--accent-on); }

.btn:disabled { opacity: 0.45; cursor: not-allowed; }

@media (pointer: coarse) { .btn { min-height: var(--tap-min); } }
```

One primary control per view. Every other control is visually lower.

Merge and Approve Deployment change the world. Use `--danger`. Put a confirm step in front.
Keep them away from the safe controls.

### Input

```css
.input {
  min-height: 32px;
  padding: 0 var(--space-3);
  background: var(--surface-raised);
  color: var(--text);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-md);
  font-size: var(--text-sm);
  transition: border-color var(--dur-fast) var(--ease-out);
}

.input:focus-visible {
  border-color: var(--accent);
  outline: 2px solid var(--accent);
  outline-offset: 1px;
}
```

### Filter Chip

```css
.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-1);
  min-width: 0;
  min-height: var(--target-min);
  padding: 2px var(--space-2);
  background: var(--surface-raised);
  border: 1px solid var(--border-control);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
}

.chip[data-active="true"] {
  background: var(--accent-wash);
  border-color: var(--accent);
}
```

Never give the chip row a fixed height with hidden overflow.

### PR Detail Drawer

The drawer opens under its row. It is not a modal. It does not cover the list.

```css
.drawer {
  background: var(--surface-raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  padding: var(--space-3);
  box-shadow: var(--shadow-float);
}
```

Give the trigger `aria-expanded` and `aria-controls`. Move focus into the drawer when it opens.
Return focus to the trigger when it closes.

---

## Style Guidelines

**Primary style:** Data-Dense Dashboard
**Secondary styles:** Real-Time Monitoring, Flat Design

**Keywords:** grid layout, tight padding, maximum data visibility, high contrast, flat surfaces,
live status, fast paint

**Key effects:** flat fills, hairline borders, row highlight on hover, one shadow on floating layers,
a pulsing dot for live state

**Icons:** Lucide (`lucide-react`), already installed. Use one set only.
Keep the stroke width at 1.5px. Keep icon sizes to 12px, 14px and 16px.
Never use an emoji as an icon.

**Grid:** 12 columns, `gap: var(--space-2)`. The card list runs one to four columns by width.

---

## Motion

**Tier: Standard (6/10). Built in full.**

The library is **Motion 13** (`motion/react`), chosen on 2026-09-02. It was picked over GSAP
because every animation here is a React state change: a card leaving the list needs
`AnimatePresence`, which CSS cannot do at all, and a card springing open needs `layout`, which
animates the geometry by transform so nothing animates height. GSAP would have matched
`motion.csv` but is imperative and fights the render cycle.

Cost: about 70kB on `/mine`, from 103kB to 173kB first load. Acceptable for a local tool.

The numbers live in `src/lib/motion.ts`, which repeats the values below because the library
cannot read CSS custom properties. Change both together.

What is built: hover, press, focus and open/close transitions; the list reveal; the card
spring; card exits; and reorder on a sort change. The spinning refresh icon and the pulsing
sync dot are the only continuous motion.

**Tokens**

| Token | Value | Use |
|---|---|---|
| `--dur-instant` | `120ms` | Hover, press, row highlight |
| `--dur-fast` | `180ms` | Badge change, count change, chip toggle |
| `--dur-base` | `260ms` | Drawer open, panel open, sheet open |
| `--dur-exit` | `170ms` | Every exit. About 65% of the entrance |
| `--ease-out` | `cubic-bezier(0.16, 1, 0.3, 1)` | Anything that arrives |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Anything that leaves |

**Springs.** `CARD_SPRING` is stiffness 420, damping 34, mass 0.9, for a card opening.
`REORDER_SPRING` is stiffness 320, damping 32, mass 1, slower because more rows move at once.

**List reveal.** The list uses the Subtle tier, not the Standard tier.

```
opacity 0 → 1, translateY 8px → 0, 300ms, ease-out, stagger 30ms each, cap the total at 300ms
```

First paint only. Each card carries `initial="hidden"` on the first render pass and
`initial={false}` afterwards, so a row arriving from the poll or the event stream does not move.

Two traps, both hit while building this:

- The first-pass flag must be a **ref read during render**, not state. State flips a frame
  after mount, re-renders with a different `initial`, and cancels the reveal.
- `AnimatePresence` must **not** carry `initial={false}`. That prop exists to suppress the
  enter animation on the first render, which is the one render the reveal is for.

**Live state.** The `Syncing` dot pulses on a 2s loop. Nothing else pulses.

**Rules**

- Animate `transform` and `opacity` only. Never animate `width`, `height`, `top` or `left`.
- Make the exit shorter than the entrance.
- Cancel a running animation when the state changes again. Set the final state directly.
  Never depend on an animation-end event for correctness.
- A PR list updates from a live event stream. Do not animate a row that arrives from the stream.
  Movement during a read makes the list hard to follow.
- Every animation must show cause and effect. Nothing moves for decoration.
- Never block input during an animation.

**Reduced motion.** Two mechanisms, because CSS and Motion are separate systems.

`MotionConfig reducedMotion="user"` wraps the app in `src/components/MotionProvider.tsx`. With
Reduce motion on, Motion drops every transform and layout animation and renders the final state
at once, keeping opacity. So the reveal becomes a plain cross-fade, and the spring and the
reorder snap. Verified by forcing the media feature over the DevTools protocol.

`globals.css` holds the CSS block. It **exempts `.animate-spin` and `.animate-pulse-dot`**,
which report state. The blanket rule used to freeze them at frame one, and a stopped spinner
reads as a hung request. Suppressing status feedback makes the interface worse for exactly the
people the setting protects. Do not remove the exemption.

---

## Accessibility Rules

These rules come from verified `ux-guidelines.csv` rows.

- **Colour only (High).** Every status needs a label or an icon next to the colour.
  The status rail is decorative. Hide it from the accessibility tree.
- **ARIA labels (High).** Every icon-only control needs an accessible name.
  Example: `aria-label="Update branch"`.
- **Chip collection reflow (High).** The chip row wraps. Overflow collapses into an operable
  `+n` control. Never clip a chip row.
- **Compact label overflow (High).** A badge label stays whole on one line.
  Expose any truncated value to pointer, touch and keyboard users.
- **Contextual live badge updates (High).** When a count changes, announce a full phrase.
  Use `<span role="status" aria-atomic="true">3 unresolved threads</span>`.
  Never announce a bare number. Use one status region. Do not move focus.
- **Text reflow (Critical).** Never clip text in a fixed-height box. Use unitless line height.
- **Table handling (Medium).** Wrap the PR table in `overflow-x: auto`.
  Below 768px, switch to the card layout.
- **Focus.** Keep a visible 2px `--accent` ring on every control.
  The sticky header and rail must not hide the focused row.
  Use `scroll-margin-top: var(--header-height)`.
- **Target size.** A pointer target is at least 24×24 CSS px. A touch target is at least 44px.
- **Destructive actions.** Merge and Approve Deployment need a confirm step.
  Offer an undo where the API allows it.
- **Long lists.** Virtualize above 50 rows. Animate only the mounted rows.

---

## Anti-Patterns (Do NOT Use)

- A slow dashboard
- A decorative chart
- A hidden error state
- A neutral badge that adds no signal
- A raw hex value inside a component
- A colour defined in one theme only
- An emoji used as an icon
- Text below 11px
- A colour that carries a status with no label
- A control edge drawn with `--border` or `--border-strong`
- A grey with a hue in it. Every neutral sits at chroma zero
- A status colour taken from the Tailwind ramp
- A green accent. Green means approved
- A blue `--info`. Blue is the accent
- A row that animates when the event stream updates it
- `back.out` easing on the PR list
- A modal used to show PR detail
- A chip row with a fixed height and hidden overflow
- A hover-only tooltip as the sole way to read a truncated value
- A keyboard shortcut with no visible control
- Stale data shown as live
- A count on an inactive mode that has not been checked
- A view in the rail that can never light up
- Merge offered as the row action while checks are failing
- Unread state cleared by a timer or by window focus
- The `/mine` blocked-on-you rule applied to `/reviews`
- More than 6 timeline fetches in flight at once

---

## Pre-Delivery Checklist

- [ ] All colours come from tokens. No raw hex in a component
- [ ] Every token exists in dark and light
- [ ] Every neutral is at chroma zero. No blue or warm tint in the ground
- [ ] Text contrast is 4.5:1 or better on every surface in both themes
- [ ] Control boundaries reach 3:1. They use `--border-control`
- [ ] Every status shows a label or an icon, not colour alone
- [ ] Every icon-only control has an `aria-label`
- [ ] Counts announce a full phrase through one `role="status"` region
- [ ] Focus rings are visible. The header and rail do not hide them
- [ ] Pointer targets reach 24px. Controls reach 44px under `@media (pointer: coarse)`
- [ ] Badge text is 11px or larger and stays on one line
- [ ] Counts and timestamps use tabular figures
- [ ] Fira Code ligatures are off in the interface
- [ ] The chip row wraps and never clips
- [ ] Motion uses `transform` and `opacity` only
- [ ] The list reveal runs on first paint only, never on a stream arrival
- [ ] `prefers-reduced-motion` drops transforms but keeps the spinner and the pulse turning
- [ ] Filters and sort live in the URL. Back restores them
- [ ] The sync state and last sync time are always visible
- [ ] Rows hold at 40px minimum and never clip a value
- [ ] Verified at 375px, 768px, 1024px and 1440px
