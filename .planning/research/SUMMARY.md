# Project Research Summary

**Project:** ScreenshotR Extension
**Domain:** MV3 Browser Extension — Screenshot Capture & Auto-Organization for UX Research
**Researched:** 2026-03-22
**Confidence:** MEDIUM

## Executive Summary

ScreenshotR occupies a genuine market gap: no existing tool combines effortless one-keystroke screenshot capture with intelligent auto-organization by domain and URL structure. Generic capture extensions (GoFullPage, Awesome Screenshot, Fireshot) are dumb pipes to local files with no organizing intelligence. UX research platforms (Mobbin, Page Flows) are curated SaaS libraries, not user-capture tools. ScreenshotR's recommended approach is a lean, MV3-native extension built with WXT (Vite-based framework), vanilla TypeScript for the popup UI, and a write-through offline queue architecture using IndexedDB. This keeps the bundle small, the capture loop fast, and the cross-browser story manageable from day one.

The recommended build order is: prove the core capture loop first (shortcut → capture → compress → animation), add persistence and upload second, then layer auth and UI on top. This order is dictated by hard MV3 architectural constraints: the service worker is ephemeral and must never hold state in memory, Canvas API is unavailable in the service worker (requiring an offscreen document for compression), and Firefox lacks offscreen document support entirely (requiring a OffscreenCanvas fallback in the service worker). Getting these constraints wrong early means painful rewrites. Getting them right means everything else snaps into place cleanly.

The biggest risks are the service worker termination pattern (silent data loss if captures aren't persisted to IndexedDB before upload begins), OAuth complexity in an extension context (dynamic extension IDs, Supabase's browser-first assumptions), and Chrome Web Store review rejection from overly broad permissions. All three are preventable if addressed in Phase 1 architecture — none are recoverable quickly if discovered in Phase 3. The research is based on training data through early 2025; a handful of fast-moving items (Firefox MV3 specifics, Chrome OffscreenCanvas in service workers, Supabase extension adapter availability) should be verified against current docs before finalizing architecture decisions.

## Key Findings

### Recommended Stack

WXT is the clear framework choice over Plasmo — it is Vite-native (faster builds, larger plugin ecosystem), has more mature Firefox support, and ships a typed `wxt/storage` wrapper that solves the cross-context storage problem out of the box. The popup should use vanilla TypeScript, not React or Svelte — popup startup latency is real and the popup has only 3-4 views. Compression uses the Canvas API (via offscreen document) targeting WebP output, which produces 30-50% smaller files than JPEG at equivalent quality. Supabase JS v2 handles auth but requires a custom storage adapter to replace `localStorage` with `chrome.storage.local` in the service worker context. See [STACK.md](./STACK.md) for full rationale.

**Core technologies:**
- **WXT** (^0.19.x): Extension framework — Vite-native, cross-browser MV3, file-based entrypoints, built-in typed storage
- **Vanilla TypeScript**: Popup UI — tiny bundle, instant popup open time, sufficient for 3-4 view popup
- **@supabase/supabase-js** (^2.x): Auth SDK — handles OAuth flow with custom chrome.storage adapter required
- **Canvas API + Offscreen Document**: Image compression — zero-dependency, offscreen doc required for DOM access in background
- **idb** (^8.x): IndexedDB wrapper — 1.2KB, promise-based, for offline capture queue
- **wxt/storage**: Extension settings — typed wrapper for chrome.storage.local/session, bundled with WXT
- **Zod** (^3.x): API contract validation — runtime validation + TypeScript inference, single source of truth
- **fetch (built-in)**: HTTP client — axios fails in MV3 service workers, native fetch works everywhere
- **Vitest** (^2.x): Testing — Vite-native, integrates seamlessly with WXT build pipeline

### Expected Features

The capture loop (auth → projects → select → capture → compress → upload) is the critical path. Everything else is additive. See [FEATURES.md](./FEATURES.md) for competitor matrix and full rationale.

**Must have (table stakes):**
- One-keystroke viewport capture — baseline expectation; `captureVisibleTab()` is the correct API
- Visual capture feedback (shutter animation) — users need confirmation; content script shadow DOM overlay
- Automatic metadata extraction — title, URL, domain, path, timestamp from `tab` API; zero-friction differentiator
- Project-based organization — popup project selector; single-click active project switching
- Image compression to <500KB — Canvas API WebP output; adaptive quality fallback
- OAuth login (Google minimum) — Supabase Auth; requires custom storage adapter pattern
- Recent captures view — confidence that the pipeline is working; 5-10 items from API or local cache

