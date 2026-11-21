'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

type Slide = { id: number; name: string; view_url: string };

export default function Carousel({ slides }: { slides: Slide[] }) {
  const n = slides.length;
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  // only fetch a slide when it is current or next, to save mobile data
  const [seen, setSeen] = useState<Set<number>>(new Set([0, 1]));
  const tx = useRef(0);

  useEffect(() => {
    setSeen((s) => new Set(s).add(i).add((i + 1) % Math.max(n, 1)));
  }, [i, n]);

  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setI((v) => (v + 1) % n), 4500);
    return () => clearInterval(t);
  }, [n, paused]);

  if (!n) return null;
  const go = (d: number) => setI((v) => (v + d + n) % n);

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured photos"
      className="relative mb-4 overflow-hidden rounded-lg bg-neutral-800"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={(e) => { tx.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={(e) => {
        const dx = e.changedTouches[0].clientX - tx.current;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
        setPaused(false);
      }}
    >
      <div className="relative aspect-[16/9] max-h-[420px] w-full touch-pan-y sm:aspect-[3/1]">
        {slides.map((s, k) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={s.id}
            src={seen.has(k) ? s.view_url : undefined}
            alt={s.name}
            aria-hidden={k !== i}
            loading={k === 0 ? 'eager' : 'lazy'}
            fetchPriority={k === 0 ? 'high' : 'auto'}
            decoding="async"
            className={'absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-700 ' + (k === i ? 'opacity-100' : 'opacity-0')}
          />
        ))}
      </div>
      {n > 1 && (
        <>
          <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/80 sm:block">
            <ChevronLeft />
          </button>
          <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-2 top-1/2 hidden -translate-y-1/2 rounded-full bg-black/50 p-2 hover:bg-black/80 sm:block">
            <ChevronRight />
          </button>
          <div className="absolute bottom-2 left-0 flex w-full justify-center">
            {slides.map((s, k) => (
              <button key={s.id} onClick={() => setI(k)} aria-label={'Show photo ' + (k + 1)} className="p-2">
                <span className={'block h-2 w-2 rounded-full ' + (k === i ? 'bg-rast-gold' : 'bg-white/60')} />
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
