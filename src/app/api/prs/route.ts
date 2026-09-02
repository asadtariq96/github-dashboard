import { NextRequest, NextResponse } from 'next/server';
import { getDashboardState, getLastCheckedAge } from '../../../lib/cache';
import { isMode, MODES } from '../../../lib/config';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('mode');
  const mode = isMode(raw) ? raw : 'mine';
  const state = await getDashboardState(mode, false);

  const otherAges: Record<string, number | null> = {};
  for (const m of MODES) {
    if (m !== mode) otherAges[m] = getLastCheckedAge(m);
  }

  return NextResponse.json({ ...state, mode, otherAges });
}
