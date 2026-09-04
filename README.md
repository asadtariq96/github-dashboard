# PR Desk

PR Desk is a local, single-user dashboard for engineers juggling pull requests across many
repositories. It turns GitHub's PR data into a work queue, keeps the list beside a persistent
inspector, and lets you handle common unblock-and-ship actions without maintaining a forest of
browser tabs.

> [!IMPORTANT]
> PR Desk is designed to run on your own machine. It has no application login and its mutation
> routes act with your GitHub token, so do not expose it to an untrusted network.

## What it does

- Separates PRs into **Act now**, **Waiting**, **Snoozed**, and **Done recently**.
- Provides dedicated views for failures, merge readiness, drafts, queue state, and reviews.
- Filters by repository and search term, with shareable URL state.
- Opens PR details in a resizable master/detail workspace instead of another tab.
- Summarizes changes since your last visit using GitHub activity and browser-local snapshots.
- Shows descriptions, checks and logs, unresolved review threads, and merge-queue progress.
- Supports updating branches, retrying failed checks, merging or enqueueing, deployment approval,
  draft/ready transitions, thread replies, thread resolution, dequeueing, and closing.
- Supports range selection for safe batch operations.

The interface is influenced by [OpenSourceUI](https://opensourceui.in/), whose components are
intended to be copied and customized. It is not installed as a theme dependency.

## Requirements

- Node.js 20.9 or newer
- npm
- [GitHub CLI](https://cli.github.com/) authenticated as the account whose PRs you want to see,
  or a `GITHUB_TOKEN`

For private organization repositories and write actions, the token normally needs repository,
organization-read, and workflow access. If the organization enforces SAML SSO, authorize the
token for that organization after logging in.

Check the active CLI account and scopes without printing the token:

```bash
gh auth status
```

## Run locally

```bash
git clone https://github.com/asadtariq96/github-dashboard.git
cd github-dashboard
npm ci
gh auth login
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The scripts bind to `127.0.0.1` by default so
the token-powered API is not reachable from the local network. The root route redirects to
`/mine`; use `/reviews` for PRs awaiting or previously receiving your review.

Run the production build locally with:

```bash
npm run build
npm start
```

## Configuration

Authentication works with either `GITHUB_TOKEN` or the token returned by `gh auth token`. Copy
the example file only when you need overrides:

```bash
cp .env.example .env.local
```

| Variable | Purpose | Default |
|---|---|---|
| `GITHUB_TOKEN` | GitHub token used by the server | Output of `gh auth token` |
| `GITHUB_SEARCH_QUERY` | Search query for **Mine** | `author:@me is:pr is:open sort:updated-desc` |
| `GITHUB_REVIEWS_SEARCH_QUERY` | Search query or `\|`-separated queries for **Reviews** | Direct requests plus PRs reviewed by you |
| `GITHUB_PAGE_SIZE` | Rich GraphQL nodes fetched per page, capped at 50 | `10` |
| `GITHUB_USER_NAME` | Commit-author name used to identify your own timeline commits | Unset |
| `GITHUB_USER_EMAIL` | Commit-author email used to identify your own timeline commits | Unset |
| `GITHUB_WEBHOOK_SECRET` | Verifies `X-Hub-Signature-256` on the optional webhook endpoint | Unset |
| `GITHUB_GRAPHQL_ENDPOINT` | GraphQL endpoint override, primarily for testing | GitHub's public endpoint |

The name and email overrides only affect unread-activity classification for raw commit events;
comments and reviews are matched using your GitHub login.

Multiple review searches are useful when you also want opt-in team queues. Separate complete
GitHub search expressions with `|`, for example:

```dotenv
GITHUB_REVIEWS_SEARCH_QUERY="is:pr is:open user-review-requested:@me | is:pr is:open team-review-requested:ORG/TEAM"
```

## How the queue works

In **Mine**:

- **Act now** contains PRs with an actionable blocker such as a pending deployment approval,
  failed queue entry, requested changes, failing checks, conflicts, unresolved threads, or an
  outdated base branch.
- **Waiting** contains open work that does not currently need intervention, including healthy
  merge-queue entries.
- **Needs you** is the detailed blocker view. It currently also includes healthy queue entries so
  their progress remains visible.
- **Snoozed** is browser-local and does not change the PR on GitHub.
- **Done recently** comes from GitHub's closed PR search, with a short optimistic fallback after
  actions taken in the app.

Repository selection composes with the active view. A repository can therefore contain one open
PR while showing zero under **Act now**. The empty state explains whether matching PRs are hidden,
snoozed, or simply outside the current view and provides the relevant recovery action.

In **Reviews**, the queue distinguishes new review requests, PRs pushed after your review, and PRs
already approved by you.

## Keyboard shortcuts

Shortcuts are disabled while focus is in an input, textarea, select, or editable region.

| Key | Action |
|---|---|
| `J` / `K` | Move to the next / previous PR |
| `Enter` | Inspect the first PR when no inspector is open |
| `1`–`5` | Switch inspector tabs |
| `G` | Open the inspected PR on GitHub |
| `S` | Snooze the inspected PR until tomorrow |
| `H` | Hide the inspected PR |
| `R` | Refresh the dashboard |
| `Esc` | Close the inspector or command palette |
| `⌘K` / `Ctrl+K` / `?` | Open the command palette |

## Local data

The server keeps GitHub results in an in-memory cache. It has no database. Theme, hidden PRs,
snoozes, inspector width, visits, and comparison snapshots are stored in browser `localStorage`.
Clearing site data resets those preferences but does not modify GitHub.

The browser polls every 30 seconds and also listens for server-sent cache updates. An optional
`POST /api/webhook` endpoint can trigger faster invalidation. Set `GITHUB_WEBHOOK_SECRET` to the
same value as the GitHub webhook secret before exposing that endpoint; signed payloads are then
verified using `X-Hub-Signature-256`. Without a secret, the endpoint is suitable only for the
default localhost setup.

## Development

```bash
npm run check       # TypeScript, lint, and formatting verification
npm run format      # Format source files
npm run build       # Production compilation
```

There is currently no automated test suite. Run `npm run check` and `npm run build` before
shipping changes, then exercise any affected GitHub mutation against a disposable PR.

Useful implementation references:

- [DESIGN.md](./DESIGN.md) documents product behavior, architecture, tokens, and motion.
- [CONTEXT.md](./CONTEXT.md) defines the domain language used in the codebase.

## Troubleshooting

### Organization PRs are missing

Run `gh auth status`, confirm the expected account is active, and verify the token can access the
organization. For SSO-protected organizations, the token must be explicitly authorized for SSO.
After changing authentication, restart the dev server and use the dashboard refresh button.

### A repository count is nonzero but the selected view is empty

Repository counts cover its visible open PRs; the selected work view is an additional filter. Use
the action in the empty state to open all PRs, view snoozed PRs, or restore hidden PRs.

### GitHub data appears stale

Use the refresh button. GitHub search is eventually consistent after close and merge operations,
so PR Desk removes successful mutations optimistically while it reconciles in the background.
