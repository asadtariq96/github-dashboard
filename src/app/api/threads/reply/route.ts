import { NextRequest, NextResponse } from 'next/server';
import { executeGraphQL, REPLY_TO_THREAD_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { threadId, body } = await req.json();
    if (!threadId) {
      return NextResponse.json({ ok: false, error: 'threadId is required' }, { status: 400 });
    }
    if (typeof body !== 'string' || body.trim() === '') {
      return NextResponse.json({ ok: false, error: 'A reply cannot be empty' }, { status: 400 });
    }

    await executeGraphQL(REPLY_TO_THREAD_MUTATION, {
      input: { pullRequestReviewThreadId: threadId, body: body.trim() },
    });
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Reply posted' });
  } catch (err: any) {
    console.error('Reply to thread error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to post the reply' },
      { status: 500 },
    );
  }
}
