# Website Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the public website from portfolio template to gallery-grade storefront with DB-driven pricing, availability, Saatchi-inspired gallery cards, two-column artwork detail pages, redesigned footer, and a new About page.

**Architecture:** Artwork metadata (price, medium, dimensions) already exists in the DB schema. Gallery cards and detail pages query tRPC at render time. A new `featured` column on products enables admin-configurable homepage hero. The About page and footer are pure frontend changes.

**Tech Stack:** Next.js 15 (Pages Router), tRPC v11, Drizzle ORM, Supabase PostgreSQL, Tailwind CSS

**Working directory:** `/home/blox-master/business/vamy/website/vamy.art`

---

### Task 1: Instagram URL fix

The simplest change — fix everywhere before touching components.

**Files:**
- Modify: `apps/website/content/data/footer.json`
- Modify: `apps/website/content/pages/index.md`

**Step 1: Fix footer.json**

In `apps/website/content/data/footer.json`, change the Instagram social link URL:

```json
"url": "https://www.instagram.com/maevevamyart"
```
→
```json
"url": "https://www.instagram.com/maeve_vamy_art"
```

**Step 2: Fix index.md**

In `apps/website/content/pages/index.md`, find the hero "Follow me" action URL:

```yaml
url: 'https://www.instagram.com/maevevamyart'
```
→
```yaml
url: 'https://www.instagram.com/maeve_vamy_art'
```

**Step 3: Grep for any other occurrences**

```bash
grep -r "maevevamyart" apps/website/content/ apps/website/src/ --include="*.json" --include="*.md" --include="*.tsx" --include="*.ts"
```

Fix any remaining references.

**Step 4: Commit**

```bash
git add -A
git commit -m "fix: correct Instagram handle to maeve_vamy_art"
```

---

### Task 2: DB migration — add `featured` column to products

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: migration file via `drizzle-kit generate`

**Step 1: Add `featured` to products schema**

In `packages/db/src/schema.ts`, add to the `products` table definition, after the `active` column:

```typescript
featured: boolean("featured").notNull().default(false),
```

**Step 2: Generate migration**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/db generate
```

Expected: a new migration file in `packages/db/drizzle/` adding the `featured` column.

**Step 3: Run migration**

```bash
pnpm --filter @vamy/db migrate
```

Expected: migration applies successfully.

**Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat: add featured column to products table"
```

---

### Task 3: tRPC — add `getFeatured` and `getByArtworkSlug` routes

**Files:**
- Modify: `packages/db/src/trpc/routers/products.ts`

**Step 1: Read the current file**

Read `packages/db/src/trpc/routers/products.ts` to confirm the current imports and structure.

**Step 2: Add `getFeatured` public route**

Add this procedure to the `productsRouter`:

```typescript
getFeatured: publicProcedure.query(async () => {
    const product = await db.query.products.findFirst({
        where: and(eq(products.featured, true), eq(products.active, true)),
        with: {
            artwork: true,
            variants: { where: eq(productVariants.available, true) },
        },
        orderBy: (products, { desc }) => [desc(products.updatedAt)],
    });
    return product ?? null;
}),
```

**Step 3: Add `getByArtworkSlug` public route**

Add this procedure to the `productsRouter`:

```typescript
getByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
        const artwork = await db.query.artworks.findFirst({
            where: eq(artworks.slug, input.slug),
        });
        if (!artwork) return null;

        const product = await db.query.products.findFirst({
            where: and(eq(products.artworkId, artwork.id), eq(products.active, true)),
            with: {
                artwork: true,
                variants: true,
            },
        });
        return product ?? null;
    }),
```

**Step 4: Add `setFeatured` protected route**

This toggles a product as featured, un-featuring any other:

```typescript
setFeatured: protectedProcedure
    .input(z.object({ productId: z.string().uuid(), featured: z.boolean() }))
    .mutation(async ({ input }) => {
        await db.transaction(async (tx) => {
            // Un-feature all products first
            await tx.update(products).set({ featured: false }).where(eq(products.featured, true));
            // Feature the selected one
            if (input.featured) {
                await tx.update(products).set({ featured: true, updatedAt: new Date() }).where(eq(products.id, input.productId));
            }
        });
        return { success: true };
    }),
```

