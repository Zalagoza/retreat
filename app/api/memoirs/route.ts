import { NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { isAdmin } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const fd = await req.formData();
  const title = String(fd.get('title') || '').trim();
  const body = String(fd.get('body') || '').trim();
  if (!title || !body) return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });

  let imageUrl: string | null = null;
  const image = fd.get('image');
  if (image instanceof File && image.size > 0) {
    if (!image.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (image.size > 4 * 1024 * 1024) return NextResponse.json({ error: 'Image must be under 4 MB' }, { status: 400 });
    const blob = await put('memoirs/' + Date.now() + '-' + image.name.replace(/[^a-zA-Z0-9._-]/g, '_'), image, {
      access: 'public',
    });
    imageUrl = blob.url;
  }

  const rows = await query<{ id: number }>(
    'INSERT INTO memoirs (title, body, image_url) VALUES ($1, $2, $3) RETURNING id',
    [title, body, imageUrl]
  );
  return NextResponse.json({ id: rows[0].id });
}
