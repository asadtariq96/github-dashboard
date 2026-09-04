import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeGraphQL, CLOSE_PR_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { prId } = await req.json();
    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    await executeGraphQL(CLOSE_PR_MUTATION, { input: { pullRequestId: prId } });
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Pull request closed' });
  } catch (err: any) {
    console.error('Close PR error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to close pull request' },
      { status: 500 },
    );
  }
}
