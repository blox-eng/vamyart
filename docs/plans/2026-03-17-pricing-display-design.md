# Pricing Display Design

**Goal:** Surface pricing data on gallery cards ("Prints from €75 · Original €2,500") and add a loading skeleton on detail pages until the ProductSelector hydrates.

**Spec:** This document.

---

## Change 1: Data layer

### `getStaticProps` — gallery index and detail

Switch from `products.getByArtworkSlug` (returns first active product) to `products.listByArtworkSlug` (returns all products for an artwork). Inject as `artworkProducts` (array) instead of `artworkProduct` (single object).

- Gallery index: `post.artworkProducts = toJson(products)`
- Gallery detail: `page.artworkProducts = toJson(products)`

**No backwards compatibility concern:** `ProductSelector` and `BidWidget` do not read from SSR props — they fetch their own data client-side via tRPC hooks. The only consumers of `artworkProduct` are `ArtworkCardInfoStatic` and `ArtworkDetailsStatic`, both of which are being rewritten/removed in this change.

**Note on `listByArtworkSlug`:** This procedure pre-filters to `available: true` variants only. This is intentional for pricing display — we only want to show prices for purchasable variants. `hasAvailable` will be derived from whether any variants are returned at all.

**Image lookup:** The gallery index currently uses `product.artworkId` from `getByArtworkSlug` to fetch artwork images. After the switch, derive `artworkId` from the first product in the `listByArtworkSlug` result instead.

### `deriveArtworkDisplayData()` in `apps/website/src/utils/artwork-product.ts`

Update the `ArtworkDisplayData` interface and function signature to accept an array of products:

```typescript
export interface ArtworkDisplayData {
  medium: string;
  dimensions: string;
  hasAvailable: boolean;
  printPriceFrom: number | null;
  originalPrice: number | null;
}

export function deriveArtworkDisplayData(products: any[]): ArtworkDisplayData
```

The old `cheapestPrice` field is removed — replaced by `printPriceFrom` and `originalPrice`.

Logic:
1. If input is empty array, return all nulls / empty strings / `hasAvailable: false`.
2. For each product, tag its variants with the parent's `productType`.
3. Partition: `productType === "original"` → original group, everything else → print group.
4. For each group, find the cheapest variant's price (all returned variants are available since `listByArtworkSlug` pre-filters).
5. `hasAvailable` = at least one variant exists in the result.
6. `medium` and `dimensions` from the first variant's `attributes` across all products. This favours whichever product appears first — acceptable since attributes are artwork-level metadata.

---

## Change 2: Gallery card display

### `ArtworkCardInfoStatic` in `PostFeedItem/index.tsx`

Update to use `deriveArtworkDisplayData(post.artworkProducts)`.

Display format:

| Scenario | Rendered text |
|---|---|
| Prints + original available | `Prints from €75 · Original €2,500` |
| Only prints | `From €75` |
| Only original | `Original €2,500` |
| No products / no variants | `Price on request` |

Below the price line, show availability:
- Green dot + "Available" if `hasAvailable`
- Gray dot + "Sold" otherwise

Remove medium/dimensions from cards — that detail belongs on the detail page only.

Guard: if `post.artworkProducts` is falsy or empty array, show "Price on request" + "Sold".

---

## Change 3: Detail page loading skeleton

### `PostLayout/index.tsx`

Remove the `ArtworkDetailsStatic` component entirely. The static pricing block is redundant — the `ProductSelector` shows full variant details once hydrated.

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

The skeleton is intentionally approximate — it won't match the exact number of variants, but prevents a blank gap and provides visual feedback that content is loading.

---

## Files touched

- `apps/website/src/pages/[[...slug]].js` — data injection changes
- `apps/website/src/utils/artwork-product.ts` — `ArtworkDisplayData` interface + `deriveArtworkDisplayData` update
- `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` — card pricing format
- `apps/website/src/components/layouts/PostLayout/index.tsx` — remove `ArtworkDetailsStatic`, add skeleton to `ProductSelector` import

## Out of scope

- Homepage hero pricing (confirmed: no pricing on homepage)
- Netlify `DATABASE_URL` build env issue (separate task)
- Setting a featured product (admin task)
