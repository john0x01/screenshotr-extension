# Architecture Patterns

**Domain:** MV3 Browser Extension — Screenshot Capture + Upload
**Researched:** 2026-03-22
**Overall Confidence:** MEDIUM (based on training data; web search and official doc verification were unavailable)

## Recommended Architecture

An MV3 screenshot-capture extension has five distinct execution contexts, each with strict boundaries enforced by the browser. The architecture is fundamentally message-driven: components cannot call each other directly and must communicate through `chrome.runtime` messaging.

```
+------------------+       +--------------------+       +------------------+
|   Popup UI       |       |   Service Worker   |       |  Content Script  |
| (project select, | <---> |  (orchestrator,    | <---> | (capture anim    |
|  recent captures,|  msg  |   command handler,  |  msg  |  overlay only)   |
|  settings)       |       |   auth state)      |       |                  |
+------------------+       +--------------------+       +------------------+
                                  |       |
                                  |       |
                           +------+       +-------+
                           v                      v
                   +---------------+      +-----------------+
                   | Offscreen Doc |      | Supabase Auth   |
                   | (canvas ops,  |      | (OAuth flow,    |
                   |  compression) |      |  token refresh) |
                   +---------------+      +-----------------+
```

### Component Boundaries

| Component | Responsibility | Communicates With | Lifecycle |
|-----------|---------------|-------------------|-----------|
| **Service Worker** (background) | Command listener, capture orchestrator, API calls, auth token management, offline queue manager | All other components via `chrome.runtime` messaging | Ephemeral -- terminates after ~30s idle. Must be stateless; persist to `chrome.storage`. |
| **Content Script** | Injects capture animation overlay (camera shutter effect). Reads `document.title`, `window.location` for metadata. No other DOM modification. | Service Worker via messaging | Injected per-tab. Runs in page context with isolated world. |
| **Popup UI** | Project selector, recent captures list, auth status, settings. Lightweight UI. | Service Worker via messaging or direct `chrome.storage` reads | Created/destroyed on popup open/close. No persistent state -- reads from `chrome.storage`. |
| **Offscreen Document** | Canvas-based image compression (resize, quality reduction, format conversion). Has DOM access that Service Worker lacks. | Service Worker via messaging | Created on demand, closed after use. Only one can exist at a time per extension. |
| **Auth Module** | OAuth flow (Google/GitHub via Supabase), JWT storage, token refresh | Service Worker manages; popup triggers login | Tokens stored in `chrome.storage.session` (encrypted, session-scoped). |

## Data Flow: Capture Pipeline

This is the critical path. Must complete in under 3 seconds.

```
Step 1: User presses keyboard shortcut
    |
    v
Step 2: chrome.commands.onCommand fires in Service Worker
    |
    v
Step 3: Service Worker calls chrome.tabs.captureVisibleTab()
    |  Returns: data URL (base64 PNG, typically 1-4 MB for retina displays)
    v
Step 4: Service Worker sends message to Content Script
    |  Payload: { type: "SHOW_CAPTURE_ANIMATION", thumbnail: dataUrl }
    |  Content Script shows shutter animation overlay (non-blocking)
    v
Step 5: Service Worker creates Offscreen Document (if not already open)
    |  Reason: "CANVAS" -- offscreen docs support Canvas API
    v
Step 6: Service Worker sends image data to Offscreen Document
    |  Payload: { type: "COMPRESS_IMAGE", dataUrl, maxSizeKB: 500 }
    v
Step 7: Offscreen Document processes image:
    |  - Creates canvas element
    |  - Draws image at reduced dimensions if needed
    |  - Exports as JPEG/WebP at iterative quality levels until < 500 KB
    |  - Returns compressed blob as base64
    v
Step 8: Service Worker receives compressed image
    |  - Assembles metadata: { title, url, domain, path, projectId, capturedAt }
    |  - Stores capture in IndexedDB via offline queue (write-through)
    v
Step 9: Service Worker uploads to backend API
    |  - POST /api/captures with multipart form data
    |  - On success: mark queue entry as synced
    |  - On failure: leave in queue for retry
    v
Step 10: Service Worker updates chrome.storage with capture record
    |  Popup reads this on next open to show recent captures
    DONE
```

