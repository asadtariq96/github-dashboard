import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeGraphQL, MERGE_PR_MUTATION, ENQUEUE_PR_MUTATION } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = await req.json();
    const { prId, enqueue = false, mergeMethod = 'SQUASH' } = body;

    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    if (enqueue) {
      // Add to merge queue
      try {
        await executeGraphQL(ENQUEUE_PR_MUTATION, {
          input: {
            pullRequestId: prId,
          },
        });
      } catch (enqueueErr: any) {
        // If enqueue fails (e.g. merge queue not enabled on branch), fallback to merge
        console.warn('Enqueue failed, attempting standard merge:', enqueueErr.message);
        await executeGraphQL(MERGE_PR_MUTATION, {
          input: {
            pullRequestId: prId,
            mergeMethod,
          },
        });
      }
    } else {
      // Standard direct merge
      await executeGraphQL(MERGE_PR_MUTATION, {
        input: {
          pullRequestId: prId,
          mergeMethod,
        },
      });
    }

    // Invalidate and refresh cache immediately
    await refreshAllModes();

    return NextResponse.json({ ok: true, message: 'PR merge/enqueue initiated successfully' });
  } catch (err: any) {
    console.error('Merge PR error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to merge pull request' },
      { status: 500 },
    );
  }
}
