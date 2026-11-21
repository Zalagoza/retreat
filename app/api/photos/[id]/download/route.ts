import { query } from '@/lib/db';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response('Bad id', { status: 400 });
  const rows = await query<{ name: string; orig_url: string }>(
    'SELECT name, orig_url FROM kia_photos WHERE id = $1',
    [n]
  );
  const p = rows[0];
  if (!p) return new Response('Not found', { status: 404 });

  const upstream = await fetch(p.orig_url);
  if (!upstream.ok || !upstream.body) return new Response('Unavailable', { status: 502 });

  await logEvent(req, 'download', [{ id: n, name: p.name }]);

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  const safe = p.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  headers.set(
    'Content-Disposition',
    'attachment; filename="' + safe + '"; filename*=UTF-8' + "''" + encodeURIComponent(p.name)
  );
  headers.set('Cache-Control', 'no-store');
  return new Response(upstream.body, { headers });
}
