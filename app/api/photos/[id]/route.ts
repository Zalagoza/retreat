import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const rows = await query<{ thumb_url: string; view_url: string; orig_url: string }>(
    'DELETE FROM kia_photos WHERE id = $1 RETURNING thumb_url, view_url, orig_url',
    [n]
  );
  if (rows[0]) {
    try { await del([rows[0].thumb_url, rows[0].view_url, rows[0].orig_url]); } catch { /* ignore */ }
  }
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}
