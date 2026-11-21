import archiver from 'archiver';
import { Readable } from 'stream';
import { query } from '@/lib/db';
import { logEvent } from '@/lib/log';
import { MAX_ZIP_PHOTOS } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get('ids') || '';
  const ids = Array.from(new Set(raw.split(',').map(Number).filter((x) => Number.isInteger(x) && x > 0))).slice(0, MAX_ZIP_PHOTOS);
  if (!ids.length) return new Response('No photos selected', { status: 400 });

  const rows = await query<{ id: number; name: string; orig_url: string }>(
    'SELECT id, name, orig_url FROM kia_photos WHERE id IN (' + ids.map((_, i) => '$' + (i + 1)).join(',') + ') ORDER BY id',
    ids
  );
  if (!rows.length) return new Response('Not found', { status: 404 });

  await logEvent(req, 'download', rows);

  // Streamed + uncompressed (JPEGs don't compress): low memory, starts downloading immediately
  const archive = archiver('zip', { store: true });
  (async () => {
    const used = new Set<string>();
    for (const r of rows) {
      try {
        const res = await fetch(r.orig_url);
        if (!res.ok || !res.body) continue;
        let name = r.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        if (used.has(name)) name = r.id + '-' + name;
        used.add(name);
        archive.append(Readable.fromWeb(res.body as never), { name });
        await new Promise<void>((ok, bad) => {
          archive.once('entry', () => ok());
          archive.once('error', bad);
        });
      } catch { /* skip unreachable photo */ }
    }
    await archive.finalize();
  })().catch(() => archive.abort());

  return new Response(Readable.toWeb(archive) as unknown as ReadableStream, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="kia-photos.zip"',
      'Cache-Control': 'no-store',
    },
  });
}
