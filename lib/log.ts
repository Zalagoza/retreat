import { query } from './db';

function parseDevice(ua: string, model: string): string {
  const m = model.replace(/"/g, '').trim();
  if (m) return m;
  const android = ua.match(/Android [\d.]+; ([^;)]+?)(?: Build|;|\))/);
  if (android) return android[1].trim();
  if (/iPhone/.test(ua)) return 'iPhone (model not exposed by iOS)';
  if (/iPad/.test(ua)) return 'iPad (model not exposed by iOS)';
  if (/Windows/.test(ua)) return 'Windows PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  if (/Linux/.test(ua)) return 'Linux';
  return 'Unknown';
}

type P = { id: number; name: string };

export async function logEvent(req: Request, type: 'download' | 'visit', photos?: P[]) {
  try {
    const h = req.headers;
    const ua = h.get('user-agent') || '';
    const ip = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0].trim() || null;
    const city = h.get('x-vercel-ip-city');
    const common = [
      ip,
      h.get('x-vercel-ip-country'),
      h.get('x-vercel-ip-region') || h.get('x-vercel-ip-country-region'),
      city ? decodeURIComponent(city) : null,
      parseDevice(ua, h.get('sec-ch-ua-model') || ''),
      ua.slice(0, 300),
    ];
    const list: (P | null)[] = photos && photos.length ? photos : [null];
    const vals: unknown[] = [];
    const rows = list.map((p, i) => {
      const b = i * 9;
      vals.push(type, p ? p.id : null, p ? p.name : null, ...common);
      return '(' + Array.from({ length: 9 }, (_, k) => '$' + (b + k + 1)).join(',') + ')';
    });
    await query(
      'INSERT INTO kia_events (type, photo_id, photo_name, ip, country, region, city, device, user_agent) VALUES ' +
        rows.join(','),
      vals
    );
  } catch (e) {
    console.error('logEvent failed', e);
  }
}
