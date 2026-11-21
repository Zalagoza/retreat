import { notFound } from 'next/navigation';
import { query, type Memoir } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function MemoirPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) notFound();
  const rows = await query<Memoir>('SELECT * FROM memoirs WHERE id = $1', [n]);
  const m = rows[0];
  if (!m) notFound();
  return (
    <article>
      <h1 className="text-3xl font-bold text-rast-gold">{m.title}</h1>
      {m.image_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={m.image_url} alt={m.title} className="my-6 w-full rounded-lg" />
      )}
      <p className="whitespace-pre-wrap leading-relaxed text-rast-cream/90">{m.body}</p>
    </article>
  );
}