**Should have (differentiators — Phase 2):**
- Auto-tagging from URL path segments — `pathname.split('/')` produces tags with near-zero implementation cost
- Capture status badge — `chrome.action.setBadgeText()` with pending count; upload confidence indicator
- Batch session context — UUID + sequence number per capture; enables dashboard flow reconstruction
- Offline queue with sync — IndexedDB write-through, exponential backoff retry; most competitors simply fail offline

**Defer (Phase 3+):**
- Smart deduplication hints — session URL tracking; useful but not critical for launch
- Keyboard project cycling — power user feature; low priority
- Firefox support — smaller audience, more MV3 quirks; Chrome first, Firefox second

**Explicitly never:**
Full-page capture, annotation tools, region selection, video recording, built-in image editor, social sharing, DOM inspection, AI analysis in extension, clipboard-first behavior.

### Architecture Approach

The extension has five distinct execution contexts (Service Worker, Content Script, Popup, Offscreen Document, Auth) with strict message-passing boundaries. The Service Worker is the orchestrator but is ephemeral — every state access must go through `chrome.storage`, never in-memory variables. The offscreen document provides Canvas access for compression (Chrome); Firefox requires an `OffscreenCanvas` fallback directly in the service worker. The content script does exactly two things: show the shutter animation overlay (via shadow DOM) and read page metadata. The popup is a pure view layer — it reads from `chrome.storage` on open and writes changes back; no persistent state. See [ARCHITECTURE.md](./ARCHITECTURE.md) for full data flow and code patterns.

**Major components:**
1. **Service Worker** — command listener, capture orchestrator, upload manager, offline queue coordinator; stateless, storage-backed
2. **Offscreen Document** — Canvas-based image compression (Chrome only); created on demand, reused, closed when idle
3. **Content Script** — shadow DOM animation overlay + metadata extraction only; no DOM modification beyond the temporary overlay
4. **Popup UI** — project selector, recent captures, auth status; pure view layer reading from chrome.storage
5. **IndexedDB Queue** — write-through capture persistence via `idb`; survives service worker termination; FIFO eviction at 50 captures or 25MB

### Critical Pitfalls

See [PITFALLS.md](./PITFALLS.md) for full details including detection strategies and phase assignments.

1. **Service worker termination kills in-flight uploads** — Persist to IndexedDB immediately after `captureVisibleTab()` returns, before compression or upload begins. Use `chrome.alarms` as periodic retry trigger. Architectural decision — must be correct from Phase 1.

2. **No Canvas API in service workers** — Use `chrome.offscreen.createDocument()` with reason `CANVAS` for Chrome. Use `OffscreenCanvas` Web API as Firefox fallback (available in Firefox service workers, NOT in Chrome service workers as of early 2025). Design the compression abstraction layer to support both paths from the start.

3. **Supabase client assumes browser context** — `localStorage`, cookie-based sessions, and `setInterval` token refresh all fail in MV3 service workers. Implement a custom storage adapter using `chrome.storage.local` and disable `autoRefreshToken`; refresh manually on service worker wake-up.

4. **OAuth redirect URI mismatch** — Extension IDs differ between development, staging, and production (Chrome) and between Chrome and Firefox. Pin the extension ID during development via `manifest.json` `key` field. Configure OAuth providers with both development and production URIs before starting auth integration.

5. **Chrome Web Store rejection from overly broad permissions** — Request minimum permissions only: `activeTab`, `storage`, `offscreen`, `alarms`. Audit all dependencies for `eval()` or `new Function()` before submission. Write a public privacy policy covering screenshot data transmission and storage. Submit a minimal version early to learn the review process.

## Implications for Roadmap

Based on research, the phase structure below is strongly recommended. The ordering is dictated by hard technical dependencies: Phase 1 has zero external dependencies and validates the hardest MV3 patterns; Phase 2 adds persistence and can run against a mock API; Phase 3 requires the real Supabase project; Phase 4 is hardening.

### Phase 1: Core Capture Pipeline

**Rationale:** Zero external dependencies (no backend, no auth server required). Validates the hardest and most extension-specific patterns: service worker lifecycle, offscreen document, content script shadow DOM isolation. If the capture loop is wrong, nothing built on top of it works. Must establish the write-through IndexedDB pattern here — retrofitting it later is a painful rewrite.

**Delivers:** Press shortcut → capture → compress → animation plays → data written to IndexedDB. Provable, demonstrable, no network needed.

