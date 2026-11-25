# Hosting PR Desk for a team

This plan turns PR Desk from a one-person local tool into an internal web app. It runs on
Tessen, Unity's deployment platform. Many people open one URL. Nobody clones the repository.

The plan holds three parts: where we are, where we want to be, and how to get there.

## 1. Where we are

### Behaviour today

One person runs the app on their own machine. They clone the repository, install the
packages and start the dev server. The app opens at `http://localhost:3000`.

The server binds to `127.0.0.1`, so nothing on the network can reach it. There is no login.
Anyone who reaches the port acts as the token owner.

The token comes from `GITHUB_TOKEN`, or from `gh auth token` when that variable is empty.

Beta testers get repository access, clone the code and run the dev server themselves. Each
one needs Node, npm and the GitHub CLI.

### Architecture today

The app is one Next.js process with 18 API routes. All state is either in memory or in the
browser. There is no database.

| Part | File | What it does |
|---|---|---|
| Token lookup | `src/lib/config.ts` | Reads `GITHUB_TOKEN`, else runs `gh auth token` |
| GitHub client | `src/lib/github.ts` | `executeGraphQL` and `executeRest`, one token for all |
| Cache | `src/lib/cache.ts` | `Map<Mode, ModeState>` on `globalThis`, two entries |
| Events | `src/lib/events.ts` | `prEventEmitter.subscribe(mode)`, one set per mode |
| Write guard | `src/lib/apiAuth.ts` | One shared bearer token, `DASHBOARD_API_TOKEN` |

The cache holds a 25 second window for the PR list and 5 minutes for per-PR activity. It
runs six GitHub calls at a time and shares one promise between callers who ask together. It
writes a warm-start snapshot to the temp directory, one file per mode.

Three routes never use the cache. `/api/prs/files`, `/api/checks/detail` and
`/api/queue/detail` call GitHub on every request.

The browser polls every 30 seconds. It also opens an event stream at `/api/events`, which
the server wakes at the end of each sync.

`DASHBOARD_API_TOKEN` guards 11 write routes. The browser sends no such header, so setting
the variable stops every button in the app. It only suits a script.

The browser keeps ten `localStorage` keys: theme, hidden PRs, snoozes, recent completions,
visit times, status snapshots, and three panel widths.

### What blocks a shared instance

Nine things assume one person.

1. The token is process-wide. Every request acts as the same GitHub account.
2. The cache keys on the mode alone. Two people would read each other's pull requests.
3. `getViewerLogin()` at `src/lib/github.ts:564` memoises one login for the life of the
   process. The first token to arrive would decide whose activity counts as "mine" for
   everybody.
4. `GITHUB_USER_NAME` and `GITHUB_USER_EMAIL` at `src/lib/activity.ts:31` hold one person's
   identity in the server environment.
5. The event stream keys on the mode alone. One person's sync wakes everybody.
6. The warm-start snapshot holds one file per mode, not per person.
7. `DASHBOARD_API_TOKEN` is a shared secret, not a login.
8. Every route turns a GitHub auth failure into a 500. Nothing can tell an expired token
   from a broken server.
9. `src/lib/cache.ts:132` and `src/lib/events.ts:39` pin their singletons to `globalThis`
   only outside production. A production build could hold two of each.

## 2. Where we want to be

### Behaviour we want

Someone opens one internal URL. Google sign-in and the VPN let them in. They make no
account.

On first use the app asks for a GitHub token and explains how to make one. The token goes
straight into a cookie the page cannot read. They paste it once.

From then on the app behaves as it does today, but only for them. They see their own pull
requests. Every action runs as their own GitHub account.

There is no clone, no install and no dev server.

### Architecture we want

See `HOSTING-architecture.html` for the diagram. In words:

- Tessen's ingress sits in front. It gives Google sign-in and VPN-only access.
- The app runs as one container on Tessen's shared GKE clusters.
- The browser holds the GitHub token in an `HttpOnly` cookie, which every request carries.
- The server keeps the token for the length of one request and never writes it down.
- The cache keys on the token and the mode.
- The browser polls every 30 seconds. There is no event stream.
- Diffs, check details and queue details stay uncached, as they are today.