**Step 5: Build check**

```bash
pnpm --filter @vamy/db build 2>&1 | tail -10
```

**Step 6: Commit**

```bash
git add packages/db/src/trpc/routers/products.ts
git commit -m "feat: add getFeatured, getByArtworkSlug, setFeatured tRPC routes"
```

---

### Task 4: Admin — featured toggle on Artworks page

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

**Context:** The Artworks page already shows products grouped by artwork, with inline variant editing. We need to add a "Featured" toggle button per product. The `product_variants.attributes` JSONB already supports arbitrary fields — the admin variant editor should surface medium and dimensions inputs that write to this JSONB.

**Step 1: Read the full artworks page**

Read `apps/admin/app/(dashboard)/artworks/page.tsx` in full.

**Step 2: Add Featured toggle**

Find where each product card renders (the product name/header area). Add a toggle button next to the product name:

```tsx
<button
    onClick={() => setFeatured.mutate({ productId: p.id, featured: !p.featured })}
    disabled={setFeatured.isPending}
    className={`px-2 py-0.5 rounded text-xs font-medium ${
        p.featured ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500"
    }`}
>
    {p.featured ? "★ Featured" : "Feature"}
</button>
```

Add the mutation hook inside the component:

```tsx
const setFeatured = trpc.products.setFeatured.useMutation({
    onSuccess: () => { refetch(); toast("featured updated", "success"); },
    onError: () => toast("failed to update featured", "error"),
});
```

**Step 3: Add medium + dimensions inputs to the variant editor**

Find the variant edit form (where name, price, stock inputs are). Add two more inputs after stock:

```tsx
<div>
    <label className="block text-xs text-gray-500 mb-1">Medium</label>
    <input
        type="text"
        className="w-full border px-3 py-2 rounded text-sm"
        placeholder="e.g. Oil on canvas"
        value={(editAttributes?.medium as string) ?? ""}
        onChange={(e) => setEditAttributes({ ...editAttributes, medium: e.target.value })}
    />
</div>
<div>
    <label className="block text-xs text-gray-500 mb-1">Dimensions</label>
    <input
        type="text"
        className="w-full border px-3 py-2 rounded text-sm"
        placeholder="e.g. 70 × 100 cm"
        value={(editAttributes?.dimensions as string) ?? ""}
        onChange={(e) => setEditAttributes({ ...editAttributes, dimensions: e.target.value })}
    />
</div>
```

The variant edit state needs to track `attributes`. When saving, merge medium + dimensions into the existing attributes JSONB. The `updateVariant` mutation input needs to accept `attributes` — check if it already does, and if not, add it.

**Step 4: Update the `updateVariant` tRPC mutation** (if needed)

If the current `updateVariant` in `packages/db/src/trpc/routers/products.ts` doesn't accept `attributes`, add it:

```typescript
// In the updateVariant input schema, add:
attributes: z.record(z.unknown()).optional(),
```

And in the mutation body:
```typescript
.set({
    name: input.name,
    price: String(input.price),
    stockQuantity: input.stockQuantity,
    available: input.available,
    ...(input.attributes && { attributes: input.attributes }),
    updatedAt: new Date(),
})
```

**Step 5: Build check**

```bash
pnpm --filter @vamy/admin build 2>&1 | tail -15
```

**Step 6: Commit**

```bash
git add apps/admin/app/\(dashboard\)/artworks/page.tsx packages/db/src/trpc/routers/products.ts
git commit -m "feat: add featured toggle and medium/dimensions to admin artworks page"
```

---

### Task 5: Website — gallery cards with price + availability