**Addresses:** One-keystroke capture, viewport screenshot, capture animation feedback, image compression, metadata extraction, offline queue foundation.

**Avoids:**
- Pitfall 1 (service worker termination) — IndexedDB write-through is the first thing after `captureVisibleTab()`
- Pitfall 2 (no Canvas in service worker) — offscreen document architecture established here
- Pitfall 6 (high-DPI screenshots) — adaptive quality + 1x downsampling baked into compression module
- Pitfall 7 (content script restrictions) — graceful degradation on restricted pages
- Pitfall 9 (keyboard shortcut conflicts) — `suggested_key`, not default; show in popup
- Pitfall 11 (popup closes during capture) — all capture logic in service worker, never in popup
- Pitfall 12 (CSP blocks inline styles) — CSS file-based animation from the start
- Pitfall 13 (race condition on navigation) — capture metadata and image in same event handler

### Phase 2: Storage, Upload, and Offline Queue

**Rationale:** Persistence and networking are a self-contained layer that can be developed and tested against a mock backend API. Adding the offline queue at this stage (rather than later) makes it architecturally sound — it is not bolted on. The Zod contract types force an explicit API contract to be defined before upload code is written, which catches backend/extension disagreements early.

**Delivers:** Full capture → compress → queue → upload pipeline with exponential backoff retry and online/offline detection.

**Uses:** `idb` for IndexedDB queue, `fetch` for upload API, `Zod` for API contract validation, `wxt/storage` for settings.

**Implements:** Offline queue component (write-through, FIFO eviction, max 50 items / 25MB), upload module (multipart POST, auth header injection), retry logic (`navigator.onLine` + `chrome.alarms`).

**Avoids:**
- Pitfall 1 (service worker termination) — queue survives restarts
- Pitfall 8 (IndexedDB quota exhaustion) — size caps and FIFO eviction built in here

### Phase 3: Auth and Popup UI

**Rationale:** Auth requires the real Supabase project configuration (client ID, redirect URIs, OAuth provider setup). The popup UI depends on having real project data to display. Building auth third means the capture loop is fully proven before adding the auth dependency.

**Delivers:** Complete authenticated capture workflow — login with Google OAuth, project list fetch, active project selection, recent captures view, auth state in popup.

**Uses:** `@supabase/supabase-js` with custom `chrome.storage.local` adapter, `wxt/storage` for token persistence, typed message bus for popup ↔ service worker communication.

**Implements:** Auth module (OAuth flow, custom storage adapter, manual token refresh on wake), Popup UI (project selector, recent captures list, auth status, settings), Supabase client (manual token refresh, no `setInterval`).

**Avoids:**
- Pitfall 4 (OAuth redirect URI mismatch) — extension ID pinned, both URIs registered
- Pitfall 10 (Supabase browser assumptions) — custom storage adapter + disabled autoRefreshToken

**Research flag:** This phase benefits from a research-phase step to verify current Supabase extension adapter availability and current OAuth extension ID pinning procedures. These are medium-confidence findings from training data.

### Phase 4: Quality Features and Cross-Browser

**Rationale:** Quality-of-life features (auto-tagging, status badge, session context) and Firefox support are lower risk and can be added once the core loop is proven. Firefox is a separate distribution target with meaningful quirks; tackling it after Chrome is stable reduces risk surface.

**Delivers:** Auto-tagging from URL paths, capture status badge, batch session context for flow reconstruction, Firefox compatibility, error handling hardening, performance validation against timing budget.

**Implements:** URL path parser for auto-tags, `chrome.action.setBadgeText()` badge management, session UUID + sequence number tracking, Firefox `OffscreenCanvas` fallback for compression, cross-browser smoke tests in CI.

**Avoids:**
- Pitfall 3 (cross-browser MV3 divergence) — Firefox `OffscreenCanvas` fallback for compression, WXT handles namespace differences

**Research flag:** Firefox MV3 specifics (current offscreen document support status, `OffscreenCanvas` extension service worker support) are the lowest-confidence findings in this research. Verify against current MDN and Firefox Extension Workshop documentation before implementing Firefox support.

### Phase Ordering Rationale

