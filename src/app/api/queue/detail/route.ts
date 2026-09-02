import { NextRequest, NextResponse } from 'next/server';
import { executeGraphQL, isUnknownNode, QUEUE_DETAIL_QUERY } from '../../../../lib/github';
import type { CheckRunItem, MergeQueueDetail } from '../../../../types/pr';

export const dynamic = 'force-dynamic';

type RawContext =
  | {
      __typename: 'CheckRun';
      id: string;
      name: string;
      status: string;
      conclusion: string | null;
      detailsUrl: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
    }
  | {
      __typename: 'StatusContext';
      id: string;
      context: string;
      state: string;
      targetUrl: string | null;
      createdAt?: string | null;
    };

interface RawEntry {
  id: string;
  state: string;
  position: number | null;
  enqueuedAt: string | null;
  estimatedTimeToMerge: number | null;
  solo: boolean | null;
  jump: boolean | null;
  enqueuer?: { login: string } | null;
  mergeQueue?: {
    url?: string | null;
    configuration?: MergeQueueDetail['configuration'];
  } | null;
  headCommit?: {
    oid: string;
    statusCheckRollup?: {
      state: string;
      contexts?: { totalCount: number; nodes: RawContext[] };
    } | null;
  } | null;
}

function toCheck(c: RawContext): CheckRunItem {
  if (c.__typename === 'CheckRun') {
    return {
      id: c.id,
      name: c.name,
      status: c.status,
      conclusion: c.conclusion,
      detailsUrl: c.detailsUrl,
      startedAt: c.startedAt || undefined,
      completedAt: c.completedAt || undefined,
    };
  }
  const done = c.state !== 'PENDING';
  return {
    id: c.id,
    name: c.context,
    status: done ? 'COMPLETED' : 'IN_PROGRESS',
    conclusion:
      c.state === 'SUCCESS'
        ? 'SUCCESS'
        : c.state === 'FAILURE' || c.state === 'ERROR'
          ? 'FAILURE'
          : null,
    detailsUrl: c.targetUrl,
    startedAt: c.createdAt || undefined,
    completedAt: done ? c.createdAt || undefined : undefined,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { prId } = await req.json();
    if (!prId) {
      return NextResponse.json({ ok: false, error: 'prId is required' }, { status: 400 });
    }

    const data = await executeGraphQL<{ node: { mergeQueueEntry: RawEntry | null } | null }>(
      QUEUE_DETAIL_QUERY,
      { id: prId },
    );

    const entry = data?.node?.mergeQueueEntry;
    if (!entry) {
      return NextResponse.json(
        { ok: false, error: 'This pull request is no longer in the merge queue' },
        { status: 404 },
      );
    }

    const rollup = entry.headCommit?.statusCheckRollup;
    const detail: MergeQueueDetail = {
      state: entry.state,
      position: entry.position,
      enqueuedAt: entry.enqueuedAt,
      estimatedTimeToMerge: entry.estimatedTimeToMerge,
      solo: Boolean(entry.solo),
      jump: Boolean(entry.jump),
      enqueuer: entry.enqueuer?.login ?? null,
      url: entry.mergeQueue?.url ?? null,
      configuration: entry.mergeQueue?.configuration ?? null,
      headSha: entry.headCommit?.oid ?? null,
      rollupState: rollup?.state ?? null,
      checkTotal: rollup?.contexts?.totalCount ?? 0,
      checks: (rollup?.contexts?.nodes || []).map(toCheck),
    };

    return NextResponse.json({ ok: true, detail });
  } catch (err: any) {
    if (isUnknownNode(err)) {
      return NextResponse.json(
        { ok: false, error: 'This pull request is no longer in the merge queue' },
        { status: 404 },
      );
    }
    console.error('Queue detail error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to load the merge queue entry' },
      { status: 500 },
    );
  }
}
