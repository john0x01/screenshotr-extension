# Phase 1: Core Capture Pipeline - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-core-capture-pipeline
**Areas discussed:** Shutter animation, Default shortcut, Framework choice, Retina handling

---

## Shutter Animation

| Option | Description | Selected |
|--------|-------------|----------|
| Full macOS style | Brief white flash, thumbnail appears at bottom-right, holds 2-3s, then slides off-screen | ✓ |
| Quick flash + slide | No hold time — flash, thumbnail immediately slides to bottom-right and fades out in ~1s | |
| Thumbnail only | No flash — thumbnail appears at bottom-right for 2s then fades. Minimal disruption. | |

**User's choice:** Full macOS style
**Notes:** User wants polished, native-feeling feedback. This is the primary capture confirmation mechanism.

---

## Default Shortcut

| Option | Description | Selected |
|--------|-------------|----------|
| Ctrl+Shift+S | Intuitive (S for Screenshot). On Mac: Cmd+Shift+S. Conflicts with 'Save As' in some apps. | |
| Alt+Shift+S | Less common combo, avoids most browser conflicts. On Mac: Opt+Shift+S. | |
| Ctrl+Shift+X | X for capture/snip. No common browser conflicts. On Mac: Cmd+Shift+X. | ✓ |

**User's choice:** Ctrl+Shift+X
**Notes:** Chosen for conflict avoidance over intuitiveness.

---

## Framework Choice

| Option | Description | Selected |
|--------|-------------|----------|
| WXT (Recommended) | Vite-based, strong Firefox support, active development, lighter than Plasmo | ✓ |
| Plasmo | More mature ecosystem, React-friendly, Parcel-based (heavier bundler) | |
| Vanilla MV3 | No framework overhead, full control, more boilerplate and manual cross-browser handling | |

**User's choice:** WXT (Recommended)
**Notes:** Aligned with research recommendation. User was open to suggestions; WXT won on lighter bundler and Firefox path.

---

## Retina Handling

| Option | Description | Selected |
|--------|-------------|----------|
| Keep retina, compress | Preserve full resolution, rely on WebP compression. May need aggressive quality reduction on 4K. | |
| Downscale to 1x | Always output at CSS pixel dimensions. Consistent sizes, loses sharpness. | |
| Cap at 2x | Keep 2x max, downscale 3x/4x to 2x. Best quality/size tradeoff. | ✓ |

**User's choice:** Cap at 2x
**Notes:** Balances retina sharpness with reasonable file sizes. 3x/4x displays downscaled to 2x before compression.

---

## Claude's Discretion

- Exact animation timing parameters
- WebP quality parameter tuning
- IndexedDB schema design
- Offscreen document lifecycle management
- Metadata field structure

## Deferred Ideas

None — discussion stayed within phase scope
