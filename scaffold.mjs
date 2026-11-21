// scaffold.mjs — run with: node scaffold.mjs
// Fixed: Neon = Postgres (@neondatabase/serverless), jose sessions (edge-safe),
// no backticks / ${} inside embedded files (so template literals can't break).
import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { dirname } from 'path';

const files = {};

/* ─────────── config ─────────── */

files['package.json'] = `{
  "name": "kia-memoirs",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "@neondatabase/serverless": "^1.0.0",
    "@vercel/blob": "^0.27.0",
    "archiver": "^7.0.1",
    "jose": "^5.9.6",
    "lucide-react": "^0.468.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/archiver": "^6.0.3",
    "@types/node": "^22.10.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "tailwindcss": "^3.4.15",
    "typescript": "^5.7.0"
  }
}`;

files['.env.example'] = `# Neon (Postgres) - use the POOLED connection string (hostname contains "-pooler")
DATABASE_URL=postgresql://user:password@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require

# Vercel Blob
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_xxx

# Admin credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-strong-password

# Long random string (32+ chars) for session signing
SESSION_SECRET=change-this-to-a-long-random-string-32chars-min

NEXT_PUBLIC_SITE_URL=http://localhost:3000`;

files['.gitignore'] = `node_modules
.next
out
.env
.env.local
.vercel
*.log
.DS_Store
next-env.d.ts`;

files['tsconfig.json'] = `{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`;

files['next.config.mjs'] = `/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['archiver'],
  // Ask Chromium browsers (Android) to send the device model on later requests
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Accept-CH', value: 'Sec-CH-UA-Model, Sec-CH-UA-Platform, Sec-CH-UA-Platform-Version' },
        ],
      },
    ];
  },
};

export default nextConfig;`;

files['postcss.config.mjs'] = `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};`;

files['tailwind.config.ts'] = `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rast: {
          red: '#C8102E',
          gold: '#FFCE00',
          green: '#007A3D',
          night: '#0D0D0D',
          charcoal: '#1A1A1A',
          smoke: '#262626',
          cream: '#F5F1E8',
        },
      },
      fontFamily: {
        montserrat: ['var(--font-montserrat)', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;`;

/* ─────────── lib ─────────── */

files['lib/db.ts'] = `import { neon } from '@neondatabase/serverless';

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
}`;

files['lib/session.ts'] = `import { SignJWT, jwtVerify } from 'jose';

export const COOKIE = 'kia_session';

function key() {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 16) throw new Error('SESSION_SECRET missing or too short');
  return new TextEncoder().encode(s);
}

export async function signSession(): Promise<string> {
  return new SignJWT({ admin: true })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(key());
}

export async function verifySession(token?: string): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, key());
    return true;
  } catch {
    return false;
  }
}`;

files['lib/auth.ts'] = `import { cookies } from 'next/headers';
import { createHash, timingSafeEqual } from 'crypto';
import { COOKIE, verifySession } from './session';

function h(v: string) {
  return createHash('sha256').update(v).digest();
}

export function checkCredentials(user: string, pass: string): boolean {
  const u = timingSafeEqual(h(user), h(process.env.ADMIN_USERNAME || ''));
  const p = timingSafeEqual(h(pass), h(process.env.ADMIN_PASSWORD || ''));
  return u && p && !!process.env.ADMIN_PASSWORD;
}

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(COOKIE)?.value);
}`;

files['lib/log.ts'] = `import { query } from './db';

function parseDevice(ua: string, model: string): string {
  const m = model.replace(/"/g, '').trim();
  if (m) return m;
  const android = ua.match(/Android [\\d.]+; ([^;)]+?)(?: Build|;|\\))/);
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
}`;

