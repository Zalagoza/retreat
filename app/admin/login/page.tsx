'use client';
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
}
