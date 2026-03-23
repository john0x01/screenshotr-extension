# Phase 1: Core Capture Pipeline - Research

**Researched:** 2026-03-23
**Domain:** Chrome MV3 Extension -- Screenshot Capture, Compression, Local Storage
**Confidence:** HIGH

## Summary

Phase 1 builds a fully functional local capture pipeline: keyboard shortcut triggers `captureVisibleTab()`, the image is compressed to WebP via `OffscreenCanvas` in the service worker (or fallback offscreen document), metadata is extracted, the result is stored in IndexedDB via `idb`, and a macOS-style shutter animation plays via shadow DOM content script overlay. No network, no auth, no popup UI.

The WXT framework (v0.20.20) handles MV3 scaffolding, manifest generation, HMR, and file-based entrypoints. The architecture is message-driven: service worker orchestrates, content script shows animation, and all state persists to storage (service workers are ephemeral).

**Primary recommendation:** Use `OffscreenCanvas` directly in the service worker for image compression (available in Chrome 116+, our target is 112+). Provide an offscreen document fallback for Chrome 112-115. This avoids the complexity of managing an offscreen document lifecycle for the majority of users while maintaining backward compatibility.

<user_constraints>

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Full macOS-style animation: brief white flash over viewport, thumbnail appears at bottom-right corner, holds for 2-3 seconds showing the captured image, then slides off-screen
- **D-02:** Animation rendered via shadow DOM overlay injected by content script -- must not interfere with host page DOM or styles
- **D-03:** Animation should feel polished and native -- this is the primary user feedback mechanism
- **D-04:** Default capture shortcut is `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)
- **D-05:** Shortcut registered via `chrome.commands` API in manifest -- user can reconfigure in `chrome://extensions/shortcuts`
- **D-06:** Use WXT framework (Vite-based) for MV3 scaffolding, HMR, and future cross-browser builds
- **D-07:** WXT chosen over Plasmo (lighter, Vite vs Parcel) and vanilla MV3 (too much boilerplate)
- **D-08:** Cap screenshot resolution at 2x maximum. Downscale 3x/4x displays to 2x, keep 1x and 2x as-is
- **D-09:** This provides the best quality/file-size tradeoff -- retina sharpness without excessive compression on ultra-high-DPI screens
- **D-10:** Use Canvas API to re-encode as WebP with quality tuning to hit <500KB target
- **D-11:** Compression happens in an offscreen document (Chrome) since Canvas API is unavailable in service workers

### Claude's Discretion
- Exact animation timing (flash duration, thumbnail size, slide speed)
- WebP quality parameter tuning (start ~0.82, adjust based on testing)
- IndexedDB schema design for local capture storage
- Offscreen document lifecycle management
- Metadata field structure for local persistence

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope

</user_constraints>

<phase_requirements>

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAPT-01 | Configurable global keyboard shortcut | `chrome.commands` API with `suggested_key`, WXT manifest integration |
| CAPT-02 | Capture visible viewport via `captureVisibleTab()` | Service worker calls API with `activeTab` permission, returns data URL |
| CAPT-03 | Extract page title, domain, URL, path | `chrome.tabs.get()` in same handler as capture for consistency |
| CAPT-04 | Extract timestamp at capture | `Date.now()` in service worker at capture time |
| CAPT-05 | Compress to <500KB WebP | `OffscreenCanvas` + `convertToBlob({type:'image/webp'})` with quality tuning |
| CAPT-07 | macOS-style shutter animation | WXT `createShadowRootUi` with CSS keyframes in content script |
| CAPT-08 | Shadow DOM overlay, no host DOM modification | WXT shadow root UI with `cssInjectionMode: 'ui'` |
| PLAT-01 | Chrome 112+ with Manifest V3 | WXT generates correct MV3 manifest |
| PLAT-02 | MV3 service worker | WXT `background.ts` entrypoint auto-configured as service worker |
| PLAT-03 | Minimum required permissions | `activeTab`, `storage`, `offscreen` only |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

