import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeGraphQL, ENABLE_AUTO_MERGE_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { prId, mergeMethod = 'SQUASH' } = await req.json();

    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    await executeGraphQL(ENABLE_AUTO_MERGE_MUTATION, {
      input: { pullRequestId: prId, mergeMethod },
    });

    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Auto-merge enabled' });
  } catch (err: any) {
    console.error('Enable auto-merge error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to enable auto-merge' },
      { status: 500 },
    );
  }
}
