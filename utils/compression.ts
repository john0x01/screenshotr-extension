import { COMPRESSION } from './constants';

export async function compressImage(
  dataUrl: string,
  maxWidth: number = COMPRESSION.MAX_WIDTH,
  maxSizeKB: number = COMPRESSION.MAX_SIZE_KB,
  startQuality: number = COMPRESSION.START_QUALITY,
): Promise<Blob> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // Cap at 2x: scale down if source exceeds maxWidth (per D-08)
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  // Iterative quality reduction to hit size target
  let quality = startQuality;
  let result: Blob;
  do {
    result = await canvas.convertToBlob({ type: 'image/webp', quality });
    quality -= COMPRESSION.QUALITY_STEP;
  } while (result.size > maxSizeKB * 1024 && quality >= COMPRESSION.MIN_QUALITY);

  return result;
}