- Extension must not modify the DOM of visited websites beyond a temporary capture animation overlay
- Manifest V3 required for Chrome Web Store -- service worker, not background page
- Chrome 112+ and Firefox 115+ (Firefox is v2 scope, but architecture should not preclude it)
- Compressed screenshots < 500 KB without visible quality loss
- WXT framework chosen for MV3 scaffolding (from STATE.md decisions)

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| WXT | 0.20.20 | MV3 extension framework | File-based entrypoints, auto-manifest generation, HMR, Vite-native, cross-browser support |
| idb | 8.0.3 | IndexedDB wrapper | 1.2KB promise-based wrapper by Jake Archibald. Type-safe with DBSchema interface |
| TypeScript | ^5.4 | Type safety | Required for typed messages, storage schemas, API contracts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Vitest | 4.1.0 | Unit testing | Test compression logic, metadata extraction, storage operations |
| ESLint | ^9.x | Linting | Flat config with @typescript-eslint |
| Prettier | ^3.x | Formatting | Standard formatting, configure once |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| idb | Dexie.js | Dexie is 48KB+ with features not needed; idb is 1.2KB |
| idb | Raw IndexedDB | Callback-based API is painful; idb adds type safety cheaply |
| OffscreenCanvas in SW | Offscreen document | Offscreen doc adds lifecycle complexity; OffscreenCanvas is simpler but only available Chrome 116+ |

**Installation:**
```bash
npx wxt@latest init screenshotr-extension --template vanilla
cd screenshotr-extension
npm install idb
npm install -D vitest @typescript-eslint/parser eslint prettier
```

## Architecture Patterns

### WXT Project Structure
```
entrypoints/
  background.ts          # Service worker: command listener, capture orchestrator
  capture-overlay.content.ts  # Content script: shadow DOM animation overlay
  offscreen.html         # Offscreen document: canvas fallback for Chrome <116
  offscreen.ts           # Offscreen document script
assets/
  capture-animation.css  # Shutter animation styles (injected into shadow DOM)
utils/
  compression.ts         # OffscreenCanvas WebP compression logic
  storage.ts             # IndexedDB schema and operations via idb
  messages.ts            # Typed message definitions
  metadata.ts            # Page metadata extraction helpers
  constants.ts           # Config values (quality, size limits, timing)
public/
  icon-16.png
  icon-48.png
  icon-128.png
wxt.config.ts            # WXT configuration
```

**Key WXT conventions:**
- Entrypoints are defined by file location in `entrypoints/` directory
- Content scripts use `{name}.content.ts` naming pattern
- Offscreen documents are unlisted HTML entrypoints (`offscreen.html`)
- Background entrypoint auto-becomes service worker for MV3
- CSS imported in content scripts with `cssInjectionMode: 'ui'` goes into shadow root

### Pattern 1: Stateless Service Worker with Storage-as-State

**What:** Service workers terminate after ~30s idle. ALL state must be persisted externally.

**When:** Always -- this is non-negotiable in MV3.

**Example:**
```typescript
// entrypoints/background.ts
export default defineBackground({
  main() {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command === 'capture-screenshot') {
        // Read any needed state from storage, never from variables
        const tab = await chrome.tabs.query({ active: true, currentWindow: true });
        await handleCapture(tab[0]);
      }
    });
  },
});
```

### Pattern 2: Capture Pipeline Data Flow

**What:** The critical path from shortcut to stored capture.

```
User presses Ctrl+Shift+X
  -> chrome.commands.onCommand fires in service worker
  -> chrome.tabs.captureVisibleTab() returns data URL (PNG)
  -> chrome.tabs.get(tabId) returns tab metadata (title, url)
  -> Send "SHOW_ANIMATION" message to content script (non-blocking)
  -> Compress: fetch(dataUrl) -> blob -> createImageBitmap -> OffscreenCanvas -> convertToBlob({type:'image/webp', quality:0.82})
  -> If DPR > 2: resize canvas to cap at 2x before encoding
  -> Store in IndexedDB: { id, imageBlob, metadata, capturedAt }
  -> Done (no upload in Phase 1)
```

