import { NextRequest, NextResponse } from 'next/server';
import { executeGraphQL, UPDATE_BRANCH_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { prId } = body;

    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    await executeGraphQL(UPDATE_BRANCH_MUTATION, {
      input: {
        pullRequestId: prId,
      },
    });

    // Invalidate and refresh cache immediately
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Branch update requested successfully' });
  } catch (err: any) {
    console.error('Update branch error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to update branch' },
      { status: 500 },
    );
  }
}
