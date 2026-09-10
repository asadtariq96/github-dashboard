'use client';

import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
  CircleCheck,
  CornerDownRight,
  ExternalLink,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import type { PullRequestAssessment, ReviewThreadItem, ThreadComment } from '../../types/pr';
import { compactAge } from '../../lib/time';
import { Avatar, CountPill } from './ui';
import {
  ICON_BUTTON,
  PANEL_EMPTY,
  PANEL_HEAD,
  PANEL_LINK,
  panelRoot,
  panelScroller,
} from './panelChrome';

async function post(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) throw new Error(json?.error || `HTTP ${res.status}`);
}

function CodeRef({ thread }: { thread: ReviewThreadItem }) {
  const lines =
    thread.startLine !== null && thread.line !== null && thread.startLine !== thread.line
      ? `Lines ${thread.startLine}–${thread.line}`
      : thread.line !== null
        ? `Line ${thread.line}`
        : null;

  return (
    <span className="min-w-0 truncate rounded-sm border border-line bg-surface-muted px-1.5 py-px font-mono text-2xs text-muted">
      <span className="font-semibold text-ink">{thread.path}</span>
      {lines && (
        <>
          <span aria-hidden className="px-1 text-faint">
            |
          </span>
          <span className="tabular">{lines}</span>
        </>
      )}
    </span>
  );
}

function ReplyBox({
  thread,
  onDone,
}: {
  thread: ReviewThreadItem;
  /** Awaited, so a spinner covers the refresh as well as the write. */
  onDone: () => Promise<void> | void;
}) {
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (body.trim() === '' || busy) return;
    setBusy(true);
    setError(null);
    try {
      await post('/api/threads/reply', { threadId: thread.id, body });
      setBody('');
      await onDone();
    } catch (err: any) {
      setError(err.message || 'Could not post the reply');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void send();
          }
        }}
        rows={2}
        placeholder="Reply to this thread"
        aria-label={`Reply to the thread on ${thread.path}`}
        className="w-full resize-y rounded-md border border-line-control bg-surface px-2 py-1.5 text-xs text-ink placeholder:text-faint focus:border-accent focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={send}
          disabled={busy || body.trim() === ''}
          className="tap-safe inline-flex items-center gap-1.5 rounded-md bg-accent-fill px-2.5 py-1.5 text-xs font-semibold text-accent-on transition-colors duration-instant ease-out hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-45"
        >
          {busy ? (
            <Loader2 aria-hidden className="h-[13px] w-[13px] animate-spin" />
          ) : (
            <CornerDownRight aria-hidden strokeWidth={2} className="h-[13px] w-[13px]" />
          )}
          Reply
        </button>
        <span className="text-2xs text-faint">&#8984;&#8629; sends</span>
        {error && <span className="text-2xs text-danger">{error}</span>}
      </div>
    </div>
  );
}

const REVIEW_STATE_LABEL: Record<string, string> = {
  APPROVED: 'approved',
  CHANGES_REQUESTED: 'requested changes',
  COMMENTED: 'reviewed',
  DISMISSED: 'dismissed review',
};

