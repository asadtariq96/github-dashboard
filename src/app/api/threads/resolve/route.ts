import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import {
  executeGraphQL,
  RESOLVE_THREAD_MUTATION,
  UNRESOLVE_THREAD_MUTATION,
} from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const { threadId, resolved = true } = await req.json();
    if (!threadId) {
      return NextResponse.json({ ok: false, error: 'threadId is required' }, { status: 400 });
    }

    await executeGraphQL(resolved ? RESOLVE_THREAD_MUTATION : UNRESOLVE_THREAD_MUTATION, {
      input: { threadId },
    });
    await refreshAllModes();

    return NextResponse.json({
      ok: true,
      message: resolved ? 'Thread resolved' : 'Thread reopened',
    });
  } catch (err: any) {
    console.error('Resolve thread error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to change the thread' },
      { status: 500 },
    );
  }
}
