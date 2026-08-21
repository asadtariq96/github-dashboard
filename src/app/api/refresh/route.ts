import { NextResponse } from 'next/server';
import { getDashboardState } from '../../../lib/cache';

export const dynamic = 'force-dynamic';

export async function POST() {
  const state = await getDashboardState(true);
  return NextResponse.json(state);
}
