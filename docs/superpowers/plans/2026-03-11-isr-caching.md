# ISR + On-Demand Revalidation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move read-only DB calls (featured hero, gallery card prices, artwork detail metadata, announcement banner) from client-side tRPC into server-side `getStaticProps` with ISR, eliminating loading flashes and protecting Supabase from quota abuse via repeated page refreshes.

**Architecture:** The catch-all page `[[...slug]].js` is the integration point. We detect URL patterns in `getStaticProps`, call tRPC server-side via `createCallerFactory`, and inject product/banner data directly into the page props before returning them. Pages get `revalidate: 3600` and `fallback: 'blocking'`. An `/api/revalidate` endpoint enables the admin panel to trigger instant regeneration after saves.

**Tech Stack:** Next.js 15 (Pages Router), tRPC v11 via `createCallerFactory`, Supabase PostgreSQL, Netlify edge CDN (Cache-Control headers), React Query

**Spec:** `docs/superpowers/specs/2026-03-11-isr-caching-design.md`

---

## Chunk 1: Foundation

### Task 1: Catch-all — fallback + revalidate

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`

The catch-all currently uses `fallback: false`. ISR requires `fallback: 'blocking'` for `res.revalidate()` to work and for background regeneration to kick in. Also add `revalidate: 3600` to `getStaticProps`.

- [ ] **Step 1: Change fallback and add revalidate**

In `getStaticPaths`, change:
```js
return { paths: filtered, fallback: false };
```
→
```js
return { paths: filtered, fallback: 'blocking' };
```

In `getStaticProps`, change the return statement from:
```js
return { props };
```
→
```js
return { props, revalidate: 3600 };
```

- [ ] **Step 2: Build check**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds. No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git commit -m "feat(isr): enable fallback:blocking and revalidate:3600 on catch-all"
```

---

### Task 2: Cache-Control on tRPC GET handler

**Files:**
- Modify: `apps/website/app/api/trpc/[trpc]/route.ts`

Public GET requests to `/api/trpc` are currently uncached. Adding `Cache-Control` headers makes Netlify's CDN serve cached responses, protecting Supabase from repeat callers.

Important: `fetchRequestHandler` returns a `Response` whose headers may be immutable. Construct a new `Response` with merged headers instead of mutating.

- [ ] **Step 1: Intercept and annotate GET responses**

Replace the full contents of `apps/website/app/api/trpc/[trpc]/route.ts`:

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@vamy/db/trpc";
import { createContext } from "@vamy/db/trpc/context";

