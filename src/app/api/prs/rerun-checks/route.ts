import { NextRequest, NextResponse } from 'next/server';
import { executeRest } from '../../../../lib/github';
import { refreshAllModes } from '../../../../lib/cache';

export const dynamic = 'force-dynamic';

/** A check run's details URL carries its workflow run id: /actions/runs/<id>/job/<id>. */
function runIdsFrom(detailsUrls: string[]): number[] {
  const ids = new Set<number>();
  for (const url of detailsUrls) {
    const match = url?.match(/\/actions\/runs\/(\d+)/);
    if (match) ids.add(Number(match[1]));
  }
  return Array.from(ids);
}

export async function POST(req: NextRequest) {
  try {
    const { repo, detailsUrls } = await req.json();

    if (!repo || !Array.isArray(detailsUrls)) {
      return NextResponse.json(
        { ok: false, error: 'repo and detailsUrls are required' },
        { status: 400 },
      );
    }

    const runIds = runIdsFrom(detailsUrls);
    if (runIds.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No GitHub Actions run found. This check runs on external CI.' },
        { status: 422 },
      );
    }

    const results = await Promise.allSettled(
      runIds.map((id) =>
        executeRest(`repos/${repo}/actions/runs/${id}/rerun-failed-jobs`, { method: 'POST' }),
      ),
    );

    const failed = results.filter((r) => r.status === 'rejected');
    if (failed.length === runIds.length) {
      const reason = (failed[0] as PromiseRejectedResult).reason;
      throw new Error(reason?.message || 'Every re-run request was rejected');
    }

    await refreshAllModes();

    const started = runIds.length - failed.length;
    return NextResponse.json({
      ok: true,
      message: `Re-running failed jobs on ${started} workflow run${started === 1 ? '' : 's'}`,
    });
  } catch (err: any) {
    console.error('Re-run checks error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to re-run checks' },
      { status: 500 },
    );
  }
}
