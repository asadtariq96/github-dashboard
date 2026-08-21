import { NextResponse } from 'next/server';
import { getDashboardState } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await getDashboardState(false);
  return NextResponse.json(state);
}
