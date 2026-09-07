import { NextRequest, NextResponse } from 'next/server';
import { CHECK_DETAIL_QUERY, executeGraphQL, isUnknownNode } from '../../../../lib/github';
import { getGitHubToken } from '../../../../lib/config';
import type { CheckDetail } from '../../../../types/pr';

export const dynamic = 'force-dynamic';

const LOG_TAIL_LINES = 200;

interface RawCheckDetail {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  detailsUrl: string | null;
  permalink: string | null;
  title: string | null;
  summary: string | null;
  text: string | null;
  steps?: {
    nodes: Array<{
      number: number;
      name: string;
      status: string;
      conclusion: string | null;
      startedAt?: string | null;
      completedAt?: string | null;
      secondsToCompletion?: number | null;
    }>;
  };
  annotations?: {
    nodes: Array<{
      annotationLevel: string | null;
      message: string;
      title: string | null;
      path: string;
      rawDetails: string | null;
      blobUrl: string | null;
      location?: { start?: { line?: number | null }; end?: { line?: number | null } } | null;
    }>;
  };
}

/** `.../actions/runs/<run>/job/<job>` is the only shape whose log we can read. */
function jobIdFrom(detailsUrl: string | null): string | null {
  const match = /\/job\/(\d+)/.exec(detailsUrl || '');
  return match ? match[1] : null;
}

function repoFrom(detailsUrl: string | null): string | null {
  const match = /github\.com\/([^/]+\/[^/]+)\//.exec(detailsUrl || '');
  return match ? match[1] : null;
}

async function fetchLogTail(
  detailsUrl: string | null,
): Promise<{ logTail?: string; logError?: string }> {
  const jobId = jobIdFrom(detailsUrl);
  const repo = repoFrom(detailsUrl);
  if (!jobId || !repo) return { logError: 'This check does not publish a readable job log.' };

  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/jobs/${jobId}/logs`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${await getGitHubToken()}`,
        'User-Agent': 'GitHub-Dashboard-App',
      },
      redirect: 'follow',
    });

    if (!res.ok) return { logError: `GitHub returned ${res.status} for this log.` };

    const text = await res.text();
    const lines = text.split('\n');
    return { logTail: lines.slice(-LOG_TAIL_LINES).join('\n').trim() };
  } catch (err: any) {
    return { logError: err.message || 'Could not read the log.' };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { checkId, withLog = false } = await req.json();
    if (!checkId) {
      return NextResponse.json({ ok: false, error: 'checkId is required' }, { status: 400 });
    }

    const data = await executeGraphQL<{ node: RawCheckDetail | null }>(CHECK_DETAIL_QUERY, {
      id: checkId,
    });
    const node = data?.node;
    if (!node) {
      return NextResponse.json(
        { ok: false, error: 'That check no longer exists' },
        { status: 404 },
      );
    }

    const detail: CheckDetail = {
      id: node.id,
      name: node.name,
      status: node.status,
      conclusion: node.conclusion,
      startedAt: node.startedAt || undefined,
      completedAt: node.completedAt || undefined,
      detailsUrl: node.detailsUrl,
      permalink: node.permalink,
      title: node.title,
      summary: node.summary,
      text: node.text,
      steps: (node.steps?.nodes || []).map((s) => ({
        number: s.number,
        name: s.name,
        status: s.status,
        conclusion: s.conclusion,
        startedAt: s.startedAt || undefined,
        completedAt: s.completedAt || undefined,
        secondsToCompletion: s.secondsToCompletion,
      })),
      annotations: (node.annotations?.nodes || []).map((a) => ({
        annotationLevel:
          (a.annotationLevel as CheckDetail['annotations'][number]['annotationLevel']) ?? null,
        message: a.message,
        title: a.title,
        path: a.path,
        rawDetails: a.rawDetails,
        blobUrl: a.blobUrl,
        startLine: a.location?.start?.line ?? null,
        endLine: a.location?.end?.line ?? null,
      })),
    };

    if (withLog) Object.assign(detail, await fetchLogTail(node.detailsUrl));

    return NextResponse.json({ ok: true, detail });
  } catch (err: any) {
    if (isUnknownNode(err)) {
      return NextResponse.json(
        { ok: false, error: 'That check no longer exists' },
        { status: 404 },
      );
    }
    console.error('Check detail error:', err);
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to load the check' },
      { status: 500 },
    );
  }
}
