import sharp from 'sharp';
import { query } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const W = 1200;
const H = 630;
const COLS = 3;
const ROWS = 2;

// Link-preview image (WhatsApp etc.): a collage of random photos, small JPEG so it always shows
export async function GET() {
  let urls: string[] = [];
  try {
    const rows = await query<{ thumb_url: string }>(
      'SELECT thumb_url FROM kia_photos ORDER BY random() LIMIT ' + COLS * ROWS
    );
    urls = rows.map((r) => r.thumb_url);
  } catch { /* fall back to plain banner */ }

  const cw = W / COLS;
  const ch = H / ROWS;
  const settled = await Promise.allSettled(
    urls.map(async (u) => {
      const res = await fetch(u, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) throw new Error('bad image');
      return sharp(Buffer.from(await res.arrayBuffer()))
        .resize(cw, ch, { fit: 'cover' })
        .jpeg({ quality: 80 })
        .toBuffer();
    })
  );
  const tiles = settled.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));

  const overlays: sharp.OverlayOptions[] = [];
  if (tiles.length) {
    for (let k = 0; k < COLS * ROWS; k++) {
      overlays.push({ input: tiles[k % tiles.length], left: (k % COLS) * cw, top: Math.floor(k / COLS) * ch });
    }
  }
  const stripe =
    '<svg width="' + W + '" height="14" xmlns="http://www.w3.org/2000/svg">' +
    '<rect width="400" height="14" fill="#C8102E"/>' +
    '<rect x="400" width="400" height="14" fill="#FFCE00"/>' +
    '<rect x="800" width="400" height="14" fill="#007A3D"/></svg>';
  overlays.push({ input: Buffer.from(stripe), left: 0, top: H - 14 });

  const out = await sharp({ create: { width: W, height: H, channels: 3, background: '#1A1A1A' } })
    .composite(overlays)
    .jpeg({ quality: 72, mozjpeg: true })
    .toBuffer();

  return new Response(new Uint8Array(out), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
