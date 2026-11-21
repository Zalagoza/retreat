import { neon } from '@neondatabase/serverless';

export type Photo = {
  id: number;
  name: string;
  thumb_url: string;
  view_url: string;
};

let sqlFn: ReturnType<typeof neon> | null = null;
let initP: Promise<void> | null = null;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function client() {
  const url = process.env.DATABASE_URL || '';
  if (!url.startsWith('postgres')) {
    throw new Error('DATABASE_URL must be a Neon postgresql:// connection string');
  }
  return (sqlFn ??= neon(url));
}

// Retries transient network errors (Neon waking up, dropped connections)
async function run(text: string, params: unknown[] = []) {
  for (let i = 0; ; i++) {
    try {
      return await client().query(text, params);
    } catch (e) {
      const msg = String((e as Error)?.message || '');
      const transient = /fetch failed|ECONNRESET|ETIMEDOUT|Error connecting/i.test(msg);
      if (!transient || i >= 4) throw e;
      await sleep(500 * (i + 1));
    }
  }
}

function init() {
  return (initP ??= (async () => {
    await run(
      'CREATE TABLE IF NOT EXISTS kia_photos (' +
        'id SERIAL PRIMARY KEY, name TEXT NOT NULL, thumb_url TEXT NOT NULL, ' +
        'view_url TEXT NOT NULL, orig_url TEXT NOT NULL, size INTEGER NOT NULL DEFAULT 0, ' +
        'created_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    await run(
      'CREATE TABLE IF NOT EXISTS kia_events (' +
        'id SERIAL PRIMARY KEY, type TEXT NOT NULL, photo_id INTEGER, photo_name TEXT, ' +
        'ip TEXT, country TEXT, region TEXT, city TEXT, device TEXT, user_agent TEXT, ' +
        'created_at TIMESTAMPTZ NOT NULL DEFAULT now())'
    );
    await run('CREATE INDEX IF NOT EXISTS kia_photos_created_idx ON kia_photos (created_at DESC, id DESC)');
    await run('CREATE INDEX IF NOT EXISTS kia_events_created_idx ON kia_events (created_at DESC)');
  })().catch((e) => {
    initP = null;
    throw e;
  }));
}

export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = []
): Promise<T[]> {
  await init();
  return (await run(text, params)) as T[];
}