### Pattern 3: WXT Shadow Root UI for Animation

**What:** Use WXT's `createShadowRootUi` for style-isolated animation overlay.

**Example:**
```typescript
// entrypoints/capture-overlay.content.ts
import './capture-animation.css';

export default defineContentScript({
  matches: ['<all_urls>'],
  cssInjectionMode: 'ui',

  async main(ctx) {
    chrome.runtime.onMessage.addListener((msg) => {
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
      // 1. Flash overlay (white, 150ms fade)
      const flash = document.createElement('div');
      flash.className = 'capture-flash';
      container.append(flash);

      // 2. Thumbnail preview (bottom-right, holds 2-3s, slides off)
      const preview = document.createElement('div');
      preview.className = 'capture-preview';
      const img = document.createElement('img');
      img.src = thumbnail;
      preview.append(img);
      container.append(preview);

      // 3. Auto-remove after animation completes
      setTimeout(() => ui.remove(), 3500);
    },
  });
  ui.mount();
}
```

### Pattern 4: Typed Message Bus

**What:** All cross-context communication uses typed discriminated unions.

```typescript
// utils/messages.ts
export type BackgroundMessage =
  | { type: 'SHOW_CAPTURE_ANIMATION'; thumbnail: string }
  | { type: 'CAPTURE_COMPLETE'; captureId: string };

export type ContentMessage =
  | { type: 'ANIMATION_DONE' };
```

### Pattern 5: Compression with OffscreenCanvas (Service Worker)

**What:** Compress images directly in the service worker using `OffscreenCanvas`. Falls back to offscreen document for Chrome <116.

```typescript
// utils/compression.ts
export async function compressImage(
  dataUrl: string,
  maxWidth: number,
  maxSizeKB: number,
  startQuality: number = 0.82,
): Promise<Blob> {
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);

  // Cap at 2x: if source is larger, scale down
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
    quality -= 0.05;
  } while (result.size > maxSizeKB * 1024 && quality >= 0.4);

  return result;
}
```

### Anti-Patterns to Avoid

- **In-memory state in service worker:** State WILL be lost on termination. Always read from `chrome.storage` or IndexedDB.
- **Large data URLs through messaging:** Data URLs from captureVisibleTab can be 2-4MB. For service worker to content script messaging, send only a thumbnail-sized data URL for the animation preview (resize first). Store full image in IndexedDB.
- **Inline styles in content scripts:** MV3 CSP blocks inline styles. Use CSS classes from imported stylesheets. WXT handles this via `cssInjectionMode: 'ui'`.
- **Content script as capture engine:** Never use html2canvas. `captureVisibleTab()` runs natively in the browser -- no DOM access needed.
- **Popup as state manager:** Popup is destroyed on close. It is a pure view layer.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| IndexedDB promise wrapper | Custom promisified IndexedDB | `idb` (1.2KB) | Schema versioning, TypeScript generics, cursor iteration -- all handled |
| MV3 manifest generation | Manual manifest.json | WXT auto-generation | Cross-browser manifest differences, permission declarations, content script registration |
| Shadow DOM CSS isolation | Manual shadow root setup | WXT `createShadowRootUi` | Handles mounting, lifecycle, CSS injection, position modes |
| Content script registration | Manual `chrome.scripting.registerContentScripts` | WXT `defineContentScript` | Auto-registers from file metadata, handles matches config |
| UUID generation | Custom ID generator | `crypto.randomUUID()` | Built into Chrome 92+, available in service workers |

