import { COMPRESSION } from './constants';

// Self-initializing script loaded by entrypoints/offscreen.html
// Provides Canvas-based image compression for Chrome <116 fallback

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'COMPRESS_IMAGE_OFFSCREEN') {
    compressInOffscreen(msg.dataUrl, msg.maxWidth, msg.maxSizeKB, msg.quality)
      .then(async (blob) => {
        const buffer = await blob.arrayBuffer();
        sendResponse({ buffer: Array.from(new Uint8Array(buffer)), size: blob.size });
      })
      .catch((err) => {
        sendResponse({ error: String(err) });
      });
    return true; // Keep channel open for async
  }
});

async function compressInOffscreen(
  dataUrl: string,
  maxWidth: number,
  maxSizeKB: number,
  quality: number,
): Promise<Blob> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });

  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  let q = quality;
  let blob: Blob;
  do {
    blob = await new Promise<Blob>((resolve) =>
      canvas.toBlob((b) => resolve(b!), 'image/webp', q),
    );
    q -= COMPRESSION.QUALITY_STEP;
  } while (blob.size > maxSizeKB * 1024 && q >= COMPRESSION.MIN_QUALITY);

  return blob;
}