The server holds no credential at rest. A stolen disk gives up nothing. There is no
credential store to build and no breach to explain.

### The gap

| Concern | Today | Wanted |
|---|---|---|
| Who can reach it | Nobody but the operator | Any Unity employee on the VPN |
| Sign-in | None | Google, at the ingress |
| GitHub token | Environment or `gh` CLI | An `HttpOnly` cookie in the caller's browser |
| Token at rest | On the operator's machine | Nowhere on the server |
| Cache key | Mode | Token and mode |
| Viewer login | One memo for the process | One memo for each caller |
| Freshness | Poll, plus an event stream | Poll only |
| Write guard | One shared bearer | The caller's own token |
| Auth failure | HTTP 500 | HTTP 401 or 403, with a code |
| Install | Clone and `npm run dev` | Open a URL |

## 3. How to get there

Seven stages. Stages 0, 1, 2 and 5 form a chain, in that order. Stages 3 and 4 fit anywhere
after stage 1, but both must land before stage 5. See `HOSTING-build-order.html` for the
same order as a diagram.

Every stage leaves the app working. Local runs keep the environment-token fallback, so
behaviour on your own machine never changes until you choose to paste a token.

### Stage 0. Close the script hole

`src/components/pr-card/ChecksPanel.tsx:88` writes `detail.summary` into
`dangerouslySetInnerHTML`. GitHub does not sanitise that field. Whoever authors a check run
writes it.

Anyone who can run a check on a repository you view can put script on your page. That
script can drive every write route from the victim's own session.

Render the summary as text, or run it through a markdown renderer that escapes HTML. The
two `bodyHTML` uses are safe, because GitHub sanitises those. These three are the only
places the app writes raw HTML, apart from the static theme script in `layout.tsx`.

This is a live bug today. Fix it first, and fix it whatever else you decide.

Size: small.

### Stage 1. Give each request its own identity

Add `POST /api/session`. It takes a token, checks it with the viewer query, and sets the
cookie. It returns the login, so the app can say who is signed in. `DELETE /api/session`
clears the cookie.

Cookie shape:

| Attribute | Value | Why |
|---|---|---|
| Name | `__Host-gh_token` | The prefix stops a sibling subdomain planting a cookie |
| `HttpOnly` | yes | Script on the page cannot read the token |
| `Secure` | yes | Required by the `__Host-` prefix |
| `SameSite` | `Strict` | Blocks every cross-site request, so no CSRF token is needed |
| `Path` | `/` | Required by the `__Host-` prefix |
| `Max-Age` | 30 to 90 days | A session cookie would force a paste on every restart |

`SameSite` is the real guard against forged requests. The ingress is not. A victim's browser
carries their Google session on a forged request, so sign-in proves nothing there. All 11
write routes are POST, and `Strict` blocks a cross-site POST outright.

Add `src/lib/requestContext.ts`, holding an `AsyncLocalStorage` store with the token and the
caller key. The caller key is the SHA-256 of the cookie value, cut to 16 characters, worked
out on each request. It is a few microseconds of work and needs no memo. A second cookie
holding the key would drift out of step when someone pastes a new token.

Wrap each route handler in a `withCaller` helper. It reads the cookie and runs the handler
inside the store.

Change `getGitHubToken()` in `src/lib/config.ts` to read the store first. Keep the
environment fallback, but only when `NODE_ENV === 'development'` or `ALLOW_ENV_TOKEN` is
set. Without that guard, one stray variable on the pod would make every request act as one
shared account.

`executeGraphQL` and `executeRest` need no change. They already call `getGitHubToken()`, and
`AsyncLocalStorage` reaches them without a new argument. All 18 routes run on Node, so the
store propagates through every path.

Three more changes belong in this pass, because they touch the same files.