files['lib/image.ts'] = `// Browser-only helpers: small square thumbnail + phone-friendly 1280px copy before upload
type Src = ImageBitmap | HTMLImageElement;

async function load(file: File): Promise<{ src: Src; w: number; h: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      let b: ImageBitmap;
      try {
        b = await createImageBitmap(file, { imageOrientation: 'from-image' });
      } catch {
        b = await createImageBitmap(file);
      }
      return { src: b, w: b.width, h: b.height, done: () => b.close() };
    } catch { /* fall through to <img> */ }
  }
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.src = url;
  await img.decode();
  return { src: img, w: img.naturalWidth, h: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
}

function render(src: Src, w: number, h: number, size: number, square: boolean, q: number): Promise<Blob> {
  let sx = 0, sy = 0, sw = w, sh = h, dw: number, dh: number;
  if (square) {
    const s = Math.min(w, h);
    sx = (w - s) / 2;
    sy = (h - s) / 2;
    sw = s;
    sh = s;
    dw = size;
    dh = size;
  } else {
    const k = Math.min(1, size / Math.max(w, h));
    dw = Math.round(w * k);
    dh = Math.round(h * k);
  }
  const c = document.createElement('canvas');
  c.width = dw;
  c.height = dh;
  const ctx = c.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas not supported'));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, sx, sy, sw, sh, 0, 0, dw, dh);
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error('Could not encode image'))), 'image/jpeg', q)
  );
}

export async function makeVariants(file: File) {
  const { src, w, h, done } = await load(file);
  try {
    const thumb = await render(src, w, h, 320, true, 0.8);
    const view = await render(src, w, h, 1280, false, 0.78);
    return { thumb, view };
  } finally {
    done();
  }
}`;

files['middleware.ts'] = `import { NextRequest, NextResponse } from 'next/server';
import { COOKIE, verifySession } from '@/lib/session';

export async function middleware(req: NextRequest) {
  const ok = await verifySession(req.cookies.get(COOKIE)?.value);
  if (!ok) {
    return NextResponse.redirect(new URL('/admin/login', req.url));
  }
  return NextResponse.next();
}

// /admin/login is excluded so the login page is reachable
export const config = {
  matcher: ['/admin', '/admin/((?!login).*)'],
};`;

/* ─────────── styles / layout ─────────── */

files['app/globals.css'] = `@tailwind base;
@tailwind components;
@tailwind utilities;

html { -webkit-text-size-adjust: 100%; }
body {
  background: #1f1f1f;
  color: #e6e6e6;
  overscroll-behavior-y: none;
  -webkit-tap-highlight-color: transparent;
}
button, a { touch-action: manipulation; }
.pt-safe { padding-top: env(safe-area-inset-top); }
.pb-safe { padding-bottom: env(safe-area-inset-bottom); }
.px-safe { padding-left: env(safe-area-inset-left); padding-right: env(safe-area-inset-right); }
@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}`;

files['app/layout.tsx'] = `import type { Metadata, Viewport } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';
import VisitBeacon from '@/components/VisitBeacon';

const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['400', '700'],
  display: 'swap',
  variable: '--font-montserrat',
});

export const metadata: Metadata = {
  title: 'Kia Memoirs',
  description: 'Photo library',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#1A1A1A',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={montserrat.variable + ' font-montserrat min-h-dvh antialiased'}>
        <header className="border-b-4 border-rast-gold bg-rast-charcoal pt-safe px-safe">
          <div className="mx-auto flex max-w-[1400px] items-center justify-between px-3 py-3">
            <a href="/" className="text-lg font-bold text-rast-gold">Kia Memoirs</a>
            <a href="/admin" className="p-2 text-sm text-rast-cream/70 hover:text-rast-gold">Admin</a>
          </div>
        </header>
        <main className="mx-auto max-w-[1400px] px-3 px-safe py-3">{children}</main>
        <VisitBeacon />
      </body>
    </html>
  );
}`;

/* ─────────── components ─────────── */

files['components/VisitBeacon.tsx'] = `'use client';
import { useEffect } from 'react';

export default function VisitBeacon() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem('kia_visit')) return;
      sessionStorage.setItem('kia_visit', '1');
    } catch { /* storage blocked: still log */ }
    fetch('/api/visit', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}`;