async function handler(req: Request) {
  const response = await fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

  // Only cache GET (query) responses — mutations (POST) must not be cached
  if (req.method !== "GET") return response;

  return new Response(response.body, {
    status: response.status,
    headers: {
      ...Object.fromEntries(response.headers.entries()),
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

export { handler as GET, handler as POST };
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/api/trpc/[trpc]/route.ts
git commit -m "feat(isr): add Cache-Control headers to tRPC GET handler"
```

---

### Task 3: On-demand revalidation endpoint

**Files:**
- Create: `apps/website/src/pages/api/revalidate.ts`

This endpoint is called by the admin panel after saving changes. It triggers Next.js to regenerate affected static pages immediately.

- [ ] **Step 1: Create the revalidate API route**

Create `apps/website/src/pages/api/revalidate.ts`:

```ts
import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = req.headers["x-revalidate-secret"] ?? req.query.secret;
  if (secret !== process.env.REVALIDATION_SECRET) {
    return res.status(401).json({ error: "Invalid secret" });
  }

  const rawPaths = (req.query.paths as string) ?? "";
  const paths = rawPaths
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);

  if (paths.length === 0) {
    return res.status(400).json({ error: "No paths provided" });
  }

  try {
    await Promise.all(paths.map((path) => res.revalidate(path)));
    return res.json({ revalidated: true, paths });
  } catch (err) {
    return res.status(500).json({ error: "Revalidation failed", detail: String(err) });
  }
}
```

- [ ] **Step 2: Add REVALIDATION_SECRET to .env files**

Generate a secret and add it to both `.env.local` files. The repo root `.env.local` is symlinked into both apps — add to both explicitly to be safe:

```bash
SECRET=$(openssl rand -hex 32)
echo "REVALIDATION_SECRET=$SECRET" >> /home/blox-master/business/vamy/website/vamy.art/.env.local
echo "NEXT_PUBLIC_WEBSITE_URL=http://localhost:3000" >> /home/blox-master/business/vamy/website/vamy.art/.env.local
```

> In production (Netlify), set `REVALIDATION_SECRET` and `NEXT_PUBLIC_WEBSITE_URL=https://vamy.art` as environment variables in both the website and admin Netlify sites.

- [ ] **Step 3: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds. `/api/revalidate` appears in Pages API routes.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/api/revalidate.ts
git commit -m "feat(isr): add /api/revalidate endpoint for on-demand page regeneration"
```

---

## Chunk 2: Server-side data injection

### Task 4: Create the tRPC server caller helper

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`

All server-side tRPC calls in `getStaticProps` use the same pattern. tRPC v11 uses `createCallerFactory` (not the deprecated `createCaller`). Add the import and caller setup once at the top of the catch-all.

- [ ] **Step 1: Add tRPC server caller import**

At the top of `apps/website/src/pages/[[...slug]].js`, after the existing imports, add:

```js
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@vamy/db/trpc';

// tRPC v11 server-side caller (used in getStaticProps — no auth needed for public routes)
const createServerCaller = createCallerFactory(appRouter);
const serverTrpc = createServerCaller({ userId: null });
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git commit -m "feat(isr): add tRPC v11 server caller to catch-all getStaticProps"
```

---

### Task 5: Homepage — featured hero + announcement banner server-side

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`
- Modify: `apps/website/src/components/AnnouncementBanner.tsx`
- Modify: `apps/website/src/pages/_app.tsx`

The homepage hero currently uses ImageBlock → FeaturedHero (client-side tRPC). AnnouncementBanner also makes a client-side query. Both are injected server-side.

- [ ] **Step 1: Inject featured artwork URL + banner for homepage**

In `getStaticProps` in `[[...slug]].js`, after `const props = await resolveStaticProps(urlPath, data);` (which is fully resolved since it's awaited), add:

```js
if (urlPath === '/') {
    // Inject featured artwork image server-side
    try {
        const featured = await serverTrpc.products.getFeatured();
        if (featured?.artwork?.slug) {
            const heroSection = props.page?.sections?.[0];
            if (heroSection?.media?.url?.includes('placeholder')) {
                heroSection.media.url = `/images/${featured.artwork.slug}.jpg`;
                heroSection.media.altText = `${featured.artwork.title} by Maeve Vamy`;
            }
        }
    } catch {
        // Fallback to placeholder if DB unavailable at build time
    }

    // Inject active announcement banner server-side
    try {
        const banner = await serverTrpc.banners.getActive({ slug: '' });
        if (banner) {
            props.site.activeBanner = banner;
        }
    } catch {
        // No banner — component handles null gracefully
    }
}
```

- [ ] **Step 2: Update AnnouncementBanner to accept a prop instead of querying**

Replace `apps/website/src/components/AnnouncementBanner.tsx`:

```tsx
interface Banner {
    text: string;
}

interface AnnouncementBannerProps {
    banner?: Banner | null;
}

export function AnnouncementBanner({ banner }: AnnouncementBannerProps) {
    if (!banner) return null;

    return (
        <div className="bg-black text-white text-center text-sm py-2 px-4">
            {banner.text}
        </div>
    );
}
```

- [ ] **Step 3: Update _app.tsx to pass banner from site props**

In `apps/website/src/pages/_app.tsx`, find where `AnnouncementBanner` is rendered and pass the banner prop:

```tsx
<AnnouncementBanner banner={pageProps?.site?.activeBanner ?? null} />
```

- [ ] **Step 4: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git add apps/website/src/components/AnnouncementBanner.tsx
git add apps/website/src/pages/_app.tsx
git commit -m "feat(isr): inject featured hero and announcement banner server-side on homepage"
```

---

### Task 6: Gallery cards — product data server-side

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`

Gallery cards currently fetch product data client-side via ArtworkCardInfo. We fetch all products in `getStaticProps`, attach each to its post object, and render inline in PostFeedItem without any client-side calls.

- [ ] **Step 1: Fetch all products and attach to gallery posts**

In `getStaticProps` in `[[...slug]].js`, after the homepage block, add:

```js
if (urlPath === '/gallery') {
    try {
        const allProducts = await serverTrpc.products.listAll();
        // Build slug → product lookup map
        const productsBySlug = Object.fromEntries(
            (allProducts ?? [])
                .filter((p) => p.artwork?.slug)
                .map((p) => [p.artwork.slug, p])
        );
        // Attach product to each post via its URL slug
        const posts = props.page?.items ?? [];
        for (const post of posts) {
            const postSlug = post.__metadata?.urlPath?.split('/').filter(Boolean).pop();
            if (postSlug && productsBySlug[postSlug]) {
                post.artworkProduct = productsBySlug[postSlug];
            }
        }
    } catch {
        // Products unavailable at build time — cards render without pricing
    }
}
```

- [ ] **Step 2: Render product data inline in PostFeedItem**

In `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`:

Remove the `dynamic` import for `ArtworkCardInfo` at the top of the file.

Replace the dynamic render block:
```tsx
{(() => {
    const slug = (post.__metadata?.urlPath ?? '').split('/').filter(Boolean).pop();
    return slug ? <ArtworkCardInfo slug={slug} /> : null;
})()}
```
→
```tsx
{post.artworkProduct && (
    <ArtworkCardInfoStatic product={post.artworkProduct} />
)}
```

Add the static component above the `PostAttribution` function:

```tsx
function ArtworkCardInfoStatic({ product }: { product: any }) {
    const allVariants = (product.variants ?? []) as any[];
    const cheapest = allVariants
        .filter((v: any) => v.available && v.price)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
    const hasAvailable = allVariants.some((v: any) => v.available);
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium ?? "";
    const dimensions = attrs.dimensions ?? "";

    return (
        <div className="mt-2 space-y-1">
            {medium && (
                <p className="text-xs text-gray-500">
                    {medium}{dimensions ? ` · ${dimensions}` : ""}
                </p>
            )}
            {cheapest ? (
                <p className="text-sm font-light">€{Number(cheapest.price).toLocaleString()}</p>
            ) : (
                <p className="text-xs text-gray-400 italic">Price on request</p>
            )}
            <p className="text-xs flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${hasAvailable ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git add apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx
git commit -m "feat(isr): gallery cards render product data server-side"
```

---

### Task 7: Artwork detail — product data server-side

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

Artwork detail pages fetch product data client-side via ArtworkDetails. We inject it at build time.

- [ ] **Step 1: Fetch product for gallery detail pages**

In `getStaticProps` in `[[...slug]].js`, after the gallery index block, add:

```js
// Gallery detail: e.g. /gallery/whispers (exactly 2 path segments)
if (urlPath.startsWith('/gallery/') && urlPath.split('/').filter(Boolean).length === 2) {
    const artworkSlug = urlPath.split('/').filter(Boolean).pop();
    try {
        const product = await serverTrpc.products.getByArtworkSlug({ slug: artworkSlug });
        if (product) {
            props.page.artworkProduct = product;
        }
    } catch {
        // Product unavailable at build time — detail renders without pricing
    }
}
```

- [ ] **Step 2: Remove client-side ArtworkDetails from PostLayout**

In `apps/website/src/components/layouts/PostLayout/index.tsx`:

Remove the dynamic import block:
```tsx
const ArtworkDetails = dynamic(
    () => import('../../blocks/ArtworkDetails').then((m) => ({ default: m.ArtworkDetails })),
    { ssr: false }
);
```

Replace `{artworkSlug && <ArtworkDetails slug={artworkSlug} />}` with:
```tsx
{page.artworkProduct && <ArtworkDetailsStatic product={page.artworkProduct} />}
```

Add before the export:

```tsx
function ArtworkDetailsStatic({ product }: { product: any }) {
    const allVariants = (product.variants ?? []) as any[];
    const cheapest = allVariants
        .filter((v: any) => v.available && v.price)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
    const hasAvailable = allVariants.some((v: any) => v.available);
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium ?? "";
    const dimensions = attrs.dimensions ?? "";

    return (
        <div className="space-y-2">
            {medium && <p className="text-sm text-gray-500">{medium}</p>}
            {dimensions && <p className="text-sm text-gray-500">{dimensions}</p>}
            {cheapest ? (
                <p className="text-lg font-light">€{Number(cheapest.price).toLocaleString()}</p>
            ) : (
                <p className="text-sm text-gray-400 italic">Price on request</p>
            )}
            <p className="text-sm flex items-center gap-1.5">
                <span className={`inline-block w-2 h-2 rounded-full ${hasAvailable ? "bg-green-500" : "bg-gray-400"}`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}
```

- [ ] **Step 3: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds. Gallery detail pages (`/gallery/whispers` etc.) show as `●` SSG.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git add apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "feat(isr): artwork detail renders product metadata server-side"
```

---

## Chunk 3: Admin wiring + cleanup

### Task 8: Admin — trigger revalidation after saves

**Files:**
- Create: `apps/admin/lib/revalidate.ts`
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

After each save in admin, call the website's revalidation endpoint so changes appear immediately.

- [ ] **Step 1: Create the revalidate helper**

Create `apps/admin/lib/revalidate.ts`:

```ts
const WEBSITE_URL = process.env.NEXT_PUBLIC_WEBSITE_URL ?? "http://localhost:3000";
const SECRET = process.env.REVALIDATION_SECRET ?? "";

export async function revalidatePaths(paths: string[]): Promise<void> {
    try {
        await fetch(
            `${WEBSITE_URL}/api/revalidate?paths=${encodeURIComponent(paths.join(","))}`,
            {
                method: "POST",
                headers: { "x-revalidate-secret": SECRET },
            }
        );
    } catch {
        // Non-critical — ISR fallback will catch it within 1 hour
        console.warn("Revalidation failed for paths:", paths);
    }
}
```

- [ ] **Step 2: Read the artworks page to understand current state**

Read `apps/admin/app/(dashboard)/artworks/page.tsx` to find the exact mutation `onSuccess` handlers and the product/artwork data structure available in scope.

- [ ] **Step 3: Wire revalidation into mutation onSuccess handlers**

In `apps/admin/app/(dashboard)/artworks/page.tsx`, add:
```tsx
import { revalidatePaths } from "@/lib/revalidate";
```

Update each mutation's `onSuccess` to call `revalidatePaths`:

**`createProduct.onSuccess`:**
```ts
onSuccess: async () => {
    await revalidatePaths(["/", "/gallery"]);
    refetch();
    toast("product created", "success");
},
```

**`updateVariant.onSuccess`** — also revalidate the specific artwork page. The artwork slug is available from the product data in local state. Look for the product being edited (e.g. from `editId` state to find the parent product, then its `artwork.slug`):
```ts
onSuccess: async (_, vars) => {
    // Find the slug for the product being edited
    const editedProduct = artworkEntries
        .flatMap(([, ps]) => ps)
        .find((p) => p.variants?.some((v) => v.id === vars.variantId));
    const slug = editedProduct?.artwork?.slug;
    const paths = ["/", "/gallery", ...(slug ? [`/gallery/${slug}`] : [])];
    await revalidatePaths(paths);
    refetch();
    toast("variant updated", "success");
},
```

**`setFeatured.onSuccess`:**
```ts
onSuccess: async () => {
    await revalidatePaths(["/"]);
    refetch();
    toast("featured updated", "success");
},
```

**`deleteProduct.onSuccess`:**
```ts
onSuccess: async () => {
    await revalidatePaths(["/", "/gallery"]);
    refetch();
    toast("product deleted", "success");
},
```

> Note: the exact variable names (`artworkEntries`, `editId`, etc.) depend on the current page state — read the file first in Step 2 and adapt accordingly.

- [ ] **Step 4: Build check**

```bash
pnpm --filter @vamy/admin build 2>&1 | tail -10
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/lib/revalidate.ts apps/admin/app/\(dashboard\)/artworks/page.tsx
git commit -m "feat(isr): trigger website revalidation from admin after product saves"
```

---

### Task 9: Cleanup — remove now-unused client-only components

**Files:**
- Delete: `apps/website/src/components/blocks/ArtworkCardInfo/index.tsx`
- Delete: `apps/website/src/components/blocks/ArtworkDetails/index.tsx`
- Delete: `apps/website/src/components/blocks/FeaturedHero/index.tsx`
- Modify: `apps/website/src/components/blocks/ImageBlock/index.tsx`

- [ ] **Step 1: Confirm nothing else imports these components**

```bash
grep -r "ArtworkCardInfo\|ArtworkDetails\|FeaturedHero" apps/website/src/ --include="*.tsx" --include="*.ts" --include="*.js"
```

If any other file imports them besides the ones already modified, update those files first.

- [ ] **Step 2: Delete the three components**

```bash
rm apps/website/src/components/blocks/ArtworkCardInfo/index.tsx
rm apps/website/src/components/blocks/ArtworkDetails/index.tsx
rm apps/website/src/components/blocks/FeaturedHero/index.tsx
```

- [ ] **Step 3: Simplify ImageBlock — remove FeaturedHero detection**

Read `apps/website/src/components/blocks/ImageBlock/index.tsx`. Remove:
- The `dynamic(() => import('./FeaturedHero')...)` import at the top
- The placeholder URL detection (`if (url?.includes('placeholder'))`)
- The conditional FeaturedHero render

Restore the component to its single responsibility: render an `<img>` from the provided `url`. The featured artwork URL is now baked in at build time.

- [ ] **Step 4: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

Expected: Build succeeds with no broken imports.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove client-only ArtworkCardInfo, ArtworkDetails, FeaturedHero components"
```

---

### Task 10: Set staleTime:Infinity on get-a-piece

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx`

The get-a-piece page keeps its client-side query (the piece slug comes from `?piece=` URL param). Product data changes ~1-2x/month so we should never re-fetch within a session.

> Note: `apps/website/src/pages/get-a-piece.tsx` is a dedicated page file — it exists independently of the catch-all.

- [ ] **Step 1: Update staleTime**

In `apps/website/src/pages/get-a-piece.tsx`, find the tRPC query and update to `staleTime: Infinity`:

```tsx
const { data: product } = trpc.products.getByArtworkSlug.useQuery(
    { slug: pieceSlug },
    { enabled: !!pieceSlug, staleTime: Infinity }
);
```

- [ ] **Step 2: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -10
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "perf: set staleTime:Infinity on get-a-piece product query"
```

---

### Task 11: Final build verification

- [ ] **Step 1: Full turbo build**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm turbo build 2>&1 | tail -20
```

Expected: `Tasks: 2 successful, 2 total`. Zero TypeScript errors.

- [ ] **Step 2: Confirm SSG output in build log**

Verify these routes appear in the website build output with `●` (SSG):
- `/` — homepage with featured artwork baked in
- `/gallery` — gallery with product data baked in
- `/gallery/whispers`, `/gallery/first-contact`, `/gallery/on-the-horizon` — detail pages with pricing baked in
- `/about` — pure static

And these as `ƒ` (Dynamic/API):
- `/api/revalidate`
- `/api/trpc/[trpc]`

- [ ] **Step 3: Push**

```bash
git push origin feature/blox-349-vamyart-integration-for-selling-build-or-buy
```