### Timing Budget (3-second target)

| Step | Expected Duration | Notes |
|------|-------------------|-------|
| captureVisibleTab | 50-150ms | Browser-native, fast |
| Create offscreen doc | 50-100ms | First time only; reuse if open |
| Image compression | 200-500ms | Depends on source size and target quality |
| Network upload | 500-2000ms | Depends on compressed size and connection |
| Animation overlay | 0ms (async) | Non-blocking, runs in parallel |
| **Total** | **~800-2750ms** | Within budget on broadband |

## Patterns to Follow

### Pattern 1: Stateless Service Worker with Storage-as-State

**What:** Service Workers in MV3 are ephemeral. They can terminate after 30 seconds of idle time and restart when an event fires. All state must be persisted externally.

**When:** Always. This is not optional in MV3.

**Implementation:**
```typescript
// BAD -- state lost on worker restart
let currentProject = null;

// GOOD -- read from storage on every event
chrome.commands.onCommand.addListener(async (command) => {
  const { currentProject } = await chrome.storage.local.get('currentProject');
  // use currentProject
});
```

**Storage strategy:**
- `chrome.storage.session` -- Auth tokens (encrypted, cleared on browser close)
- `chrome.storage.local` -- User preferences, current project selection
- IndexedDB -- Offline capture queue (larger data, structured queries)

### Pattern 2: Single Offscreen Document Lifecycle

**What:** Chrome allows only one offscreen document per extension. Create it on demand, reuse it across compressions, close it when idle.

**When:** Every time image compression is needed.

**Implementation:**
```typescript
async function getOrCreateOffscreen() {
  const existingContexts = await chrome.runtime.getContexts({
    contextType: 'OFFSCREEN_DOCUMENT',
  });
  if (existingContexts.length > 0) return;

  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: ['CANVAS'],
    justification: 'Image compression via canvas for screenshot capture',
  });
}
```

**Critical detail:** The `reasons` array must include a valid enum value. `CANVAS` is the correct reason for image manipulation. Using an invalid reason will throw.

### Pattern 3: Message Bus with Typed Actions

**What:** All inter-component communication goes through `chrome.runtime.sendMessage` / `onMessage`. Use a typed action pattern to keep this manageable.

**When:** All cross-context communication.

**Implementation:**
```typescript
// shared/messages.ts
type Message =
  | { type: 'CAPTURE_TRIGGERED'; tabId: number }
  | { type: 'COMPRESS_IMAGE'; dataUrl: string; maxSizeKB: number }
  | { type: 'COMPRESS_RESULT'; blob: string; sizeKB: number }
  | { type: 'SHOW_CAPTURE_ANIMATION'; thumbnail: string }
  | { type: 'UPLOAD_COMPLETE'; captureId: string }
  | { type: 'UPLOAD_FAILED'; captureId: string; error: string };
```

### Pattern 4: Content Script as Minimal Overlay

**What:** Content script does only two things: (1) show the capture animation overlay, (2) read page metadata. It does NOT modify the page DOM beyond injecting a temporary shadow DOM overlay.

**When:** On every capture event.

**Why:** PROJECT.md explicitly requires "must not modify the DOM of visited websites." Shadow DOM isolates the animation overlay from the page.

```typescript
// content-script.ts
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SHOW_CAPTURE_ANIMATION') {
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'closed' });
    // Inject animation styles and elements into shadow DOM
    // Auto-remove after animation completes (~800ms)
    document.body.appendChild(host);
    setTimeout(() => host.remove(), 1000);
  }
});
```

### Pattern 5: Offline Queue with Write-Through