files['components/ProgressBar.tsx'] = `// value: 0..1, or -1 for unknown size
export default function ProgressBar({ value, label }: { value: number; label?: string }) {
  const unknown = value < 0;
  return (
    <div className="w-full">
      {label && <div className="mb-1 text-xs text-neutral-300">{label}</div>}
      <div className="h-2 w-full overflow-hidden rounded bg-neutral-700">
        <div
          className={'h-full bg-rast-gold transition-all ' + (unknown ? 'w-full animate-pulse' : '')}
          style={unknown ? undefined : { width: Math.round(Math.min(1, value) * 100) + '%' }}
        />
      </div>
    </div>
  );
}`;

files['components/Gallery.tsx'] = `'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Check, Play, Pause, X, Archive } from 'lucide-react';
import type { Photo } from '@/lib/db';
import { MAX_ZIP_PHOTOS } from '@/lib/config';

const PAGE = 48;
// Plain links: the browser shows its own save dialog + progress (works on every mobile browser)
const dlUrl = (id: number) => '/api/photos/' + id + '/download';

export default function Gallery({ initial, total }: { initial: Photo[]; total: number }) {
  const [photos, setPhotos] = useState<Photo[]>(initial);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const sentinel = useRef<HTMLDivElement>(null);
  const touchX = useRef(0);
  const hasMore = photos.length < total;

  const loadMore = useCallback(async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const res = await fetch('/api/photos?offset=' + photos.length + '&limit=' + PAGE);
      const j = await res.json();
      setPhotos((p) => {
        const seen = new Set(p.map((x) => x.id));
        return p.concat((j.photos as Photo[]).filter((x) => !seen.has(x.id)));
      });
    } catch { /* retry on next scroll */ }
    setLoading(false);
  }, [loading, hasMore, photos.length]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((e) => { if (e[0].isIntersecting) loadMore(); }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  // phone Back button closes the viewer instead of leaving the site
  useEffect(() => {
    const onPop = () => { setOpen(null); setPlaying(false); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  function openViewer(i: number) {
    if (open === null) history.pushState({ kiaViewer: true }, '');
    setOpen(i);
  }
  function closeViewer() {
    if (history.state && history.state.kiaViewer) history.back();
    else { setOpen(null); setPlaying(false); }
  }

  const go = useCallback(
    (d: number) => setOpen((i) => (i === null ? i : Math.max(0, Math.min(photos.length - 1, i + d)))),
    [photos.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') closeViewer();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open === null, go]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setOpen((i) => (i === null ? i : (i + 1) % photos.length)), 3500);
    return () => clearInterval(t);
  }, [playing, photos.length]);

  useEffect(() => {
    if (open === null) return;
    setLoaded(false);
    const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
    if (!nav.connection?.saveData) {
      const next = photos[open + 1];
      if (next) new Image().src = next.view_url;
    }
    if (open >= photos.length - 6) loadMore();
    document.getElementById('film-' + open)?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [open, photos, loadMore]);

  function toggle(id: number) {
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else if (n.size >= MAX_ZIP_PHOTOS) alert('You can zip up to ' + MAX_ZIP_PHOTOS + ' photos at a time.');
      else n.add(id);
      return n;
    });
  }

  const cur = open !== null ? photos[open] : null;
  const from = open === null ? 0 : Math.max(0, open - 20);
  const strip = open === null ? [] : photos.slice(from, open + 21);

  return (
    <>
      <div className="mb-2 flex items-center justify-between text-sm text-neutral-300">
        <span>{selecting ? sel.size + ' selected' : total + ' photos'}</span>
        <div className="flex gap-2">
          {selecting && (
            <button onClick={() => setSel(new Set(photos.slice(0, MAX_ZIP_PHOTOS).map((p) => p.id)))} className="rounded bg-neutral-700 px-3 py-2">
              Select all
            </button>
          )}
          <button onClick={() => { setSelecting((v) => !v); setSel(new Set()); }} className="rounded bg-neutral-700 px-3 py-2">
            {selecting ? 'Cancel' : 'Select'}
          </button>
        </div>
      </div>

      {photos.length === 0 && <p className="text-neutral-400">No photos yet.</p>}
      <div className={'grid grid-cols-4 gap-1 sm:grid-cols-8 sm:gap-1.5 ' + (sel.size ? 'pb-24' : '')}>
        {photos.map((p, i) => (
          <div key={p.id} className="relative aspect-square">
            <button
              onClick={() => (selecting ? toggle(p.id) : openViewer(i))}
              className={'block h-full w-full overflow-hidden border bg-neutral-800 focus:outline-none focus-visible:border-rast-gold ' + (sel.has(p.id) ? 'border-rast-gold ring-2 ring-rast-gold' : 'border-neutral-600')}
              aria-label={(selecting ? 'Select ' : 'Open ') + p.name}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p.thumb_url}
                alt={p.name}
                width={320}
                height={320}
                loading={i < 12 ? 'eager' : 'lazy'}
                fetchPriority={i < 4 ? 'high' : 'auto'}
                decoding="async"
                className="h-full w-full object-cover"
              />
            </button>
            {selecting ? (
              <span className={'pointer-events-none absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-full border-2 ' + (sel.has(p.id) ? 'border-rast-gold bg-rast-gold text-black' : 'border-white bg-black/40')}>
                {sel.has(p.id) && <Check size={14} />}
              </span>
            ) : (
              <a href={dlUrl(p.id)} download={p.name} aria-label={'Download ' + p.name} className="absolute bottom-1 right-1 rounded-full bg-black/70 p-1.5 text-white">
                <Download size={14} />
              </a>
            )}
          </div>
        ))}
      </div>
      <div ref={sentinel} className="h-10" />
      {loading && <p className="py-2 text-center text-sm text-neutral-400">Loading more...</p>}

      {selecting && sel.size > 0 && (
        <div className="fixed bottom-0 left-0 z-40 flex w-full items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 pt-3 pb-safe">
          <span className="text-sm">{sel.size} selected</span>
          <a
            href={'/api/zip?ids=' + Array.from(sel).join(',')}
            download="kia-photos.zip"
            className="ml-auto flex items-center gap-2 rounded bg-rast-gold px-4 py-3 font-bold text-black"
          >
            <Archive size={18} /> Download ZIP
          </a>
        </div>
      )}

      {cur && open !== null && (
        <div className="fixed left-0 top-0 z-50 flex h-dvh w-full flex-col overscroll-contain bg-black">
          <div className="flex items-center gap-2 bg-neutral-900 pt-safe px-safe pl-3 pr-1 text-sm">
            <span className="min-w-0 flex-1 truncate">{cur.name}</span>
            <span className="text-neutral-400">{open + 1}/{total}</span>
            <button onClick={() => setPlaying((v) => !v)} className="p-3" aria-label="Slideshow">
              {playing ? <Pause size={20} /> : <Play size={20} />}
            </button>
            <a href={dlUrl(cur.id)} download={cur.name} className="p-3 text-rast-gold" aria-label="Download photo">
              <Download size={20} />
            </a>
            <button onClick={closeViewer} className="p-3" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div
            className="relative flex min-h-0 flex-1 touch-pan-y items-center justify-center"
            onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
            onTouchEnd={(e) => {
              const dx = e.changedTouches[0].clientX - touchX.current;
              if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cur.thumb_url} alt="" aria-hidden className="absolute h-full w-full object-contain opacity-60 blur-sm" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={cur.id}
              src={cur.view_url}
              alt={cur.name}
              decoding="async"
              onLoad={() => setLoaded(true)}
              className={'relative max-h-full max-w-full select-none object-contain transition-opacity ' + (loaded ? 'opacity-100' : 'opacity-0')}
            />
            {open > 0 && (
              <button onClick={() => go(-1)} className="absolute left-2 hidden rounded-full bg-black/60 p-3 hover:bg-black sm:block" aria-label="Previous">
                <ChevronLeft />
              </button>
            )}
            {open < photos.length - 1 && (
              <button onClick={() => go(1)} className="absolute right-2 hidden rounded-full bg-black/60 p-3 hover:bg-black sm:block" aria-label="Next">
                <ChevronRight />
              </button>
            )}
          </div>

          <div className="flex gap-1 overflow-x-auto overscroll-x-contain bg-neutral-900 p-2 pb-safe">
            {strip.map((p, k) => {
              const i = from + k;
              return (
                <button key={p.id} id={'film-' + i} onClick={() => setOpen(i)} className={'h-14 w-14 shrink-0 border-2 ' + (i === open ? 'border-rast-gold' : 'border-transparent opacity-60')}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.thumb_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}`;

