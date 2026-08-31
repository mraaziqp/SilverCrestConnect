/**
 * Prepares an image in the browser before it is uploaded.
 *
 * A phone photo is commonly 4000px wide and several megabytes. Sent as a base64
 * data URI that becomes a third larger again, and the request either times out
 * at the gateway — the 504 seen when adding drive photos — or succeeds and
 * leaves a multi-megabyte string in the datastore that every visitor then
 * downloads. Neither is acceptable, and neither is necessary: nothing on the
 * page displays an image wider than about 1200px.
 *
 * So the file is drawn to a canvas at a sane size first. A 5MB photo lands at
 * roughly 200KB, which uploads instantly and is small enough to survive as a
 * data URI if cloud storage is unavailable.
 *
 * Transparency is preserved. Sponsor logos are supplied with transparent
 * backgrounds, and re-encoding one as JPEG would fill it with black.
 */

export interface PreparedImage {
  dataUri: string;
  width: number;
  height: number;
  bytes: number;
  /** True when the original was returned untouched. */
  passthrough: boolean;
}

/** Formats the server accepts. */
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml'];

export interface PrepareOptions {
  /** Longest edge of the result, in CSS pixels. */
  maxDimension?: number;
  /** JPEG quality, when the result is encoded as JPEG. */
  quality?: number;
}

function readAsDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('That file could not be read as an image.'));
    img.src = src;
  });
}

/** True when any pixel is not fully opaque. */
function hasTransparency(ctx: CanvasRenderingContext2D, w: number, h: number): boolean {
  try {
    const { data } = ctx.getImageData(0, 0, w, h);
    // Every fourth byte is alpha. Step through coarsely; a logo's transparent
    // area is never a handful of stray pixels.
    for (let i = 3; i < data.length; i += 4 * 16) {
      if (data[i] < 250) return true;
    }
    return false;
  } catch {
    // A tainted canvas cannot be read. Assume transparency and keep PNG, which
    // is the lossless choice and cannot introduce a black background.
    return true;
  }
}

export async function prepareImage(file: File, options: PrepareOptions = {}): Promise<PreparedImage> {
  const { maxDimension = 1600, quality = 0.82 } = options;

  if (!ACCEPTED.includes(file.type)) {
    throw new Error(`Unsupported image type. Use PNG, JPEG, WebP, GIF or SVG.`);
  }

  const original = await readAsDataUri(file);

  // SVG is already small and scales perfectly; rasterising it would only make
  // it worse. GIF may be animated, and drawing it to a canvas keeps one frame.
  if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
    return { dataUri: original, width: 0, height: 0, bytes: file.size, passthrough: true };
  }

  const img = await loadImage(original);
  const longest = Math.max(img.naturalWidth, img.naturalHeight);
  const scale = longest > maxDimension ? maxDimension / longest : 1;
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUri: original, width: img.naturalWidth, height: img.naturalHeight, bytes: file.size, passthrough: true };

  ctx.drawImage(img, 0, 0, w, h);

  const keepAlpha = file.type === 'image/png' || file.type === 'image/webp'
    ? hasTransparency(ctx, w, h)
    : false;

  const dataUri = keepAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);

  // Re-encoding a small, already-optimised file can make it bigger. Keep
  // whichever is smaller, as long as the dimensions did not need reducing.
  if (scale === 1 && dataUri.length >= original.length) {
    return { dataUri: original, width: w, height: h, bytes: file.size, passthrough: true };
  }

  return {
    dataUri,
    width: w,
    height: h,
    // A base64 payload is about 3/4 real bytes.
    bytes: Math.round((dataUri.length - dataUri.indexOf(',') - 1) * 0.75),
    passthrough: false,
  };
}

/** Human-readable size, for telling someone why their upload was refused. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