**Files:**
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`
- Modify: `apps/website/src/components/layouts/PostFeedLayout/index.tsx` (to pass product data)

**Context:** The gallery page renders PostFeedLayout → PostFeedSection → PostFeedItem for each artwork. Currently PostFeedItem only shows title, excerpt, and thumbnail. We need to add price, medium, dimensions, and availability — fetched from the DB via tRPC.

The challenge: PostFeedLayout uses `getStaticProps` (static generation). Product data is dynamic (DB). Two approaches:

**Approach A (recommended):** Make PostFeedItem a hybrid — render the static content server-side, then fetch product data client-side via tRPC in a child component. This avoids changing the static generation pipeline.

**Step 1: Create an ArtworkCardInfo client component**

Create `apps/website/src/components/blocks/ArtworkCardInfo/index.tsx`:

```tsx
"use client";

import { trpc } from "../../../lib/trpc";

export function ArtworkCardInfo({ slug }: { slug: string }) {
    const { data: products } = trpc.products.listByArtworkSlug.useQuery(
        { slug },
        { staleTime: 60_000 }
    );

    if (!products || products.length === 0) return null;

    // Find the first available variant with a price (for the "from" price)
    const allVariants = products.flatMap((p) => p.variants ?? []);
    const cheapest = allVariants
        .filter((v) => v.available && v.price)
        .sort((a, b) => Number(a.price) - Number(b.price))[0];

    // Determine availability from artwork status or variant availability
    const hasAvailable = allVariants.some((v) => v.available);
    const product = products[0];
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium || product.artwork?.medium || "";
    const dimensions = attrs.dimensions || product.artwork?.dimensions || "";

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
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    hasAvailable ? "bg-green-500" : "bg-gray-400"
                }`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}
```

**Step 2: Import and render ArtworkCardInfo in PostFeedItem**

In `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`, add at the top:

```tsx
import dynamic from 'next/dynamic';

const ArtworkCardInfo = dynamic(
    () => import('../../../blocks/ArtworkCardInfo').then((m) => ({ default: m.ArtworkCardInfo })),
    { ssr: false }
);
```

Then, inside the card content `<div>` (after the title `<TitleTag>` and before the excerpt), extract the slug from the post URL and render the component:

```tsx
{(() => {
    const slug = (post.__metadata?.urlPath ?? '').split('/').filter(Boolean).pop();
    return slug ? <ArtworkCardInfo slug={slug} /> : null;
})()}
```

**Step 3: Remove the excerpt** (optional but recommended)

The card now shows medium + dimensions + price + availability. The old excerpt is redundant. Consider removing or keeping it — the design doc didn't explicitly remove it, but the Saatchi card design doesn't have descriptions. Keep the excerpt for now but it can be toggled off in the gallery config (`showExcerpt: false` in `content/pages/gallery/index.md`).

**Step 4: Build check**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
```

**Step 5: Commit**

```bash
git add apps/website/src/components/blocks/ArtworkCardInfo/index.tsx apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx
git commit -m "feat: gallery cards show price, availability, medium from DB"
```

---

### Task 6: Website — homepage hero from featured artwork

**Files:**
- Modify: `apps/website/content/pages/index.md` (update hero image reference)
- Create: `apps/website/src/components/blocks/FeaturedHero/index.tsx`

**Context:** The homepage hero currently shows a static image from `index.md`. We want the hero image to come from the DB-featured product's artwork.

**Step 1: Create FeaturedHero client component**

Create `apps/website/src/components/blocks/FeaturedHero/index.tsx`:

```tsx
"use client";

import { trpc } from "../../../lib/trpc";

