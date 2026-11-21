import { preconnect } from 'react-dom';
import { query, type Photo } from '@/lib/db';
import Gallery from '@/components/Gallery';

// Cached for 60s (and refreshed instantly after upload/delete) so phones get fast HTML
export const revalidate = 60;

export default async function Home() {
  const photos = await query<Photo>(
    'SELECT id, name, thumb_url, view_url FROM kia_photos ORDER BY created_at DESC, id DESC LIMIT 48'
  );
  const c = await query<{ n: string }>('SELECT count(*) AS n FROM kia_photos');
  if (photos[0]) {
    try { preconnect(new URL(photos[0].thumb_url).origin); } catch { /* ignore */ }
  }
  return <Gallery initial={photos} total={Number(c[0].n)} />;
}
