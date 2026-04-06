---
phase: 01-core-capture-pipeline
verified: 2026-04-06T00:00:00Z
status: human_needed
score: 10/11 must-haves verified (1 requires human)
human_verification:
  - test: "End-to-end capture with animation in Chrome"
    expected: "White flash plays (~300ms), thumbnail preview appears bottom-right (~280px), holds ~2s, slides off to the right. Service worker console shows '[screenshotr] Capture stored: {uuid} ({size}KB)' with size under 500KB. Elements panel shows animation inside a shadow root, not modifying page DOM."
    why_human: "CSS animation quality, visual correctness of flash/slide timing, and actual shadow DOM isolation cannot be verified by static code analysis alone. The build passes but behavior requires a running Chrome instance."
  - test: "Restricted page badge fallback (chrome://extensions)"
    expected: "Pressing Ctrl+Shift+X on chrome://extensions shows a green 'OK' badge on the extension icon for ~2 seconds (no animation). No error in the service worker console."
    why_human: "Content script injection behavior on privileged pages requires manual testing with a loaded extension."
---

# Phase 1: Core Capture Pipeline Verification Report

**Phase Goal:** User can press a keyboard shortcut and get a compressed, metadata-tagged screenshot persisted locally with visual feedback
**Verified:** 2026-04-06
**Status:** human_needed — all automated checks pass; 2 items require human testing
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | User presses the configured keyboard shortcut and a screenshot of the visible viewport is captured | VERIFIED | `entrypoints/background.ts` registers `chrome.commands.onCommand` for `'capture-screenshot'`; manifest.json contains command with `Ctrl+Shift+X` / `Command+Shift+X`. `captureVisibleTab` is called in the handler. |
| 2  | A macOS-style shutter animation plays on the page without disrupting the page's own content or DOM | ? HUMAN | Code and CSS are substantive and correctly wired. Shadow DOM isolation via `createShadowRootUi` + `cssInjectionMode: 'ui'` is correctly implemented. Visual behavior requires human confirmation. |
| 3  | The captured image is compressed to under 500 KB and stored locally (IndexedDB) with extracted metadata (title, domain, URL, path, timestamp) | VERIFIED | `utils/compression.ts` implements iterative WebP compression targeting `MAX_SIZE_KB: 500`. `utils/storage.ts` persists to IndexedDB via `idb`. `utils/metadata.ts` extracts title, url, domain, path, capturedAt. All three are called sequentially in the background handler. |
| 4  | The extension loads in Chrome 112+ as a Manifest V3 extension with a service worker and minimum required permissions | VERIFIED | `npm run build` exits 0. Generated manifest.json has `"manifest_version":3`, `"background":{"service_worker":"background.js"}`, `"permissions":["activeTab","storage","offscreen"]` — exactly the minimum three permissions from the plan. |

**Score:** 3/4 truths fully verified programmatically; 1 requires human.

---

## Required Artifacts

### Plan 01-01 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `wxt.config.ts` | WXT config with manifest commands and permissions | VERIFIED | Contains `'capture-screenshot'` command, `permissions: ['activeTab', 'storage', 'offscreen']`, `srcDir: '.'` |
| `entrypoints/background.ts` | Service worker with capture orchestration | VERIFIED | 105 lines; `chrome.commands.onCommand`, `captureVisibleTab`, `compressImage`, `storeCapture`, `extractMetadata`, `createThumbnail`, `compressViaOffscreenDocument` all present |
| `utils/compression.ts` | WebP compression with OffscreenCanvas + fallback | VERIFIED | Exports `compressImage`; uses `new OffscreenCanvas(...)`, `convertToBlob({ type: 'image/webp', quality })`, iterative quality loop |
| `utils/storage.ts` | IndexedDB schema and CRUD via idb | VERIFIED | Exports `getDB`, `storeCapture`, `getCapture`, `getRecentCaptures`; `ScreenshotrDB` schema; `by-status` and `by-capturedAt` indexes |
| `utils/messages.ts` | Typed message definitions | VERIFIED | Exports `BackgroundMessage`, `ContentMessage`, `OffscreenMessage`, `OffscreenResponse` as discriminated unions |
| `utils/metadata.ts` | Metadata extraction | VERIFIED | Exports `CaptureMetadata` interface and `extractMetadata` function extracting title, url, domain, path, capturedAt |
| `utils/constants.ts` | Shared constants | VERIFIED | `COMPRESSION.MAX_SIZE_KB: 500`, `ANIMATION.TOTAL_DURATION_MS: 3500`, `DB.NAME: 'screenshotr'` |
| `utils/offscreen-compress.ts` | Offscreen document fallback script | VERIFIED | Handles `COMPRESS_IMAGE_OFFSCREEN` message; Canvas-based compression; `canvas.toBlob(..., 'image/webp', q)` |
| `entrypoints/offscreen.html` | Offscreen document HTML | VERIFIED | Loads `../utils/offscreen-compress.ts`; WXT bundles to `chunks/offscreen-BZ4CCNi_.js` in build output |
| `public/icon-16.png` | Icon 16x16 | VERIFIED | File exists, 79 B in build output |
| `public/icon-48.png` | Icon 48x48 | VERIFIED | File exists, 123 B in build output |
| `public/icon-128.png` | Icon 128x128 | VERIFIED | File exists, 306 B in build output |

