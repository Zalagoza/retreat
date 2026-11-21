import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });

  const rows = await query<{ image_url: string | null }>(
    'DELETE FROM memoirs WHERE id = $1 RETURNING image_url',
    [n]
  );
  if (rows[0]?.image_url) {
    try { await del(rows[0].image_url); } catch { /* ignore blob cleanup errors */ }
  }
  return NextResponse.json({ ok: true });
}
