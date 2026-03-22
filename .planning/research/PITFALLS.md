# Domain Pitfalls

**Domain:** MV3 Browser Extension -- Screenshot Capture & Upload
**Researched:** 2026-03-22
**Confidence:** MEDIUM (training data only -- web search/fetch unavailable for verification)

---

## Critical Pitfalls

Mistakes that cause rewrites, store rejections, or broken core functionality.

### Pitfall 1: Service Worker Termination Kills In-Flight Uploads

**What goes wrong:** The MV3 service worker terminates after ~30 seconds of inactivity (or ~5 minutes of continuous activity). A capture-compress-upload pipeline running in the service worker gets killed mid-upload. The user sees a successful capture animation but the image never arrives at the backend.

**Why it happens:** Developers build the capture pipeline as a single async chain in the service worker, assuming it runs to completion like a background page (MV2 mental model). MV3 service workers are ephemeral -- Chrome can and will terminate them aggressively.

**Consequences:** Silent data loss. Users think captures are uploading but they vanish. Worst case: users lose trust in the tool and abandon it.

**Prevention:**
- Use `chrome.offscreen.createDocument()` for any long-running work (image compression, upload). Offscreen documents are not subject to the same termination rules as service workers.
- Persist capture data to IndexedDB immediately after `captureVisibleTab()` returns, BEFORE starting compression or upload. The service worker can die and the data survives.
- Implement a retry queue: on service worker startup, check IndexedDB for unsent captures and resume uploads.
- Use `chrome.alarms` (minimum 1-minute interval) as a fallback to wake the service worker and flush the upload queue.

**Detection:** Test by capturing, then immediately closing the popup and navigating away. Check if the upload actually completes. Add telemetry for "capture saved to IndexedDB" vs "upload confirmed by backend" to detect the gap.

**Phase:** Must be addressed in Phase 1 (core capture pipeline). This is architectural -- retrofitting is painful.

---

### Pitfall 2: No Canvas/DOM APIs in Service Workers

**What goes wrong:** Image compression (resizing, quality reduction, format conversion) requires Canvas API. Service workers have no DOM and no Canvas. Code that works in a content script or popup fails silently or throws in the service worker.

**Why it happens:** Developers write compression logic, test it in the popup context where Canvas exists, then move it to the service worker for "background processing" and it breaks.

**Consequences:** Compression fails, images upload at full size (1-5 MB for high-DPI screens), blowing past the 500 KB target. Or the entire capture pipeline crashes.

