# ScreenshotR Mapper — Project Description & Requirements

## Overview

ScreenshotR Mapper is a browser extension and web dashboard that allows designers, product managers, and developers to capture, organize, and map UX flows from any website as part of their research and inspiration process.

Instead of manually taking screenshots, cropping, renaming, and organizing files — or paying for a dedicated UX research platform like Mobbin — users install the extension, configure a keyboard shortcut, and capture any page with a single keystroke. Screenshots are automatically organized by website and page title and made available in a web dashboard where they can be arranged into UX flow maps.

**Primary use case:** A product team building a fintech SaaS wants to research Stripe's onboarding and checkout flows. They visit each relevant page, press the shortcut, and within minutes have a structured gallery of every screen organized by section. They then drag those screenshots onto a flow board to map the navigation sequence.


## Goals

- Eliminate the manual friction of UX research screenshot gathering
- Auto-organize captures by domain, page, and project without user effort
- Provide a visual flow-mapping canvas to turn screenshots into navigable UX maps
- Be lightweight enough to replace ad-hoc folder systems, and powerful enough to rival dedicated research tools


## System Architecture

The product has three layers: the browser extension, a backend API with storage, and a web dashboard.

### Browser Extension

Built with Manifest V3 (Chrome/Firefox), the extension consists of three components:

**Content script** injects into the active tab. It handles the capture using `chrome.tabs.captureVisibleTab()` for viewport shots, or `html2canvas` for full-page captures. It reads `document.title`, `window.location`, and structured meta tags to build the metadata payload sent to the API.

**Service worker** registers the global keyboard shortcut via the `chrome.commands` API. It acts as the message broker — when the shortcut fires, it instructs the content script to capture and then relays the resulting image blob and metadata to the backend.

**Popup UI** is a small settings panel where users configure their active project, capture mode (viewport vs. full-page), and keyboard shortcut.

### Backend API

A Node.js/Fastify REST API with three core responsibilities:

**Capture service** receives the base64 image blob from the extension, compresses it using Sharp, uploads it to object storage (Cloudflare R2 or AWS S3), and returns a CDN-hosted URL.

**Metadata extractor** parses the raw URL into structured fields: `domain`, `path`, `page_title`, `captured_at`, and auto-generated tags derived from path segments (e.g. `/checkout` → tag: "checkout").

**Auth & workspace layer** handles user sessions via JWT, team workspaces, and project-level access control.

### Web Dashboard

A React web application with three main views:

**Gallery view** displays screenshots organized by project → website → page. Each card shows the thumbnail, site favicon, page title, and capture timestamp.

**Search & filter** allows filtering by domain, tag, date range, or free-text search across page titles and metadata.

## Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Extension | Vanilla JS + Plasmo framework | Handles MV3 boilerplate, HMR, cross-browser builds |
| Backend | Node.js + Fastify + Prisma | Fast to build, type-safe ORM, excellent DX |
| Database | PostgreSQL via Supabase | Structured queries, built-in auth, managed hosting |
| Object storage | Cloudflare R2 | S3-compatible API, zero egress fees |
| Dashboard | React + Tailwind CSS | Rich component ecosystem for gallery and board views |
| Flow canvas | React Flow | Purpose-built for node/edge interactive boards |

---

## Requirements

### Extension

- Register a configurable global keyboard shortcut to trigger capture
- Support viewport capture and full-page capture modes
- Automatically extract page title, domain, full URL, and path on capture
- Associate each capture with the user's currently selected project
- Display a minimal screenshot animation on screenshot, so the user knows it was been captured
- Queue captures locally if offline and sync when reconnected

### Dashboard — Gallery

- Display all screenshots in a responsive grid, grouped by website domain
- Show site favicon, page title, URL path, and capture date on each card
- Support filtering by project, domain, tag, and date range
- Support full-text search across page titles and tags
- Allow bulk selection for tagging, moving to a project, or deletion
- Support renaming, re-tagging, and adding notes to any screenshot


### Projects & Workspaces

- Allow users to create multiple projects for organizing research sessions
- Support team workspaces where members share projects and boards
- Provide role-based access: Owner, Editor, Viewer

## Non-Functional Requirements

- Screenshot capture and upload must complete in under 3 seconds on a standard broadband connection
- The extension must not interfere with or modify the DOM of any visited website
- Images must be compressed to under 500 KB per screenshot without visible quality loss
- All API calls must be authenticated via JWT; storage URLs must be signed and expire after 24 hours for public access
- The extension must support Chrome 112+ and Firefox 115+
- The backend must support at least 10,000 screenshots per workspace without degradation in gallery load time

---


## Out of Scope (v1)

- Figma plugin (post-launch consideration)
- Self-hosted deployment