**What:** Every capture is written to IndexedDB immediately, then uploaded. On success, the entry is marked synced. On failure, it stays queued for retry.

**When:** Every capture. This makes offline support essentially free.

**Implementation:**
```typescript
// Queue entry shape
interface QueuedCapture {
  id: string;           // UUID
  imageBlob: Blob;      // Compressed image
  metadata: CaptureMetadata;
  status: 'pending' | 'uploading' | 'synced' | 'failed';
  retryCount: number;
  createdAt: number;
}
```

Retry strategy: exponential backoff (1s, 2s, 4s, 8s, max 60s). Listen for `navigator.onLine` events in the service worker to trigger batch sync.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Background Page Thinking

**What:** Writing the service worker as if it is a persistent background page that holds state in memory.

**Why bad:** The service worker WILL terminate. Any in-memory state is lost. Capture operations that span async steps (compress -> upload) can be interrupted mid-flow.

**Instead:** Persist every intermediate state to storage. Use `chrome.alarms` for periodic tasks instead of `setInterval`. Chain async operations atomically where possible.

### Anti-Pattern 2: Large Data Through Message Passing

**What:** Sending full-resolution screenshot data URLs (2-4 MB) through `chrome.runtime.sendMessage`.

**Why bad:** Message passing has practical size limits. Large messages can be slow or fail. The serialization/deserialization overhead is significant.

**Instead:** For Service Worker to Offscreen Document communication with large payloads, consider using `chrome.runtime.getURL` with shared storage, or accept the data URL overhead but compress early. In practice, data URLs up to ~5 MB work through messaging but test at retina resolutions.

### Anti-Pattern 3: Content Script as Capture Engine

**What:** Using the content script to call `html2canvas` or otherwise reconstruct the page for capture.

**Why bad:** Violates the DOM-safety constraint. Unreliable across sites. CSP blocking. Performance problems.

**Instead:** `chrome.tabs.captureVisibleTab()` runs in the service worker context using the browser's native rendering. No content script involvement needed for the actual capture.

### Anti-Pattern 4: Popup as State Manager

**What:** Keeping application state in the popup's JavaScript context.

**Why bad:** Popup is destroyed every time it closes. State must be reconstructed on every open.

**Instead:** Popup is a pure view layer. It reads from `chrome.storage` on open, writes changes through the service worker or directly to storage. No persistent state.

## Component Boundaries and Directory Structure

```
src/
  background/
    service-worker.ts      # Entry point, event listeners
    capture.ts             # captureVisibleTab orchestration
    upload.ts              # API client, multipart upload
    queue.ts               # IndexedDB offline queue manager
    auth.ts                # Supabase auth, token management
  content/
    content-script.ts      # Animation overlay only
    animation.css          # Shutter animation styles
  popup/
    popup.html             # Popup entry point
    popup.ts               # UI logic
    popup.css              # Styles
  offscreen/
    offscreen.html         # Offscreen document entry
    compress.ts            # Canvas-based image compression
  shared/
    messages.ts            # Typed message definitions
    types.ts               # Shared TypeScript types
    api-contracts.ts       # Backend API type definitions
    constants.ts           # Config values, limits
  manifest.json            # MV3 manifest
```

## Cross-Browser Considerations

| Concern | Chrome | Firefox | Strategy |
|---------|--------|---------|----------|
| Manifest version | MV3 required | MV3 supported (115+), MV2 still works | Target MV3 for both. Extension framework (WXT/Plasmo) handles differences. |
| Offscreen documents | Supported | NOT supported (Firefox has no offscreen API) | Firefox alternative: use the popup or a hidden iframe for canvas ops, OR compress in the service worker using `OffscreenCanvas` (Firefox service workers support it). |
| `chrome.tabs.captureVisibleTab` | Available | Available as `browser.tabs.captureVisibleTab` | Framework polyfills this. Use `browser.*` namespace with webextension-polyfill if no framework. |
| Service worker lifecycle | Terminates after ~30s idle | More lenient but converging to Chrome behavior | Code defensively as if always ephemeral. |
| `chrome.storage.session` | Supported | Supported in 115+ | Safe to use for auth tokens. |