**Key insight:** WXT eliminates most MV3 boilerplate. The idb library eliminates IndexedDB pain. Focus implementation effort on the capture pipeline logic and animation polish -- not on framework plumbing.

## Common Pitfalls

### Pitfall 1: Service Worker Termination During Compression

**What goes wrong:** The service worker starts compressing a large image via OffscreenCanvas. Chrome terminates the worker after ~30s idle or ~5min active. Compression result is lost.

**Why it happens:** MV3 service workers are ephemeral. Developers assume they run to completion like background pages.

**How to avoid:** Persist the raw data URL to IndexedDB IMMEDIATELY after `captureVisibleTab()` returns, BEFORE starting compression. If the service worker dies, on next wake check for uncompressed captures and resume. Use `chrome.alarms` (min 1-minute interval) as a safety net to process the queue.

**Warning signs:** Captures appear in the animation but never show up in storage.

### Pitfall 2: No `CANVAS` Reason in chrome.offscreen.Reason Enum

**What goes wrong:** The prior research and many tutorials reference `reasons: ['CANVAS']` for offscreen documents. This reason does NOT exist.

**Why it happens:** Outdated documentation and hallucinated API values.

**How to avoid:** Use `reasons: [chrome.offscreen.Reason.BLOBS]` -- this is the correct reason for image blob operations. The valid enum values are: TESTING, AUDIO_PLAYBACK, IFRAME_SCRIPTING, DOM_SCRAPING, BLOBS, DOM_PARSER, USER_MEDIA, DISPLAY_MEDIA, WEB_RTC, CLIPBOARD, LOCAL_STORAGE, WORKERS, BATTERY_STATUS, MATCH_MEDIA, GEOLOCATION.

**Warning signs:** `chrome.offscreen.createDocument()` throws with invalid reason.

### Pitfall 3: Content Script Cannot Inject on Restricted Pages

**What goes wrong:** User captures on `chrome://extensions`, `chrome://settings`, `about:blank`, or Chrome Web Store pages. Content script cannot inject, so no animation plays.

**Why it happens:** Chrome restricts content script access to these pages.

**How to avoid:** `captureVisibleTab()` still WORKS on most restricted pages. Degrade gracefully: if the tab URL starts with `chrome://`, `about:`, or `chrome-extension://`, skip the animation message and use `chrome.action.setBadgeText({ text: 'OK' })` as fallback feedback. Clear badge after 2 seconds.

**Warning signs:** Shortcut works on some pages but silently fails on others.

### Pitfall 4: High-DPI Screenshots Blow Past 500KB

**What goes wrong:** On 3x/4x Retina displays, `captureVisibleTab()` returns images at native resolution (5760x3240 for a 1920x1080 viewport at 3x). Even WebP at quality 0.8 can exceed 500KB.

**Why it happens:** Developers test on 1x/2x displays. 3x+ displays produce much larger images.

**How to avoid:** Per D-08/D-09, cap at 2x. Get `window.devicePixelRatio` via a quick content script message or `chrome.tabs.getZoom()`. If DPR > 2, scale the canvas dimensions to `viewport * 2` before encoding. Use adaptive quality: start at 0.82, step down by 0.05 until under 500KB, minimum quality 0.40.

**Warning signs:** File sizes inconsistent across machines.

### Pitfall 5: `Ctrl+Shift+X` Shortcut Conflict

**What goes wrong:** The chosen shortcut `Ctrl+Shift+X` may conflict with other extensions or browser shortcuts. On some systems, this maps to "strikethrough" in text editors or other functions.

**Why it happens:** Limited shortcut space for extensions. Chrome does NOT prevent conflicts -- it silently picks one handler.

**How to avoid:** Use `suggested_key` in manifest (not a hard requirement). Document in popup/options that users can reconfigure at `chrome://extensions/shortcuts`. Note: `Ctrl` auto-converts to `Command` on Mac, so `Ctrl+Shift+X` in manifest becomes `Cmd+Shift+X` on Mac -- this is correct per D-04.