files['components/UploadPanel.tsx'] = `'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';
import { makeVariants } from '@/lib/image';
import { MAX_UPLOAD_MB } from '@/lib/config';
import ProgressBar from './ProgressBar';

type Item = { name: string; status: 'waiting' | 'uploading' | 'done' | 'error'; error?: string };

export default function UploadPanel() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);

  function mark(i: number, patch: Partial<Item>) {
    setItems((all) => all.map((it, k) => (k === i ? { ...it, ...patch } : it)));
  }

  async function start(files: File[]) {
    if (!files.length) return;
    setBusy(true);
    setProgress(0);
    setItems(files.map((f) => ({ name: f.name, status: 'waiting' })));
    const opts = { access: 'public' as const, handleUploadUrl: '/api/upload' };

    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      mark(i, { status: 'uploading' });
      try {
        if (!f.type.startsWith('image/')) throw new Error('Not an image');
        if (f.size > MAX_UPLOAD_MB * 1024 * 1024) throw new Error('Over ' + MAX_UPLOAD_MB + ' MB limit');
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const { thumb, view } = await makeVariants(f);
        const base = i / files.length;
        const step = 1 / files.length;
        setProgress(base + step * 0.05);
        const t = await upload('photos/thumb-' + safe + '.jpg', thumb, { ...opts, contentType: 'image/jpeg' });
        const v = await upload('photos/view-' + safe + '.jpg', view, { ...opts, contentType: 'image/jpeg' });
        setProgress(base + step * 0.15);
        const o = await upload('photos/orig-' + safe, f, {
          ...opts,
          contentType: f.type,
          multipart: true,
          onUploadProgress: (e) => setProgress(base + step * (0.15 + 0.8 * (e.percentage / 100))),
        });
        const res = await fetch('/api/photos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: f.name, thumb_url: t.url, view_url: v.url, orig_url: o.url, size: f.size }),
        });
        if (!res.ok) throw new Error('Could not save photo');
        mark(i, { status: 'done' });
      } catch (e) {
        mark(i, { status: 'error', error: e instanceof Error ? e.message : 'Failed' });
      }
      setProgress((i + 1) / files.length);
    }
    setBusy(false);
    if (input.current) input.current.value = '';
    router.refresh();
  }

  const doneCount = items.filter((i) => i.status === 'done').length;

  return (
    <div className="space-y-3 rounded-lg bg-rast-charcoal p-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        disabled={busy}
        onChange={(e) => start(Array.from(e.target.files || []))}
        className="text-sm"
      />
      {items.length > 0 && (
        <>
          <ProgressBar value={progress} label={busy ? 'Uploading ' + (doneCount + 1) + ' of ' + items.length : 'Finished: ' + doneCount + ' of ' + items.length + ' uploaded'} />
          <ul className="max-h-40 space-y-1 overflow-auto text-xs">
            {items.map((it, i) => (
              <li key={i} className={it.status === 'error' ? 'text-rast-red' : it.status === 'done' ? 'text-rast-green' : 'text-neutral-300'}>
                {it.name} - {it.status}{it.error ? ': ' + it.error : ''}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}`;

