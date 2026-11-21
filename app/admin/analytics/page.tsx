import { query } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Ev = {
  type: string; photo_name: string | null; ip: string | null; country: string | null;
  region: string | null; city: string | null; device: string | null; created_at: string | Date;
};

function when(d: string | Date) {
  return new Date(d).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

export default async function Analytics() {
  const [totals] = await query<{ downloads: string; visits: string; ips: string }>(
    "SELECT count(*) FILTER (WHERE type='download') AS downloads, " +
      "count(*) FILTER (WHERE type='visit') AS visits, count(DISTINCT ip) AS ips FROM kia_events"
  );
  const countries = await query<{ c: string; n: string }>(
    "SELECT coalesce(country,'Unknown') AS c, count(*) AS n FROM kia_events WHERE type='download' GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
  );
  const top = await query<{ p: string; n: string }>(
    "SELECT coalesce(photo_name,'(deleted)') AS p, count(*) AS n FROM kia_events WHERE type='download' GROUP BY 1 ORDER BY 2 DESC LIMIT 10"
  );
  const recent = await query<Ev>('SELECT * FROM kia_events ORDER BY created_at DESC LIMIT 200');

  const card = 'rounded-lg bg-rast-charcoal p-4';
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-rast-gold">Analytics</h1>
        <a href="/admin" className="text-sm hover:underline">Back to admin</a>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className={card}><div className="text-3xl font-bold">{totals.downloads}</div>Downloads</div>
        <div className={card}><div className="text-3xl font-bold">{totals.visits}</div>Visits</div>
        <div className={card}><div className="text-3xl font-bold">{totals.ips}</div>Unique IPs</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className={card}>
          <h2 className="mb-2 font-bold">Downloads by country</h2>
          {countries.map((r) => <div key={r.c} className="flex justify-between text-sm"><span>{r.c}</span><span>{r.n}</span></div>)}
        </div>
        <div className={card}>
          <h2 className="mb-2 font-bold">Most downloaded</h2>
          {top.map((r) => <div key={r.p} className="flex justify-between gap-2 text-sm"><span className="truncate">{r.p}</span><span>{r.n}</span></div>)}
        </div>
      </div>
      <div className={card + ' overflow-x-auto'}>
        <h2 className="mb-2 font-bold">Recent activity (latest 200)</h2>
        <table className="w-full text-left text-xs">
          <thead className="text-neutral-400">
            <tr><th className="pr-3">Time</th><th className="pr-3">Type</th><th className="pr-3">Photo</th><th className="pr-3">IP</th><th className="pr-3">Location</th><th>Device</th></tr>
          </thead>
          <tbody>
            {recent.map((e, i) => (
              <tr key={i} className="border-t border-neutral-700">
                <td className="whitespace-nowrap py-1 pr-3">{when(e.created_at)}</td>
                <td className="pr-3">{e.type}</td>
                <td className="max-w-[160px] truncate pr-3">{e.photo_name || '-'}</td>
                <td className="pr-3">{e.ip || '-'}</td>
                <td className="pr-3">{[e.city, e.region, e.country].filter(Boolean).join(', ') || '-'}</td>
                <td>{e.device || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
