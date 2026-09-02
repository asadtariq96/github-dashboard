import { NextRequest, NextResponse } from 'next/server';
import { executeGraphQL, CONVERT_TO_DRAFT_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { prId } = await req.json();
    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    await executeGraphQL(CONVERT_TO_DRAFT_MUTATION, { input: { pullRequestId: prId } });
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'Converted back to draft' });
  } catch (err: any) {
    console.error('Convert to draft error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to convert to draft' },
      { status: 500 },
    );
  }
}
