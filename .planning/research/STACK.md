# Technology Stack

**Project:** ScreenshotR Extension
**Researched:** 2026-03-22
**Overall confidence:** MEDIUM (unable to verify latest versions against npm/official docs due to tool restrictions; recommendations based on training data through early 2025)

## Recommended Stack

### Extension Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **WXT** | ^0.19.x | MV3 extension framework | Vite-based, first-class cross-browser support (Chrome + Firefox from one codebase), file-based entrypoints, auto-generates manifest, HMR in dev. Actively maintained, growing faster than Plasmo in 2024-2025. | MEDIUM |

**Why WXT over Plasmo:**

- **Cross-browser output:** WXT compiles to both Chrome MV3 and Firefox MV3 (with MV2 fallback for older Firefox) from a single codebase. Plasmo also supports this but WXT's implementation is more mature for Firefox compatibility edge cases.
- **Vite-native:** WXT is built on Vite from the ground up. Plasmo uses Parcel internally, which has a smaller ecosystem and slower build times. Vite's plugin ecosystem (for CSS, image optimization, etc.) is a significant advantage.
- **Framework-agnostic:** WXT supports vanilla TS, React, Vue, Svelte, and Solid for UI. Since this project needs a lightweight popup UI, we can use vanilla TypeScript or a minimal framework without being locked in.
- **File-based routing:** Entrypoints (background, popup, content scripts) are defined by file location, not config. This is more intuitive and reduces boilerplate.
- **Active development:** WXT had rapid iteration through 2024, with the author (Aaron Kelley) very responsive. Plasmo's development pace slowed in late 2024.
- **Storage utilities:** WXT ships `wxt/storage` which wraps `chrome.storage` with a type-safe, reactive API -- useful for project selection state and auth tokens.

**Why NOT Plasmo:**

- Parcel-based (slower builds, smaller plugin ecosystem than Vite)
- BSMS (Browser Store Management Service) push adds complexity we don't need
- Plasmo's `CSUI` (content script UI) feature is irrelevant -- our content script only shows a brief animation overlay
- Development velocity slowed relative to WXT in the 2024-2025 timeframe

### UI Framework (Popup)

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Vanilla TypeScript** | — | Popup UI, settings | The popup is simple: project selector dropdown, recent captures list, settings toggle. No complex state management needed. Vanilla TS keeps bundle tiny (<10KB) and avoids framework overhead in a context where startup speed matters (popup open time). | HIGH |

**Why NOT React/Vue/Svelte for popup:**

- Extension popups should open instantly. Framework runtime adds 30-100KB+ and initialization delay.
- The popup has ~3 views (project select, recent captures, settings). This doesn't warrant a framework.
- Content script overlay (shutter animation) is CSS animation + a small DOM snippet -- no framework needed.
- If the popup grows complex later, WXT makes it easy to add Svelte or Preact. Start simple.

**Alternative if popup complexity grows:** Preact (~3KB) or Svelte (compiles away). NOT React (too heavy for extension popup).

### Authentication

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **@supabase/supabase-js** | ^2.x | Auth SDK, OAuth flow | Project requirement. Handles Google/GitHub OAuth. Extension opens OAuth in a new tab/window, Supabase redirects back, extension captures the session. | MEDIUM |

**Extension OAuth flow specifics:**

1. Extension calls `supabase.auth.signInWithOAuth({ provider: 'google' })` with a redirect URL pointing to a known extension page (e.g., `chrome-extension://<id>/auth-callback.html`).
2. WXT can serve a dedicated `auth-callback.html` entrypoint that captures the OAuth tokens from URL fragments.
3. Tokens stored in `chrome.storage.session` (MV3 session storage, cleared on browser close) or `chrome.storage.local` (persistent).
4. Service worker attaches JWT to all API requests.

**Critical note:** `chrome.identity` API is Chrome-only and not cross-browser. Use web-based OAuth flow instead for cross-browser compatibility.

### Image Compression

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Canvas API (built-in)** | — | Primary compression | `captureVisibleTab()` returns a data URL. Convert to canvas, re-export as JPEG/WebP with quality parameter. For viewport screenshots, this is sufficient to hit <500KB. Zero dependencies. | HIGH |
| **browser-image-compression** | ^2.x | Fallback / advanced compression | If canvas quality tuning alone doesn't reliably hit <500KB (e.g., on 4K displays), this library provides iterative compression targeting a max file size. ~40KB gzipped. | LOW |

**Compression strategy:**

