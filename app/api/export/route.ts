import archiver from 'archiver';
import { isAdmin } from '@/lib/auth';
import { query, type Memoir } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!(await isAdmin())) return new Response('Unauthorized', { status: 401 });

  const memoirs = await query<Memoir>('SELECT * FROM memoirs ORDER BY id');
  const archive = archiver('zip', { zlib: { level: 9 } });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    archive.on('data', (c: Buffer) => chunks.push(c));
    archive.on('end', () => resolve(Buffer.concat(chunks)));
    archive.on('error', reject);
  });

  for (const m of memoirs) {
    const folder = m.id + '-' + m.title.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 40) + '/';
    archive.append(m.title + '\n\n' + m.body, { name: folder + 'memoir.txt' });
    if (m.image_url) {
      try {
        const r = await fetch(m.image_url);
        if (r.ok) {
          const ext = (m.image_url.split('?')[0].split('.').pop() || 'jpg').slice(0, 5);
          archive.append(Buffer.from(await r.arrayBuffer()), { name: folder + 'image.' + ext });
        }
      } catch { /* skip unreachable image */ }
    }
  }
  await archive.finalize();
  const zip = await done;

  return new Response(new Uint8Array(zip), {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="kia-memoirs.zip"',
    },
  });
}