export function FeaturedHero({ fallbackImage }: { fallbackImage: string }) {
    const { data: product } = trpc.products.getFeatured.useQuery(undefined, {
        staleTime: 60_000,
    });

    // Use the artwork's featured image from the markdown content
    // The featured product has artwork.slug — map to /images/{slug}.jpg
    // Fallback: if no featured product or image, use the placeholder
    const artwork = product?.artwork;
    const imageUrl = artwork
        ? `/images/${artwork.slug}.jpg`
        : fallbackImage;
    const altText = artwork
        ? `${artwork.title} by Maeve Vamy`
        : "A painting by Maeve Vamy";

    return (
        <img
            src={imageUrl}
            alt={altText}
            className="w-full h-full object-cover"
            loading="eager"
        />
    );
}
```

**Step 2: Integrate into the homepage**

The hero image is rendered by `ImageBlock` based on `index.md` content. The simplest integration: replace the static image URL in `index.md` with a placeholder, and dynamically swap it via FeaturedHero.

In `apps/website/src/components/blocks/ImageBlock/index.tsx`, read the current file. If the image URL matches the placeholder pattern, render FeaturedHero instead. However, this couples ImageBlock to a specific use case.

**Better approach:** Modify the homepage section that renders the hero. Read `apps/website/src/components/sections/GenericSection/index.tsx` to understand how it renders the media block, then decide the best integration point.

The simplest approach: keep the static placeholder in `index.md` as the fallback, and layer the FeaturedHero over it with absolute positioning in the GenericSection hero. But this requires understanding the GenericSection layout.

**Alternative (simpler):** Create a custom homepage component at `apps/website/src/pages/index.tsx` that overrides the catch-all route, renders the hero with FeaturedHero, and keeps the rest of the page content. However, this is a bigger change.

**Recommended approach:** Add the FeaturedHero as a dynamically-imported component inside PostLayout or GenericSection, rendered only on the homepage. OR: just update the static image in `index.md` to a real artwork image for now, and make FeaturedHero a client component that replaces the `<img>` in the hero after hydration.

**For the implementer:** Read `apps/website/src/components/sections/GenericSection/index.tsx` and `apps/website/src/components/blocks/ImageBlock/index.tsx` to find the exact integration point. The goal: the hero image on the homepage should come from the DB's featured product. If the featured product's artwork slug is "whispers", the image should be `/images/whispers.jpg`. Use `dynamic(() => import(...), { ssr: false })` for the FeaturedHero component.

**Step 3: Build check + commit**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
git add apps/website/src/components/blocks/FeaturedHero/
git commit -m "feat: homepage hero shows featured artwork from DB"
```

---

### Task 7: Website — artwork detail page two-column layout

**Files:**
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

**Context:** Replace the single-column markdown flow with a two-column layout: large image left, structured details + commerce widgets right.

**Step 1: Read the current PostLayout**

Already provided above. The current structure is:
1. `<header>` with title, date, author (centered)
2. `<Markdown>` block with content
3. Commerce widgets (BidWidget + ProductSelector)
4. Bottom sections

**Step 2: Create ArtworkDetails client component**

Create `apps/website/src/components/blocks/ArtworkDetails/index.tsx`:

```tsx
"use client";

import { trpc } from "../../../lib/trpc";

export function ArtworkDetails({ slug }: { slug: string }) {
    const { data: product } = trpc.products.getByArtworkSlug.useQuery(
        { slug },
        { staleTime: 60_000 }
    );

    if (!product) return null;

    const artwork = product.artwork;
    const variant = product.variants?.[0];
    const attrs = (variant?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium || artwork?.medium || "";
    const dimensions = attrs.dimensions || artwork?.dimensions || "";
    const hasAvailable = product.variants?.some((v) => v.available) ?? false;
    const cheapest = product.variants
        ?.filter((v) => v.available && v.price)
        .sort((a, b) => Number(a.price) - Number(b.price))[0];

    return (
        <div className="space-y-4">
            {medium && (
                <p className="text-sm text-gray-500">
                    {medium}{dimensions ? ` · ${dimensions}` : ""}
                </p>
            )}
            {cheapest ? (
                <p className="text-2xl font-light">€{Number(cheapest.price).toLocaleString()}</p>
            ) : (
                <p className="text-sm text-gray-400 italic">Price on request</p>
            )}
            <p className="text-sm flex items-center gap-2">
                <span className={`inline-block w-2 h-2 rounded-full ${
                    hasAvailable ? "bg-green-500" : "bg-gray-400"
                }`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}
```

**Step 3: Redesign PostLayout to two-column**