function PrCommentCard({ comment, unread }: { comment: ThreadComment; unread: boolean }) {
  const [open, setOpen] = useState(false);

  return (
    <li className="defer-row" style={{ '--row-estimate': '76px' } as React.CSSProperties}>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar name={comment.author} src={comment.authorAvatarUrl} />
          <span className="text-xs font-semibold text-ink">{comment.author}</span>
          <span className="text-2xs text-dim">
            {REVIEW_STATE_LABEL[comment.reviewState || ''] || 'commented'}{' '}
            {compactAge(comment.createdAt)}
          </span>
          <span
            aria-hidden
            className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-line-strong'}`}
          />
          <span className="sr-only">{unread ? 'Unread' : 'Read'}</span>
          <a
            href={comment.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open this comment by ${comment.author} on GitHub`}
            className={ICON_BUTTON}
          >
            <ExternalLink aria-hidden strokeWidth={2} className="h-3 w-3" />
          </a>
          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={open ? 'Collapse this comment' : 'Expand this comment'}
            className={ICON_BUTTON}
          >
            <ChevronDown
              aria-hidden
              strokeWidth={2}
              className={`h-3.5 w-3.5 transition-transform duration-fast ease-out ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        {open ? (
          <div className="md mt-2 text-xs" dangerouslySetInnerHTML={{ __html: comment.bodyHTML }} />
        ) : (
          <p className="mt-1.5 truncate text-xs text-muted">{comment.bodyText}</p>
        )}
      </div>
    </li>
  );
}

function ThreadCard({
  thread,
  unread,
  onChanged,
  defaultOpen = false,
}: {
  thread: ReviewThreadItem;
  unread: boolean;
  /** Awaited, so a spinner covers the refresh as well as the write. */
  onChanged: () => Promise<void> | void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canToggleResolve = thread.isResolved ? thread.viewerCanUnresolve : thread.viewerCanResolve;

  const toggleResolved = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await post('/api/threads/resolve', {
        threadId: thread.id,
        resolved: !thread.isResolved,
      });
      await onChanged();
    } catch (err: any) {
      setError(err.message || 'Could not change the thread');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="defer-row" style={{ '--row-estimate': '96px' } as React.CSSProperties}>
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Avatar name={thread.author} src={thread.authorAvatarUrl} />
          <span className="text-xs font-semibold text-ink">{thread.author}</span>
          {thread.createdAt && (
            <span className="text-2xs text-dim">commented {compactAge(thread.createdAt)}</span>
          )}
          {thread.isOutdated && (
            <span className="shrink-0 rounded-sm bg-surface-muted px-1 text-2xs text-dim">
              outdated
            </span>
          )}
          {thread.isResolved && (
            <span className="inline-flex shrink-0 items-center gap-1 text-2xs text-ready">
              <CircleCheck aria-hidden strokeWidth={2} className="h-3 w-3" />
              resolved
            </span>
          )}
          <span
            aria-hidden
            className={`ml-auto h-[7px] w-[7px] shrink-0 rounded-full ${unread ? 'bg-accent' : 'bg-line-strong'}`}
          />
          <span className="sr-only">{unread ? 'Unread' : 'Read'}</span>

          <button
            type="button"
            onClick={() => setOpen(!open)}
            aria-expanded={open}
            aria-label={
              open ? `Collapse the thread on ${thread.path}` : `Expand the thread on ${thread.path}`
            }
            className={ICON_BUTTON}
          >
            <ChevronDown
              aria-hidden
              strokeWidth={2}
              className={`h-3.5 w-3.5 transition-transform duration-fast ease-out ${open ? 'rotate-180' : ''}`}
            />
          </button>
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <CodeRef thread={thread} />
        </div>

        {!open && <p className="mt-1.5 truncate text-xs text-muted">{thread.bodyPreview}</p>}

        {!open && thread.replyCount > 0 && (
          <div className="mt-2 flex items-center gap-2 border-t border-dashed border-line-subtle pt-1.5">
            <span className="flex items-center">
              {thread.replies.slice(0, 3).map((reply, i) => (
                <span
                  key={reply.login}
                  className={`rounded-full ring-[1.5px] ring-surface ${i === 0 ? '' : '-ml-1'}`}
                >
                  <Avatar name={reply.login} src={reply.avatarUrl} size={16} />
                </span>
              ))}
            </span>
            <span className="truncate text-2xs text-dim">
              {thread.replyCount} {thread.replyCount === 1 ? 'reply' : 'replies'}
            </span>
          </div>
        )}

        {open && (
          <div className="mt-2.5 flex flex-col gap-2.5">
            <ul className="flex flex-col gap-2.5">
              {thread.comments.map((comment) => (
                <li
                  key={comment.id}
                  className="rounded-md border border-line bg-surface-muted/40 p-2.5"
                >
                  <div className="flex items-center gap-2">
                    <Avatar name={comment.author} src={comment.authorAvatarUrl} size={18} />
                    <span className="text-2xs font-semibold text-ink">{comment.author}</span>
                    <span className="text-2xs text-dim">{compactAge(comment.createdAt)}</span>
                    <a
                      href={comment.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`Open this comment by ${comment.author} on GitHub`}
                      className={`${ICON_BUTTON} ml-auto`}
                    >
                      <ExternalLink aria-hidden strokeWidth={2} className="h-3 w-3" />
                    </a>
                  </div>
                  <div
                    className="md mt-1.5 text-xs"
                    dangerouslySetInnerHTML={{ __html: comment.bodyHTML }}
                  />
                </li>
              ))}
            </ul>

            {thread.viewerCanReply && <ReplyBox thread={thread} onDone={onChanged} />}

            <div className="flex items-center gap-2">
              {canToggleResolve && (
                <button
                  type="button"
                  onClick={toggleResolved}
                  disabled={busy}
                  className="tap-safe inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-xs font-medium text-muted transition-colors duration-instant ease-out hover:bg-surface-muted hover:text-ink disabled:opacity-45"
                >
                  {busy ? (
                    <Loader2 aria-hidden className="h-[13px] w-[13px] animate-spin" />
                  ) : thread.isResolved ? (
                    <RotateCcw aria-hidden strokeWidth={2} className="h-[13px] w-[13px]" />
                  ) : (
                    <Check aria-hidden strokeWidth={2} className="h-[13px] w-[13px]" />
                  )}
                  {thread.isResolved ? 'Reopen thread' : 'Resolve thread'}
                </button>
              )}
              {error && <span className="text-2xs text-danger">{error}</span>}
            </div>
          </div>
        )}
      </div>
    </li>
  );
}

export function ThreadsPanel({
  pr,
  unreadSinceMs,
  onChanged,
  openFirst = false,
  fill = false,
}: {
  pr: PullRequestAssessment;
  /** Threads newer than this are marked unread. 0 marks nothing. */
  unreadSinceMs: number;
  /** Awaited, so a spinner covers the refresh as well as the write. */
  onChanged: () => Promise<void> | void;
  openFirst?: boolean;
  fill?: boolean;
}) {
  const comments = pr.prComments ?? [];
  const isUnread = (ts: string) =>
    unreadSinceMs > 0 && Boolean(ts) && new Date(ts).getTime() > unreadSinceMs;

  return (
    <section className={panelRoot(fill)}>
      <header className={PANEL_HEAD}>
        <span className="font-bold text-ink">Comments and unresolved threads</span>
        <CountPill>{comments.length + pr.unresolvedThreads.length}</CountPill>
        <a
          href={`${pr.url}/files`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${PANEL_LINK} ml-auto`}
        >
          View all threads
        </a>
      </header>

      {comments.length === 0 && pr.unresolvedThreads.length === 0 ? (
        <p className={PANEL_EMPTY}>Nobody commented, and every review thread is resolved.</p>
      ) : (
        <ul className={panelScroller(fill)}>
          {comments.map((comment) => (
            <PrCommentCard
              key={comment.id}
              comment={comment}
              unread={isUnread(comment.createdAt)}
            />
          ))}
          {pr.unresolvedThreads.map((thread, i) => (
            <ThreadCard
              key={thread.id}
              thread={thread}
              defaultOpen={openFirst && i === 0}
              unread={isUnread(thread.createdAt)}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
