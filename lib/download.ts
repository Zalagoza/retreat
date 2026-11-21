// Browser-only: download with progress. onProgress gets 0..1, or -1 if size is unknown.
export async function downloadWithProgress(
  url: string,
  filename: string,
  onProgress: (p: number) => void
) {
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error('Download failed');
  const total = Number(res.headers.get('content-length')) || 0;
  const reader = res.body.getReader();
  const parts: Uint8Array[] = [];
  let got = 0;
  onProgress(total ? 0 : -1);
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    parts.push(value);
    got += value.length;
    onProgress(total ? got / total : -1);
  }
  const blob = new Blob(parts as BlobPart[], { type: res.headers.get('content-type') || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  onProgress(1);
}
