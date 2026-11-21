'use client';
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
}