**Firefox offscreen gap is the biggest cross-browser concern.** Use `OffscreenCanvas` in the service worker as the Firefox fallback for image compression. This avoids needing an offscreen document entirely on Firefox. Chrome service workers do NOT support `OffscreenCanvas` (as of training data cutoff), so the offscreen document pattern is needed there.

## Suggested Build Order

Based on component dependencies, build in this order:

### Phase 1: Core Capture Pipeline (no network)
1. **Manifest + Service Worker scaffold** -- commands listener, basic event handling
2. **captureVisibleTab integration** -- capture on shortcut, get data URL
3. **Offscreen Document + compression** -- canvas-based JPEG/WebP compression
4. **Content Script animation** -- shadow DOM shutter overlay
5. **Result:** Press shortcut -> capture -> compress -> animation plays. No upload yet, but proves the core loop.

### Phase 2: Storage + Upload
6. **IndexedDB queue** -- persist captures locally
7. **API contract types** -- define upload endpoint types
8. **Upload module** -- POST compressed image + metadata to backend
9. **Offline retry logic** -- exponential backoff, online/offline detection
10. **Result:** Full capture -> compress -> queue -> upload pipeline.

### Phase 3: Auth + Popup UI
11. **Supabase Auth integration** -- OAuth flow, token storage
12. **Popup UI** -- project selector, recent captures, login state
13. **Authenticated API calls** -- attach JWT to upload requests
14. **Result:** Complete authenticated capture workflow with UI.

### Phase 4: Polish + Cross-Browser
15. **Firefox compatibility** -- OffscreenCanvas fallback, manifest differences
16. **Error handling hardening** -- service worker restart recovery, partial upload recovery
17. **Performance tuning** -- compression quality ladder, timing budget validation
18. **Result:** Production-ready cross-browser extension.

**Rationale for this order:** Phase 1 has zero external dependencies (no backend, no auth) and validates the hardest MV3-specific patterns (service worker lifecycle, offscreen documents, content script isolation). Phase 2 adds persistence and networking but can work against a mock API. Phase 3 adds auth which requires the real Supabase project. Phase 4 is hardening.

## Scalability Considerations

| Concern | At launch | At 10K users | At 100K users |
|---------|-----------|--------------|---------------|
| Capture frequency | Low | Moderate -- burst patterns during research sessions | High -- need rate limiting per user |
| Image size | Compress to < 500 KB | Same constraint | Same; consider server-side re-encoding |
| Queue size | 1-5 pending | Rare offline use | Need queue size limits, oldest-first eviction |
| Storage API limits | `chrome.storage.local` 10 MB default | Use IndexedDB for images (no hard limit) | Same |
| Service worker wake-ups | Infrequent | Per-capture | Same pattern, but alarms for batch sync |

## Sources

- Chrome Extensions MV3 documentation (developer.chrome.com/docs/extensions) -- MEDIUM confidence (from training data, not live-verified)
- Chrome Offscreen Documents API reference -- MEDIUM confidence (training data)
- Firefox WebExtensions compatibility data (developer.mozilla.org) -- MEDIUM confidence (training data)
- MV3 service worker lifecycle behavior -- MEDIUM confidence (well-documented pattern in training data, but specifics like exact timeout values may have changed)

**Note:** Web search and official doc fetching were unavailable during this research session. All findings are based on training data (cutoff ~early 2025). Key claims to verify before implementation:
1. Firefox `OffscreenCanvas` support in extension service workers
2. Exact Chrome offscreen document `reasons` enum values
3. Current `chrome.storage.session` behavior and limits
4. Whether Chrome service workers now support `OffscreenCanvas` (would simplify architecture significantly)
