# Gallery Image CDN & Performance — Design

**Date:** 2026-05-26
**Scope:** `apps/website` image delivery only. Admin app and the upload pipeline are out of scope.

## Problem

Gallery cards, the piece detail page, and the homepage hero render full-resolution
originals straight from Supabase Storage (and a few static `/images/*.jpg`) through plain
`<img src>` tags — `LazyImage` (cards/detail) and `ImageBlock` (hero/sections). There is
**zero** image optimization: no resizing, no modern formats, no responsive `srcset`. A
2–10 MB original is downloaded even for a small thumbnail. Gallery cards also have no
reserved aspect ratio, so images cause layout shift (CLS) as they load.

## Goal

Serve resized, format-optimized, CDN-cached images for every image source on the public
site, with the smallest, safest change — no new vendor cost, no upload-pipeline changes.

## Approach (chosen: Netlify Image CDN)

Netlify already runs an on-the-fly Image CDN at `/.netlify/images`. We route image URLs
through it and emit a responsive `srcset`. Free (included with hosting), edge-cached,
auto AVIF/WebP via `Accept`-header negotiation, on-the-fly resize. Covers both Supabase
and static images. Keeps the existing `LazyImage` blur-up/fallback behavior intact.

Rejected: `next/image` migration (invasive — needs intrinsic width/height on every image,
loses custom `LazyImage`, churns Stackbit components for the same result); Supabase
Storage transforms (a paid add-on, and only covers Supabase-hosted images).

## Components

### 1. `src/utils/netlify-image.ts` (new, pure functions — unit tested)

Split so the string-building is always testable, independent of environment:

- `buildNetlifyImageUrl(src, { width, height?, quality=75, fit='cover' })` → string
  **Pure, no env checks.** Builds `/.netlify/images?url=<URI-encoded src>&w=…&h?&fit?&q=…`.
  **No `fm`** — Netlify auto-negotiates AVIF/WebP from the browser `Accept` header.
  Returns `src` unchanged for inputs that can't/shouldn't be transformed: falsy, `data:`
  URI, `.svg`, or already starts with `/.netlify/images` (SVGs don't raster-transform; the
  placeholder fallback is an SVG). These pass-throughs are pure and unit-tested directly.
- `netlifyImage(src, opts)` → string — thin wrapper that applies the **runtime gate** then
  delegates to `buildNetlifyImageUrl`. Returns `src` unchanged (skips optimization) when:
  - **Not running on Netlify** — `process.env.NODE_ENV !== 'production'` so plain
    `next dev` (where `/.netlify/images` 404s) gets original URLs. `netlify dev` and
    preview/prod builds run as production and get optimization.
  - **Stackbit visual preview** is active (`process.env.STACKBIT_PREVIEW`) — rewriting
    `src` would break `ImageBlock`'s `#@src` inline-edit field mapping.
- `netlifyImageSrcSet(src, widths, opts)` → string — wrapper over the same gate that maps
  widths to `"<url> <w>w"` entries joined by `, `.

Tests target `buildNetlifyImageUrl` for query-string format and the
falsy/`data:`/`.svg`/already-optimized pass-throughs (env-independent). The runtime gate
(`netlifyImage`) is exercised by toggling `NODE_ENV`/`STACKBIT_PREVIEW` in the test.

### 2. `LazyImage` (`src/components/atoms/LazyImage.tsx`) — wire in srcset

Add optional `widths?: number[]` (default `[400, 800, 1200, 1600]`) and `sizes?: string`
(default `100vw`). Compute `src = netlifyImage(src, { width: <largest width> })` and
`srcSet = netlifyImageSrcSet(...)`; pass `sizes` through. Blur-up, fallback-on-error, and
the `complete`/`naturalWidth` cache check are unchanged. Callers that know their layout
(e.g. gallery grid cards) pass a tighter `sizes` so the browser picks a small candidate.

### 3. `ImageBlock` (`src/components/blocks/ImageBlock/index.tsx`) — wire in srcset

Apply `netlifyImage`/`netlifyImageSrcSet` to `url`. Keep the Stackbit `data-sb-field-path`
annotations and the `#@src` mapping pointing at the original field; the helper's
`STACKBIT_PREVIEW` pass-through keeps the editor working.

### 4. `apps/website/netlify.toml` — allowlist Supabase

```toml
[images]
  remote_images = ["https://ytgbohzmipyfrezsctbl\\.supabase\\.co/.*"]
```

(Static `/images/*` are local to the deploy and need no allowlisting.)

### 5. CLS fix (CSS-only, gallery cards)

Give the gallery-card image wrapper a fixed `aspect-ratio` with `object-cover` so grid
cells reserve space before the image loads. Scoped to the **grid cards** only — uniform
crop is the standard, acceptable treatment there.
**Out of scope:** the detail-page hero keeps its natural ratio; eliminating its CLS would
require storing image dimensions at upload time (an upload-pipeline change).

## Data flow

Render: component receives a raw URL (Supabase public URL or `/images/x.jpg`) →
`netlifyImage`/`netlifyImageSrcSet` rewrite to `/.netlify/images?...` (prod only) →
browser requests sized/negotiated variant → Netlify edge transforms once, caches, serves.
No DB or tRPC changes. No upload changes.

## Error handling

- Transform failure / unallowlisted host → Netlify returns the original; `LazyImage`'s
  `onError` still falls back to the placeholder SVG.
- Non-prod / Stackbit / SVG / data-URI → original URL, identical to today's behavior.

## Testing

`netlify-image.test.ts` (Vitest, pure functions, codebase convention):
- `buildNetlifyImageUrl` builds correct query string with URI-encoded `url`, `w`, `q`,
  optional `h`/`fit`; quality defaults to 75; custom quality respected
- `buildNetlifyImageUrl` pass-through for: falsy, `data:`, `.svg`, already-optimized
- `netlifyImageSrcSet` formats `"<url> <w>w"` entries
- `netlifyImage` runtime gate: no-op when `NODE_ENV !== 'production'` or `STACKBIT_PREVIEW`
  set; optimizes otherwise

No integration/E2E needed — visual spot-check on the deploy preview (Network tab shows
`/.netlify/images` requests + reduced transfer size) covers the runtime path.

## Out of scope

Upload UX/reliability (base64→Netlify body-limit risk), admin thumbnails, rich-text
editor, storing image dimensions, detail-page hero CLS.