**Warning signs:** Shortcut fires another extension's action or does nothing.

### Pitfall 6: captureVisibleTab Permission Requirements

**What goes wrong:** `captureVisibleTab()` requires `activeTab` permission. Without it, the call fails silently or throws.

**Why it happens:** Developers forget the permission or use overly broad `<all_urls>` which triggers Web Store review flags.

**How to avoid:** Use exactly `activeTab` permission -- it grants temporary access to the active tab when the user invokes the extension (via command or action click). Do NOT request `tabs` permission -- `activeTab` is sufficient and less intrusive for store review.

**Warning signs:** captureVisibleTab throws "Missing activeTab permission" error.

## Code Examples

### WXT Background Entrypoint with chrome.commands

```typescript
// entrypoints/background.ts
// Source: WXT docs (wxt.dev/guide/essentials/entrypoints.html) + chrome.commands API

export default defineBackground({
  main() {
    chrome.commands.onCommand.addListener(async (command) => {
      if (command !== 'capture-screenshot') return;

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      try {
        // Step 1: Capture visible tab as PNG data URL
        const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
          format: 'png',
        });

        // Step 2: Extract metadata immediately
        const metadata = {
          title: tab.title ?? '',
          url: tab.url ?? '',
          domain: new URL(tab.url ?? '').hostname,
          path: new URL(tab.url ?? '').pathname,
          capturedAt: Date.now(),
        };

        // Step 3: Notify content script to show animation (non-blocking)
        chrome.tabs.sendMessage(tab.id, {
          type: 'SHOW_CAPTURE_ANIMATION',
          thumbnail: dataUrl, // Will be resized for animation
        }).catch(() => {
          // Content script may not be injectable -- use badge fallback
          chrome.action.setBadgeText({ text: '✓', tabId: tab.id });
          setTimeout(() => chrome.action.setBadgeText({ text: '', tabId: tab.id }), 2000);
        });

        // Step 4: Compress and store
        const compressed = await compressImage(dataUrl, 3840, 500, 0.82);
        await storeCapture(compressed, metadata);

      } catch (err) {
        console.error('[screenshotr] Capture failed:', err);
      }
    });
  },
});
```

### WXT Manifest Commands Configuration

```typescript
// wxt.config.ts
import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'ScreenshotR',
    permissions: ['activeTab', 'storage', 'offscreen'],
    commands: {
      'capture-screenshot': {
        suggested_key: {
          default: 'Ctrl+Shift+X',
          mac: 'Command+Shift+X',
        },
        description: 'Capture a screenshot of the visible page',
      },
    },
  },
});
```

**Note on mac key:** Setting `mac: 'Command+Shift+X'` is explicit but redundant -- Chrome auto-converts `Ctrl` to `Command` on Mac. Including it is clearer for readers.

### IndexedDB Schema with idb

```typescript
// utils/storage.ts
// Source: idb README (github.com/jakearchibald/idb)

import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface ScreenshotrDB extends DBSchema {
  captures: {
    key: string; // UUID
    value: {
      id: string;
      imageBlob: Blob;
      thumbnailBlob: Blob;
      metadata: CaptureMetadata;
      status: 'pending' | 'compressed' | 'synced';
      capturedAt: number;
    };
    indexes: {
      'by-status': string;
      'by-capturedAt': number;
    };
  };
}

export interface CaptureMetadata {
  title: string;
  url: string;
  domain: string;
  path: string;
  capturedAt: number;
}

let dbPromise: Promise<IDBPDatabase<ScreenshotrDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ScreenshotrDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScreenshotrDB>('screenshotr', 1, {
      upgrade(db) {
        const store = db.createObjectStore('captures', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-capturedAt', 'capturedAt');
      },
    });
  }
  return dbPromise;
}

export async function storeCapture(
  imageBlob: Blob,
  metadata: CaptureMetadata,
): Promise<string> {
  const db = await getDB();
  const id = crypto.randomUUID();
  await db.put('captures', {
    id,
    imageBlob,
    thumbnailBlob: imageBlob, // Phase 1: same blob; Phase 2 can add thumbnail generation
    metadata,
    status: 'pending',
    capturedAt: metadata.capturedAt,
  });
  return id;
}
```

