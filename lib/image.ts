// Browser-only helpers: small square thumbnail + phone-friendly 1280px copy before upload
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
}
