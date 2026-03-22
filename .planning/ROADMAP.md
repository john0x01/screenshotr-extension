# Roadmap: ScreenshotR Extension

## Overview

This roadmap delivers a one-keystroke screenshot capture extension for Chrome in three phases. Phase 1 proves the core capture loop works (shortcut, screenshot, compress, animate, persist) with zero network dependencies. Phase 2 adds the upload pipeline, offline queue, and API contracts so captures flow to the backend. Phase 3 layers authentication and the popup UI so users can log in, pick projects, and see their captures. Each phase delivers a complete, testable capability.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Core Capture Pipeline** - Shortcut triggers viewport capture, compression, animation, and local persistence
- [ ] **Phase 2: Upload, Storage & API Contracts** - Captures upload to backend with offline queue, retry, and defined API types
- [ ] **Phase 3: Auth & Popup UI** - OAuth login, project selection, recent captures view, and settings

## Phase Details

### Phase 1: Core Capture Pipeline
**Goal**: User can press a keyboard shortcut and get a compressed, metadata-tagged screenshot persisted locally with visual feedback
**Depends on**: Nothing (first phase)
**Requirements**: CAPT-01, CAPT-02, CAPT-03, CAPT-04, CAPT-05, CAPT-07, CAPT-08, PLAT-01, PLAT-02, PLAT-03
**Success Criteria** (what must be TRUE):
  1. User presses the configured keyboard shortcut and a screenshot of the visible viewport is captured
  2. A macOS-style shutter animation plays on the page without disrupting the page's own content or DOM
  3. The captured image is compressed to under 500 KB and stored locally (IndexedDB) with extracted metadata (title, domain, URL, path, timestamp)
  4. The extension loads in Chrome 112+ as a Manifest V3 extension with a service worker and minimum required permissions
**Plans**: TBD

### Phase 2: Upload, Storage & API Contracts
**Goal**: Captures flow from local storage to the backend API reliably, even across offline periods
**Depends on**: Phase 1
**Requirements**: UPLD-01, UPLD-02, UPLD-03, UPLD-04, UPLD-05, CAPT-06, CAPT-09
**Success Criteria** (what must be TRUE):
  1. After capture, the compressed image and metadata upload to the backend API endpoint
  2. Each capture is tagged with the active project ID and auto-generated tags from URL path segments
  3. When offline, captures queue locally and automatically sync when connectivity returns, with the extension badge showing pending count
  4. The full capture-to-upload cycle completes in under 3 seconds on standard broadband
  5. TypeScript API contract types (request/response schemas) are defined and exported for backend team consumption
**Plans**: TBD

### Phase 3: Auth & Popup UI
**Goal**: Users can log in, choose a project, and see their recent captures through the popup
**Depends on**: Phase 2
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, POPU-01, POPU-02, POPU-03, POPU-04
**Success Criteria** (what must be TRUE):
  1. User can sign in with Google or GitHub OAuth via Supabase and the session persists across browser restarts
  2. Expired tokens refresh automatically without requiring user to re-authenticate
  3. User can open the popup, see their auth state, select an active project from a fetched list, and view recent captures
  4. User can access settings (shortcut info, account, active project) and sign out from the popup
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Core Capture Pipeline | 0/? | Not started | - |
| 2. Upload, Storage & API Contracts | 0/? | Not started | - |
| 3. Auth & Popup UI | 0/? | Not started | - |
