# 0005: Hybrid Webhook Invalidation via smee.io Relay with SSE Live Updates

We decided to add instant reactivity by introducing a GitHub Webhook receiver backed by an optional local webhook tunnel/relay (e.g. `smee.io` or `gh webhook forward`) and Server-Sent Events (SSE) streaming to the frontend.

## Context

A 30-second polling cadence creates latency between GitHub events (PR approvals, check runs, review comments) and dashboard visibility. While users can manually click refresh, true instant reactivity requires event-driven invalidation. For local development behind NAT/firewalls, direct GitHub webhooks cannot reach `localhost:3000` without a public proxy or tunnel.

## Decision

1. **Webhook Endpoint (`POST /api/webhook`)**:
   - Listens for GitHub event payloads (`pull_request`, `pull_request_review`, `pull_request_review_comment`, `issue_comment`, `check_run`, `check_suite`, `status`).
   - Immediately triggers `getDashboardState(true)` in the backend cache to re-fetch fresh GraphQL state.
   - Pushes an update signal to all connected SSE clients.
2. **Server-Sent Events Stream (`GET /api/events`)**:
   - The frontend connects to `/api/events` via standard `EventSource`.
   - When a webhook invalidation occurs, the server sends an event, triggering an immediate UI re-render with zero polling delay.
3. **Local Webhook Ingress (Smee / `gh webhook forward`)**:
   - Supports zero-setup local webhook delivery using Smee.io relay or GitHub CLI's native `gh webhook forward`.
4. **Resilient Hybrid Fallback**:
   - Periodic 30s background polling remains active as a heartbeat and safety net if webhooks are dropped or disconnected.

## Consequences

- Dashboard updates in <1 second upon approvals, CI status changes, and new comments.
- Zero external infrastructure requirement — works with or without webhooks (falls back gracefully to 30s polling).
