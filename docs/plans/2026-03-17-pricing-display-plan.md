# Pricing Display Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface "Prints from €75 · Original €2,500" on gallery cards and show a loading skeleton on detail pages until the ProductSelector hydrates.

**Architecture:** Update `deriveArtworkDisplayData` to accept multiple products and return per-type pricing. Switch `getStaticProps` from single-product to multi-product injection. Remove static pricing from detail page, add skeleton to dynamic import.

**Tech Stack:** Next.js 15 Pages Router, tRPC, TypeScript, Tailwind CSS

**Spec:** `docs/plans/2026-03-17-pricing-display-design.md`

---

## Chunk 1: Data layer + Gallery cards

### Task 1: Update `deriveArtworkDisplayData`

**Files:**
- Modify: `apps/website/src/utils/artwork-product.ts`

- [ ] **Step 1: Rewrite the interface and function**

Replace the entire file with:

```typescript
export interface ArtworkDisplayData {
    medium: string;
    dimensions: string;
    hasAvailable: boolean;
    printPriceFrom: number | null;
    originalPrice: number | null;
}

export function deriveArtworkDisplayData(products: any[]): ArtworkDisplayData {
    if (!products || products.length === 0) {
        return { medium: "", dimensions: "", hasAvailable: false, printPriceFrom: null, originalPrice: null };
    }

    // Tag each variant with its parent product's type, then flatten
    const tagged = products.flatMap((p: any) =>
        ((p.variants ?? []) as any[]).map((v: any) => ({ ...v, productType: p.productType }))
    );

    const prints = tagged.filter((v) => v.productType !== "original");
    const originals = tagged.filter((v) => v.productType === "original");

    const cheapest = (variants: any[]) => {
        const withPrice = variants.filter((v) => v.price);
        if (withPrice.length === 0) return null;
        return Math.min(...withPrice.map((v) => Number(v.price)));
    };

    const attrs = (tagged[0]?.attributes ?? {}) as Record<string, string>;

    return {
        medium: attrs.medium ?? "",
        dimensions: attrs.dimensions ?? "",
        hasAvailable: tagged.length > 0,
        printPriceFrom: cheapest(prints),
        originalPrice: cheapest(originals),
    };
}
```

- [ ] **Step 2: Verify the build compiles**

```bash
cd apps/website && pnpm build
```

This will fail because `PostFeedItem` and `PostLayout` still reference `cheapestPrice`. That's expected — we fix those next.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/utils/artwork-product.ts
git commit -m "refactor: deriveArtworkDisplayData accepts product array, returns per-type pricing"
```

### Task 2: Update gallery card component

**Files:**
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`

- [ ] **Step 1: Update `ArtworkCardInfoStatic` and its call site**

Replace the `ArtworkCardInfoStatic` function (lines 97-120) with:

```tsx
function ArtworkCardInfoStatic({ products }: { products: any[] }) {
    const { printPriceFrom, originalPrice, hasAvailable } = deriveArtworkDisplayData(products);

    const priceParts: string[] = [];
    if (printPriceFrom !== null) {
        priceParts.push(originalPrice !== null ? `Prints from €${printPriceFrom.toLocaleString()}` : `From €${printPriceFrom.toLocaleString()}`);
    }
    if (originalPrice !== null) {
        priceParts.push(`Original €${originalPrice.toLocaleString()}`);
    }

    return (
        <div className="mt-2 space-y-1">
            {priceParts.length > 0 ? (
                <p className="text-sm font-light">{priceParts.join(" · ")}</p>
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

Update the call site (line 83-85) from:

```tsx
{post.artworkProduct && (
    <ArtworkCardInfoStatic product={post.artworkProduct} />
)}
```

To:

```tsx
{post.artworkProducts && post.artworkProducts.length > 0 && (
    <ArtworkCardInfoStatic products={post.artworkProducts} />
)}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx
git commit -m "feat: gallery cards show per-type pricing (prints from / original)"
```

### Task 3: Update `getStaticProps` data injection

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js`

- [ ] **Step 1: Update gallery index injection (lines 99-135)**

Replace the gallery index block with:

