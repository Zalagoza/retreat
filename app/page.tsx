import { preconnect } from 'react-dom';
import { query, type Photo } from '@/lib/db';
import Gallery from '@/components/Gallery';
import Carousel from '@/components/Carousel';
import { SITE_TITLE } from '@/lib/config';

// Cached for 60s (and refreshed instantly after upload/delete) so phones get fast HTML
export const revalidate = 60;

export default async function Home() {
  const [photos, count, slides] = await Promise.all([
    query<Photo>('SELECT id, name, thumb_url, view_url FROM kia_photos ORDER BY created_at DESC, id DESC LIMIT 48'),
    query<{ n: string }>('SELECT count(*) AS n FROM kia_photos'),
    query<{ id: number; name: string; view_url: string }>('SELECT id, name, view_url FROM kia_photos ORDER BY random() LIMIT 4'),
  ]);
  if (photos[0]) {
    try { preconnect(new URL(photos[0].thumb_url).origin); } catch { /* ignore */ }
  }
  return (
    <>
      <Carousel slides={slides} />
      <h1 className="mb-3 text-lg font-bold text-rast-gold sm:text-2xl">{SITE_TITLE}</h1>
      <Gallery initial={photos} total={Number(count[0].n)} />
    </>
  );
}