### CSS Animation for macOS Shutter Effect

```css
/* assets/capture-animation.css */
/* Injected into shadow DOM via WXT cssInjectionMode: 'ui' */

:host {
  all: initial;
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  z-index: 2147483647;
  pointer-events: none;
}

.capture-flash {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: white;
  opacity: 0;
  animation: flash 300ms ease-out forwards;
}

@keyframes flash {
  0% { opacity: 0.7; }
  100% { opacity: 0; }
}

.capture-preview {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 280px;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.3);
  overflow: hidden;
  opacity: 0;
  transform: scale(0.3) translateY(100px);
  animation: preview-in 400ms 200ms ease-out forwards,
             preview-hold 2000ms 600ms linear forwards,
             preview-out 300ms 2600ms ease-in forwards;
}

@keyframes preview-in {
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

@keyframes preview-hold {
  from, to { opacity: 1; transform: scale(1) translateY(0); }
}

@keyframes preview-out {
  to {
    opacity: 0;
    transform: scale(0.9) translateX(120%);
  }
}

.capture-preview img {
  width: 100%;
  height: auto;
  display: block;
}
```

### Offscreen Document Fallback (Chrome <116)

```typescript
// entrypoints/offscreen.ts
// Unlisted script entrypoint for offscreen document

export default defineUnlistedScript({
  main() {
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      if (msg.type === 'COMPRESS_IMAGE_OFFSCREEN') {
        compressInOffscreen(msg.dataUrl, msg.maxWidth, msg.maxSizeKB, msg.quality)
          .then((blob) => {
            // Convert blob to array buffer for messaging
            blob.arrayBuffer().then((buffer) => {
              sendResponse({ buffer: Array.from(new Uint8Array(buffer)), size: blob.size });
            });
          });
        return true; // Keep message channel open for async response
      }
    });
  },
});

async function compressInOffscreen(
  dataUrl: string,
  maxWidth: number,
  maxSizeKB: number,
  quality: number,
): Promise<Blob> {
  // In offscreen document, we have full DOM -- use regular canvas
  const img = new Image();
  img.src = dataUrl;
  await new Promise((r) => (img.onload = r));

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
    q -= 0.05;
  } while (blob.size > maxSizeKB * 1024 && q >= 0.4);

  return blob;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Offscreen document for all canvas ops | `OffscreenCanvas` in service worker | Chrome 116 (Aug 2023) | Eliminates offscreen document lifecycle complexity for Chrome 116+ |
| `reasons: ['CANVAS']` for offscreen docs | No CANVAS reason exists; use `BLOBS` | Always (CANVAS was never valid) | Prior research/tutorials are wrong about this |
| `captureVisibleTab` JPEG-only | PNG and JPEG with quality param | Chrome MV3 | Can capture as JPEG directly, but WebP still requires re-encoding |
| Background page (MV2) | Service worker (MV3) | Chrome MV3 requirement | Ephemeral lifecycle changes everything -- persist-first architecture |
| Manual shadow DOM setup | WXT `createShadowRootUi` | WXT 0.x+ | Framework handles shadow root creation, CSS injection, mounting lifecycle |

**Deprecated/outdated:**
- `chrome.offscreen.Reason.CANVAS` -- does not exist. Use `BLOBS` for canvas/blob operations.
- Background pages -- MV3 requires service workers. No `persistent: true` in MV3.
- `chrome.extension.getBackgroundPage()` -- removed in MV3.

## Open Questions

1. **OffscreenCanvas WebP support in Chrome 112-115**
   - What we know: OffscreenCanvas.convertToBlob with WebP works in Chrome 116+. Chrome 112 launched March 2023.
   - What's unclear: Whether Chrome 112-115 supports OffscreenCanvas in service workers at all, and whether WebP encoding works there.
   - Recommendation: Use feature detection (`typeof OffscreenCanvas !== 'undefined'`). Fall back to offscreen document if unavailable. Given Chrome auto-updates, most users will be on recent versions.

2. **Message size limits for data URLs**
   - What we know: `captureVisibleTab()` returns data URLs that can be 2-4MB on Retina. `chrome.tabs.sendMessage` works with these sizes in practice.
   - What's unclear: Exact hard limit on message payload size.
   - Recommendation: For the animation thumbnail, create a small preview (e.g., 280px wide) before sending to content script. Keep full-resolution data URL in the service worker only.

3. **Device pixel ratio detection from service worker**
   - What we know: `window.devicePixelRatio` is not available in service workers.
   - What's unclear: Best way to get DPR for scaling decisions.
   - Recommendation: Use `chrome.tabs.captureVisibleTab` which captures at native DPR. Then detect the actual size from the image bitmap dimensions vs the tab's CSS viewport size (available from `chrome.tabs.get()` which returns `width`/`height` in CSS pixels). If `bitmap.width > tab.width * 2`, scale down.

## Sources

### Primary (HIGH confidence)
- [Chrome offscreen API reference](https://developer.chrome.com/docs/extensions/reference/api/offscreen) -- Reason enum values, lifecycle, permissions
- [Chrome commands API reference](https://developer.chrome.com/docs/extensions/reference/api/commands) -- suggested_key format, Mac key conversion, limitations
- [WXT project structure docs](https://wxt.dev/guide/essentials/project-structure.html) -- Directory layout, entrypoint conventions
- [WXT entrypoints docs](https://wxt.dev/guide/essentials/entrypoints.html) -- Background, content script, offscreen document configuration
- [WXT content scripts docs](https://wxt.dev/guide/essentials/content-scripts.html) -- createShadowRootUi, cssInjectionMode, overlay position
- [idb GitHub](https://github.com/jakearchibald/idb) -- DBSchema interface, openDB, TypeScript usage
- [MDN OffscreenCanvas.convertToBlob](https://developer.mozilla.org/en-US/docs/Web/API/OffscreenCanvas/convertToBlob) -- WebP support, quality parameter
- npm registry -- Verified versions: wxt@0.20.20, idb@8.0.3, vitest@4.1.0, zod@4.3.6

### Secondary (MEDIUM confidence)
- [WXT offscreen document example](https://github.com/wxt-dev/examples/tree/main/examples/offscreen-document-setup) -- Example structure (code not fully inspected)
- [Chrome offscreen documents blog](https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3) -- Architecture patterns, lifecycle
- [CanIUse OffscreenCanvas WebP](https://caniuse.com/mdn-api_offscreencanvas_converttoblob_option_type_parameter_webp) -- Browser compat for WebP encoding

### Tertiary (LOW confidence)
- OffscreenCanvas availability in Chrome 112-115 service workers specifically -- needs runtime verification

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH -- WXT, idb, and OffscreenCanvas are well-documented, versions verified against npm
- Architecture: HIGH -- MV3 patterns (service worker, messaging, shadow DOM) are well-established
- Pitfalls: HIGH -- Service worker termination, missing CANVAS reason, and restricted page issues are well-documented
- Animation implementation: MEDIUM -- WXT createShadowRootUi overlay mode verified from docs, but exact animation timing needs runtime testing
- OffscreenCanvas in SW for Chrome 112+: MEDIUM -- Works in 116+, unclear for 112-115

**Research date:** 2026-03-23
**Valid until:** 2026-04-23 (stable domain, APIs well-established)
