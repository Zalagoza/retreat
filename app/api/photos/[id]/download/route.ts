import { query } from '@/lib/db';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

// Logs the download, then sends the browser to the Blob CDN (?download=1 makes it a file download).
// The function finishes in milliseconds instead of streaming the whole file.
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

  await logEvent(req, 'download', [{ id: n, name: p.name }]);

  const target = new URL(p.orig_url);
  target.searchParams.set('download', '1');
  return new Response(null, {
    status: 302,
    headers: { Location: target.toString(), 'Cache-Control': 'no-store' },
  });
}
