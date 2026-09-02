import { NextRequest, NextResponse } from 'next/server';
import { refreshAllModes } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const event = req.headers.get('x-github-event') || 'unknown';

  try {
    const relevantEvents = [
      'pull_request',
      'pull_request_review',
      'pull_request_review_comment',
      'issue_comment',
      'check_run',
      'check_suite',
      'status',
    ];

    console.log(`[Webhook] Received GitHub event: ${event}`);

    // Trigger instant cache re-fetch asynchronously if relevant event
    if (relevantEvents.includes(event) || event === 'ping' || event === 'unknown') {
      refreshAllModes().catch((err) => {
        console.error('[Webhook] Failed to refresh state:', err);
      });
    }

    return NextResponse.json({ ok: true, event, message: 'Invalidation triggered' });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Webhook processing failed' },
      { status: 500 },
    );
  }
}
