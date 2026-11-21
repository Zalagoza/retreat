import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth';
import { query, type Photo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const offset = Math.max(0, Number(u.searchParams.get('offset')) || 0);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 48));
  const photos = await query<Photo>(
    'SELECT id, name, thumb_url, view_url FROM kia_photos ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return NextResponse.json({ photos }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}

function blobUrl(v: unknown): string | null {
  try {
    const u = new URL(String(v));
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const thumb = blobUrl(b?.thumb_url);
  const view = blobUrl(b?.view_url);
  const orig = blobUrl(b?.orig_url);
  const name = String(b?.name || '').slice(0, 200);
  if (!thumb || !view || !orig || !name) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const size = Math.min(2147483647, Math.max(0, Number(b?.size) || 0));
  const rows = await query<{ id: number }>(
    'INSERT INTO kia_photos (name, thumb_url, view_url, orig_url, size) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [name, thumb, view, orig, size]
  );
  revalidatePath('/');
  return NextResponse.json({ id: rows[0].id });
}