files['components/DeleteButton.tsx'] = `'use client';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';

export default function DeleteButton({ id }: { id: number }) {
  const router = useRouter();
  async function del() {
    if (!confirm('Delete this photo?')) return;
    const res = await fetch('/api/photos/' + id, { method: 'DELETE' });
    if (res.ok) router.refresh();
    else alert('Delete failed.');
  }
  return (
    <button onClick={del} aria-label="Delete photo" className="absolute right-1 top-1 rounded bg-black/70 p-1 text-rast-red hover:text-white">
      <Trash2 size={14} />
    </button>
  );
}`;

/* ─────────── pages ─────────── */

files['app/page.tsx'] = `import { preconnect } from 'react-dom';
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
}`;

files['app/admin/login/page.tsx'] = `'use client';
import { useState } from 'react';

export default function Login() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const fd = new FormData(e.currentTarget);
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: fd.get('username'), password: fd.get('password') }),
    });
    setBusy(false);
    if (res.ok) window.location.href = '/admin';
    else setError('Wrong username or password.');
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <h1 className="text-2xl font-bold text-rast-gold">Admin login</h1>
      <input name="username" placeholder="Username" required className="w-full rounded bg-rast-smoke p-3" />
      <input name="password" type="password" placeholder="Password" required className="w-full rounded bg-rast-smoke p-3" />
      {error && <p className="text-rast-red">{error}</p>}
      <button disabled={busy} className="w-full rounded bg-rast-gold p-3 font-bold text-rast-night disabled:opacity-50">
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}`;

