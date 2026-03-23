# Phase 1: Core Capture Pipeline - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

User can press a configurable keyboard shortcut and get a compressed, metadata-tagged screenshot of the visible viewport persisted locally (IndexedDB) with a macOS-style visual feedback animation. No network calls, no auth, no popup UI. This phase validates the hardest MV3 patterns (service worker lifecycle, offscreen document for compression, content script shadow DOM isolation) before adding any external dependencies.

</domain>

<decisions>
## Implementation Decisions

### Shutter animation
- **D-01:** Full macOS-style animation: brief white flash over viewport, thumbnail appears at bottom-right corner, holds for 2-3 seconds showing the captured image, then slides off-screen
- **D-02:** Animation rendered via shadow DOM overlay injected by content script — must not interfere with host page DOM or styles
- **D-03:** Animation should feel polished and native — this is the primary user feedback mechanism

### Default keyboard shortcut
- **D-04:** Default capture shortcut is `Ctrl+Shift+X` (Mac: `Cmd+Shift+X`)
- **D-05:** Shortcut registered via `chrome.commands` API in manifest — user can reconfigure in `chrome://extensions/shortcuts`

### Extension framework
- **D-06:** Use WXT framework (Vite-based) for MV3 scaffolding, HMR, and future cross-browser builds
- **D-07:** WXT chosen over Plasmo (lighter, Vite vs Parcel) and vanilla MV3 (too much boilerplate)

### Retina/HiDPI handling
- **D-08:** Cap screenshot resolution at 2x maximum. Downscale 3x/4x displays to 2x, keep 1x and 2x as-is
- **D-09:** This provides the best quality/file-size tradeoff — retina sharpness without excessive compression on ultra-high-DPI screens

### Image compression
- **D-10:** Use Canvas API to re-encode as WebP with quality tuning to hit <500KB target
- **D-11:** Compression happens in an offscreen document (Chrome) since Canvas API is unavailable in service workers

### Claude's Discretion
- Exact animation timing (flash duration, thumbnail size, slide speed)
- WebP quality parameter tuning (start ~0.82, adjust based on testing)
- IndexedDB schema design for local capture storage
- Offscreen document lifecycle management
- Metadata field structure for local persistence

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project requirements
- `SCREENSHOTR.md` -- Full project description including extension requirements, non-functional requirements, and tech stack rationale
- `.planning/PROJECT.md` -- Project context, core value, constraints, and key decisions
- `.planning/REQUIREMENTS.md` -- v1 requirements with IDs (CAPT-01 through CAPT-08, PLAT-01 through PLAT-03 for this phase)

### Research findings
- `.planning/research/STACK.md` -- WXT recommendation, Canvas API compression approach, idb for IndexedDB
- `.planning/research/ARCHITECTURE.md` -- MV3 component architecture, offscreen document pattern, data flow
- `.planning/research/PITFALLS.md` -- Service worker termination risks, offscreen document cross-browser gaps, message size limits

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project, no existing code

### Established Patterns
- None — patterns will be established in this phase (WXT project structure, message passing conventions, storage patterns)

### Integration Points
- IndexedDB captures stored here will be read by Phase 2 (upload pipeline) for syncing to backend
- Metadata structure defined here must be compatible with the API contracts defined in Phase 2

</code_context>

<specifics>
## Specific Ideas

- Animation should feel exactly like macOS native screenshot behavior — the user specifically chose "Full macOS style" over lighter alternatives
- `Ctrl+Shift+X` chosen as default — X for capture/snip, avoids common browser shortcut conflicts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-core-capture-pipeline*
*Context gathered: 2026-03-23*
