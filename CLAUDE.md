<!-- GSD:project-start source:PROJECT.md -->
## Project

**ScreenshotR Extension**

A browser extension (Chrome/Firefox) that lets designers, product managers, and developers capture screenshots of any website with a single keyboard shortcut. Captures are automatically tagged with page metadata (domain, title, URL, path) and uploaded to the ScreenshotR backend API, where they're organized by project and website. Part of a multi-repo product — this repo is the extension only; a separate team builds the backend API simultaneously.

**Core Value:** One-keystroke screenshot capture with zero manual organization — press the shortcut, the screenshot is captured, tagged, and uploaded without leaving the page.

### Constraints

- **Manifest V3**: Required for Chrome Web Store. Service worker instead of background page.
- **Cross-browser**: Must work on Chrome 112+ and Firefox 115+. Framework should handle MV3 compatibility differences.
- **Performance**: Capture + compress + upload < 3 seconds on broadband.
- **Image size**: Compressed screenshots < 500 KB without visible quality loss.
- **DOM safety**: Extension must not interfere with or modify the DOM of visited websites beyond a temporary capture animation overlay.
- **API contracts**: Extension defines the backend interface. Contracts must be well-documented TypeScript types so the backend team can implement against them.
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Extension Framework
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **WXT** | ^0.19.x | MV3 extension framework | Vite-based, first-class cross-browser support (Chrome + Firefox from one codebase), file-based entrypoints, auto-generates manifest, HMR in dev. Actively maintained, growing faster than Plasmo in 2024-2025. | MEDIUM |
- **Cross-browser output:** WXT compiles to both Chrome MV3 and Firefox MV3 (with MV2 fallback for older Firefox) from a single codebase. Plasmo also supports this but WXT's implementation is more mature for Firefox compatibility edge cases.
- **Vite-native:** WXT is built on Vite from the ground up. Plasmo uses Parcel internally, which has a smaller ecosystem and slower build times. Vite's plugin ecosystem (for CSS, image optimization, etc.) is a significant advantage.
- **Framework-agnostic:** WXT supports vanilla TS, React, Vue, Svelte, and Solid for UI. Since this project needs a lightweight popup UI, we can use vanilla TypeScript or a minimal framework without being locked in.
- **File-based routing:** Entrypoints (background, popup, content scripts) are defined by file location, not config. This is more intuitive and reduces boilerplate.
- **Active development:** WXT had rapid iteration through 2024, with the author (Aaron Kelley) very responsive. Plasmo's development pace slowed in late 2024.
- **Storage utilities:** WXT ships `wxt/storage` which wraps `chrome.storage` with a type-safe, reactive API -- useful for project selection state and auth tokens.
- Parcel-based (slower builds, smaller plugin ecosystem than Vite)
- BSMS (Browser Store Management Service) push adds complexity we don't need
- Plasmo's `CSUI` (content script UI) feature is irrelevant -- our content script only shows a brief animation overlay
- Development velocity slowed relative to WXT in the 2024-2025 timeframe
### UI Framework (Popup)
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vanilla TypeScript** | — | Popup UI, settings | The popup is simple: project selector dropdown, recent captures list, settings toggle. No complex state management needed. Vanilla TS keeps bundle tiny (<10KB) and avoids framework overhead in a context where startup speed matters (popup open time). | HIGH |
- Extension popups should open instantly. Framework runtime adds 30-100KB+ and initialization delay.
- The popup has ~3 views (project select, recent captures, settings). This doesn't warrant a framework.
- Content script overlay (shutter animation) is CSS animation + a small DOM snippet -- no framework needed.
- If the popup grows complex later, WXT makes it easy to add Svelte or Preact. Start simple.
### Authentication
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@supabase/supabase-js** | ^2.x | Auth SDK, OAuth flow | Project requirement. Handles Google/GitHub OAuth. Extension opens OAuth in a new tab/window, Supabase redirects back, extension captures the session. | MEDIUM |
### Image Compression
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Canvas API (built-in)** | — | Primary compression | `captureVisibleTab()` returns a data URL. Convert to canvas, re-export as JPEG/WebP with quality parameter. For viewport screenshots, this is sufficient to hit <500KB. Zero dependencies. | HIGH |
| **browser-image-compression** | ^2.x | Fallback / advanced compression | If canvas quality tuning alone doesn't reliably hit <500KB (e.g., on 4K displays), this library provides iterative compression targeting a max file size. ~40KB gzipped. | LOW |
### Local Storage / Offline Queue
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **idb** | ^8.x | IndexedDB wrapper | Lightweight (~1.2KB) promise-based wrapper around IndexedDB. Used for offline capture queue. Raw IndexedDB API is callback-based and painful. `idb` by Jake Archibald is the standard thin wrapper. | MEDIUM |
| **wxt/storage** | (bundled) | Extension settings | WXT's built-in typed storage wrapper for `chrome.storage.local`/`session`. Use for auth tokens, selected project ID, user preferences. | MEDIUM |
- `chrome.storage.local` (via `wxt/storage`): Settings, auth tokens, selected project -- small key-value data that needs to sync across extension contexts (popup, service worker, content script).
- IndexedDB (via `idb`): Offline capture queue -- binary blob data (compressed images) that can be large. `chrome.storage` has a 10MB quota; IndexedDB has effectively no limit.
### HTTP Client
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **fetch (built-in)** | — | API calls | Native `fetch` is available in MV3 service workers and extension pages. No library needed. Wrap in a thin typed client that handles auth header injection and error handling. | HIGH |
- `fetch` is universally available in modern browsers and MV3 service workers.
- The extension makes 2-3 types of API calls (upload capture, list projects, auth). A thin wrapper (50 lines of TypeScript) is simpler than a dependency.
- `axios` has known issues in MV3 service workers due to XMLHttpRequest unavailability.
### Build & Dev Tools
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **TypeScript** | ^5.4 | Type safety | Non-negotiable for any project defining API contracts. Catches bugs at compile time. Extension-backend contract types are shared via a types package or copied. | HIGH |
| **Vite** | ^5.x or ^6.x | Bundler | Bundled with WXT. Fast HMR, excellent plugin ecosystem. | MEDIUM |
| **ESLint** | ^9.x | Linting | Flat config format. Use `@typescript-eslint/parser`. | MEDIUM |
| **Prettier** | ^3.x | Formatting | Standard. Configure once, never think about it. | HIGH |
| **Vitest** | ^2.x | Unit testing | Vite-native test runner. Since WXT uses Vite, Vitest integrates seamlessly. Test compression logic, API client, storage utilities. | MEDIUM |
### CSS / Styling
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vanilla CSS** | — | Popup styling, animation | The popup is simple enough for plain CSS. The shutter animation overlay is pure CSS keyframes. No framework needed. | HIGH |
- Extension popup CSS is ~200 lines. Tailwind's build step and utility classes are overkill.
- Content script CSS must be completely isolated. Vanilla CSS in a shadow DOM or scoped injection is simpler.
## API Contract Types
| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Zod** | ^3.x | Runtime validation + type inference | Define API contracts as Zod schemas. Infer TypeScript types from them. Validate responses at runtime (defensive against backend bugs). Export schemas for backend team to use. ~13KB. | HIGH |
- TypeScript types disappear at runtime. Zod validates actual API responses.
- Backend team can import the same Zod schemas to validate their output.
- `z.infer<typeof schema>` generates types automatically -- single source of truth.
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Extension framework | WXT | Plasmo | Parcel-based, slower dev, Firefox support less robust |
| Extension framework | WXT | Manual webpack/vite | Too much boilerplate for MV3 cross-browser. WXT handles manifest generation, HMR, browser polyfills |
| UI framework | Vanilla TS | React | Too heavy for extension popup (30KB+ runtime). Startup latency matters. |
| UI framework | Vanilla TS | Svelte | Reasonable alternative if popup grows complex. Compiles away. Revisit if needed. |
| Image compression | Canvas API | browser-image-compression | Dependency not needed if Canvas quality tuning suffices. Add only if needed. |
| Image compression | Canvas API | Squoosh/libSquoosh | WASM-based, more complex to bundle in extension, overkill for viewport screenshots |
| IndexedDB wrapper | idb | Dexie.js | Dexie is 48KB+ with features we don't need (versioning, hooks, sync). `idb` is 1.2KB. |
| HTTP client | fetch | axios | axios uses XMLHttpRequest internally, which is unavailable in MV3 service workers |
| HTTP client | fetch | ky | Adds unnecessary abstraction for 2-3 endpoints |
| Validation | Zod | io-ts / yup | Zod has best TypeScript inference, most active ecosystem, simplest API |
| CSS | Vanilla CSS | Tailwind | Overkill for ~200 lines of popup CSS and a CSS animation |
## Installation
# Initialize WXT project
# Core dependencies
# Dev dependencies
## Project Structure (WXT convention)
## Browser Compatibility Notes
| Feature | Chrome 112+ | Firefox 115+ | Notes |
|---------|-------------|--------------|-------|
| MV3 service worker | Yes | Yes (since FF 115) | WXT handles differences |
| `captureVisibleTab()` | Yes | Yes | Requires `activeTab` permission |
| WebP encoding | Yes | Yes | Use for smaller file sizes |
| `chrome.storage.session` | Yes | Yes (since FF 115) | Session-scoped storage |
| `chrome.commands` | Yes | Yes | Keyboard shortcut registration |
| IndexedDB in SW | Yes | Yes | For offline queue |
| OAuth redirect to extension page | Yes | Yes (different URL scheme) | WXT normalizes `browser.runtime.getURL()` |
## Version Confidence Note
## Sources
- WXT official documentation (wxt.dev) -- training data, MEDIUM confidence
- Plasmo official documentation (docs.plasmo.com) -- training data, MEDIUM confidence
- Chrome Extensions MV3 documentation (developer.chrome.com/docs/extensions) -- HIGH confidence, well-known stable API
- MDN WebExtensions documentation (developer.mozilla.org) -- HIGH confidence
- Jake Archibald's `idb` library (github.com/jakearchibald/idb) -- HIGH confidence, long-standing standard
- Zod documentation (zod.dev) -- HIGH confidence
- Supabase Auth documentation (supabase.com/docs/guides/auth) -- MEDIUM confidence
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
