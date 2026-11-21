import { NextResponse } from 'next/server';
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
}