**Typed errors.** `executeGraphQL` and `executeRest` are the only code that sees GitHub's
status and its `errors` array, so they classify the failure. Throw `GitHubAuthError` on a
401. Throw `GitHubForbiddenError` on a 403, and on a GraphQL 200 whose errors name
`INSUFFICIENT_SCOPES`, `FORBIDDEN`, or SAML.

Every route already catches and answers 500, so the wrapper alone cannot translate. Replace
each catch's 500 line with one shared `errorResponse(err)`. Keep the existing
`isUnknownNode` 404s.

| Class | Status | Body code | Cookie | What the app shows |
|---|---|---|---|---|
| `GitHubAuthError` | 401 | `github_auth` | Deleted | The paste screen, saying the token expired |
| `GitHubForbiddenError` | 403 | `github_forbidden` | Kept | GitHub's message, where the action failed |

Deleting the cookie on a 403 would sign people out over one repository they cannot see.
Those failures are per resource, so the token stays.

**The viewer memo.** Delete the module variable at `src/lib/github.ts:564`. Hold the login
on the caller entry that stage 2 creates, so the memo cannot outlive its caller.

**The singletons.** Make the `globalThis` assignment at `src/lib/cache.ts:132`
unconditional. A forked cache in production is a silent bug, and one line removes the risk.

Files: `src/lib/requestContext.ts` and `src/app/api/session/route.ts` (both new),
`src/lib/config.ts`, `src/lib/github.ts`, `src/lib/cache.ts`, and 18 route files.

Size: large. It is the heart of the work.

### Stage 2. One cache for each person

Change the state map in `src/lib/cache.ts` to this shape:

```
Map<callerKey, {
  modes: Map<Mode, ModeState>,
  viewerLogin?: Promise<string>,
  lastTouched: number,
}>
```

One sweep then bounds both the cache and the login memo.

- `stateFor(mode)` takes the caller from the request store.
- `refreshAllModes` and `getLastCheckedAge` do the same.
- Drop the disk snapshot in the hosted build. It holds one file per mode, and it would put
  other people's pull-request data on pod disk.
- Remove any caller untouched for an hour. Without this the map grows for every person who
  ever signs in, and the pod dies.
- Use the caller key `local` when no cookie arrives, so local runs behave as they do now.

Keep the token as the cache key. Do not key on the GitHub login. Two fine-grained tokens for
one account can carry different repository scopes, so one shared entry would serve one
token's view to the other. That is the same leak this plan forbids in section 6. The cache
holds a token's view of GitHub, so the token is the honest key.

Losing a cache entry when a token rotates costs one sync. The window is 25 seconds, so the
cost is nothing.

Size: medium.

### Stage 3. Delete the event stream

The stream cannot earn its keep here. `prEventEmitter.emit` has one call site,
`src/lib/cache.ts:403`, at the end of a sync. A sync only starts from a request. With the
cache keyed per caller, every wake-up is caused by the same person who is already holding
the fresh response.

The only gain left is that person's second tab, which would see a write at once instead of
within 30 seconds. That poll is a cache hit anyway. It does not pay for a per-caller
subscription registry or for ingress timeout work.

Delete `src/app/api/events/route.ts`, `src/lib/events.ts`, the emit at `src/lib/cache.ts:403`,
and the stream in `src/components/DashboardView.tsx:304-313`. The 30 second poll stays.

Settle the webhook in the same stage. GitHub delivers from its own servers, with no VPN and
no Google session, so it probably cannot reach the ingress at all. Ask in `#devs-tessen`
first.

- If GitHub can reach a public signed path, keep `/api/webhook`, add repository parsing, and
  bring the stream back with it. The two only make sense together.
- If it cannot, leave the route for local use. On the pod it has no token and already fails
  into its own catch.

Size: small. It removes more code than it adds.

### Stage 4. Ask for the token

Add a first-run screen. It explains what the token needs, links to GitHub's fine-grained
token page, and posts what the user pastes to `/api/session`.

Add a shared `checkAuth(res)` and call it wherever the app fetches its own API. On
`github_auth`, show the paste screen again. The seven places are:

