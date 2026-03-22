# Requirements: ScreenshotR Extension

**Defined:** 2026-03-22
**Core Value:** One-keystroke screenshot capture with zero manual organization

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Capture

- [ ] **CAPT-01**: User can trigger a screenshot capture with a configurable global keyboard shortcut
- [ ] **CAPT-02**: Extension captures the visible viewport using `chrome.tabs.captureVisibleTab()`
- [ ] **CAPT-03**: Extension automatically extracts page title, domain, full URL, and path on capture
- [ ] **CAPT-04**: Extension extracts timestamp at moment of capture
- [ ] **CAPT-05**: Extension compresses captured image to under 500 KB without visible quality loss (Canvas API → WebP)
- [ ] **CAPT-06**: Capture-to-upload cycle completes in under 3 seconds on standard broadband
- [ ] **CAPT-07**: Extension displays macOS-style camera shutter animation (thumbnail preview sliding to corner) on capture
- [ ] **CAPT-08**: Capture animation uses shadow DOM overlay and does not modify the host page's DOM
- [ ] **CAPT-09**: Extension auto-generates tags from URL path segments (e.g., `/checkout/confirm` → tags: "checkout", "confirm")

### Upload & Storage

- [ ] **UPLD-01**: Extension uploads compressed image + metadata to backend API after capture
- [ ] **UPLD-02**: Each capture is associated with the user's currently selected project
- [ ] **UPLD-03**: Extension queues captures in IndexedDB when offline and syncs when connectivity is restored
- [ ] **UPLD-04**: Extension icon badge shows pending upload count and clears on successful sync
- [ ] **UPLD-05**: Extension defines TypeScript API contracts (endpoints, request/response types) for backend team alignment

### Auth

- [ ] **AUTH-01**: User can sign in via OAuth (Google) through Supabase Auth
- [ ] **AUTH-02**: User can sign in via OAuth (GitHub) through Supabase Auth
- [ ] **AUTH-03**: Extension persists auth tokens and maintains session across browser restarts
- [ ] **AUTH-04**: Extension refreshes expired tokens automatically without user intervention

### Popup UI

- [ ] **POPU-01**: User can view and select active project from a list fetched from the API
- [ ] **POPU-02**: User can view recent captures (thumbnail, title, timestamp) in the popup
- [ ] **POPU-03**: User can access settings (keyboard shortcut info, account, active project)
- [ ] **POPU-04**: Popup shows current auth state (signed in/out) with sign-in/sign-out action

### Platform

- [ ] **PLAT-01**: Extension works on Chrome 112+ using Manifest V3
- [ ] **PLAT-02**: Extension uses MV3 service worker (not background page)
- [ ] **PLAT-03**: Extension requests only minimum required permissions

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Cross-Browser

- **XBRW-01**: Extension works on Firefox 115+ with MV3 compatibility
- **XBRW-02**: Offscreen document fallback for Firefox (which lacks `chrome.offscreen` API)

### Capture Enhancements

- **CAPT-10**: Extension tracks batch session context (session ID + sequence number) for flow reconstruction
- **CAPT-11**: Extension shows subtle "already captured" hint when same URL is captured twice in a session

### Power User

- **POWR-01**: User can cycle active project via keyboard shortcut without opening popup

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Full-page scrolling capture | Requires DOM injection or complex stitching; violates no-DOM-modification constraint; users scroll and capture incrementally |
| Annotation/drawing tools | Massive UI complexity; not core value; belongs in dashboard if anywhere |
| Region/area selection | Requires DOM injection for selection rectangle; conflicts with one-keystroke philosophy |
| Video/GIF recording | Different technical domain entirely; dilutes product focus |
| Built-in image editor | Extensions have tiny UI real estate; dashboard feature if needed |
| Direct social sharing | Not the UX research use case; dashboard handles distribution |
| Page DOM inspection | Different product category (CSS Peeper, WhatFont); not aligned with capture focus |
| AI-powered analysis | Premature, expensive, belongs server-side if ever built |
| Clipboard copy as default | Upload-first is the core value; clipboard undermines auto-organize promise |
| Figma plugin | Post-launch consideration per project spec |
| Self-hosted deployment | Not applicable to browser extension |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CAPT-01 | Phase 1 | Pending |
| CAPT-02 | Phase 1 | Pending |
| CAPT-03 | Phase 1 | Pending |
| CAPT-04 | Phase 1 | Pending |
| CAPT-05 | Phase 1 | Pending |
| CAPT-06 | Phase 2 | Pending |
| CAPT-07 | Phase 1 | Pending |
| CAPT-08 | Phase 1 | Pending |
| CAPT-09 | Phase 2 | Pending |
| UPLD-01 | Phase 2 | Pending |
| UPLD-02 | Phase 2 | Pending |
| UPLD-03 | Phase 2 | Pending |
| UPLD-04 | Phase 2 | Pending |
| UPLD-05 | Phase 2 | Pending |
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 3 | Pending |
| POPU-01 | Phase 3 | Pending |
| POPU-02 | Phase 3 | Pending |
| POPU-03 | Phase 3 | Pending |
| POPU-04 | Phase 3 | Pending |
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |

**Coverage:**
- v1 requirements: 25 total
- Mapped to phases: 25
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
*Last updated: 2026-03-22 after roadmap creation*