- **Dependency order forces Phase 1 first:** The service worker lifecycle and offscreen document patterns are foundational. Getting them wrong means rewriting everything.
- **Mock-API-compatible Phase 2:** Upload and queue can be built and tested with a mock backend. This decouples extension development from backend readiness.
- **Auth is last because it requires external config:** Supabase project setup, OAuth provider registration, and extension ID pinning are external dependencies. Building auth third lets the team move in parallel.
- **Cross-browser deferred to Phase 4:** Firefox represents a smaller audience and adds meaningful complexity. Chrome-first is a deliberate risk reduction choice, not an oversight.
- **Anti-features are locked out from Phase 1:** Full-page capture, annotation, region selection, and DOM inspection are explicitly excluded. The architecture (service worker orchestration, `captureVisibleTab()` only) makes adding them difficult by design.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 3 (Auth):** Supabase extension adapter availability may have changed since training data cutoff; current OAuth extension ID pinning procedure should be verified against current Chrome and Supabase docs before implementation begins.
- **Phase 4 (Firefox):** Firefox MV3 status and `OffscreenCanvas` support in extension service workers are the lowest-confidence findings in this research. Verify against current MDN and Firefox Extension Workshop before building the Firefox target.

Phases with standard patterns (can skip research-phase):
- **Phase 1 (Core Capture):** `captureVisibleTab()`, offscreen documents, service worker lifecycle, and shadow DOM overlays are well-documented MV3 patterns with high-confidence implementation guidance.
- **Phase 2 (Storage + Upload):** IndexedDB via `idb`, fetch-based multipart upload, and Zod contract validation are mature, stable patterns with abundant documentation.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | MEDIUM | WXT and Supabase versions unverified against npm; Canvas/fetch/idb recommendations are HIGH confidence; WXT 0.x API surface may have changed if graduated to 1.x |
| Features | MEDIUM | Competitor analysis based on training data through early 2025; Chrome Web Store listings should be spot-checked before finalizing roadmap |
| Architecture | MEDIUM | Core MV3 patterns (service worker lifecycle, offscreen docs, content script isolation) are well-documented and HIGH confidence; Firefox-specific claims (OffscreenCanvas in SW, offscreen doc absence) are MEDIUM and need verification |
| Pitfalls | MEDIUM-HIGH | Service worker termination and Canvas-in-SW pitfalls are fundamental platform constraints (HIGH confidence); OAuth and Supabase-specific pitfalls are MEDIUM and benefit from current-doc verification |

**Overall confidence:** MEDIUM — sufficient to begin Phase 1 with high confidence; Phase 3 and 4 need targeted verification before planning.

### Gaps to Address

- **WXT version and API surface:** Run `npm view wxt version` and check wxt.dev for breaking changes if WXT has graduated from 0.x to 1.x since early 2025 training data cutoff.
- **Firefox OffscreenCanvas in service workers:** Training data indicates Chrome service workers lack `OffscreenCanvas` support but Firefox has it. This is the architectural basis for the cross-browser compression strategy. Verify against current MDN before committing to this design.
- **Supabase extension adapter:** Supabase may have shipped first-class extension support (custom storage adapter, token handling) since training cutoff. Check supabase.com/docs before building the custom adapter pattern.
- **Chrome Web Store permission review current state:** Store review policies have been tightening. Verify current `activeTab` + `offscreen` permission acceptance for capture extensions before final manifest design.
- **Chrome `captureVisibleTab()` without `tabs` permission:** Training data suggests `activeTab` alone is sufficient for capture. Verify this is still the case in current Chrome MV3 docs.

## Sources

### Primary (HIGH confidence)
- Chrome Extensions MV3 API documentation (developer.chrome.com/docs/extensions) — `captureVisibleTab()`, `chrome.commands`, `chrome.storage`, offscreen documents, service worker lifecycle
- MDN WebExtensions documentation (developer.mozilla.org) — Firefox MV3, `browser.*` namespace, `OffscreenCanvas`
- Jake Archibald's `idb` library (github.com/jakearchibald/idb) — IndexedDB wrapper, API, size

### Secondary (MEDIUM confidence)
- WXT official documentation (wxt.dev) — framework API, storage utilities, cross-browser output
- Zod documentation (zod.dev) — schema validation, TypeScript inference API
- Supabase Auth documentation (supabase.com/docs/guides/auth) — OAuth flow, session management
- Chrome Web Store review policies (developer.chrome.com/docs/webstore) — permission scrutiny, single-purpose rule

### Tertiary (MEDIUM-LOW confidence — needs verification)
- Plasmo documentation (docs.plasmo.com) — used for WXT comparison; Plasmo 2024-2025 development pace claims
- Competitor feature analysis (GoFullPage, Awesome Screenshot, Fireshot, Nimbus, Mobbin) — based on training data, not current Chrome Web Store listings

---
*Research completed: 2026-03-22*
*Ready for roadmap: yes*
