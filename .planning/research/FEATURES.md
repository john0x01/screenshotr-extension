# Feature Landscape

**Domain:** Browser extension for UX research screenshot capture and organization
**Researched:** 2026-03-22
**Confidence:** MEDIUM (based on training data knowledge of GoFullPage, Awesome Screenshot, Fireshot, Nimbus Screenshot, Mobbin, Page Flows, UXArchive; no live verification possible this session)

## Competitive Landscape Context

The screenshot extension market splits into two distinct categories that ScreenshotR straddles:

1. **Generic screenshot tools** (GoFullPage, Awesome Screenshot, Fireshot, Nimbus) -- focus on capture mechanics: viewport, full-page, region select, annotation. They are utility tools with no organizing intelligence.

2. **UX research platforms** (Mobbin, Page Flows, UXArchive) -- focus on curated screenshot libraries and flow mapping. They are SaaS products, not extensions. Mobbin charges $16+/month and provides its own curated library rather than letting users capture their own.

ScreenshotR occupies the gap: **capture convenience of a screenshot extension** + **auto-organization intelligence of a UX research tool**, without requiring manual file management or a $200/yr subscription to a curated library.

---

## Table Stakes

Features users expect from any screenshot capture extension. Missing any of these and users will immediately switch to a free alternative.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-click/keystroke capture | Every competitor does this. GoFullPage is literally one click. | Low | PROJECT.md already specifies keyboard shortcut via `chrome.commands` |
| Viewport screenshot | Baseline capture mode. `captureVisibleTab()` is the simplest approach. | Low | Already scoped in PROJECT.md |
| Visual capture feedback | Users need confirmation something happened. macOS screenshot animation is the gold standard. | Medium | PROJECT.md specifies shutter animation. Keep it lightweight -- content script overlay only. |
| Automatic metadata extraction | Title, URL, domain, timestamp. Users expect this from any modern tool. | Low | Straightforward from `tab` API. This is ScreenshotR's core differentiator territory when done well. |
| Project/folder organization | Awesome Screenshot has folders. Nimbus has workspaces. Users need at least basic grouping. | Low | Popup UI project selector. Extension just needs project list from API + active project state. |
| Image compression before upload | Network-aware users expect reasonable file sizes. 500KB target is industry-standard. | Medium | Canvas API + quality tuning. Consider WebP output (better compression than JPEG at same quality). |
| Cross-browser support (Chrome + Firefox) | Firefox users are a vocal minority but significant in the dev/design audience. | Medium | MV3 framework (Plasmo/WXT) handles most differences. Main pain point is `browser` vs `chrome` namespace. |
| OAuth login | Extension auth must be frictionless. Google/GitHub OAuth is expected for dev/design tools. | Medium | Supabase Auth handles the heavy lifting. Extension opens popup for OAuth flow. |
| Recent captures view | Users want to confirm their last few captures worked. Popup should show 5-10 recent items. | Low | Fetch from API or show from local cache. Thumbnail + title + timestamp. |
| Settings/preferences panel | Keyboard shortcut config, active project selection, account info. | Low | Standard popup UI. Keep minimal. |

---

## Differentiators

