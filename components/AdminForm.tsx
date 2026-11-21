'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError('');
    const res = await fetch('/api/memoirs', { method: 'POST', body: new FormData(form) });
    setBusy(false);
    if (res.ok) {
      form.reset();
      router.refresh();
    } else {
      const j = await res.json().catch(() => ({}));
      setError(j.error || 'Could not save.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-lg bg-rast-charcoal p-4">
      <input name="title" placeholder="Title" required className="w-full rounded bg-rast-smoke p-3" />
      <textarea name="body" placeholder="Write the memoir..." required rows={6} className="w-full rounded bg-rast-smoke p-3" />
      <input name="image" type="file" accept="image/*" className="text-sm" />
      {error && <p className="text-rast-red">{error}</p>}
      <button disabled={busy} className="rounded bg-rast-gold px-5 py-2 font-bold text-rast-night disabled:opacity-50">
        {busy ? 'Saving...' : 'Publish'}
      </button>
    </form>
  );
}