Replace the current single-column `<article>` with a two-column grid:

```tsx
<article className="px-4 py-16 sm:py-28">
    <div className="mx-auto max-w-screen-2xl">
        <div className="lg:grid lg:grid-cols-2 lg:gap-12 items-start">
            {/* Left: artwork image */}
            <div className="mb-8 lg:mb-0 lg:sticky lg:top-8">
                {page.featuredImage?.url && (
                    <img
                        src={page.featuredImage.url}
                        alt={page.featuredImage.altText || title}
                        className="w-full h-auto"
                    />
                )}
            </div>

            {/* Right: details + commerce */}
            <div className="space-y-8">
                <div>
                    <h1 className="text-3xl font-light mb-4"
                        {...(enableAnnotations && { 'data-sb-field-path': 'title' })}
                    >
                        {title}
                    </h1>

                    {artworkSlug && <ArtworkDetails slug={artworkSlug} />}
                </div>

                {/* Inquire CTA */}
                {artworkSlug && (
                    <a
                        href={`/get-a-piece?piece=${artworkSlug}`}
                        className="inline-block bg-black text-white px-8 py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors"
                    >
                        Inquire
                    </a>
                )}

                {/* Description from markdown */}
                {markdown_content && (
                    <div>
                        <Markdown
                            options={{ forceBlock: true }}
                            className="sb-markdown text-gray-600 text-sm leading-relaxed"
                            {...(enableAnnotations && { 'data-sb-field-path': 'markdown_content' })}
                        >
                            {markdown_content}
                        </Markdown>
                    </div>
                )}

                {/* Commerce widgets */}
                {artworkSlug && (
                    <div className="space-y-4">
                        <BidWidget artworkSlug={artworkSlug} />
                        <ProductSelector artworkSlug={artworkSlug} />
                    </div>
                )}
            </div>
        </div>
    </div>
</article>
```

Import ArtworkDetails at the top:
```tsx
const ArtworkDetails = dynamic(
    () => import('../../blocks/ArtworkDetails').then((m) => ({ default: m.ArtworkDetails })),
    { ssr: false }
);
```

Remove the old `<header>` (centered title + date + author) and the old `<Markdown>` block — they're replaced by the two-column layout.

**Step 4: Clean up markdown content**

The artwork markdown files (e.g. `whispers.md`) start with `![](/images/whispers.jpg)` (the image) and then bold metadata (Piece ID, Medium, Dimensions). Since the image now renders from `featuredImage.url` in the left column, and metadata comes from DB, the markdown content should only contain the **description text**. Update each artwork markdown file to remove the image embed and metadata lines, leaving only the description paragraph.

Files to update:
- `apps/website/content/pages/gallery/whispers.md`
- `apps/website/content/pages/gallery/first-contact.md`
- `apps/website/content/pages/gallery/on-the-horizon.md`

For each file, remove these lines from the markdown body:
```markdown
![](/images/{artwork}.jpg)

**Piece ID: #...**
**Medium:** ...
**Dimensions:** ...
```

Keep only the description text.

**Step 5: Build check + commit**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
git add apps/website/src/components/layouts/PostLayout/index.tsx apps/website/src/components/blocks/ArtworkDetails/ apps/website/content/pages/gallery/
git commit -m "feat: two-column artwork detail layout with DB-driven metadata"
```

---

### Task 8: Website — get-a-piece DB-driven

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx`

**Step 1: Read the current file**

The file has a hardcoded `ARTWORK_MAP` with 3 entries. The `?piece=` param currently uses piece ID hashes like `#seascape-w2025`.

**Step 2: Replace ARTWORK_MAP with tRPC query**

Remove the entire `ARTWORK_MAP` constant. Replace the artwork lookup with a tRPC query:

```tsx
const pieceSlug = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search).get('piece') ?? ''
    : (router.query.piece as string) ?? '';

const { data: product } = trpc.products.getByArtworkSlug.useQuery(
    { slug: pieceSlug },
    { enabled: !!pieceSlug, staleTime: 60_000 }
);

const artwork = product?.artwork ?? null;
const variant = product?.variants?.[0] ?? null;
const attrs = (variant?.attributes ?? {}) as Record<string, string>;
```