files['app/admin/page.tsx'] = `import { query, type Photo } from '@/lib/db';
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
}`;

files['app/admin/analytics/page.tsx'] = `import { query } from '@/lib/db';

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
}`;

/* ─────────── API ─────────── */

files['app/api/auth/login/route.ts'] = `import { NextResponse } from 'next/server';
import { checkCredentials } from '@/lib/auth';
import { COOKIE, signSession } from '@/lib/session';

export async function POST(req: Request) {
  const { username, password } = await req.json().catch(() => ({}));
  if (typeof username !== 'string' || typeof password !== 'string' || !checkCredentials(username, password)) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, await signSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}`;

files['app/api/auth/logout/route.ts'] = `import { NextResponse } from 'next/server';
import { COOKIE } from '@/lib/session';

export async function POST(req: Request) {
  const res = NextResponse.redirect(new URL('/admin/login', req.url), 303);
  res.cookies.delete(COOKIE);
  return res;
}`;

files['app/api/upload/route.ts'] = `import { NextResponse } from 'next/server';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { isAdmin } from '@/lib/auth';
import { MAX_UPLOAD_MB } from '@/lib/config';

// Issues short-lived tokens so the browser uploads straight to Blob (no 4.5 MB limit, real progress)
export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await req.json()) as HandleUploadBody;
  try {
    const json = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ['image/*'],
        maximumSizeInBytes: MAX_UPLOAD_MB * 1024 * 1024,
        cacheControlMaxAge: 31536000,
        addRandomSuffix: true,
      }),
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Upload error' }, { status: 400 });
  }
}`;

files['app/api/photos/route.ts'] = `import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth';
import { query, type Photo } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const u = new URL(req.url);
  const offset = Math.max(0, Number(u.searchParams.get('offset')) || 0);
  const limit = Math.min(100, Math.max(1, Number(u.searchParams.get('limit')) || 48));
  const photos = await query<Photo>(
    'SELECT id, name, thumb_url, view_url FROM kia_photos ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return NextResponse.json({ photos }, { headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' } });
}

function blobUrl(v: unknown): string | null {
  try {
    const u = new URL(String(v));
    return u.protocol === 'https:' && u.hostname.endsWith('.public.blob.vercel-storage.com') ? u.toString() : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const b = await req.json().catch(() => null);
  const thumb = blobUrl(b?.thumb_url);
  const view = blobUrl(b?.view_url);
  const orig = blobUrl(b?.orig_url);
  const name = String(b?.name || '').slice(0, 200);
  if (!thumb || !view || !orig || !name) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const size = Math.min(2147483647, Math.max(0, Number(b?.size) || 0));
  const rows = await query<{ id: number }>(
    'INSERT INTO kia_photos (name, thumb_url, view_url, orig_url, size) VALUES ($1,$2,$3,$4,$5) RETURNING id',
    [name, thumb, view, orig, size]
  );
  revalidatePath('/');
  return NextResponse.json({ id: rows[0].id });
}`;

