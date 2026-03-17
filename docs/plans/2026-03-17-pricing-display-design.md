# Pricing Display Design

**Goal:** Surface pricing data on gallery cards ("Prints from €75 · Original €2,500") and add a loading skeleton on detail pages until the ProductSelector hydrates.

**Spec:** This document.

---

## Change 1: Data layer

### `getStaticProps` — gallery index and detail

Switch from `products.getByArtworkSlug` (returns first active product) to `products.listByArtworkSlug` (returns all products for an artwork). Inject as `artworkProducts` (array) instead of `artworkProduct` (single object).

- Gallery index: `post.artworkProducts = toJson(products)`
- Gallery detail: `page.artworkProducts = toJson(products)`
- Keep the existing `artworkProduct` key populated (first product) for backwards compatibility with `ProductSelector` and `BidWidget` until they're migrated. OR migrate them in the same change if trivial.

### `deriveArtworkDisplayData()` in `apps/website/src/utils/artwork-product.ts`

Update signature to accept an array of products:

```typescript
export function deriveArtworkDisplayData(products: any[]): {
  medium: string;
  dimensions: string;
  hasAvailable: boolean;
  printPriceFrom: number | null;
  originalPrice: number | null;
}
```

Logic:
1. Flatten all variants across all products.
2. Partition variants by parent product's `productType`: "print" vs "original".
3. For each group, find the cheapest available variant's price.
4. `hasAvailable` = any variant across all products is available.
5. `medium` and `dimensions` from the first variant's attributes (unchanged).

Backwards compatibility: the old single-product call sites should still work. Accept both a single product and an array — if a single object is passed, wrap it in an array internally.

---

## Change 2: Gallery card display

### `ArtworkCardInfoStatic` in `PostFeedItem/index.tsx`

Update to use the new `deriveArtworkDisplayData` with `post.artworkProducts`.

Display format:

| Scenario | Rendered text |
|---|---|
| Prints + original available | `Prints from €75 · Original €2,500` |
| Only prints | `From €75` |
| Only original | `Original €2,500` |
| Nothing available | `Price on request` |

Below the price line, show availability:
- Green dot + "Available" if `hasAvailable`
- Gray dot + "Sold" otherwise

Remove medium/dimensions from cards — that detail belongs on the detail page only.

---

## Change 3: Detail page loading skeleton

### `PostLayout/index.tsx`

Remove the `ArtworkDetailsStatic` component entirely. The static pricing block is redundant once the `ProductSelector` loads with full variant details.

### `ProductSelector` dynamic import

Add a `loading` component to the `dynamic()` import:

```typescript
const ProductSelector = dynamic(() => import('../../blocks/ProductSelector'), {
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
});
```

This shows pulsing placeholder bars that match the approximate shape of the variant picker until it hydrates.

---

## Files touched

- `apps/website/src/pages/[[...slug]].js` — data injection changes
- `apps/website/src/utils/artwork-product.ts` — `deriveArtworkDisplayData` update
- `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` — card pricing format
- `apps/website/src/components/layouts/PostLayout/index.tsx` — remove `ArtworkDetailsStatic`, add skeleton to `ProductSelector` import

## Out of scope

- Homepage hero pricing (confirmed: no pricing on homepage)
- Netlify `DATABASE_URL` build env issue (separate task)
- Setting a featured product (admin task)