**Step 3: Update the left panel**

Replace the hardcoded artwork rendering with DB data:

```tsx
{artwork ? (
    <div className="mb-10">
        <img
            src={`/images/${artwork.slug}.jpg`}
            alt={artwork.title}
            className="w-full aspect-[3/4] object-cover mb-6"
        />
        <h2 className="text-xl font-light mb-1">{artwork.title}</h2>
        <p className="text-sm text-gray-500">{attrs.medium || artwork.medium}</p>
        <p className="text-sm text-gray-500">{attrs.dimensions || artwork.dimensions}</p>
        {variant?.price && (
            <p className="text-lg font-light mt-2">€{Number(variant.price).toLocaleString()}</p>
        )}
    </div>
) : (
    /* existing generic "Interested in owning a piece?" fallback */
)}
```

**Step 4: Update the piece field pre-fill**

The piece input should use the artwork title (from DB) instead of the hash ID:

```tsx
const [piece, setPiece] = React.useState('');

React.useEffect(() => {
    if (artwork?.title && !piece) setPiece(artwork.title);
}, [artwork?.title]);
```

**Step 5: Update gallery card and artwork detail page links**

In the artwork markdown files (`whispers.md`, etc.), update the "INQUIRE ABOUT THE ORIGINAL" button URL in `bottomSections`:

```yaml
url: '/get-a-piece?piece=whispers'
```

(Replace the old `%23seascape-w2025` hash with the artwork slug.)

Do this for all 3 artwork files.

**Step 6: Build check + commit**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
git add apps/website/src/pages/get-a-piece.tsx apps/website/content/pages/gallery/
git commit -m "feat: get-a-piece page pulls artwork data from DB"
```

---

### Task 9: Website — footer redesign

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx`
- Modify: `apps/website/content/data/footer.json`

**Step 1: Update footer.json**

Change the copyright text to include the year:

```json
"copyrightText": "© 2026 Vamy"
```

(Instagram URL was already fixed in Task 1.)

**Step 2: Redesign the Footer component**

Read `apps/website/src/components/sections/Footer/index.tsx` in full first.

Restructure the grid layout. The new layout has two rows:

**Row 1 (main footer area):**
```
[Logo + "Maeve Vamy"]  |  [Newsletter heading + subtitle + input + social icons]
```

**Row 2 (bottom bar):**
```
© 2026 Vamy  |  Terms · Privacy  |  Legal entity line
```

Key changes:
- Logo section: far left, logo image + "Maeve Vamy" text stacked
- Newsletter section: right of logo, heading "Stay in the loop", subtitle, email input + subscribe button
- Social icons: rendered below the newsletter input, not in a separate column
- Copyright uses `new Date().getFullYear()` for dynamic year
- Bottom bar: horizontal flex with copyright, legal links, and legal notice

The exact CSS grid depends on the current footer structure — the implementer should read the current file and adapt. The target is a clean two-column top row (logo | newsletter+social) and a single-row bottom bar.

**Step 3: Build check + commit**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
git add apps/website/src/components/sections/Footer/index.tsx apps/website/content/data/footer.json
git commit -m "feat: redesign footer — logo left, newsletter grouped, dynamic copyright year"
```

---

### Task 10: Website — About page

**Files:**
- Create: `apps/website/src/pages/about.tsx`
- Create: `apps/website/public/images/about-placeholder.jpg` (copy an existing image as placeholder)
- Modify: `apps/website/content/data/header.json`

**Step 1: Add "About" to header navigation**

In `apps/website/content/data/header.json`, add to the `primaryLinks` array, before the Gallery link:

```json
{
    "label": "ABOUT",
    "altText": "About",
    "url": "/about",
    "icon": "arrowRight",
    "iconPosition": "right",
    "style": "secondary",
    "type": "Link"
}
```

**Step 2: Create a placeholder hero image**

```bash
cp apps/website/public/images/whispers.jpg apps/website/public/images/about-placeholder.jpg
```

(Maeve will replace this with a real studio photo.)

**Step 3: Create the About page**

Create `apps/website/src/pages/about.tsx`:

```tsx
import * as React from 'react';
import Head from 'next/head';
import Header from '../components/sections/Header';
import Footer from '../components/sections/Footer';
import { allContent } from '../utils/local-content';