```javascript
// Gallery index: attach product data to posts for server-side rendering
if (urlPath === '/gallery' && props.page?.items) {
    try {
        props.page.items = await Promise.all(
            props.page.items.map(async (post) => {
                const postSlug = post.__metadata?.urlPath?.split('/').filter(Boolean).pop();
                if (!postSlug) return post;
                try {
                    const products = await serverTrpc.products.listByArtworkSlug({ slug: postSlug });
                    let updatedPost = { ...post };
                    if (products.length > 0) {
                        updatedPost.artworkProducts = toJson(products);
                        const artworkId = products[0].artworkId;
                        if (artworkId) {
                            const images = await serverTrpc.artworkImages.list({ artworkId });
                            const primary = images.find(img => img.isPrimary);
                            if (primary) {
                                updatedPost.featuredImage = {
                                    ...(post.featuredImage || {}),
                                    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
                                    altText: primary.altText || post.featuredImage?.altText || post.title,
                                };
                            }
                        }
                    }
                    return updatedPost;
                } catch {
                    // Product unavailable for this slug
                }
                return post;
            })
        );
    } catch {
        // Products unavailable at build time — cards render without pricing
    }
}
```

- [ ] **Step 2: Update gallery detail injection (lines 137-135)**

Replace the gallery detail block with:

```javascript
// Gallery detail: /gallery/{slug} — exactly 2 path segments
if (urlPath.startsWith('/gallery/') && urlPath.split('/').filter(Boolean).length === 2) {
    const artworkSlug = urlPath.split('/').filter(Boolean).pop();
    try {
        const products = await serverTrpc.products.listByArtworkSlug({ slug: artworkSlug });
        if (products.length > 0) {
            props.page.artworkProducts = toJson(products);
            const artworkId = products[0].artworkId;
            if (artworkId) {
                const images = await serverTrpc.artworkImages.list({ artworkId });
                const primary = images.find(img => img.isPrimary);
                if (primary) {
                    props.page.featuredImage = {
                        ...(props.page.featuredImage || {}),
                        url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${primary.storagePath}`,
                        altText: primary.altText || props.page.featuredImage?.altText || props.page.title,
                    };
                }
            }
        }
    } catch {
        // Product unavailable at build time — detail renders without pricing
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/\[\[...slug\]\].js
git commit -m "feat: inject all products per artwork in getStaticProps for pricing display"
```

---

## Chunk 2: Detail page skeleton + Build verification

### Task 4: Remove static pricing and add loading skeleton to detail page

**Files:**
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

- [ ] **Step 1: Add loading skeleton to ProductSelector import**

Replace the `ProductSelector` dynamic import (lines 11-14):

```typescript
const ProductSelector = dynamic(
    () => import('../../blocks/ProductSelector').then((m) => ({ default: m.ProductSelector })),
    { ssr: false }
);
```

With:

```typescript
const ProductSelector = dynamic(
    () => import('../../blocks/ProductSelector').then((m) => ({ default: m.ProductSelector })),
    {
        ssr: false,
        loading: () => (
            <div className="space-y-3 animate-pulse">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-12 w-full bg-gray-100 rounded" />
                <div className="h-12 w-full bg-gray-100 rounded" />
                <div className="h-12 w-full bg-gray-100 rounded" />
                <div className="h-10 w-full bg-gray-200 rounded" />
            </div>
        ),
    }
);
```

- [ ] **Step 2: Remove `ArtworkDetailsStatic` component and its usage**

Delete the entire `ArtworkDetailsStatic` function (lines 20-40).

Remove the usage on line 76:

```tsx
{page.artworkProduct && <ArtworkDetailsStatic product={page.artworkProduct} />}
```

Remove the unused import of `deriveArtworkDisplayData` on line 8.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "feat: replace static pricing with loading skeleton on detail page"
```

### Task 5: Build and verify

- [ ] **Step 1: Full build check**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm turbo build
```

Both `@vamy/website` and `@vamy/admin` should build successfully.

- [ ] **Step 2: Local verification**

```bash
cd apps/website && pnpm dev
```

1. Open `/gallery` — cards should show "Price on request" + "Sold" (no DB locally unless DATABASE_URL is set). With DB: "Prints from €75 · Original €2,500" + green "Available".
2. Open `/gallery/whispers` — no static pricing block, skeleton pulses until ProductSelector loads.
3. Verify no console errors.

- [ ] **Step 3: Commit and push**

```bash
git push origin main
```
