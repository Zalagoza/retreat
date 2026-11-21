import { query, type Photo } from '@/lib/db';
import UploadPanel from '@/components/UploadPanel';
import DeleteButton from '@/components/DeleteButton';

export const dynamic = 'force-dynamic';

export default async function Admin() {
  const photos = await query<Photo>(
    'SELECT id, name, thumb_url, view_url FROM kia_photos ORDER BY created_at DESC, id DESC LIMIT 200'
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rast-gold">Admin</h1>
        <div className="flex gap-4 text-sm">
          <a href="/admin/analytics" className="text-rast-gold hover:underline">Analytics</a>
          <form action="/api/auth/logout" method="post">
            <button className="text-rast-red hover:underline">Log out</button>
          </form>
        </div>
      </div>
      <UploadPanel />
      <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-8">
        {photos.map((p) => (
          <div key={p.id} className="relative aspect-square border border-neutral-600 bg-neutral-800">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.thumb_url} alt={p.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
            <DeleteButton id={p.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