export default function AboutPage({ site }: { site: any }) {
    return (
        <>
            <Head>
                <title>About — Maeve Vamy</title>
                <meta name="description" content="Maeve Vamy is a Bulgarian-based oil painter exploring the boundary between realism and abstraction." />
            </Head>

            <div className="sb-page">
                <div className="sb-base sb-default-base-layout">
                    {site?.header && <Header {...site.header} />}

                    <main className="bg-white">
                        {/* Hero image */}
                        <div className="w-full max-h-[60vh] overflow-hidden">
                            <img
                                src="/images/about-placeholder.jpg"
                                alt="Maeve Vamy in her studio"
                                className="w-full h-full object-cover"
                            />
                        </div>

                        <div className="mx-auto max-w-3xl px-4 py-16 sm:py-24 space-y-12">
                            {/* Bio */}
                            <section className="space-y-6">
                                <h1 className="text-3xl font-light">Maeve Vamy</h1>
                                <p className="text-gray-600 leading-relaxed">
                                    Maeve Vamy is a Bulgarian-based oil painter whose work explores the
                                    boundary between observation and abstraction. Working primarily in oil
                                    on canvas, her paintings capture coastal atmospheres, light phenomena,
                                    and the tension between stillness and motion.
                                </p>
                                <p className="text-gray-600 leading-relaxed">
                                    Her practice is rooted in direct observation — long hours spent watching
                                    how light moves across water, how weather reshapes a horizon, how colour
                                    shifts between dawn and dusk. These observations become the raw material
                                    for paintings that sit between realism and something more felt than seen.
                                </p>
                                <p className="text-gray-600 leading-relaxed">
                                    Maeve works from her studio in Stara Zagora, Bulgaria. Her paintings are
                                    held in private collections across Europe.
                                </p>
                            </section>

                            {/* Artist statement */}
                            <section className="border-l-2 border-gray-200 pl-6">
                                <p className="text-gray-500 italic leading-relaxed">
                                    "I paint because looking isn't enough. A photograph captures a moment —
                                    a painting captures what that moment felt like. The mess, the slowness,
                                    the refusal to be rushed — that's the point. Every brushstroke is a
                                    decision to stay with something longer than the world usually allows."
                                </p>
                                <p className="text-sm text-gray-400 mt-4">— Maeve Vamy</p>
                            </section>
                        </div>
                    </main>

                    {site?.footer && <Footer {...site.footer} />}
                </div>
            </div>
        </>
    );
}

export async function getStaticProps() {
    const { allContent } = await import('../utils/local-content');
    const data = allContent();
    return { props: { site: data.props.site } };
}
```

**Step 4: Build check + commit**

```bash
pnpm --filter @vamy/website build 2>&1 | tail -15
git add apps/website/src/pages/about.tsx apps/website/public/images/about-placeholder.jpg apps/website/content/data/header.json
git commit -m "feat: add About page with bio and artist statement"
```

---

### Task 11: Final build verification

**Step 1: Build both apps**

```bash
pnpm turbo build 2>&1 | tail -30
```

Expected: both `@vamy/website` and `@vamy/admin` compile with zero TypeScript errors.

**Step 2: Verify routes**

Website routes should include:
- `/` (homepage with featured hero)
- `/gallery` (cards with price + availability)
- `/gallery/whispers` (two-column detail layout)
- `/get-a-piece` (DB-driven artwork data)
- `/about` (new page)

Admin routes should include:
- `/artworks` (with featured toggle + medium/dimensions)

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: build fixes for website polish"
```
