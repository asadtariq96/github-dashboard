import { NextRequest, NextResponse } from 'next/server';

export function getApiToken(): string | null {
  const raw = process.env.DASHBOARD_API_TOKEN;
  if (raw && raw.trim() !== '') return raw.trim();
  return null;
}

export function isAuthorized(req: NextRequest): boolean {
  const expected = getApiToken();
  if (!expected) return true;
  const header = req.headers.get('authorization') || '';
  return header === `Bearer ${expected}`;
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
}
