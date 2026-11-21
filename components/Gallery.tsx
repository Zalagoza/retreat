'use client';
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
        <div className="fixed bottom-0 left-0 z-40 flex w-full items-center gap-3 border-t border-neutral-700 bg-neutral-900 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
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
          <div className="flex items-center gap-2 bg-neutral-900 pt-safe pl-3 pr-1 text-sm">
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

          <div className="flex gap-1 overflow-x-auto overscroll-x-contain bg-neutral-900 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
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
}
