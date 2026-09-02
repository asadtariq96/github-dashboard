import { executeRest } from './github';
import { ActivityItem, PrActivityInfo } from '../types/pr';

const TIMELINE_ACCEPT = 'application/vnd.github.mockingbird-preview+json';
const MAX_PAGES = 3;
const MAX_ITEMS = 30;

interface TimelineEvent {
  event?: string;
  created_at?: string | null;
  submitted_at?: string | null;
  html_url?: string | null;
  body?: string | null;
  state?: string | null;
  user?: { login?: string } | null;
  author?: { name?: string | null; email?: string | null; date?: string | null } | null;
}

interface Act {
  ts: string;
  login: string;
  kind: 'comment' | 'review' | 'commit';
  url: string;
  text: string;
  state: string;
  isMe: boolean;
}

function myCommitIdentity(): { name: string; email: string } {
  return {
    name: process.env.GITHUB_USER_NAME || 'Asad Tariq',
    email: (process.env.GITHUB_USER_EMAIL || 'asad.tariq@unity3d.com').toLowerCase(),
  };
}

/**
 * Fetch the issue timeline for a PR and compute "new activity by others
 * since the viewer's own last activity" (last comment/review/commit).
 */
export async function fetchPrActivity(
  repo: string,
  number: number,
  meLogin: string,
): Promise<PrActivityInfo> {
  const me = myCommitIdentity();
  const acts: Act[] = [];

  for (let page = 1; page <= MAX_PAGES; page++) {
    const events = await executeRest<TimelineEvent[]>(
      `repos/${repo}/issues/${number}/timeline?per_page=100&page=${page}`,
      { headers: { Accept: TIMELINE_ACCEPT } },
    );
    if (!events || events.length === 0) break;

    let foundMine = false;
    for (const e of events) {
      const ev = e.event;
      if (ev === 'commented') {
        const login = e.user?.login || '';
        if (!e.created_at) continue;
        acts.push({
          ts: e.created_at,
          login,
          kind: 'comment',
          url: e.html_url || '',
          text: (e.body || '').trim(),
          state: '',
          isMe: login === meLogin,
        });
      } else if (ev === 'reviewed') {
        const login = e.user?.login || '';
        if (!e.submitted_at) continue;
        acts.push({
          ts: e.submitted_at,
          login,
          kind: 'review',
          url: e.html_url || '',
          text: (e.body || '').trim(),
          state: (e.state || '').toLowerCase(),
          isMe: login === meLogin,
        });
      } else if (ev === 'committed') {
        const au = e.author;
        if (!au?.date) continue;
        const name = au.name || '';
        const email = (au.email || '').toLowerCase();
        acts.push({
          ts: au.date,
          login: name,
          kind: 'commit',
          url: e.html_url || '',
          text: (e.body || '').trim(),
          state: '',
          isMe: name === me.name || email === me.email,
        });
      }
      if (e.user?.login === meLogin || auCheck(e, me)) foundMine = true;
    }
    // Stop early once we've found the viewer's own activity (older pages can only
    // contain older events; we still need events back to their last activity).
    if (foundMine) break;
  }

  const sorted = acts.filter((a) => a.ts).sort((a, b) => (a.ts < b.ts ? -1 : 1));
  if (sorted.length === 0) {
    return { since: new Date().toISOString(), items: [] };
  }

  const mine = sorted.filter((a) => a.isMe);
  const since = mine.length > 0 ? mine[mine.length - 1].ts : sorted[sorted.length - 1].ts;

  const items: ActivityItem[] = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const a = sorted[i];
    if (a.isMe || a.ts <= since) continue;
    items.push({
      type: a.kind,
      author: a.login,
      ts: a.ts,
      url: a.url,
      text: a.text.slice(0, 200),
      state: a.state,
      bot: a.login.endsWith('[bot]'),
    });
    if (items.length >= MAX_ITEMS) break;
  }

  return { since, items };
}

function auCheck(e: TimelineEvent, me: { name: string; email: string }): boolean {
  const au = e.author;
  return !!au && (au.name === me.name || (au.email || '').toLowerCase() === me.email);
}
