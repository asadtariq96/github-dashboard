import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeGraphQL, MARK_READY_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { prId } = await req.json();
    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    await executeGraphQL(MARK_READY_MUTATION, { input: { pullRequestId: prId } });
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Marked ready for review' });
  } catch (err: any) {
    console.error('Mark ready error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to mark ready for review' },
      { status: 500 },
    );
  }
}
