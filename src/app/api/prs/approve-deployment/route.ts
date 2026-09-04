import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../../lib/apiAuth';
import { executeRest } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  try {
    const body = await req.json();
    const {
      repoWithOwner,
      runId,
      environmentIds,
      comment = 'Approved via GitHub PR Dashboard',
    } = body;

    if (!repoWithOwner || !runId) {
      return NextResponse.json(
        { ok: false, error: 'repoWithOwner and runId are required' },
        { status: 400 },
      );
    }

    // If environmentIds wasn't passed directly, fetch them from the pending_deployments endpoint
    let targetEnvIds = environmentIds;
    if (!targetEnvIds || !Array.isArray(targetEnvIds) || targetEnvIds.length === 0) {
      const pendingDeploys = await executeRest<
        Array<{
          environment?: { id: number };
        }>
      >(`repos/${repoWithOwner}/actions/runs/${runId}/pending_deployments`);

      targetEnvIds = (pendingDeploys || [])
        .map((d) => d.environment?.id)
        .filter((id): id is number => typeof id === 'number');
    }

    if (!targetEnvIds || targetEnvIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No pending deployment environments found for this workflow run' },
        { status: 400 },
      );
    }

    // Submit the approval to GitHub REST API
    await executeRest(`repos/${repoWithOwner}/actions/runs/${runId}/pending_deployments`, {
      method: 'POST',
      body: {
        environment_ids: targetEnvIds,
        state: 'approved',
        comment,
      },
    });

    // Invalidate and refresh cache immediately
    await refreshAllModes();

    return NextResponse.json({
      ok: true,
      message: `Successfully approved deployment for ${repoWithOwner} run #${runId}`,
    });
  } catch (err: any) {
    console.error('Approve deployment error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to approve deployment' },
      { status: 500 },
    );
  }
}
