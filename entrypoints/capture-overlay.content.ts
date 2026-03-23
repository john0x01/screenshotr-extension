import '@/assets/capture-animation.css';
import { ANIMATION } from '@/utils/constants';
import type { BackgroundMessage } from '@/utils/messages';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    chrome.runtime.onMessage.addListener((msg: BackgroundMessage) => {
      if (msg.type === 'SHOW_CAPTURE_ANIMATION') {
        showAnimation(ctx, msg.thumbnail);
      }
    });
  },
});

async function showAnimation(ctx: ContentScriptContext, thumbnail: string) {
  const ui = await createShadowRootUi(ctx, {
    name: 'screenshotr-capture-overlay',
    position: 'overlay',
    onMount: (container) => {
      // Create overlay container
      const overlay = document.createElement('div');
      overlay.className = 'screenshotr-overlay';

      // 1. Flash overlay (white, 300ms fade -- per D-01 "brief white flash")
      const flash = document.createElement('div');
      flash.className = 'capture-flash';
      overlay.appendChild(flash);

      // 2. Thumbnail preview (bottom-right, holds ~2s, slides off -- per D-01)
      const preview = document.createElement('div');
      preview.className = 'capture-preview';
      const img = document.createElement('img');
      img.src = thumbnail;
      img.alt = 'Screenshot captured';
      preview.appendChild(img);
      overlay.appendChild(preview);

      container.appendChild(overlay);

      // 3. Auto-remove after animation completes (3.5s total)
      setTimeout(() => {
        ui.remove();
      }, ANIMATION.TOTAL_DURATION_MS);
    },
  });
  ui.mount();
}
