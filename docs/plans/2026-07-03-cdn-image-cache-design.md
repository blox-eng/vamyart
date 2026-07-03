# Design: Fix slow first-load of gallery images

**Date:** 2026-07-03
**Branch:** `perf/cdn-cache-images`
**Source task:** Todoist — "CDN cache the images as the first page loads SUUUUUUUUPER slow"

## Problem

The first load of any landing page feels very slow: the page text/layout paints
quickly, but images take a long time to appear (gray boxes, then pop in), worst
on the first visit. The site already routes images through Netlify Image CDN, so
"add CDN caching" is only half the story.

### Root cause (measured against production)

| Cause | Evidence | Effect |
|---|---|---|
| **12 MB source originals** | Supabase object = 11,794,804 B JPEG; raw file stored as-is (no resize) | Netlify's *cold* transform must fetch + decode a 12 MB source → **~1.8s** the first time (warm: 0.27s) |
| **1-hour cache TTL** | Supabase serves `cache-control: public, max-age=3600`; Netlify Image CDN inherits it (transform response also `max-age=3600`) | The slow cold path **recurs hourly** and on every edge eviction, despite immutable UUID filenames |
| **No LCP preload** | Above-the-fold hero renders via `ImageBlock` (`<img>`) with no `fetchPriority` and no preload link | The hero starts downloading after hydration → "pops in" late |
| **Supabase transform disabled** | `render/image/...` endpoint returns 403 | Can't offload resizing to Supabase without paying for the add-on |

The website rendering path is already correct: `netlify-image` util → Netlify
Image CDN → responsive `srcset` → webp output (355 KB at w=1600). The problems
are all upstream in object cache metadata and above-the-fold prioritization.

## Scope (decided)

- **In scope:** long-lived cache header on uploads + backfill; LCP preload +
  priority on the hero (homepage + gallery detail).
- **Deferred (TODOs):** pre-warming transforms; source resize to a web-master.
- Full-resolution originals are **not** required to be preserved.

## Approach

```
 upload (admin)                    website render                 Netlify Image CDN
 ─────────────                     ──────────────                 ─────────────────
 uploadToSignedUrl(                ImageBlock priority?           first req (cold):
   ...,                             → loading=eager                fetch 12MB source,
   { cacheControl:"31536000" })     → fetchPriority=high           transform (~1.8s)
        │                          heroPreload(url) →             then cached 1 YEAR
        ▼                           <link rel=preload             (was 1 hour)
 object served                       as=image imagesrcset          │
 max-age=31536000  ───────────────────────────────────────────────┘ inherited TTL
```

### 1. Long-lived cache on Storage objects (core fix)

- New uploads pass `cacheControl: "31536000"` to `uploadToSignedUrl` in the admin
  artworks page. supabase-js emits `cache-control: max-age=31536000`.
  **Note (finding A2):** supabase-js's `cacheControl` takes seconds only — it
  cannot emit the literal `immutable` token. `max-age=31536000` (one year) is
  sufficient. We do NOT rely on the `immutable` directive.
- **Safety invariant:** long caching is safe because storage keys are
  content-addressed UUIDs that are never overwritten — `createUploadUrl` mints a
  fresh `crypto.randomUUID()` path and uploads use `upsert:false`. A replaced
  image is a *new URL*, so a stale byte can never be served. The backfill
  script's in-place overwrite is the one controlled exception. If a
  "replace image, keep same path" flow is ever added, it MUST mint a new key.
- **Backfill** existing objects (they still carry `max-age=3600`): a standalone,
  idempotent script (`scripts/backfill-image-cache-control.mjs`) that lists every
  object in the `artwork-images` bucket and re-uploads it in place
  (`upsert:true`, same path, preserved content-type) with the long cacheControl.
  Supports `--dry-run`, logs each object + resulting header, uses the
  service-role key from env. Run once, locally.

### 2. Prioritize + preload the LCP image (website)

- Add a single `priority` prop to `ImageBlock`: `priority` →
  `loading="eager" fetchPriority="high"`. Existing `loading` prop unchanged.
- **Homepage:** `[[...slug]].js` already injects the featured artwork into
  `sections[0].media`. Set `priority` there and emit the preload link — do not
  make the component sniff its own index (finding C2).
- **Gallery detail:** `gallery/[slug].js` already has a `<Head>`; add the preload
  link for `artwork.primaryImage.url` and mark its `ImageBlock` `priority`.
- **Gallery grid:** only the **first** grid image (index 0, the LCP candidate)
  gets `priority` (eager + high); no explicit preload link (its LCP is a small
  thumbnail). All other thumbnails keep lazy loading.
- **`heroPreload(url)` helper (finding A1 — the key invariant):** one source of
  truth that returns the preload link's `imagesrcset`/`imagesizes` from the same
  `netlifyImageSrcSet(url)` + `sizes` the hero `ImageBlock` renders. If they
  don't match byte-for-byte the browser double-downloads and the change makes
  things *slower*. The helper mirrors the production gate (finding A3): off
  production `netlifyImageSrcSet` returns `''` → emit no preload link (matches
  what the `<img>` does in dev/preview).

### 3. Page cache-busting on studio changes — already done

ISR revalidation already fires on every studio mutation (publish/unpublish,
feature, reorder, add/remove image, edit) via the auth-gated same-origin
`/api/revalidate` proxy. Combined with content-addressed URLs, the "bust the
cache when I change things" requirement is met with no new code.

## Testing

- **T1** unit: upload passes `cacheControl:"31536000"` to `uploadToSignedUrl`.
- **T2** unit (key guard): `heroPreload(url).imagesrcset` equals `ImageBlock`'s
  `srcSet` for the same url — guards the A1 double-download invariant.
- **T3** unit: `heroPreload` no-ops off-production (mirrors A3).
- **T4** reuse existing `netlify-image` unit tests; don't duplicate.
- **T5** verify post-deploy: `curl` a transform → assert `max-age=31536000`;
  Lighthouse LCP on `/` and a gallery piece; view-source shows the preload link.

## Files touched

- `apps/admin/app/(dashboard)/artworks/page.tsx` — cacheControl on upload (1 line)
- `scripts/backfill-image-cache-control.mjs` — new, one-time backfill
- `apps/website/src/components/blocks/ImageBlock/index.tsx` — `priority` prop
- `apps/website/src/utils/netlify-image.ts` — add `heroPreload(url)` helper (+ test)
- `apps/website/src/pages/[[...slug]].js` — homepage hero priority + preload
- `apps/website/src/pages/gallery/[slug].js` — detail hero priority + preload
- `apps/website/src/pages/gallery/index.js` — grid first-image (index 0) priority

~7 files, no new services.

## Deferred (TODOs)

1. **Pre-warm transforms** after upload/publish so the first-visitor-after-publish
   never eats the one-time ~2s cold hit. Deferred: low traffic, infrequent
   uploads; needs an admin→website warming path. Revisit if it becomes a real
   complaint.
2. **Resize sources to a web-master** (~2560px, <1MB) at upload. Biggest remaining
   cold-transform reduction and cuts Netlify transform cost. Deferred by scope
   decision (web-master-only is acceptable; originals not needed). Revisit if
   Netlify transform costs or cold latency bite.
