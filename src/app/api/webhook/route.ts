import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { refreshAllModes } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

async function hasValidSignature(req: NextRequest, secret: string): Promise<boolean> {
  const supplied = req.headers.get('x-hub-signature-256') || '';
  const expected = `sha256=${createHmac('sha256', secret)
    .update(await req.text())
    .digest('hex')}`;
  if (supplied.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event') || 'unknown';

  try {
    const secret = process.env.GITHUB_WEBHOOK_SECRET?.trim();
    if (secret && !(await hasValidSignature(req, secret))) {
      return NextResponse.json({ ok: false, error: 'Invalid webhook signature' }, { status: 401 });
    }

    const relevantEvents = [
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'issue_comment',
      'check_run',
      'check_suite',
      'status',
    ];

    const shouldInvalidate = relevantEvents.includes(event) || event === 'unknown';
    if (shouldInvalidate) {
      refreshAllModes().catch((err) => {
        console.error('[Webhook] Failed to refresh state:', err);
      });
    }

    return NextResponse.json({
      ok: true,
      event,
      message: shouldInvalidate ? 'Invalidation triggered' : 'Event ignored',
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
