# ScreenshotR Extension

## What This Is

A browser extension (Chrome/Firefox) that lets designers, product managers, and developers capture screenshots of any website with a single keyboard shortcut. Captures are automatically tagged with page metadata (domain, title, URL, path) and uploaded to the ScreenshotR backend API, where they're organized by project and website. Part of a multi-repo product — this repo is the extension only; a separate team builds the backend API simultaneously.

## Core Value

One-keystroke screenshot capture with zero manual organization — press the shortcut, the screenshot is captured, tagged, and uploaded without leaving the page.

## Requirements

### Validated

- ✓ Register a configurable global keyboard shortcut to trigger capture — Phase 1
- ✓ Capture visible viewport using `chrome.tabs.captureVisibleTab()` — Phase 1
- ✓ Automatically extract page title, domain, full URL, and path on capture — Phase 1
- ✓ Display a macOS-style camera shutter animation (thumbnail preview sliding to corner) on capture — Phase 1
- ✓ Compress images to under 500 KB without visible quality loss — Phase 1
- ✓ Extension must not modify the DOM of visited websites (content script for capture animation overlay only) — Phase 1
- ✓ Chrome 112+ MV3 with service worker and minimum permissions — Phase 1

### Active

- [ ] Associate each capture with the user's currently selected project
- [ ] Queue captures locally (IndexedDB) if offline and sync when reconnected (nice-to-have, include if straightforward)
- [ ] OAuth authentication (Google/GitHub) via Supabase Auth
- [ ] Popup UI for selecting active project, viewing recent captures, and settings
- [ ] Define and implement API contracts for backend integration (capture upload, project list, auth)
- [ ] Complete capture-to-upload cycle in under 3 seconds on standard broadband

### Out of Scope

- Full-page capture (scrolling/stitching) — viewport-only for v1, users scroll and capture incrementally
- Web dashboard — separate repo, separate team
- Backend API implementation — separate repo, this extension defines the contracts
- Figma plugin — post-launch consideration
- Self-hosted deployment — not applicable to extension
- Team workspaces and role-based access — backend concern, extension just reads project list
- Flow canvas / board view — dashboard feature

## Context

- **Multi-repo setup:** This is the `extension` repo. A backend repo is being built simultaneously by another team. This extension defines the API contracts (endpoints, request/response types) and the backend team aligns.
- **Tech stack direction:** Plasmo or WXT for MV3 framework (to be decided during research). Vanilla JS or lightweight framework for popup UI.
- **Auth flow:** OAuth (Google/GitHub) via Supabase Auth. Extension opens OAuth flow, receives JWT, stores it for API calls.
- **Storage:** Captures compressed client-side before upload. Backend handles object storage (R2/S3).
- **Capture method:** `chrome.tabs.captureVisibleTab()` only — no DOM injection, no `html2canvas`. Content script limited to capture animation overlay.

## Constraints

- **Manifest V3**: Required for Chrome Web Store. Service worker instead of background page.
- **Cross-browser**: Must work on Chrome 112+ and Firefox 115+. Framework should handle MV3 compatibility differences.
- **Performance**: Capture + compress + upload < 3 seconds on broadband.
- **Image size**: Compressed screenshots < 500 KB without visible quality loss.
- **DOM safety**: Extension must not interfere with or modify the DOM of visited websites beyond a temporary capture animation overlay.
- **API contracts**: Extension defines the backend interface. Contracts must be well-documented TypeScript types so the backend team can implement against them.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Viewport-only capture | Avoids DOM injection, simpler implementation, user scrolls for more | — Pending |
| OAuth only (no email/password) | Simpler extension auth flow, no login form needed in popup | — Pending |
| Supabase Auth | Matches backend team's database choice, built-in OAuth providers | — Pending |
| Extension defines API contracts | Extension team moves first, backend aligns — prevents blocking | — Pending |
| Camera shutter animation | Native macOS-feel, clear visual feedback on capture | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-06 after Phase 1 completion*