**Prevention:**
- Use `chrome.offscreen.createDocument()` with reason `CANVAS` -- this is the official MV3 pattern for Canvas work in the background. The offscreen document has full DOM/Canvas access.
- Alternative: Use a library like `@aspect-ratio/image-compress` or raw `OffscreenCanvas` (available in service workers in Chrome 116+, but NOT in Firefox). For cross-browser safety, prefer the offscreen document approach.
- IMPORTANT: `OffscreenCanvas` (the Web API, not Chrome's offscreen document) is available in Chrome service workers but NOT in Firefox. Do not confuse the two concepts.

**Detection:** Test compression in the service worker context specifically. Unit tests running in Node or browser tabs will not catch this.

**Phase:** Phase 1. Compression architecture must be decided upfront.

---

### Pitfall 3: Cross-Browser MV3 Divergence (Chrome vs Firefox)

**What goes wrong:** Firefox's MV3 implementation differs from Chrome in several ways that break a "write once" approach:
- Firefox MV3 uses an "Event Page" model, not a true service worker (as of Firefox 128+). The lifecycle is similar but not identical.
- `chrome.offscreen` API does NOT exist in Firefox. Any code relying on offscreen documents needs a Firefox fallback.
- Firefox uses `browser.*` namespace (Promise-based) vs Chrome's `chrome.*` (callback-based, though Promises now work in Chrome too).
- `manifest.json` differences: Firefox requires `browser_specific_settings.gecko.id`, Chrome ignores it.
- `chrome.identity.launchWebAuthFlow()` behavior differs between browsers.

**Why it happens:** Developers build for Chrome first (larger market share), treat Firefox as "just another Chromium browser," and discover late that key APIs are missing or behave differently.

**Consequences:** Firefox version ships broken or months late. Or worse, the architecture is Chrome-only (offscreen documents everywhere) and needs a rewrite for Firefox.

**Prevention:**
- Use WXT or Plasmo framework -- they abstract many of these differences. WXT in particular has good cross-browser normalization.
- Design the compression/upload pipeline with a platform abstraction layer: `if (chrome.offscreen) { useOffscreen() } else { usePopupFallback() }`.
- For Firefox without offscreen documents: run compression in the popup context or a hidden iframe/tab. This is less clean but works.
- Test on BOTH browsers from Day 1, not as an afterthought. Set up a CI/test matrix early.
- Use `webextension-polyfill` or the framework's built-in polyfill for namespace differences.

**Detection:** Maintain a compatibility matrix document. Every time you use a Chrome-specific API, note the Firefox equivalent or fallback.

**Phase:** Phase 1 (architecture) must account for this. Phase 2+ should include Firefox smoke tests in CI.

---

### Pitfall 4: OAuth Flow Fails Silently in Extensions

**What goes wrong:** `chrome.identity.launchWebAuthFlow()` opens a browser popup for OAuth. Common failures:
- Redirect URI mismatch: the OAuth provider expects `https://<extension-id>.chromiumapp.org/` but the extension ID changes between development and production (or between Chrome and Firefox).
- The auth popup gets blocked by popup blockers or lost behind other windows.
- Supabase Auth redirect does not match the extension's expected callback format.
- Token refresh fails when the service worker is terminated -- the user appears logged out randomly.

**Why it happens:** OAuth was designed for web apps with stable URLs. Extensions have dynamic IDs, no traditional URL bar, and ephemeral background contexts. Supabase Auth documentation focuses on web/mobile, not extensions.

**Consequences:** Users cannot log in, or they get logged out randomly, or auth works in development but breaks in production (different extension ID).

**Prevention:**
- Pin the extension ID in development by setting `key` in `manifest.json` (Chrome) to ensure a stable ID during development.
- For production, the Chrome Web Store assigns a permanent ID -- configure OAuth providers with BOTH development and production redirect URIs.
- Store the auth token (JWT) in `chrome.storage.local` (not just in-memory). On service worker wake, rehydrate from storage.
- Implement a token refresh mechanism that runs on service worker startup, not on a timer (timers die with the service worker).
- For Supabase specifically: use `supabase.auth.setSession()` to restore sessions from stored tokens rather than relying on Supabase's built-in session persistence (which assumes a browser context with cookies).
- Firefox: `browser.identity.launchWebAuthFlow()` exists but the redirect URL format is `https://<addon-uuid>.extensions.allizom.org/` -- completely different from Chrome.

**Detection:** Test auth flow with a fresh extension install (no cached tokens). Test after the service worker has been idle for 5+ minutes. Test on Firefox separately.

**Phase:** Phase 2 (auth integration). But the storage pattern for tokens should be established in Phase 1 architecture.

---

### Pitfall 5: Chrome Web Store Review Rejection

**What goes wrong:** Common rejection reasons for capture/upload extensions:
- **Overly broad permissions:** Requesting `<all_urls>` or `activeTab` + `tabs` when the store reviewer thinks you only need one. `captureVisibleTab()` requires `activeTab` -- but reviewers scrutinize ANY permission that grants access to page content.
- **Missing privacy policy:** Required if you capture ANY user data (screenshots of websites are user data).
- **"Single purpose" violation:** If the extension does capture + project management + auth + settings, reviewers may argue it is not "single purpose." Frame it as "screenshot capture tool" with supporting features.
- **Remote code execution:** Any use of `eval()`, `new Function()`, or loading scripts from external URLs gets rejected. Some compression libraries use `eval` internally.
- **Host permission justification:** You must explain in the store listing WHY you need each permission.

**Why it happens:** Chrome Web Store review has gotten significantly stricter since 2023. Rules that were loosely enforced are now applied rigorously. Many guides and tutorials predate these stricter reviews.

**Consequences:** Weeks of delay. Each resubmission goes back into the review queue (3-7 days typically). Multiple rejections can flag your developer account.

**Prevention:**
- Request MINIMUM permissions. For this project: `activeTab` (for captureVisibleTab), `storage`, `offscreen`, `alarms`. Do NOT request `tabs` unless absolutely needed -- `activeTab` is sufficient for capturing the current tab.
- Write a clear privacy policy. Host it on a public URL. Explain what screenshots contain, how they are transmitted, where they are stored.
- Audit ALL dependencies for `eval()` or `new Function()` usage. Use a bundler with CSP-compatible output.
- Set Content Security Policy in manifest to disallow `unsafe-eval`.
- Submit early (even a minimal version) to establish the listing and learn the review process before the full product is ready.

**Detection:** Run `chrome.management.getSelf()` to verify permissions match expectations. Use Chrome's built-in extension audit tools. Search your bundle for `eval` and `Function(` before submission.

**Phase:** Phase 3 (distribution). But permissions must be minimized from Phase 1 -- adding permissions later requires a new review and user re-approval.

---

## Moderate Pitfalls

### Pitfall 6: High-DPI Screenshots Blow Past Size Limits

**What goes wrong:** `captureVisibleTab()` captures at the device's pixel ratio. On a Retina display (2x or 3x), a 1920x1080 viewport produces a 3840x2160 or 5760x3240 image. The raw PNG is 5-15 MB. Even after JPEG conversion at quality 80, it can be 1-3 MB -- well over the 500 KB target.

**Why it happens:** Developers test on standard DPI screens and the images are fine. They ship, and users on MacBook Pros or 4K monitors hit the size limit.

**Prevention:**
- Always downsample to 1x device pixels before compression: draw to a Canvas at `width / devicePixelRatio`.
- Use JPEG quality 75-85 as baseline. Test with complex screenshots (lots of text, gradients) -- these compress worse than simple UIs.
- Implement adaptive quality: start at quality 85, check size, reduce if over 500 KB. Cap at quality 60 minimum to avoid visible artifacts.
- Consider WebP format (smaller than JPEG at equivalent quality) -- but verify backend accepts it.

**Detection:** Test explicitly on a 2x and 3x display. Log image dimensions and file sizes in development.

**Phase:** Phase 1 (capture pipeline).

---

### Pitfall 7: Content Script Injection on Restricted Pages

**What goes wrong:** The capture animation overlay requires a content script. Content scripts CANNOT be injected into:
- `chrome://` pages (settings, extensions page, new tab in some configs)
- `chrome-extension://` pages (other extensions' pages)
- Chrome Web Store pages (`chrome.google.com/webstore`)
- `about:` pages
- Firefox equivalents: `about:`, `moz-extension://`

The user presses the shortcut on one of these pages and nothing happens -- no animation, possibly no capture, and no error message.

**Why it happens:** Developers forget that extensions have restricted page access. The keyboard shortcut fires globally but the content script cannot inject.

**Consequences:** Confusing UX -- sometimes the shortcut works, sometimes it silently fails.

**Prevention:**
- `captureVisibleTab()` itself still WORKS on most restricted pages (it captures pixels, not DOM). The animation overlay is what fails.
- Degrade gracefully: if content script injection fails, still capture and upload, just skip the animation. Show a badge on the extension icon instead (`chrome.action.setBadgeText`).
- Detect restricted pages before injection: check the URL scheme. If it starts with `chrome://`, `about:`, `chrome-extension://`, skip injection and use fallback feedback.

**Detection:** Test the shortcut on `chrome://extensions`, `chrome://settings`, the Chrome Web Store, and `about:blank`.

**Phase:** Phase 1 (capture pipeline, feedback mechanism).

---

### Pitfall 8: IndexedDB Quota and Cleanup

**What goes wrong:** If offline queuing stores full-resolution screenshots in IndexedDB, storage fills up fast. Each capture at 500 KB means 200 captures = 100 MB. Users who capture frequently while offline (or if uploads silently fail) can hit storage limits. IndexedDB eviction policies vary by browser.

**Why it happens:** The offline queue is built without a size cap or cleanup policy. Works great in testing, fails in production with heavy users.

**Prevention:**
- Set a maximum queue size (e.g., 50 pending captures or 25 MB total).
- Delete from IndexedDB immediately after confirmed upload (not after upload starts -- after backend confirms receipt).
- Implement a FIFO eviction: if queue is full, drop oldest unsynced capture and notify user via badge.
- Store compressed images in the queue, not raw captures.

**Detection:** Monitor IndexedDB usage with `navigator.storage.estimate()`. Log queue depth.

**Phase:** Phase 2 (offline queue, if implemented).

---

### Pitfall 9: Keyboard Shortcut Conflicts and Platform Differences

**What goes wrong:** The extension's keyboard shortcut conflicts with OS shortcuts, browser shortcuts, or other extensions. On macOS, many `Cmd+Shift+*` combinations are taken. On Windows/Linux, `Ctrl+Shift+*` similarly. Chrome only allows specific modifier combinations for extension commands.

**Why it happens:** Developers pick a shortcut that works on their machine and do not test across OSes or consider conflicts.

**Consequences:** The shortcut does not fire, or it triggers something else. Users do not know how to reconfigure it.

**Prevention:**
- Do NOT set a default shortcut in `manifest.json`. Instead, use `"suggested_key"` and clearly document that users can change it at `chrome://extensions/shortcuts`.
- Pick a less common default like `Alt+Shift+S` (avoid `Cmd/Ctrl+Shift+S` which is "Save As" in many apps).
- In the popup UI, show the current shortcut and link to the shortcuts configuration page.
- On macOS, `Command` maps to `MacCtrl` in Chrome extension shortcuts -- this is a common source of confusion.

**Detection:** Test on macOS, Windows, and Linux. Check if the suggested shortcut conflicts with common browser shortcuts.

**Phase:** Phase 1 (commands setup).

---

### Pitfall 10: Supabase Client Library Assumes Browser Context

**What goes wrong:** The `@supabase/supabase-js` client uses `fetch`, `localStorage`, and cookie-based session storage internally. In an MV3 service worker:
- `localStorage` does not exist (use `chrome.storage.local` instead).
- Cookie-based auth does not work (no document context).
- Auto-refresh tokens rely on `setInterval` which dies when the service worker terminates.

**Why it happens:** Supabase client was designed for web apps. Extension context is not a first-class target.

**Consequences:** Auth state is lost on service worker restart. Token refresh stops working. Users get logged out unpredictably.

**Prevention:**
- Create a custom storage adapter for Supabase that uses `chrome.storage.local` instead of `localStorage`:
  ```typescript
  const customStorage = {
    getItem: (key) => chrome.storage.local.get(key).then(r => r[key] ?? null),
    setItem: (key, value) => chrome.storage.local.set({ [key]: value }),
    removeItem: (key) => chrome.storage.local.remove(key),
  };
  const supabase = createClient(url, key, { auth: { storage: customStorage, autoRefreshToken: false } });
  ```
- Disable `autoRefreshToken` and implement manual token refresh on service worker wake-up.
- Check token expiry on every API call and refresh proactively.

**Detection:** Kill the service worker manually (chrome://serviceworker-internals) and verify auth state persists.

**Phase:** Phase 2 (auth integration). Design the storage adapter pattern in Phase 1 architecture.

---

## Minor Pitfalls

### Pitfall 11: Popup Closes on Capture and Loses State

**What goes wrong:** When the user clicks outside the popup (e.g., to the page they want to capture), the popup closes and all in-memory state is lost. If the capture flow starts from the popup, it dies mid-execution.

**Prevention:** Never initiate captures from the popup. Use keyboard shortcuts or the action icon click (`chrome.action.onClicked`). Popup is for settings and status only. All capture logic lives in the service worker.

**Phase:** Phase 1 (architecture decision).

---

### Pitfall 12: Content Security Policy Blocks Inline Styles in Content Scripts

**What goes wrong:** The capture animation overlay uses inline styles or inline scripts. MV3's strict CSP blocks inline execution in content scripts by default.

**Prevention:** Use CSS classes injected via a stylesheet file (declared in `manifest.json` under `content_scripts.css`), not inline styles. For dynamic animation, use CSS custom properties or class toggling, not `element.style`.

**Phase:** Phase 1 (animation implementation).

---

### Pitfall 13: Race Condition Between Capture and Tab Navigation

**What goes wrong:** User presses shortcut, `captureVisibleTab()` fires, but the page navigates or reloads between the shortcut event and the capture call. The captured image is of the wrong page, or the metadata (URL, title) does not match the captured content.

**Prevention:** Capture the tab metadata (URL, title) at the same time as `captureVisibleTab()` -- use `chrome.tabs.get()` in the same event handler, not from a cached value. Accept that in rare race conditions the metadata might be slightly stale; this is an acceptable edge case for v1.

**Phase:** Phase 1 (capture pipeline).

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Core capture pipeline | Service worker termination during upload (#1) | Persist to IndexedDB first, upload async with retry |
| Image compression | No Canvas in service worker (#2) | Use offscreen document (Chrome) with Firefox fallback |
| Cross-browser support | API divergence (#3) | Use WXT/Plasmo, test both browsers from Day 1 |
| Auth integration | OAuth redirect URI mismatch (#4), Supabase browser assumptions (#10) | Pin extension ID, custom storage adapter, manual token refresh |
| Capture animation | Content script restrictions (#7), CSP blocking inline styles (#12) | Graceful degradation, CSS file-based animation |
| Offline queue | IndexedDB quota exhaustion (#8) | Size caps, FIFO eviction, store compressed only |
| Distribution | Chrome Web Store rejection (#5) | Minimal permissions, privacy policy, no eval() |
| Keyboard shortcut | Conflicts and platform differences (#9) | Use suggested_key, document reconfiguration, test multi-OS |
| High-DPI handling | Oversized screenshots (#6) | Always downsample to 1x, adaptive JPEG quality |

## Confidence Notes

All pitfalls documented here are based on training data knowledge of MV3 extension development as of early 2025. Web search and fetch tools were unavailable during this research session, so findings could NOT be verified against current Chrome or Firefox documentation.

**Areas of highest confidence (MEDIUM-HIGH):**
- Service worker lifecycle termination (#1) -- well-documented, fundamental MV3 constraint
- No DOM/Canvas in service workers (#2) -- fundamental platform constraint
- Chrome Web Store review strictness (#5) -- widely reported

**Areas needing verification (MEDIUM-LOW):**
- Firefox MV3 specifics (#3) -- Firefox's MV3 implementation has been evolving rapidly; current state of `browser.offscreen` support should be verified
- Supabase client behavior in extensions (#10) -- Supabase may have added extension-specific adapters since training cutoff
- Exact `captureVisibleTab()` permissions requirements (#5) -- may have changed in recent Chrome versions

## Sources

- Chrome Extensions MV3 documentation (developer.chrome.com/docs/extensions) -- referenced from training data, not live-verified
- Firefox Extension Workshop (extensionworkshop.com) -- referenced from training data
- Supabase documentation (supabase.com/docs) -- referenced from training data
- Chrome Web Store review policies (developer.chrome.com/docs/webstore/review-process) -- referenced from training data

> **NOTE:** All sources are from training data (cutoff ~early 2025). Verify critical claims against current documentation before making architectural decisions.
