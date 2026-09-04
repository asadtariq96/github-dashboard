import { NextRequest, NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '../../../lib/apiAuth';
import { getDashboardState } from '../../../lib/cache';
import { isMode } from '../../../lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) return unauthorized();
  const raw = req.nextUrl.searchParams.get('mode');
  const mode = isMode(raw) ? raw : 'mine';
  const state = await getDashboardState(mode, true);
  return NextResponse.json({ ...state, mode });
}