- `src/components/DashboardView.tsx:282` and `:383`
- `src/lib/prApi.ts:78`
- `src/components/pr-card/MergeQueuePanel.tsx:191`
- `src/components/pr-card/ThreadsPanel.tsx:26`
- `src/components/pr-card/DiffPanel.tsx:136`
- `src/components/pr-card/ChecksPanel.tsx:184`

The cookie travels on its own, so no fetch wrapper is needed and no call site changes how it
sends a request.

Delete `src/lib/apiAuth.ts` and `DASHBOARD_API_TOKEN`. The caller's own token now decides
what each write may do.

Size: medium, and most of it is the screen.

### Stage 5. Deploy to Tessen

Install the CLI and set the project up:

```bash
curl -fsSL https://tessen.unity.com/install.sh | sh
tessen auth login
tessen init
```

Then:

- Set `output: 'standalone'` in `next.config.ts`, so the image stays small.
- Write a Dockerfile on top of that output.
- Keep the `tessen.*` labels in `docker-compose.yml` that `tessen init` scaffolds.
- Leave `ALLOW_ENV_TOKEN` unset, and set no `GITHUB_TOKEN`.
- Add `GITHUB_WEBHOOK_SECRET` to the namespace secrets only if the webhook survived stage 3.
- Run one replica. The cache lives in memory, so a second replica holds a second copy.
- Add a health route for the probes, request logging, and a count of cached callers.
- Check it on the test cluster first: `tessen -k test deployment up`.

This stage must not ship before stage 2. Two cookies against a mode-keyed cache would let
two people read each other's pull requests.

`tessen configure claude` installs Tessen's own skills, which include a
`/tessen-onboarding` command.

Size: medium, and mostly configuration.

### Stage 6. Housekeeping

- Drop `GITHUB_USER_NAME` and `GITHUB_USER_EMAIL` from the hosted build, or move that
  identity into the browser. They mark the operator's commits as yours for every user.
- Prune `gh_dashboard_visited_prs` and `gh_dashboard_pr_snapshots`. Drop entries older than
  90 days. Both maps only grow today.
- Update `README.md`, `DESIGN.md` and `CONTEXT.md`.

Size: small.

## 4. Decisions already taken

**A container, not a static export.** A static export would mean deleting every API route
and moving each GitHub call into the browser. The container keeps the server cache and the
whole `src/app/api` tree.

**The token lives in the browser, in a cookie the page cannot read.** We store no
credential, so we need no encryption at rest and no answer for a breach. A cookie beats
`localStorage`, because script on the page cannot carry the token away and use it later.
The cost is a small session route.

**The cache keys on the token, not the login.** Two tokens for one account can see different
repositories, so only the token describes what an entry holds.

**No event stream, for now.** Nothing but the caller's own request can wake it, and the
caller already has the answer. It comes back if the webhook gets a public path.

**No database.** Every durable fact belongs to GitHub or to the browser. The server keeps a
cache and nothing else.

**A token, not a GitHub App.** An App would remove the paste step, but it needs a client
secret, a token store and per-organisation approval. Revisit it when the beta ends.

## 5. Open questions

- Can GitHub deliver a webhook through the ingress? Ask in `#devs-tessen`. The answer
  decides half of stage 3.
- Does Unity's organisation policy allow fine-grained tokens? If not, the instructions must
  name a classic token with SAML authorisation instead.
- Do fine-grained tokens work for the merge-queue mutations and for approving a deployment?
  Test one token end to end before writing the first-run copy.
- One replica, or two? A second replica now only costs a duplicate cache, so session
  affinity is a nicety rather than a need.
- What are the smallest scopes that still work? Writes need more than reads.

## 6. What this plan does not do

- No hosted token store, and no server-side OAuth.
- No background poller. The browser polls, and nothing else drives a sync.
- No shared cache between people. It cannot work. Fields such as `viewerCanUpdateBranch`
  and `viewerCanReply` differ for every viewer.
- No static export, and no desktop build.
