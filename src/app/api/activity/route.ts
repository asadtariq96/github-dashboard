import { NextRequest, NextResponse } from 'next/server';
import { getActivityFor } from '../../../lib/cache';
import { isMode } from '../../../lib/config';

export const dynamic = 'force-dynamic';

/** Cap on one request, so a wide view cannot ask for hundreds of timelines at once. */
const MAX_KEYS = 40;

export async function POST(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('mode');
  const mode = isMode(raw) ? raw : 'mine';

  let keys: string[] = [];
  try {
    const body = await req.json();
    if (Array.isArray(body?.keys)) {
      keys = body.keys.filter((k: unknown) => typeof k === 'string').slice(0, MAX_KEYS);
    }
  } catch {
    return NextResponse.json({ error: 'Expected a JSON body with a keys array' }, { status: 400 });
  }

  if (keys.length === 0) return NextResponse.json({ activity: {} });

  try {
    const activity = await getActivityFor(mode, keys);
    return NextResponse.json({ activity });
  } catch (err: any) {
    console.error('activity route failed:', err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}
