import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { logEvent } from '@/lib/log';

export async function POST(req: Request) {
  if (!(await isAdmin())) await logEvent(req, 'visit');
  return NextResponse.json({ ok: true });
}