Features that set ScreenshotR apart from generic screenshot tools. Not expected from a screenshot extension, but directly valuable for the UX research use case.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Auto-tagging from URL structure** | Extract tags from URL path segments (`/checkout/confirm` -> tags: "checkout", "confirm"). No manual tagging needed. Competitors require manual folder placement. | Low | Parse `pathname.split('/')`. Huge DX win for near-zero cost. |
| **Domain-based auto-grouping** | Screenshots automatically cluster by domain without user action. Visit stripe.com, captures go under "stripe.com". This is the "zero manual organization" promise. | Low | Backend concern mostly, but extension sends domain as structured field. |
| **Capture animation with thumbnail preview** | macOS-style: thumbnail slides to corner, briefly visible, then disappears. Goes beyond basic "flash" feedback that competitors use. Communicates "captured AND will be organized." | Medium | Content script overlay. CSS animation. Must not interfere with page DOM (overlay via shadow DOM or iframe). |
| **Offline queue with sync** | Capture works without internet. IndexedDB stores pending uploads. Syncs when back online. Most screenshot extensions simply fail offline. | Medium | IndexedDB for blob storage. Service worker handles retry. Must handle conflict resolution (what if project was deleted while offline). |
| **Batch capture session context** | Track which captures happened in the same browsing session, enabling "flow reconstruction" on the dashboard. Extension sends session ID + capture sequence number. | Low | Generate session UUID on extension load. Increment counter per capture. Enables powerful dashboard features later. |
| **Quick project switching** | Popup shows project list with single-click switching. Keyboard shortcut to cycle projects. Research sessions often span multiple projects. | Low | Already partially scoped. Add keyboard shortcut for project cycling as a power-user feature. |
| **Capture status indicator** | Badge on extension icon showing upload status (pending count, success/failure). Users want confidence their captures made it to the cloud. | Low | `chrome.action.setBadgeText()`. Show pending count. Clear on successful upload. |
| **Smart deduplication hint** | If the user captures the same URL twice within a session, show a subtle "already captured" indicator. Don't block -- they may want the duplicate -- but surface the info. | Medium | Track captured URLs in session state. Compare on capture. Content script shows brief overlay hint. |

---

## Anti-Features

Features to explicitly NOT build in the extension. Either they are scope traps, violate the product philosophy, or belong elsewhere.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full-page scrolling capture** | Requires DOM injection (`html2canvas`) or complex scrolling + stitching. Breaks the "no DOM modification" constraint. Adds significant complexity for a v1 edge case. GoFullPage exists for this; don't compete on their turf. | Viewport-only. Users scroll and capture incrementally. The dashboard reconstructs flows from sequential viewport captures. |
| **Annotation/drawing tools** | Awesome Screenshot's territory. Adds massive UI complexity to the extension popup. Not the core value prop. | Capture and organize. Annotation belongs in the dashboard (separate repo) if anywhere. |
| **Region/area selection** | Requires content script injection to draw selection rectangle on page. DOM interference. Moderate complexity. Not aligned with "one keystroke, zero friction" philosophy. | Viewport only. Users can crop in the dashboard if needed. |
| **Video/GIF recording** | Completely different technical domain (MediaRecorder API, screen capture permissions). Feature creep that dilutes the product. | Stay focused on static screenshots. If screen recording is needed later, it is a separate product. |
| **Built-in image editor** | Crop, resize, filters in the extension popup. Massive scope. Extensions have tiny UI real estate. | Dashboard feature if needed. Extension is capture-only. |
| **Direct social sharing** | "Share to Twitter/Slack" from extension. Premature. Not the use case. UX researchers don't share raw captures to social media. | Share via dashboard link. Extension uploads; dashboard distributes. |
| **Page DOM inspection/metadata** | Extracting CSS, font info, color palettes from the page. Requires deep content script injection. Different product (CSS Peeper, WhatFont). | Stick to visual capture + URL metadata. DOM inspection is a different tool. |
| **Browser tab management** | Opening, grouping, or managing tabs as part of "research sessions." Scope creep into a different product category. | Capture only. Tab management tools exist (e.g., OneTab). |
| **AI-powered analysis** | "Analyze this screenshot for UX patterns" in the extension. Tempting but premature, expensive, and belongs server-side. | If AI features come later, they belong in the dashboard/API, not the extension. |
| **Clipboard copy as default** | Some screenshot tools copy to clipboard by default. For ScreenshotR, the value is cloud organization, not clipboard. Clipboard-first undermines the auto-organize promise. | Upload-first is the default behavior. Clipboard copy can be a secondary option but never the primary action. |

---

## Feature Dependencies

```
OAuth Authentication
  --> Project List (requires auth to fetch projects)
    --> Active Project Selection (requires project list)
      --> Capture with Project Association (requires active project)
        --> Upload to Backend (requires auth + project + compressed image)
          --> Recent Captures View (requires successful uploads)

Keyboard Shortcut Registration
  --> Viewport Capture (triggered by shortcut)
    --> Metadata Extraction (runs alongside capture)
    --> Image Compression (runs after capture)
      --> Upload to Backend

Capture Animation (independent of upload pipeline)
  --> Triggered by capture event
  --> Runs in content script overlay

Offline Queue (extends upload pipeline)
  --> Requires: Image Compression, Metadata Extraction
  --> Stores locally when upload fails
  --> Syncs when connectivity restored

Capture Status Badge (depends on upload pipeline)
  --> Reads pending/completed upload counts
```