files['app/api/photos/[id]/route.ts'] = `import { NextResponse } from 'next/server';
import { del } from '@vercel/blob';
import { revalidatePath } from 'next/cache';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return NextResponse.json({ error: 'Bad id' }, { status: 400 });
  const rows = await query<{ thumb_url: string; view_url: string; orig_url: string }>(
    'DELETE FROM kia_photos WHERE id = $1 RETURNING thumb_url, view_url, orig_url',
    [n]
  );
  if (rows[0]) {
    try { await del([rows[0].thumb_url, rows[0].view_url, rows[0].orig_url]); } catch { /* ignore */ }
  }
  revalidatePath('/');
  return NextResponse.json({ ok: true });
}`;

files['app/api/photos/[id]/download/route.ts'] = `import { query } from '@/lib/db';
import { logEvent } from '@/lib/log';

export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const n = Number(id);
  if (!Number.isInteger(n)) return new Response('Bad id', { status: 400 });
  const rows = await query<{ name: string; orig_url: string }>(
    'SELECT name, orig_url FROM kia_photos WHERE id = $1',
    [n]
  );
  const p = rows[0];
  if (!p) return new Response('Not found', { status: 404 });

  const upstream = await fetch(p.orig_url);
  if (!upstream.ok || !upstream.body) return new Response('Unavailable', { status: 502 });

  await logEvent(req, 'download', [{ id: n, name: p.name }]);

  const headers = new Headers();
  headers.set('Content-Type', upstream.headers.get('content-type') || 'application/octet-stream');
  const len = upstream.headers.get('content-length');
  if (len) headers.set('Content-Length', len);
  const safe = p.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  headers.set(
    'Content-Disposition',
    'attachment; filename="' + safe + '"; filename*=UTF-8' + "''" + encodeURIComponent(p.name)
  );
  headers.set('Cache-Control', 'no-store');
  return new Response(upstream.body, { headers });
}`;

files['app/api/visit/route.ts'] = `import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { logEvent } from '@/lib/log';

export async function POST(req: Request) {
  if (!(await isAdmin())) await logEvent(req, 'visit');
  return NextResponse.json({ ok: true });
}`;

files['README.md'] = `# Kia Memoirs (photo library)

1. Copy .env.example to .env.local and fill it in (Neon Postgres, Vercel Blob, admin login, SESSION_SECRET).
2. npm install
3. npm run dev
4. Open /admin/login, upload photos, view analytics at /admin/analytics.

Tables are created automatically on first query.
Location (country/city) comes from Vercel's edge headers, so it only fills in once deployed on Vercel.
`;

files['lib/config.ts'] = `export const MAX_UPLOAD_MB = 12;
export const MAX_ZIP_PHOTOS = 100;`;

files['app/api/zip/route.ts'] = `import archiver from 'archiver';
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
}`;

/* ─────────── write ─────────── */

// Safety: never touch real env files, and never overwrite existing files unless --force
const force = process.argv.includes('--force');
for (const [path, content] of Object.entries(files)) {
  if (/^\.env(\.local|\.[a-z]+)?$/.test(path) && path !== '.env.example') continue;
  if (existsSync(path) && !force) { console.log('skipped (exists)', path); continue; }
  const dir = dirname(path);
  if (dir !== '.') mkdirSync(dir, { recursive: true });
  writeFileSync(path, content + '\n');
  console.log('wrote', path);
}
console.log('\nDone. Next: cp .env.example .env.local && npm install && npm run dev');