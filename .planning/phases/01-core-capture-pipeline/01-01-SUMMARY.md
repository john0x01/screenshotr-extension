---
phase: 01-core-capture-pipeline
plan: 01
subsystem: capture
tags: [wxt, chrome-mv3, webp, offscreen-canvas, indexeddb, idb, service-worker]

# Dependency graph
requires: []
provides:
  - WXT project scaffold with Chrome MV3 manifest
  - Capture pipeline (shortcut -> captureVisibleTab -> compress -> store)
  - WebP compression with OffscreenCanvas and offscreen document fallback
  - IndexedDB storage schema via idb with status and timestamp indexes
  - Typed message bus for cross-context communication
  - Metadata extraction (title, domain, URL, path, timestamp)
affects: [01-02-capture-animation, 02-upload-pipeline, 03-auth-ui]

# Tech tracking
tech-stack:
  added: [wxt@0.20.20, idb@8.0.3, typescript@5.x]
  patterns: [stateless-service-worker, offscreen-canvas-compression, typed-message-bus, indexeddb-via-idb]

key-files:
  created:
    - wxt.config.ts
    - package.json
    - tsconfig.json
    - entrypoints/background.ts
    - entrypoints/offscreen.html
    - utils/compression.ts
    - utils/storage.ts
    - utils/metadata.ts
    - utils/messages.ts
    - utils/constants.ts
    - utils/offscreen-compress.ts
    - public/icon-16.png
    - public/icon-48.png
    - public/icon-128.png
  modified: []

key-decisions:
  - "Moved offscreen script to utils/offscreen-compress.ts to avoid WXT entrypoint name collision"
  - "OffscreenCanvas primary compression path with offscreen document fallback for Chrome <116"
  - "Badge text fallback for restricted pages where content script cannot inject"

patterns-established:
  - "Stateless service worker: all state persisted to IndexedDB, no in-memory variables"
  - "Typed message bus: discriminated unions for all cross-context messages"
  - "Iterative compression: start at quality 0.82, step down 0.05 until under 500KB"
  - "Offscreen document as fallback only: OffscreenCanvas preferred in service worker"

requirements-completed: [CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, PLAT-01, PLAT-02, PLAT-03]

# Metrics
duration: 4min
completed: 2026-03-23
---

# Phase 1 Plan 1: Core Capture Pipeline Summary

**WXT Chrome MV3 extension with keyboard-triggered viewport capture, WebP compression via OffscreenCanvas, metadata extraction, and IndexedDB persistence**

## Performance

- **Duration:** 4 min
- **Started:** 2026-03-23T16:22:13Z
- **Completed:** 2026-03-23T16:26:30Z
- **Tasks:** 2
- **Files modified:** 15

## Accomplishments
- Complete WXT project scaffold building for Chrome MV3 with correct permissions (activeTab, storage, offscreen)
- Full capture pipeline: Ctrl+Shift+X triggers captureVisibleTab, compresses to WebP under 500KB, extracts metadata, stores in IndexedDB
- Offscreen document fallback for Chrome 112-115 where OffscreenCanvas is unavailable in service workers
- Typed message definitions for background, content, and offscreen communication

## Task Commits

Each task was committed atomically:

1. **Task 1: Scaffold WXT project and configure manifest** - `d81ce90` (feat)
2. **Task 2: Implement compression, storage, metadata, offscreen fallback, and background capture handler** - `796e82c` (feat)

Supporting commits:
- `1bf3f27` - chore: add .gitignore for build outputs and node_modules

## Files Created/Modified
- `wxt.config.ts` - WXT config with manifest permissions and keyboard shortcut command
- `package.json` - Project manifest with wxt and idb dependencies
- `tsconfig.json` - TypeScript config extending WXT-generated tsconfig
- `entrypoints/background.ts` - Service worker: command listener, capture orchestration, compress, store
- `entrypoints/offscreen.html` - Offscreen document HTML entrypoint for Chrome <116 fallback
- `utils/compression.ts` - OffscreenCanvas WebP compression with iterative quality tuning
- `utils/storage.ts` - IndexedDB schema and CRUD via idb (captures store with status/timestamp indexes)
- `utils/metadata.ts` - Page metadata extraction from chrome.tabs.Tab
- `utils/messages.ts` - Typed discriminated union message definitions
- `utils/constants.ts` - Compression, animation, and DB configuration constants
- `utils/offscreen-compress.ts` - Canvas-based compression for offscreen document fallback
- `public/icon-16.png` - Extension icon 16x16
- `public/icon-48.png` - Extension icon 48x48
- `public/icon-128.png` - Extension icon 128x128
- `.gitignore` - Ignore node_modules, .output, .wxt

## Decisions Made
- **Offscreen script location:** Moved `offscreen.ts` from `entrypoints/` to `utils/offscreen-compress.ts` because WXT treats both `offscreen.html` and `offscreen.ts` as separate entrypoints with the same name, causing a build error. The HTML entrypoint loads the script via a relative import.
- **OffscreenCanvas as primary path:** The service worker uses OffscreenCanvas directly (Chrome 116+) with offscreen document as fallback, rather than always using the offscreen document. This simplifies the common case.
- **Badge feedback fallback:** On restricted pages where content scripts cannot inject, the extension shows a green "OK" badge for 2 seconds as capture confirmation.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] WXT entrypoint name collision for offscreen document**
- **Found during:** Task 2 (build verification)
- **Issue:** WXT detected `entrypoints/offscreen.html` and `entrypoints/offscreen.ts` as two entrypoints with the same name "offscreen", causing build failure
- **Fix:** Moved offscreen script to `utils/offscreen-compress.ts` and updated HTML to reference `../utils/offscreen-compress.ts`
- **Files modified:** `entrypoints/offscreen.html`, `utils/offscreen-compress.ts` (moved from `entrypoints/offscreen.ts`)
- **Verification:** `npm run build` passes, offscreen.html included in build output
- **Committed in:** 796e82c (Task 2 commit)

**2. [Rule 3 - Blocking] Missing .gitignore for generated build artifacts**
- **Found during:** Post-task verification
- **Issue:** `.output/`, `.wxt/`, and `node_modules/` were untracked generated files
- **Fix:** Created `.gitignore` with standard exclusions
- **Files modified:** `.gitignore`
- **Committed in:** 1bf3f27

---

**Total deviations:** 2 auto-fixed (2 blocking)
**Impact on plan:** Both fixes necessary for build correctness and clean repo state. No scope creep.

## Issues Encountered
- WXT `init` command requires interactive terminal for package manager selection; scaffolded project manually instead of using `npx wxt@latest init`

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all data paths are fully wired. The capture pipeline is complete from shortcut to IndexedDB storage. Animation content script is not yet implemented (separate plan 01-02).

## Next Phase Readiness
- Capture pipeline is complete and ready for the animation overlay (plan 01-02)
- IndexedDB storage schema is ready for Phase 2 upload pipeline to read from
- Message types are defined for content script communication (plan 01-02)
- Metadata structure is compatible with future API contract definitions

---
*Phase: 01-core-capture-pipeline*
*Completed: 2026-03-23*