### Critical Path

The minimum viable capture loop is:

```
Auth --> Fetch Projects --> Select Project --> Capture --> Compress --> Upload
```

Everything else layers on top. Build this pipeline first, make it rock-solid, then add the quality-of-life features.

---

## MVP Recommendation

### Must ship (Phase 1 -- the capture loop):

1. **OAuth login** (Google at minimum, GitHub as stretch) -- gate to everything else
2. **Keyboard shortcut capture** -- the core interaction
3. **Viewport screenshot** -- `captureVisibleTab()`, simplest reliable method
4. **Metadata extraction** -- title, URL, domain, path, timestamp
5. **Image compression** -- Canvas API to WebP/JPEG, target < 500KB
6. **Upload to backend** -- POST compressed image + metadata to API
7. **Active project selection** -- popup with project list, click to select
8. **Capture feedback animation** -- visual confirmation that capture happened

### Ship in Phase 2 (quality of life):

1. **Recent captures view** in popup -- confidence that captures are working
2. **Auto-tagging from URL path** -- low effort, high value
3. **Capture status badge** -- pending/success indicator on icon
4. **Batch session context** -- session ID + sequence number per capture
5. **Offline queue** -- IndexedDB storage, background sync

### Defer (Phase 3+):

1. **Smart deduplication hints** -- nice but not critical
2. **Quick project switching via keyboard** -- power user feature
3. **Firefox support** -- ship Chrome first, Firefox second (smaller audience, more MV3 quirks)

### Explicitly never:

Full-page capture, annotation tools, region selection, video recording, image editing, social sharing, DOM inspection, AI analysis in extension.

---

## Competitor Feature Matrix (for reference)

| Feature | GoFullPage | Awesome Screenshot | Fireshot | Nimbus | Mobbin | ScreenshotR |
|---------|------------|-------------------|----------|--------|--------|-------------|
| Viewport capture | Yes | Yes | Yes | Yes | N/A (curated) | Yes |
| Full-page capture | Yes (core) | Yes | Yes | Yes | N/A | No (by design) |
| Region select | No | Yes | Yes | Yes | N/A | No (by design) |
| Annotation | No | Yes (core) | Basic | Yes | N/A | No (by design) |
| Auto-metadata | No | No | No | No | Curated | Yes (core) |
| Auto-organization | No | Folders only | No | Workspaces | Curated library | Yes (core) |
| Cloud upload | No (local only) | Yes (paid) | No | Yes (paid) | SaaS | Yes (core) |
| Offline queue | N/A | No | N/A | No | N/A | Yes |
| Project-based | No | No | No | Workspaces | Collections | Yes (core) |
| Domain grouping | No | No | No | No | By app | Yes (auto) |
| URL-based tagging | No | No | No | No | Manual | Yes (auto) |
| Flow mapping | No | No | No | No | Yes (curated) | Dashboard (future) |
| Price | Free | Freemium | Freemium | Freemium | $16/mo+ | TBD |

**Key insight from this matrix:** No existing screenshot extension does auto-organization by domain and URL structure. The capture tools are dumb pipes to local files. The research platforms (Mobbin) are curated libraries, not user-capture tools. ScreenshotR's differentiator is being the first tool that combines effortless capture with intelligent auto-organization.

---

## Sources

- Training data knowledge of Chrome Web Store extensions (GoFullPage, Awesome Screenshot, Fireshot, Nimbus Screenshot) -- MEDIUM confidence, based on features as of early 2025
- Training data knowledge of Mobbin, Page Flows, UXArchive SaaS platforms -- MEDIUM confidence
- Chrome Extensions MV3 API documentation (chrome.tabs.captureVisibleTab, chrome.commands, chrome.action) -- HIGH confidence on API capabilities
- Project requirements from `.planning/PROJECT.md` and `SCREENSHOTR.md`

**Note:** Web search was unavailable during this research session. Feature claims about competitors are based on training data (up to early 2025) and should be spot-checked against current Chrome Web Store listings before finalizing the roadmap.
