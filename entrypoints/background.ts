import { compressImage } from '@/utils/compression';
import { storeCapture } from '@/utils/storage';
import { extractMetadata } from '@/utils/metadata';
import { COMPRESSION, ANIMATION } from '@/utils/constants';
import type { BackgroundMessage, OffscreenMessage } from '@/utils/messages';

export default defineBackground({
  main() {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command !== 'capture-screenshot') return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id || !tab.windowId) return;

      try {
        // Step 1: Capture visible tab as PNG data URL
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
        });

        // Step 2: Extract metadata immediately (CAPT-03, CAPT-04)
        const metadata = extractMetadata(tab);

        // Step 3: Send animation message to content script (non-blocking)
        // Create a small thumbnail for the animation to avoid large message payload
        const thumbnailDataUrl = await createThumbnail(dataUrl, ANIMATION.PREVIEW_WIDTH_PX);
        const animMsg: BackgroundMessage = {
          type: 'SHOW_CAPTURE_ANIMATION',
          thumbnail: thumbnailDataUrl,
        };
        chrome.tabs.sendMessage(tab.id, animMsg).catch(() => {
          // Content script not injectable (restricted page) -- badge fallback
          chrome.action.setBadgeText({ text: 'OK', tabId: tab.id });
          chrome.action.setBadgeBackgroundColor({ color: '#4CAF50', tabId: tab.id });
          setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
        });

        // Step 4: Compress image (OffscreenCanvas in SW, fallback to offscreen doc)
        let compressed: Blob;
        try {
          compressed = await compressImage(dataUrl);
        } catch {
          // OffscreenCanvas not available (Chrome <116) -- use offscreen document
          compressed = await compressViaOffscreenDocument(dataUrl);
        }

        // Step 5: Store in IndexedDB
        const captureId = await storeCapture(compressed, metadata);
        console.log(`[screenshotr] Capture stored: ${captureId} (${(compressed.size / 1024).toFixed(1)}KB)`);
      } catch (err) {
        console.error('[screenshotr] Capture failed:', err);
      }
    });
  },
});

async function createThumbnail(dataUrl: string, targetWidth: number): Promise<string> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  const scale = targetWidth / bitmap.width;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const thumbnailBlob = await canvas.convertToBlob({ type: 'image/webp', quality: 0.6 });
  const buffer = await thumbnailBlob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
  return `data:image/webp;base64,${base64}`;
}

async function compressViaOffscreenDocument(dataUrl: string): Promise<Blob> {
  // Ensure offscreen document exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT as any],
  });

  if (existingContexts.length === 0) {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.BLOBS],
      justification: 'Image compression via Canvas API',
    });
  }

  const msg: OffscreenMessage = {
    type: 'COMPRESS_IMAGE_OFFSCREEN',
    dataUrl,
    maxWidth: COMPRESSION.MAX_WIDTH,
    maxSizeKB: COMPRESSION.MAX_SIZE_KB,
    quality: COMPRESSION.START_QUALITY,
  };

  const response = await chrome.runtime.sendMessage(msg);
  if (response.error) throw new Error(response.error);

  const uint8 = new Uint8Array(response.buffer);
  return new Blob([uint8], { type: 'image/webp' });
}