1. `captureVisibleTab({ format: 'jpeg', quality: 85 })` -- Chrome supports quality parameter directly.
2. If result >500KB, re-encode via Canvas at lower quality (75, then 65).
3. **WebP preferred** where supported (Chrome 112+ and Firefox 115+ both support WebP): `canvas.toBlob(callback, 'image/webp', 0.82)` typically produces 30-50% smaller files than JPEG at equivalent visual quality.
4. Only pull in `browser-image-compression` if the iterative approach above proves insufficient during implementation.

**Why NOT sharp/libvips:** These are Node.js server-side libraries. Cannot run in a browser extension.

### Local Storage / Offline Queue

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **idb** | ^8.x | IndexedDB wrapper | Lightweight (~1.2KB) promise-based wrapper around IndexedDB. Used for offline capture queue. Raw IndexedDB API is callback-based and painful. `idb` by Jake Archibald is the standard thin wrapper. | MEDIUM |
| **wxt/storage** | (bundled) | Extension settings | WXT's built-in typed storage wrapper for `chrome.storage.local`/`session`. Use for auth tokens, selected project ID, user preferences. | MEDIUM |

**Storage split rationale:**

- `chrome.storage.local` (via `wxt/storage`): Settings, auth tokens, selected project -- small key-value data that needs to sync across extension contexts (popup, service worker, content script).
- IndexedDB (via `idb`): Offline capture queue -- binary blob data (compressed images) that can be large. `chrome.storage` has a 10MB quota; IndexedDB has effectively no limit.

### HTTP Client

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **fetch (built-in)** | — | API calls | Native `fetch` is available in MV3 service workers and extension pages. No library needed. Wrap in a thin typed client that handles auth header injection and error handling. | HIGH |

**Why NOT axios/ky/ofetch:**

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

**Why NOT Tailwind:**

- Extension popup CSS is ~200 lines. Tailwind's build step and utility classes are overkill.
- Content script CSS must be completely isolated. Vanilla CSS in a shadow DOM or scoped injection is simpler.

## API Contract Types

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| **Zod** | ^3.x | Runtime validation + type inference | Define API contracts as Zod schemas. Infer TypeScript types from them. Validate responses at runtime (defensive against backend bugs). Export schemas for backend team to use. ~13KB. | HIGH |

**Why Zod over just TypeScript interfaces:**

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

```bash
# Initialize WXT project
npx wxt@latest init screenshotr-extension --template vanilla

# Core dependencies
npm install @supabase/supabase-js idb zod

# Dev dependencies
npm install -D typescript @typescript-eslint/eslint-plugin @typescript-eslint/parser eslint prettier vitest
```

**Note:** WXT bundles Vite internally -- do not install Vite separately.

## Project Structure (WXT convention)

```
extension/
  entrypoints/
    background.ts          # Service worker: capture logic, upload, auth
    popup/
      index.html           # Popup HTML
      main.ts              # Popup JS
      style.css            # Popup styles
    content.ts             # Content script: shutter animation overlay only
    auth-callback.html     # OAuth redirect landing page
  public/
    icon-16.png
    icon-48.png
    icon-128.png
  utils/
    api-client.ts          # Typed fetch wrapper with auth
    compression.ts         # Canvas-based image compression
    storage.ts             # wxt/storage definitions
    capture-queue.ts       # IndexedDB offline queue via idb
  contracts/
    schemas.ts             # Zod schemas for API contracts
    types.ts               # Inferred TypeScript types
  wxt.config.ts            # WXT configuration
  tsconfig.json
```

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

Versions listed are based on training data through early 2025. Before starting implementation:

1. Run `npm view wxt version` to confirm latest WXT version
2. Run `npm view @supabase/supabase-js version` to confirm Supabase SDK version
3. Check [wxt.dev](https://wxt.dev) for any breaking changes if version has jumped to 1.x
4. Check if WXT has graduated from 0.x to stable -- API surface may have changed

## Sources

- WXT official documentation (wxt.dev) -- training data, MEDIUM confidence
- Plasmo official documentation (docs.plasmo.com) -- training data, MEDIUM confidence
- Chrome Extensions MV3 documentation (developer.chrome.com/docs/extensions) -- HIGH confidence, well-known stable API
- MDN WebExtensions documentation (developer.mozilla.org) -- HIGH confidence
- Jake Archibald's `idb` library (github.com/jakearchibald/idb) -- HIGH confidence, long-standing standard
- Zod documentation (zod.dev) -- HIGH confidence
- Supabase Auth documentation (supabase.com/docs/guides/auth) -- MEDIUM confidence
