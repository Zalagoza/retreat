'use client';
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
}
