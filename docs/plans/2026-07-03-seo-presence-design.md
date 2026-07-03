# SEO Presence + Load Polish — Design

**Date:** 2026-07-03
**Follows:** [#23](https://github.com/blox-eng/vamyart/issues/23) fonts/FCP work (merged, PR #25). Perf now 83–85, FCP ~1.1s.
**Scope:** Organic discoverability (search + social rich results) + the one remaining honest load lever, driven by the studio SEO fields Maeve already fills. **No schema changes, no new admin fields.**

## Goal

Give search engines and social platforms everything they need to find, index, and richly render vamy.art — using the existing per-piece `seoTitle`/`seoDescription` studio fields as the single source of truth — while holding Performance ≥ 83 and reaching a perfect Lighthouse SEO score.

## Findings that shaped scope

- **Image path is already at its ceiling** (do NOT redo): `LazyImage` emits a responsive `srcSet` from `netlifyImageSrcSet` + `DEFAULT_WIDTHS [400,800,1200,1600]`; Netlify Image CDN auto-negotiates AVIF/WebP from the `Accept` header; the hero preload's `imagesrcset`/`imagesizes` already match the rendered `<img>` (`buildHeroPreload`); #22 added a year-long cache. There is no meaningful image lever left.
- **FCP fixed** by #23. Performance 83–85; remaining LCP (~4.3–4.6s lab) is network-throttling-bound, not fixable in code.
- **Studio SEO half-built:** `artworks.seoTitle` / `seoDescription` columns exist, are editable in the admin (`EditPiecePanel.tsx`, `NewPieceForm.tsx`), and already feed the gallery detail `<head>` (`gallery/[slug].js`: `metaTitle = seoTitle ?? title`, `metaDescription = seoDescription ?? excerpt`, `socialImage = primaryImage.url`).
- **Absent today:** `sitemap.xml`, `robots.txt`, any `<link rel="canonical">`, any JSON-LD, `<html lang>`.

## Current wiring (reference)

- Head tags: classic `next/head`. Central generator `apps/website/src/utils/seo-utils.js` (`seoGenerateMetaTags`, `seoGenerateTitle`, `seoGenerateMetaDescription`, `seoGenerateOgImage`, `seoGenerateOgUrl`). **Emits no canonical.**
- Consumers: catch-all `pages/[[...slug]].js`, gallery detail `pages/gallery/[slug].js`, gallery index `pages/gallery/index.js`. Hand-rolled heads: `about.tsx`, `get-a-piece.tsx`.
- `_document.tsx`: `<Html className="${inter.variable} ${cormorant.variable}">` — **no `lang`**.
- Website has a hybrid `app/` dir (`app/api/{cron,trpc,webhooks}`) → App Router metadata routes (`app/sitemap.ts`, `app/robots.ts`) are viable.
- Server data access: `serverTrpc` = `appRouter.createCaller({ userId: null })`; `artworks.listPublic()` returns published pieces with image URLs.
- `NEXT_PUBLIC_SITE_URL` is set. `trailingSlash: true`.

## Design

### 1. Crawl & canonical infrastructure

- **`app/robots.ts`** — App Router metadata route: allow all, `sitemap` = `${SITE_URL}/sitemap.xml`, `host` from `NEXT_PUBLIC_SITE_URL`.
- **`app/sitemap.ts`** — static routes (`/`, `/about`, `/gallery`, `/get-a-piece`) + DB-driven gallery slugs via `serverTrpc.artworks.listPublic()` (published only), `lastModified = updatedAt`. Revalidated hourly. Unpublishing a piece in the studio removes it automatically.
- **Canonical** — `<link rel="canonical" href>` added once in `seo-utils.js` (feeds catch-all + gallery pages) and in the two hand-rolled heads (`about.tsx`, `get-a-piece.tsx`). URL = `NEXT_PUBLIC_SITE_URL` + request path, normalized to the site's `trailingSlash: true` form. Matters specifically because trailing-slash variants would otherwise read as duplicate URLs.
- **`<html lang="en">`** in `_document.tsx`.

### 2. Structured data (JSON-LD), auto-derived

A small reusable helper `apps/website/src/components/atoms/JsonLd.tsx` renders `<script type="application/ld+json">{JSON.stringify(data)}</script>` (inside each page's `<Head>`). Builders live in `apps/website/src/utils/structured-data.js`.

- **Gallery piece** (`gallery/[slug].js`): `VisualArtwork` — `name`, `description`, `image` = primary image URL, `dateCreated` = year, `artMedium` = medium, `creator` = `{ @type: Person, name: "Vamy" }`, `url` = canonical. **Plus** `BreadcrumbList` (Home → Gallery → piece).
- **Homepage** (catch-all, home slug): `WebSite` (`name`, `url`) + `Person` (Vamy; `sameAs` = social links from `site.json` if present).
- **About** (`about.tsx`): `Person`.
- **Deliberately skipped:** `Product`/`Offer` markup. Originals carry no structured price (manual Stripe links); prints are a separate `products`/`variants` table. YAGNI — the artwork is the SEO story.

### 3. Studio wiring: verify end-to-end (no new fields)

Confirm one edit moves every surface: admin `seoTitle`/`seoDescription` → DB → `getBySlug` → `<title>` + `meta description` + `og:*` + **now canonical + JSON-LD** (all read the same fields). `listPublic` not returning the SEO fields is fine — the gallery *index* head describes the collection, not individual cards. No change there (YAGNI).

### 4. Performance: one honest, measure-gated lever

Images are optimal, so the only real perf work is the **deferred unused-JS trim (#23 lever 2)** — the tRPC/react-query provider hydrates on every page solely for the announcement banner. Approach: defer/gate that hydration. **Gate:** take a before/after Lighthouse; ship only if it buys a real TBT/bundle win. Otherwise drop it — no app-wide risk for a lab-only delta. No image changes.

## Sequencing & shipping

SEO first (independent, safe, high-yield): robots + sitemap → canonical + lang → JSON-LD. Then the gated JS trim. Batched commits, **one push per PR** (protects Netlify preview credits). Expected: PR A (crawl + canonical + lang + JSON-LD), PR B (JS trim, only if it measures well).

## Out of scope / deferred

- `Product`/`Offer` JSON-LD (no structured price on originals).
- New studio fields (noindex toggle, canonical override, OG picker) — auto-derive covers the need.
- Image work (already optimal).
- Cyrillic/i18n SEO (BG locale not live; revisit with the locale).

## Risks

- **Sitemap DB call at build/revalidate:** `app/sitemap.ts` runs `serverTrpc` — must handle an empty/failed DB gracefully (return static routes rather than throw), so a DB blip never 500s the sitemap.
- **Canonical correctness:** must match the exact `trailingSlash: true` URL the page is served at, or it fights itself. Unit-test the URL builder.
- **JSON-LD validity:** invalid schema is worse than none. Validate each type against Google Rich Results Test before merge.

## Success criteria

- `sitemap.xml` + `robots.txt` live and valid; sitemap reflects only published pieces.
- Every page: exactly one canonical + `lang="en"`.
- Google Rich Results Test passes VisualArtwork + Person + BreadcrumbList.
- Lighthouse **SEO = 100**; Performance holds ≥ 83.
- A studio edit to a piece's SEO title/description appears in `<title>`, meta description, OG card, and JSON-LD — with zero dev involvement.
