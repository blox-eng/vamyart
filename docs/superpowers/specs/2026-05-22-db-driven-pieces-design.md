# DB-Driven Pieces — Design

**Date:** 2026-05-22
**Status:** Approved (pending spec review)
**Goal:** Let the artist create, edit, reorder, and delete gallery pieces entirely from the admin studio. Remove the dependency on hardcoded markdown files for artwork content.

## Problem

Today, artwork *content* (title, excerpt, body/story, medium, dimensions, SEO) lives in markdown files under `apps/website/content/pages/gallery/` and is committed to git. The website builds these statically (SSG) and joins them with Supabase by `slug` at build time to pull in images, products, prices, and stock.

The admin can edit some fields of an existing artwork and fully manage products/variants/images, but:

- There is **no way to create a new artwork** from the admin.
- Even with a DB row, a new piece does not appear on the site without a markdown file + git commit + redeploy.

This makes adding a piece a developer task, not an artist task.

## Decision

Make **Supabase the source of truth for piece content**. Retire the markdown gallery files. The website renders gallery pages from the DB, regenerated on demand so a new/edited piece appears within seconds — no redeploy.

Resolved during brainstorming:

- **Source of truth:** Full DB-driven. Markdown gallery files retired.
- **Publishing latency:** Instant via on-demand revalidation (ISR), with a time-based `revalidate` fallback.
- **Migration:** Import the 3 existing markdown pieces (Whispers, First Contact, On the Horizon) into the DB, then delete the markdown files.
- **Body content:** Plain-text multi-paragraph description (rendered as paragraphs). No rich-text/markdown editor, no structured sections.
- **Excerpt:** Kept as a separate field (gallery cards + SEO description fallback).
- **`featured`:** `artworks.featured` drives gallery highlighting only. The existing `products.featured` continues to drive the home "buy" hero. The two stay separate.
- **Delete guard:** Deleting a piece is refused if it has any orders or an active/non-draft auction; otherwise it cascades products, variants, and images (including Storage objects).

## Verified against current docs (2026-05-22)

- **Next.js 15.5** Pages Router: `res.revalidate('/actual/path')` (secret-guarded), `getStaticPaths` `fallback: 'blocking'`, and the `revalidate` interval are all current, supported APIs.
- **Netlify Next.js Runtime v5** (`@netlify/plugin-nextjs@5.15.9`, the deploy target): explicitly supports Pages Router on-demand revalidation via `res.revalidate`, time-based ISR, and `fallback: 'blocking'`. No extra config beyond the installed runtime.
- **Drizzle 0.45 / drizzle-kit 0.30**: standard `generate` + `migrate` flow for adding columns.
- **Zod 4.3**: `z.string().uuid()` is soft-deprecated in favor of `z.uuid()` but still works. Match surrounding code; do not churn existing routers.

## Architecture

### 1. Data model (`packages/db/src/schema.ts`)

Extend the existing `artworks` table. Images already live in `artwork_images`; products/variants/pricing already in `products`/`product_variants`. Only piece *content* fields are added:

| New column | Type | Purpose |
|---|---|---|
| `excerpt` | text | One-line blurb for gallery cards + SEO description fallback |
| `description` | text | Multi-paragraph plain-text story, rendered as paragraphs on the detail page |
| `featured` | boolean, default false | Gallery highlighting (NOT the home buy-hero) |
| `sort_order` | integer, not null, default 0 | Gallery ordering |
| `seo_title` | text, nullable | Optional; falls back to `title` |
| `seo_description` | text, nullable | Optional; falls back to `excerpt` |

Existing columns kept: `id`, `slug` (unique), `title`, `year`, `medium`, `dimensions`, `status` (`available | bidding | sold`), timestamps.

New Drizzle migration via `drizzle-kit generate` + `migrate`. Update exported types.

### 2. tRPC (`packages/db/src/trpc/routers/artworks.ts`)

Protected (admin) procedures:

- `create` — input validated with Zod. Slug auto-generated from title (kebab-case), uniqueness-checked against existing rows; caller may override with an explicit slug (also uniqueness-checked). Returns the new row.
- `update` — extended to cover all new content fields. Slug editable with uniqueness check.
- `delete` — **guarded**: query orders + auctions for the artwork's products; refuse with a typed error if any order exists or an auction is active/non-draft. Otherwise delete in a transaction, cascading products → variants → images, and remove image objects from Supabase Storage (reuse the deletion logic already in `artworkImages.delete`).
- `reorder` — accepts an ordered array of artwork ids; writes `sort_order` in a transaction.
- `setFeatured` — `{ id, featured }`. Mirrors `products.setFeatured` semantics scoped to artworks.

Public procedures:

- `listPublic` — pieces for the gallery, ordered by `sort_order` then title, each with its primary image (path → CDN URL). Used by the gallery index.
- `getBySlug` — full piece content + images for the detail page. Returns null/not-found for unknown slug.

Existing `list` (admin) and `update` are extended, not replaced. `products.listByArtworkSlug` / `getByArtworkSlug` stay as-is for the purchase UI.

After every mutating procedure (`create`/`update`/`delete`/`reorder`/`setFeatured`), trigger website revalidation (see §4).

### 3. Website rendering (`apps/website`)

Carve the gallery out of the markdown catch-all into dedicated DB-backed routes. Next.js resolves specific routes ahead of `[[...slug]].js`, so all other markdown pages (home, about, get-a-piece) are untouched.

- `src/pages/gallery/index.js`
  - `getStaticProps` reads `artworks.listPublic`.
  - Returns `revalidate: 300` (time-based safety net) alongside on-demand revalidation.
  - Reuses the existing gallery listing presentation; feed it DB-derived items instead of markdown `page.items`.
- `src/pages/gallery/[slug].js`
  - `getStaticPaths` returns known slugs with `fallback: 'blocking'` so a brand-new piece renders on first request before any revalidation arrives.
  - `getStaticProps` reads `artworks.getBySlug`; returns `notFound: true` for unknown slug; `revalidate: 300`.
  - Reuses the existing `PostLayout` + `ProductSelector` components, fed DB-derived props (title, excerpt, description paragraphs, medium, dimensions, SEO, images) instead of frontmatter. `ProductSelector` continues to fetch products client-side by slug as it does today.
- Remove the 3 markdown gallery files and gallery `index.md` after migration. Confirm the catch-all no longer needs its build-time DB injection for `/gallery*` (that logic moves into the dedicated routes).

### 4. Instant publishing (on-demand revalidation)

- New API route `apps/website/src/pages/api/revalidate.js`:
  - Validates a shared secret (`REVALIDATE_SECRET`) from query/header; 401 otherwise.
  - Accepts the affected slug(s); calls `res.revalidate('/gallery')` and `res.revalidate('/gallery/<slug>')`.
  - Returns `{ revalidated: true }`; on error returns 500 (Next keeps serving the last good page).
- Admin mutations fire-and-forget a POST to the website's revalidate URL (env-configured `WEBSITE_REVALIDATE_URL` + `REVALIDATE_SECRET`), with a short timeout. A revalidation hiccup must never fail the admin mutation — it logs and moves on; the 300s ISR fallback heals it.
- Admin and website are **separate Netlify sites**, so this is a cross-site HTTP call. Both sites need `REVALIDATE_SECRET`; the admin also needs `WEBSITE_REVALIDATE_URL`.

### 5. Admin UI (`apps/admin/app/(dashboard)/artworks`)

- **New Piece form:** title (with live slug preview, editable), year, medium, dimensions, excerpt, description (textarea), status, SEO title/description. On create → auto-select the new piece so the artist can immediately upload images and add products via the existing flows.
- **Edit Piece panel:** the same fields for the selected artwork, surfacing the extended `update`.
- **List controls:** reorder (drag or explicit sort number) and a featured toggle, wired to `reorder` / `setFeatured`.
- Reuse existing toast/confirm patterns. Delete shows the guard reason when refused.

### 6. Migration

One-off seed/migration script that, for each of the 3 existing markdown pieces, fills the new content columns on the existing `artworks` row (`excerpt`, `description` from the markdown body, `year`, `medium`, `dimensions`, SEO, and an initial `sort_order`). Then delete the markdown gallery files. Verify each piece renders identically from the DB before removing markdown.

### 7. Testing

- Vitest router tests (matching the existing `auctions`/`bids` test style):
  - `create`: slug generation, kebab-casing, uniqueness collision handling, explicit-slug override.
  - `update`: field updates + slug-uniqueness on change.
  - `delete`: guard refuses when orders/active auction exist; succeeds and cascades otherwise.
  - `reorder`: writes expected `sort_order` values.
- Manual smoke test: create a piece in admin → it appears on `/gallery` and `/gallery/<slug>` within seconds; edit/reorder/feature reflect; delete guard blocks a piece with an order.

## Out of scope (YAGNI)

- Rich-text/markdown body editor and structured PostLayout sections.
- Unifying `artworks.featured` with `products.featured`.
- Buyer-facing changes to checkout, auctions, or waitlist.
- Migrating non-gallery markdown pages to the DB.

## Related

- `docs/superpowers/specs/2026-03-11-isr-caching-design.md` — prior ISR/caching work; align revalidation conventions with it.
- `docs/plans/2026-03-05-vamy-sales-integration-design.md` — overall sales architecture (this supersedes the "artworks stay in markdown" decision for gallery pieces).