### Plan 01-02 Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `entrypoints/capture-overlay.content.ts` | Content script with shadow DOM animation overlay | VERIFIED | Contains `defineContentScript`, `cssInjectionMode: 'ui'`, `createShadowRootUi`, `name: 'screenshotr-capture-overlay'`, `position: 'overlay'`, handles `SHOW_CAPTURE_ANIMATION` |
| `assets/capture-animation.css` | CSS keyframe animations for flash and thumbnail preview | VERIFIED | Contains `@keyframes flash`, `@keyframes preview-in`, `@keyframes preview-hold`, `@keyframes preview-out`, `:host` with `z-index: 2147483647`, `.capture-preview img` |

---

## Key Link Verification

### Plan 01-01 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `entrypoints/background.ts` | `utils/compression.ts` | `import compressImage` | VERIFIED | Line 1: `import { compressImage } from '@/utils/compression'`; Line 41: `compressed = await compressImage(dataUrl)` |
| `entrypoints/background.ts` | `utils/storage.ts` | `import storeCapture` | VERIFIED | Line 2: `import { storeCapture } from '@/utils/storage'`; Line 48: `const captureId = await storeCapture(compressed, metadata)` |
| `entrypoints/background.ts` | `chrome.tabs.captureVisibleTab` | API call | VERIFIED | Line 17: `const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' })` |

### Plan 01-02 Key Links

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `entrypoints/background.ts` | `entrypoints/capture-overlay.content.ts` | `chrome.tabs.sendMessage` with `SHOW_CAPTURE_ANIMATION` | VERIFIED | Line 28-31: `const animMsg: BackgroundMessage = { type: 'SHOW_CAPTURE_ANIMATION', thumbnail: thumbnailDataUrl }; chrome.tabs.sendMessage(tab.id, animMsg)` |
| `entrypoints/capture-overlay.content.ts` | `assets/capture-animation.css` | CSS import with `cssInjectionMode: 'ui'` | VERIFIED | Line 1: `import '@/assets/capture-animation.css'`; content script has `cssInjectionMode: 'ui'`; build output confirms CSS bundled to `content-scripts/capture-overlay.css` (964 B) |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `entrypoints/background.ts` | `dataUrl` | `chrome.tabs.captureVisibleTab()` | Yes — live browser API | FLOWING |
| `entrypoints/background.ts` | `metadata` | `extractMetadata(tab)` — reads `tab.url`, `tab.title` | Yes — from active tab object | FLOWING |
| `entrypoints/background.ts` | `compressed` | `compressImage(dataUrl)` — OffscreenCanvas pipeline | Yes — processes real image data | FLOWING |
| `entrypoints/background.ts` | `captureId` | `storeCapture(compressed, metadata)` — IndexedDB `db.put` | Yes — persisted to IndexedDB | FLOWING |
| `entrypoints/capture-overlay.content.ts` | `thumbnail` | `msg.thumbnail` from background message | Yes — WebP data URL generated by `createThumbnail` in service worker | FLOWING |
| `entrypoints/capture-overlay.content.ts` | animation overlay | `createShadowRootUi` + DOM construction | Yes — renders received thumbnail in shadow DOM | FLOWING |

---

## Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Build produces all extension files | `npm run build` | Exit 0; 9 output files, 25.77 kB total | PASS |
| Manifest has service worker (MV3) | manifest.json check | `"background":{"service_worker":"background.js"}` | PASS |
| Manifest has correct permissions only | manifest.json check | `["activeTab","storage","offscreen"]` | PASS |
| Manifest registers keyboard shortcut | manifest.json check | `capture-screenshot` with `Ctrl+Shift+X` / `Command+Shift+X` | PASS |
| idb module exports `openDB` | node -e require check | `typeof openDB === 'function'` | PASS |
| Content script CSS bundled | build output check | `content-scripts/capture-overlay.css` (964 B) present | PASS |
| Offscreen document bundled | build output check | `offscreen.html` + `chunks/offscreen-BZ4CCNi_.js` present | PASS |

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| CAPT-01 | 01-01-PLAN.md | User can trigger screenshot with configurable global keyboard shortcut | SATISFIED | `capture-screenshot` command registered in manifest; `chrome.commands.onCommand` listener in background.ts |
| CAPT-02 | 01-01-PLAN.md | Extension captures visible viewport using `chrome.tabs.captureVisibleTab()` | SATISFIED | `captureVisibleTab(tab.windowId, { format: 'png' })` called in background.ts line 17 |
| CAPT-03 | 01-01-PLAN.md | Extension automatically extracts page title, domain, full URL, and path on capture | SATISFIED | `extractMetadata` returns `{ title, url, domain, path, capturedAt }` from `chrome.tabs.Tab` |
| CAPT-04 | 01-01-PLAN.md | Extension extracts timestamp at moment of capture | SATISFIED | `capturedAt: Date.now()` in `extractMetadata` (metadata.ts line 27) |
| CAPT-05 | 01-01-PLAN.md | Extension compresses captured image to under 500 KB without visible quality loss | SATISFIED | Iterative WebP compression loop in `compressImage`; `MAX_SIZE_KB: 500`; loop continues until `result.size <= 500 * 1024` |
| CAPT-07 | 01-02-PLAN.md | Extension displays macOS-style camera shutter animation (thumbnail preview sliding to corner) on capture | SATISFIED (code) / HUMAN (visual) | Full CSS animation chain (flash + preview-in + preview-hold + preview-out) implemented; visual behavior needs human confirmation |
| CAPT-08 | 01-02-PLAN.md | Capture animation uses shadow DOM overlay and does not modify host page's DOM | SATISFIED (code) / HUMAN (runtime) | `createShadowRootUi` with `cssInjectionMode: 'ui'` correctly isolates CSS; runtime DOM isolation needs human confirmation |
| PLAT-01 | 01-01-PLAN.md | Extension works on Chrome 112+ using Manifest V3 | SATISFIED | `manifest_version: 3`; builds successfully; `npm run build` exits 0 |
| PLAT-02 | 01-01-PLAN.md | Extension uses MV3 service worker (not background page) | SATISFIED | `"background":{"service_worker":"background.js"}` in generated manifest |
| PLAT-03 | 01-01-PLAN.md | Extension requests only minimum required permissions | SATISFIED | `permissions: ["activeTab","storage","offscreen"]` — exactly as specified in plan; no extra permissions |

**Orphaned requirements check:** All 10 requirement IDs from the ROADMAP phase mapping (CAPT-01 through CAPT-05, CAPT-07, CAPT-08, PLAT-01, PLAT-02, PLAT-03) are covered by 01-01-PLAN.md (CAPT-01 to CAPT-05, PLAT-01 to PLAT-03) and 01-02-PLAN.md (CAPT-07, CAPT-08). No orphaned requirements.

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `entrypoints/background.ts` | 43 | Comment `// OffscreenCanvas not available (Chrome <116) -- use offscreen document` | Info | Legitimate inline explanation of fallback path; not a stub marker |

No stubs, placeholders, empty implementations, or hardcoded data found in production code paths. All data flows to real operations (capture API, compression, IndexedDB writes).

---

## Human Verification Required

### 1. End-to-End Capture with Animation

**Test:** Load the extension in Chrome (run `npm run build`, open `chrome://extensions`, load unpacked from `.output/chrome-mv3/`). Navigate to any normal website (e.g., https://example.com). Press `Cmd+Shift+X` (Mac) or `Ctrl+Shift+X` (Windows/Linux).

**Expected:**
- Brief white flash over the viewport (~300ms)
- Thumbnail preview appears at bottom-right (~280px wide), animates in from scale(0.3)
- Thumbnail holds for ~2 seconds
- Thumbnail slides off to the right
- Service worker console (via chrome://extensions > service worker link) shows: `[screenshotr] Capture stored: {uuid} ({size}KB)` with size under 500
- DevTools Elements panel shows the animation inside a `screenshotr-capture-overlay` shadow root element — NOT modifying page elements directly

**Why human:** CSS animation quality (timing feel, visual smoothness), actual shadow DOM isolation in the Elements panel, and the capture log message can only be confirmed in a running Chrome instance.

### 2. Restricted Page Badge Fallback

**Test:** With extension loaded, navigate to `chrome://extensions` and press the keyboard shortcut.

**Expected:**
- No animation (content scripts cannot inject on privileged pages)
- Green "OK" badge appears on the extension icon for approximately 2 seconds
- Badge clears after 2 seconds
- No errors in the service worker console (the `.catch()` handles the injection failure gracefully)

**Why human:** Content script injection blocking on `chrome://` URLs is a Chrome security boundary that can only be verified at runtime.

---

## Gaps Summary

No blocking gaps found. All 13 artifacts exist with substantive implementations (not stubs). All 5 key links are verified (imports present and values used). All 10 requirements have implementation evidence. The build passes cleanly (`npm run build` exits 0, 25.77 kB total output).

The 2 human verification items are behavioral tests that require a running Chrome instance — they cannot be blocked by static analysis. The code implementing CAPT-07 (animation) and CAPT-08 (shadow DOM isolation) is correct and complete; the human tests confirm the runtime behavior matches the implementation intent.

---

_Verified: 2026-04-06_
_Verifier: Claude (gsd-verifier)_
