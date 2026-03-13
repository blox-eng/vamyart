# ISR + On-Demand Revalidation — Design Spec

**Goal:** Eliminate client-side DB calls for read-only data, serve pre-rendered pages, protect Supabase from abuse, and make the site feel instant.

**Context:** Artwork data changes ~1-2 times per month. Current architecture makes client-side tRPC calls on every page load, causing loading flashes and exposing the API to quota abuse via repeated refreshes.

---

## Strategy

Move read-only product data into `getStaticProps` with ISR (`revalidate: 3600`). Pages are pre-rendered at build time and regenerated in the background every 60 minutes. When the artist updates data in the admin panel, an on-demand revalidation endpoint instantly regenerates affected pages.

## Catch-All Page: Fallback Mode

The catch-all `src/pages/[[...slug]].js` currently uses `fallback: false`. ISR requires `fallback: 'blocking'` so that:
1. `revalidate: 3600` actually triggers background regeneration
2. `res.revalidate()` calls from the on-demand endpoint take effect

Change `getStaticPaths` to return `fallback: 'blocking'` instead of `fallback: false`.

## Gallery Detail Pages: Strategy

Gallery detail pages (`/gallery/whispers`, etc.) are rendered by the catch-all `[[...slug]].js`, which reads markdown content via `allContent()` / `resolveStaticProps()`. There is no dedicated `src/pages/gallery/[slug].tsx`.

**Approach:** Inject DB data into the catch-all's `getStaticProps` rather than creating a separate page file. In `resolveStaticProps` (or in the catch-all's `getStaticProps` directly), detect gallery detail pages by URL pattern (`/gallery/{slug}`), call `tRPC` server-side to fetch product data, and merge it into the page props alongside the existing markdown content.

This avoids creating a parallel routing system and keeps the content model intact.

## What Moves Server-Side

### Homepage (`/`)
- **FeaturedHero**: Fetch featured product in `getStaticProps`, pass `featuredImage` as a prop. Remove the client-side FeaturedHero component.
- **AnnouncementBanner**: Fetch active banner in `getStaticProps`, pass as prop. Remove client-side query.

### Gallery (`/gallery`)
- **ArtworkCardInfo**: Fetch all products with variants in `getStaticProps`, build a `slug → product` map, pass to PostFeedLayout → PostFeedItem as props. Remove the client-side ArtworkCardInfo component.

### Artwork Detail (`/gallery/{slug}`)
- **ArtworkDetails**: In the catch-all `getStaticProps`, detect gallery detail pages and fetch product by artwork slug via tRPC server-side caller. Pass product data as a prop. Remove client-side ArtworkDetails component. Render medium, dimensions, price, availability directly in PostLayout from props.

### About (`/about`)
- No DB calls. Already fully static.

### Get-a-Piece (`/get-a-piece`)
- Keep client-side query for `?piece=` param (dynamic per request), but set `staleTime: Infinity` since data barely changes. The tRPC call is only made when a specific artwork is selected.

## What Stays Client-Side

| Component | Reason |
|-----------|--------|
| BidWidget | Real-time auction data via Supabase Realtime |
| BidModal | Mutation (place bid) |
| ProductSelector | Mutation (create Stripe checkout session) |
| FormBlock / ReachOutBlock | Mutation (create inquiry) |
| Footer newsletter | Mutation (subscribe) |

## API Abuse Protection

Add `Cache-Control` headers to the tRPC GET handler at `apps/website/app/api/trpc/[trpc]/route.ts`. The handler uses `fetchRequestHandler` which returns a `Response` object — intercept it and set headers:

```ts
const response = await fetchRequestHandler({ /* ... */ });
response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
return response;
```

Only apply to GET requests. POST (mutations) must not be cached.

Netlify's edge CDN caches the response. 100k refreshes within the cache window = 1 actual DB call.

## Netlify ISR Compatibility

Netlify supports Next.js ISR and on-demand revalidation via `@netlify/plugin-nextjs` (included by default in the Netlify Next.js runtime). Verify the current `netlify.toml` uses a compatible runtime. The `REVALIDATION_SECRET` and Supabase env vars must be available in the Netlify build environment (they are, since Supabase is external and env vars are configured in Netlify dashboard).

## On-Demand Revalidation

### Endpoint

`POST /api/revalidate` at `apps/website/src/pages/api/revalidate.ts`:

- Accepts `secret` (shared token between admin and website) and `paths` (comma-separated list of paths to revalidate)
- Calls `res.revalidate(path)` for each path
- Returns `{ revalidated: true, paths: [...] }`

### Trigger

When the artist saves a product, variant, or featured toggle in the admin panel, the admin calls the revalidation endpoint with the affected paths:

- Product update → revalidate `/`, `/gallery`, `/gallery/{slug}`
- Featured toggle → revalidate `/`
- Banner update → revalidate `/`

The revalidation call is made from the admin's tRPC mutation `onSuccess` handler via a simple `fetch()` to the website's revalidation endpoint.

### Secret

`REVALIDATION_SECRET` env var shared between admin and website. Stored in `.env.local`.

## Revalidation Windows

| Page | ISR revalidate | On-demand trigger |
|------|---------------|-------------------|
| Homepage | 3600s (1h) | Product featured, banner update |
| Gallery | 3600s (1h) | Product create/update/delete |
| Artwork detail | 3600s (1h) | Product/variant update for that slug |
| Get-a-piece | N/A (client-side) | N/A |
| About | false (pure static) | N/A |

## Data Flow

### Before (current)
```
User loads page → Page renders shell → Client-side JS hydrates →
tRPC call to /api/trpc → Supabase query → Response → Render data
```

### After (ISR)
```
User loads page → Netlify serves cached HTML with data already in it → Done
(Background: every 1h, Next.js regenerates page with fresh DB data)
```

### On admin update
```
Artist saves in admin → tRPC mutation succeeds →
Admin calls POST /api/revalidate → Next.js regenerates affected pages →
Next visitor gets fresh data
```

## Components to Remove

After migration, these client-only components become unnecessary:
- `apps/website/src/components/blocks/ArtworkCardInfo/index.tsx` — data passed as props
- `apps/website/src/components/blocks/ArtworkDetails/index.tsx` — data passed as props
- `apps/website/src/components/blocks/FeaturedHero/index.tsx` — data passed as props

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Stale data after admin update if revalidation fails | 1-hour fallback revalidation catches it. Admin UI shows toast if revalidation call fails. |
| Revalidation secret leaks | Only stored in `.env.local`, never committed. Rotate if compromised. |
| Build time increases with more artworks | Negligible — 3 artworks, each page builds in <1s. ISR handles incremental additions. |
| Gallery page needs all products in one query | Single `listAll` tRPC call in `getStaticProps` — acceptable for <100 artworks. |
