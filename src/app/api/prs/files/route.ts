import { NextRequest, NextResponse } from 'next/server';
import { executeRest } from '../../../../lib/github';

export const dynamic = 'force-dynamic';

interface GitHubFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch?: string;
}

const PATCH_MAX_LINES = 200;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { repo, number } = body;
    if (!repo || !number) {
      return NextResponse.json(
        { ok: false, error: 'repo and number are required' },
        { status: 400 },
      );
    }
    const files = await executeRest<GitHubFile[]>(
      `repos/${repo}/pulls/${number}/files?per_page=100`,
    );
    const trimmed = (Array.isArray(files) ? files : []).map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      patch: (f.patch || '').split('\n').slice(0, PATCH_MAX_LINES).join('\n'),
      truncated: (f.patch || '').split('\n').length > PATCH_MAX_LINES,
    }));
    return NextResponse.json({ ok: true, files: trimmed });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || 'Failed to fetch PR files' },
      { status: 500 },
    );
  }
}
