import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeGraphQL, DEQUEUE_PR_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { prId } = await req.json();
    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    // DequeuePullRequestInput names the pull request `id`, unlike every other mutation here.
    await executeGraphQL(DEQUEUE_PR_MUTATION, { input: { id: prId } });
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Removed from the merge queue' });
  } catch (err: any) {
    console.error('Dequeue PR error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to remove from the merge queue' },
      { status: 500 },
    );
  }
}
