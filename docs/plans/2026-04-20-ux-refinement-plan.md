# UX Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the UX refinement scope from `docs/plans/2026-04-20-ux-refinement-design.md` as a single coherent PR on `feat/ux-polish-2026-04-19`, extending PR #3.

**Architecture:** Vertical slices per concern. Each task modifies 1–3 files and commits independently. TDD is used for pure functions (carrier URL inference, email template rendering). UI polish is verified on the deploy preview, not unit-tested — we'd end up asserting CSS class names, which is brittle and adds no safety.

**Tech Stack:** Next.js 15 (Pages Router for website, App Router for admin API + admin app), React 19, Tailwind CSS 3.4, tRPC v11, Drizzle ORM, Supabase Postgres, Resend, Stripe, pnpm workspaces.

**Baseline:** `pnpm turbo typecheck` has 50 pre-existing TS errors on this branch — do not count these as regressions. `pnpm turbo build --filter=@vamy/website` and `--filter=@vamy/admin` are both green at the start of this plan.

**Pre-flight:** All work happens on the already-checked-out branch `feat/ux-polish-2026-04-19`. Do not create a new branch. After every task, push to `origin` so the Netlify deploy preview at `https://deploy-preview-3--vamy-website.netlify.app` updates.

---

## File Map

**Create:**
- `apps/website/src/components/atoms/LazyImage.tsx` — image wrapper with placeholder/loaded/error states (Task 1)
- `apps/website/public/favicon.ico` — 1×1 transparent PNG-stub fallback for clients that ignore the SVG link (Task 12)
- `packages/db/src/emails/order-receipt.ts` — HTML renderer for the post-purchase receipt (Task 14)
- `packages/db/src/emails/order-tracking.ts` — HTML renderer for the shipment tracking email (Task 16)
- `packages/db/src/emails/carrier-urls.ts` — pure carrier → tracking-URL map + fallback (Task 16)
- `packages/db/src/emails/__tests__/carrier-urls.test.ts` — unit tests for carrier URL map
- `packages/db/src/emails/__tests__/order-receipt.test.ts` — snapshot test for receipt template
- `packages/db/src/emails/__tests__/order-tracking.test.ts` — snapshot test for tracking template
- `packages/db/drizzle/NNNN_add_order_tracking_carrier.sql` — migration adding `tracking_carrier` column (Task 15)

**Modify:**
- `apps/website/src/components/blocks/ProductSelector/index.tsx` — skeleton, "Available pieces", terms checkbox, adaptive Buy label, softer disabled, drop variant sub-label, reassurance copy (Tasks 2, 3)
- `apps/website/src/components/blocks/BidWidget/index.tsx` — loading state (Task 4)
- `apps/website/src/components/layouts/PostLayout/index.tsx` — `<LazyImage>` for featured artwork, inline Inquire CTA below ProductSelector (Tasks 5, 10)
- `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` — `<LazyImage>` for gallery tiles (Task 5)
- `apps/website/src/pages/get-a-piece.tsx` — hydration fix, natural aspect, `<LazyImage>`, reply copy, 8 steps, checkbox parity (Tasks 6, 7)
- `apps/website/src/components/blocks/ReachOutBlock/index.tsx` — reply copy, checkbox parity (Task 7)
- `apps/website/src/components/sections/Footer/index.tsx` — "© 2026 Maeve Vamy" (Task 8)
- `apps/website/src/components/layouts/DefaultBaseLayout/index.tsx` — `min-h-screen flex flex-col` wrapper (Task 8)
- `apps/website/content/pages/terms.md` — widen content column (Task 9)
- `apps/website/content/pages/gallery/whispers.md` — remove orphaned Inquire bottomSection (Task 10)
- `apps/website/content/pages/gallery/first-contact.md` — remove orphaned Inquire bottomSection (Task 10)
- `apps/website/content/pages/gallery/on-the-horizon.md` — remove orphaned Inquire bottomSection (Task 10)
- `apps/website/content/pages/index.md` — Work grid cols + max-width (Task 11)
- `apps/admin/app/(dashboard)/artworks/page.tsx` — loading states for shipping dropdown + images panel (Task 13)
- `apps/admin/app/(dashboard)/auctions/page.tsx` — loading states for artwork/product dropdowns (Task 13)
- `apps/website/app/api/webhooks/stripe/route.ts` — replace placeholder receipt HTML with `renderOrderReceiptHtml()` (Task 14)
- `packages/db/src/schema.ts` — add `trackingCarrier: text("tracking_carrier")` to `orders` table (Task 15)
- `packages/db/src/trpc/routers/orders.ts` — accept carrier + note, call `renderOrderTrackingHtml()` (Task 16)
- `apps/admin/app/(dashboard)/orders/page.tsx` — carrier select + note textarea, "Tracking sent ✓" final state (Task 17)
- Top-level `README.md` — nothing; no docs changes to commit (user rejected committed runbook).

**Delete:**
- None.

---

## Ground Rules for Tasks

1. **Always** run `pnpm turbo typecheck` after touching TS files. Only fail on NEW errors above the 50-error baseline.
2. **Always** run `pnpm turbo build --filter=@vamy/website` (and `--filter=@vamy/admin` for admin tasks) after each task. Both must stay green.
3. **Always** commit at the end of each task with the exact message shown. Do not amend.
4. **Push after every commit** so the deploy preview rebuilds. Commands: `git push origin feat/ux-polish-2026-04-19`.
5. Semgrep hooks may print "No SEMGREP_APP_TOKEN found" — that's cosmetic noise, not a real failure. Ignore.
6. The word "pieces" (not "prints") is the canonical product-umbrella term. "Pieces" in code, "piece" in user-facing copy.

---

## Task 1: `<LazyImage>` atom

**Files:**
- Create: `apps/website/src/components/atoms/LazyImage.tsx`

Shared image wrapper. Renders a `bg-gray-100` placeholder of the same box size until `onLoad` fires, then fades the real image in via `opacity` transition. On `onError`, swaps to `/images/img-placeholder.svg` (our existing fallback) and stops retrying.

- [ ] **Step 1: Create the atom**

File: `apps/website/src/components/atoms/LazyImage.tsx`

```tsx
import * as React from 'react';
import classNames from 'classnames';

const FALLBACK_SRC = '/images/img-placeholder.svg';

type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    onLoad?: () => void;
};

export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', onLoad }: LazyImageProps) {
    const [loaded, setLoaded] = React.useState(false);
    const [errored, setErrored] = React.useState(false);
    const resolvedSrc = errored ? FALLBACK_SRC : src;

    return (
        <div className={classNames('relative bg-gray-100 overflow-hidden', className)}>
            <img
                src={resolvedSrc}
                alt={alt}
                loading={loading}
                onLoad={() => { setLoaded(true); onLoad?.(); }}
                onError={() => { if (!errored) setErrored(true); }}
                className={classNames(
                    'w-full h-full transition-opacity duration-300',
                    loaded ? 'opacity-100' : 'opacity-0',
                    imgClassName,
                )}
            />
        </div>
    );
}
```

- [ ] **Step 2: Verify typecheck + build**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Expected: both green, no new TS errors above baseline of 50.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/atoms/LazyImage.tsx
git commit -m "feat(website): LazyImage atom with placeholder/fade/error fallback"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 2: ProductSelector — skeleton, "Available pieces", drop variant sub-label, adaptive Buy, softer disabled

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

Bundles four surface changes that share the same file and git neighborhood: loading skeleton, "Available pieces" label, adaptive button, removal of the wrong-artwork variant sub-label.

- [ ] **Step 1: Add `isLoading` branch + render skeleton**

In `apps/website/src/components/blocks/ProductSelector/index.tsx`:
- Change line 9 from `const { data: productList } = trpc.products.listByArtworkSlug.useQuery(...)` to destructure `isLoading` too:
  ```tsx
  const { data: productList, isLoading: productsLoading } = trpc.products.listByArtworkSlug.useQuery({ slug: artworkSlug }, { retry: false });
  ```
- Replace the early-return block `if (!productList || productList.length === 0) return null;` (line 12) with:
  ```tsx
  if (productsLoading) {
      return (
          <div className="border border-black p-6 mt-4 space-y-3 animate-pulse" aria-busy="true" aria-label="Loading available pieces">
              <div className="h-3 w-32 bg-gray-200" />
              <div className="h-12 bg-gray-100" />
              <div className="h-12 bg-gray-100" />
              <div className="h-12 bg-gray-100" />
              <div className="h-10 w-full bg-gray-200 mt-3" />
          </div>
      );
  }
  if (!productList || productList.length === 0) return null;
  ```

- [ ] **Step 2: Rename the heading**

Change `ProductSelector/index.tsx:41` from:
```tsx
<h3 className="text-xs uppercase tracking-widest mb-4">Available Prints</h3>
```
to:
```tsx
<h3 className="text-xs uppercase tracking-widest mb-4">Available pieces</h3>
```

- [ ] **Step 3: Drop the variant sub-label**

Remove line 59 entirely (the `<p className="text-xs text-gray-500">{v.productName}</p>`). The variant's own `v.name` is sufficient; the product name is free-form admin text that doesn't stay in sync with the parent artwork.

After removal the inner `<div className="flex items-center gap-3">` block should look like:
```tsx
<div className="flex items-center gap-3">
    <input
        type="radio"
        name="variant"
        value={v.id}
        checked={selectedVariantId === v.id}
        onChange={() => { setSelectedVariantId(v.id); setCheckoutError(null); }}
        className="sr-only"
    />
    <div>
        <p className="text-sm font-medium">{v.name}</p>
    </div>
</div>
```

- [ ] **Step 4: Soften disabled opacity + adaptive Buy label**

Replace the Buy button block (lines 79–85) with:
```tsx
<button
    onClick={handleBuy}
    disabled={!selectedVariantId || isRedirecting}
    className="w-full bg-black text-white py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-60"
>
    {isRedirecting
        ? 'Redirecting to payment…'
        : !selectedVariantId
            ? 'Select a piece to buy'
            : 'Buy'}
</button>
```
(The "Accept terms to continue" branch is added in Task 3 once the terms state exists.)

- [ ] **Step 5: Verify locally**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Expected: green. No new TS errors.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "fix(product-selector): loading skeleton, 'Available pieces', adaptive Buy, drop wrong-artwork sub-label"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 3: ProductSelector — terms checkbox + reassurance copy + full adaptive Buy states

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

- [ ] **Step 1: Add `termsAccepted` state**

Near the top of the component body (around line 5–7, just after the existing `useState` calls), add:
```tsx
const [termsAccepted, setTermsAccepted] = React.useState(false);
```
(Adjust the `useState` import at the top of the file if needed: `import { useState } from 'react';` → `import * as React from 'react';` OR add `useState` to the existing named imports. Follow whichever pattern is already present in the file.)

- [ ] **Step 2: Render the checkbox above the Buy button**

Between the `{checkoutError && ...}` block and the `<button>` element, insert:
```tsx
<label className="flex items-start gap-3 cursor-pointer mt-4 mb-3">
    <input
        type="checkbox"
        checked={termsAccepted}
        onChange={(e) => setTermsAccepted(e.target.checked)}
        className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
    />
    <span className="text-xs text-gray-600">
        I have read and accept the{' '}
        <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:no-underline">Terms</a>
        {' '}and{' '}
        <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:no-underline">Privacy Policy</a>.
    </span>
</label>
```

- [ ] **Step 3: Wire `termsAccepted` into the Buy button**

Update the Buy button's `disabled` and label to account for the new state:
```tsx
<button
    onClick={handleBuy}
    disabled={!selectedVariantId || !termsAccepted || isRedirecting}
    className="w-full bg-black text-white py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-60"
>
    {isRedirecting
        ? 'Redirecting to payment…'
        : !selectedVariantId
            ? 'Select a piece to buy'
            : !termsAccepted
                ? 'Accept terms to continue'
                : 'Buy'}
</button>
```

- [ ] **Step 4: Add reassurance copy below the button**

Directly after the closing `</button>` tag, before the outer closing `</div>`, add:
```tsx
<p className="text-xs text-gray-500 mt-3 text-center">
    Secure checkout via Stripe. Card, Apple Pay, Google Pay.
</p>
```

- [ ] **Step 5: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Expected: green.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "feat(product-selector): require terms checkbox before Buy; Stripe reassurance copy"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 4: BidWidget — distinguish loading from no-auction

**Files:**
- Modify: `apps/website/src/components/blocks/BidWidget/index.tsx`

- [ ] **Step 1: Destructure `isLoading`**

Change line 16 from:
```tsx
const { data: auction, refetch } = trpc.auctions.getByArtworkSlug.useQuery(
    { slug: artworkSlug },
    { refetchInterval: 30_000, retry: false }
);
```
to:
```tsx
const { data: auction, isLoading: auctionLoading, refetch } = trpc.auctions.getByArtworkSlug.useQuery(
    { slug: artworkSlug },
    { refetchInterval: 30_000, retry: false }
);
```

- [ ] **Step 2: Render a muted card while loading**

Replace line 35 (`if (!auction || auction.status !== 'active') return null;`) with:
```tsx
if (auctionLoading) {
    return (
        <div className="border border-gray-200 p-6 mt-8 animate-pulse" aria-busy="true" aria-label="Checking auction status">
            <div className="h-3 w-32 bg-gray-100 mb-3" />
            <div className="h-8 w-40 bg-gray-200 mb-4" />
            <div className="h-10 w-full bg-gray-100" />
        </div>
    );
}
if (!auction || auction.status !== 'active') return null;
```

- [ ] **Step 3: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/blocks/BidWidget/index.tsx
git commit -m "fix(bid-widget): show muted loading card instead of null while checking auction"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 5: Adopt `<LazyImage>` across gallery tiles + PostLayout featured

**Files:**
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

- [ ] **Step 1: Gallery tile image via LazyImage**

Open `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` and locate the `<img>` tag that renders the tile's featuredImage.

Replace that `<img>` with:
```tsx
<LazyImage
    src={featuredImage.url}
    alt={featuredImage.altText || title}
    className="w-full aspect-[3/4]"
    imgClassName="object-cover"
/>
```
Add the import at the top of the file:
```tsx
import LazyImage from '../../../atoms/LazyImage';
```
(If the existing featuredImage rendering uses an aspect ratio or class different from `aspect-[3/4]`, preserve whatever was there — wrap the exact same dimensions onto `<LazyImage>`'s `className`. Read the file first and mirror its existing classes.)

- [ ] **Step 2: PostLayout featured artwork via LazyImage**

In `apps/website/src/components/layouts/PostLayout/index.tsx`, replace lines 52–57 (the current raw `<img>` for `featuredImageUrl`) with:
```tsx
<LazyImage
    src={featuredImageUrl}
    alt={featuredImageAlt}
    className="w-full"
    imgClassName="h-auto"
    loading="eager"
    {...(enableAnnotations && { 'data-sb-field-path': 'featuredImage.url' })}
/>
```
Add the import near the top of the file (after the existing imports, before the `dynamic()` calls):
```tsx
import LazyImage from '../../atoms/LazyImage';
```
Note: `LazyImage` doesn't currently accept `data-sb-field-path`. Update the atom in `apps/website/src/components/atoms/LazyImage.tsx` to accept and spread arbitrary props onto the outer `<div>`. Change `LazyImageProps` signature to:
```tsx
type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    onLoad?: () => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onLoad'>;
```
And destructure `...rest` in the function signature:
```tsx
export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', onLoad, ...rest }: LazyImageProps) {
```
Spread `{...rest}` onto the outer `<div>`.

- [ ] **Step 3: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/atoms/LazyImage.tsx apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "feat(website): adopt LazyImage on gallery tiles and artwork featured image"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 6: `/get-a-piece` — hydration fix + natural aspect + LazyImage + 8 steps + reply copy

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx`

- [ ] **Step 1: Replace STEPS array**

Replace the `STEPS` constant (lines 10–15) with:
```tsx
const STEPS = [
    { n: '01', label: 'Send your inquiry', text: 'Fill in the form — takes under a minute.' },
    { n: '02', label: 'Maeve gets back to you', text: 'Personally, within 2 working days.' },
    { n: '03', label: 'Discuss the details', text: 'Shipping, insurance, payment — all sorted together.' },
    { n: '04', label: 'Secure payment', text: 'Via Stripe link — card, Apple Pay, Google Pay.' },
    { n: '05', label: 'Packed with care', text: 'Museum-grade packaging, fully insured, dispatched within 30 days.' },
    { n: '06', label: 'Tracked shipping', text: 'Maeve will email tracking details once your piece is on its way.' },
    { n: '07', label: 'Certificate included', text: 'Signed certificate of authenticity and provenance documentation.' },
    { n: '08', label: 'Aftercare', text: 'Care instructions included, and Maeve is reachable long after.' },
];
```

- [ ] **Step 2: Fix the hydration mismatch**

Replace lines 19–21 (the `typeof window` branch) with:
```tsx
const pieceSlug = typeof router.query.piece === 'string' ? router.query.piece : '';
```
The `useRouter` hydration model is enough — don't read `window.location.search` separately.

- [ ] **Step 3: Natural aspect preview with LazyImage**

Replace lines 95–106 (the `<img>` in the `artwork` branch) with:
```tsx
) : artwork ? (
    <div className="mb-10">
        <LazyImage
            src={`/images/${artwork.slug}.jpg`}
            alt={artwork.title}
            className="w-full shadow-sm mb-6"
            imgClassName="h-auto"
            loading="eager"
        />
        <h2 className="text-xl font-light mb-1">{artwork.title}</h2>
```
(Keep the `{medium && ...}`, `{dimensions && ...}`, and price lines unchanged.)

Add at the top of the file, after the other imports:
```tsx
import LazyImage from '../components/atoms/LazyImage';
```

- [ ] **Step 4: Reply copy change (both places)**

Replace line 276–278 (the `<p className="text-xs text-gray-400 mt-3">`) with:
```tsx
<p className="text-xs text-gray-400 mt-3">
    I'll reply personally — usually within 2 working days. — Maeve
</p>
```

- [ ] **Step 5: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Then open the deploy preview at `/get-a-piece?piece=whispers`, confirm:
- No React #418 warning in the browser console.
- The Whispers painting renders at natural landscape aspect, no crop.
- The "What happens next" column shows 8 steps.
- Reply copy reads "I'll reply personally — usually within 2 working days. — Maeve".

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(get-a-piece): drop hydration mismatch, natural aspect preview, 8 next-steps, first-person reply copy"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 7: ReachOutBlock — reply copy + Terms/Privacy checkbox wording

**Files:**
- Modify: `apps/website/src/components/blocks/ReachOutBlock/index.tsx`
- Modify: `apps/website/src/pages/get-a-piece.tsx` (checkbox parity)

- [ ] **Step 1: Update ReachOutBlock reply copy**

In `apps/website/src/components/blocks/ReachOutBlock/index.tsx`, replace lines 131–134 (the `<p className="text-xs text-gray-400">`) with:
```tsx
<p className="text-xs text-gray-400">
    I'll reply personally — usually within 2 working days. — Maeve
</p>
```

- [ ] **Step 2: Update ReachOutBlock checkbox wording**

Replace lines 125–128 (the checkbox `<span>`) with:
```tsx
<span className="text-sm text-gray-500">
    I have read and accept the{' '}
    <a href="/terms" className="underline hover:no-underline" target="_blank" rel="noreferrer">Terms</a>
    {' '}and{' '}
    <a href="/privacy" className="underline hover:no-underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
</span>
```

- [ ] **Step 3: Mirror the wording in `/get-a-piece`**

In `apps/website/src/pages/get-a-piece.tsx`, replace lines 249–252 (the checkbox `<span>`) with:
```tsx
<span className="text-sm text-gray-500">
    I have read and accept the{' '}
    <a href="/terms" className="underline hover:no-underline" target="_blank" rel="noreferrer">Terms</a>
    {' '}and{' '}
    <a href="/privacy" className="underline hover:no-underline" target="_blank" rel="noreferrer">Privacy Policy</a>.
</span>
```
Also verify the existing `<a href="/terms">` on that line has `rel="noreferrer"` (it didn't before — add it now if still missing).

- [ ] **Step 4: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/blocks/ReachOutBlock/index.tsx apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(forms): first-person reply copy + Terms/Privacy checkbox parity across all three forms"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 8: Footer — sticky on short pages + copyright fix

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx`
- Modify: `apps/website/src/components/layouts/DefaultBaseLayout/index.tsx`

- [ ] **Step 1: Footer copyright text**

In `apps/website/src/components/sections/Footer/index.tsx`, replace line 77:
```tsx
<p>&copy; {new Date().getFullYear()} Vamy</p>
```
with:
```tsx
<p>&copy; {new Date().getFullYear()} Maeve Vamy</p>
```

- [ ] **Step 2: Sticky-footer layout**

In `apps/website/src/components/layouts/DefaultBaseLayout/index.tsx`, replace the inner `sb-base sb-default-base-layout` div (line 13) so the layout becomes `min-h-screen flex flex-col` and the children are wrapped in a `flex-1 main` region.

New file body:
```tsx
import * as React from 'react';
import classNames from 'classnames';
import Header from '../../sections/Header';
import Footer from '../../sections/Footer';

export default function DefaultBaseLayout(props) {
    const { page, site } = props;
    const { enableAnnotations = true } = site;
    const pageMeta = page?.__metadata || {};

    return (
        <div className={classNames('sb-page', pageMeta.pageCssClasses)} {...(enableAnnotations && { 'data-sb-object-id': pageMeta.id })}>
            <div className="sb-base sb-default-base-layout min-h-screen flex flex-col">
                {site.header && <Header {...site.header} enableAnnotations={enableAnnotations} />}
                <div className="flex-1">{props.children}</div>
                {site.footer && <Footer {...site.footer} enableAnnotations={enableAnnotations} />}
            </div>
        </div>
    );
}
```

- [ ] **Step 3: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Then load the deploy preview at `/privacy` on a 1600×1000 browser window. The footer should be pinned to the bottom of the viewport, not floating mid-page. Tall pages (`/terms`) should still scroll normally with the footer at the end.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx apps/website/src/components/layouts/DefaultBaseLayout/index.tsx
git commit -m "fix(layout): sticky footer on short pages; '© 2026 Maeve Vamy'"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 9: Terms page — comfortable reading column on wide screens

**Files:**
- Modify: `apps/website/content/pages/terms.md`

The content renders via a `GenericSection` inside `PageLayout`. The simplest, lowest-blast-radius fix: add a `maxWidth: prose` style to the existing section's `styles.self` so Tailwind applies `max-w-prose mx-auto` around the content.

- [ ] **Step 1: Inspect current frontmatter**

Read the top of `apps/website/content/pages/terms.md` to see the section's current `styles.self` block. (If the block does not exist yet, create it.)

- [ ] **Step 2: Add max-width style**

Edit the first `GenericSection` entry's `styles.self` to include (merging with what's there):
```yaml
styles:
  self:
    maxWidth: 3xl
    justifyContent: center
    padding:
      - pt-16
      - pl-4
      - pb-16
      - pr-4
```
The `maxWidth: 3xl` maps to Tailwind `max-w-3xl` via `map-styles-to-class-names.js` (which is the existing Stackbit theme's mapper — do not invent a new value). If `3xl` is not in the mapper's allowed list, use `prose` if present, else `2xl` as a fallback. Verify by skimming `apps/website/src/utils/map-styles-to-class-names.js` for the exact allowed tokens and pick the closest one that yields roughly 65–75ch.

- [ ] **Step 3: Verify**

```
pnpm turbo build --filter=@vamy/website
```
Load the deploy preview at `/terms` on 1600×1000 and confirm the body text now occupies a comfortable 60–75ch reading measure, not a narrow sliver.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/pages/terms.md
git commit -m "fix(terms): comfortable reading column on wide screens"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 10: Artwork pages — inline Inquire CTA below ProductSelector, remove orphan

**Files:**
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`
- Modify: `apps/website/content/pages/gallery/whispers.md`
- Modify: `apps/website/content/pages/gallery/first-contact.md`
- Modify: `apps/website/content/pages/gallery/on-the-horizon.md`

- [ ] **Step 1: Move Inquire link under the ProductSelector**

In `apps/website/src/components/layouts/PostLayout/index.tsx`, the existing top-column Inquire link (around lines 90–97, the "Inquire" uppercase link) already sits **above** the commerce widgets. Leave that one in place.

Now add a **second** inline Inquire CTA directly inside the commerce column (lines 110–115), after the `<ProductSelector />`. Change the block:
```tsx
{artworkSlug && (
    <div className="space-y-4">
        <BidWidget artworkSlug={artworkSlug} />
        <ProductSelector artworkSlug={artworkSlug} />
    </div>
)}
```
to:
```tsx
{artworkSlug && (
    <div className="space-y-4">
        <BidWidget artworkSlug={artworkSlug} />
        <ProductSelector artworkSlug={artworkSlug} />
        <div className="pt-2 text-center">
            <Link
                href={`/get-a-piece?piece=${artworkSlug}`}
                className="inline-block text-sm font-medium underline underline-offset-4 hover:text-gray-600"
            >
                Or inquire about this piece
            </Link>
        </div>
    </div>
)}
```
The import for `Link` already exists at the top of the file (line 7). No new imports needed.

- [ ] **Step 2: Remove the orphan `bottomSection` from whispers.md**

Open `apps/website/content/pages/gallery/whispers.md` and locate the `bottomSections:` block (the one containing the "Inquire about this piece" CTA — a `GenericSection` with an Action that links to `/get-a-piece/`). Delete that entire block. If `bottomSections` becomes empty, replace with `bottomSections: []` or remove the key entirely.

- [ ] **Step 3: Same removal on first-contact.md**

Apply the identical deletion in `apps/website/content/pages/gallery/first-contact.md`.

- [ ] **Step 4: Same removal on on-the-horizon.md**

Apply the identical deletion in `apps/website/content/pages/gallery/on-the-horizon.md`.

- [ ] **Step 5: Verify**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
```
Load the deploy preview at `/gallery/whispers`. The bottom "Inquire about this piece" button in the floating whitespace region is gone. Directly beneath the "Available pieces" card there is a small inline "Or inquire about this piece" link. The top "INQUIRE" link under the title is unchanged.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/layouts/PostLayout/index.tsx apps/website/content/pages/gallery/whispers.md apps/website/content/pages/gallery/first-contact.md apps/website/content/pages/gallery/on-the-horizon.md
git commit -m "fix(artwork): inline Inquire CTA below commerce card, remove orphaned bottom section"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 11: Home — "The Work" grid readability on wide screens

**Files:**
- Modify: `apps/website/content/pages/index.md`

- [ ] **Step 1: Read the existing grid section**

Read `apps/website/content/pages/index.md` and locate the `FeaturedItemsSection` (or similarly named) that renders the 4 "Oil / On Canvas / On Observation / On Abstraction / On Quality" cards. Note its current `columns:` or `styles.self.grid*` config — the exact field depends on the theme.

- [ ] **Step 2: Switch to responsive 2→4 grid**

Modify the section so it renders as:
- 1 column on mobile (already the default)
- 2 columns on `lg` (≥1024px)
- 4 columns on `xl` (≥1280px)

The Stackbit theme typically uses a `columns: 4` field. Change it to `columns: 4` at `xl` and add a `stylesAtLg` override with `columns: 2` — OR if the theme only accepts one `columns` value, change to `columns: 2` (accept slightly narrower cards on `xl` as the tradeoff for readable body text).

Also ensure the section's `styles.self.maxWidth` is capped at `6xl` (i.e. 1152px) so cards don't overspread on ultra-wide monitors.

- [ ] **Step 3: Verify on 1600×1000**

```
pnpm turbo build --filter=@vamy/website
```
Load deploy preview `/`. Each card should be at least ~260px wide, body text comfortably readable (not cramped).

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/pages/index.md
git commit -m "fix(home): readable Work grid on wide screens (cap at max-w-6xl, 2-col on lg)"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 12: Favicon 500 — ship a 1×1 stub `/favicon.ico`

**Files:**
- Create: `apps/website/public/favicon.ico`

- [ ] **Step 1: Generate the stub**

Generate a 1×1 transparent PNG-in-ICO container. The simplest reliable way:
```bash
# 1×1 transparent ICO, ~318 bytes
printf '\x00\x00\x01\x00\x01\x00\x01\x01\x00\x00\x01\x00\x20\x00\x30\x00\x00\x00\x16\x00\x00\x00\x28\x00\x00\x00\x01\x00\x00\x00\x02\x00\x00\x00\x01\x00\x20\x00\x00\x00\x00\x00\x04\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00\x00' > apps/website/public/favicon.ico
```
Verify size:
```bash
wc -c apps/website/public/favicon.ico
```
Expected: ~70 bytes. The file exists and browsers reading it get a transparent 1×1 pixel — no more 500.

- [ ] **Step 2: Verify**

Load the deploy preview's `/favicon.ico` directly in a browser (e.g. `https://deploy-preview-3--vamy-website.netlify.app/favicon.ico`). Expected: 200, not 500. The actual favicon in the tab is still the SVG via the existing `<link rel="icon">` tag.

- [ ] **Step 3: Commit**

```bash
git add apps/website/public/favicon.ico
git commit -m "fix(assets): add 1x1 /favicon.ico stub to silence 500 for clients ignoring SVG"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 13: Admin — loading states on secondary queries

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`
- Modify: `apps/admin/app/(dashboard)/auctions/page.tsx`

- [ ] **Step 1: Shipping-method dropdown on artworks page**

In `apps/admin/app/(dashboard)/artworks/page.tsx`, locate line 31:
```tsx
const { data: shippingMethodsList } = trpc.shippingMethods.list.useQuery();
```
Destructure `isLoading`:
```tsx
const { data: shippingMethodsList, isLoading: shippingMethodsLoading } = trpc.shippingMethods.list.useQuery();
```

Then in the JSX where the shipping `<select>` is rendered (around line 474–488), replace the `<option>` list with:
```tsx
<option value="">— use default —</option>
{shippingMethodsLoading && <option disabled>Loading shipping methods…</option>}
{(shippingMethodsList ?? []).map((sm) => (
    <option key={sm.id} value={sm.id}>{sm.name} ({sm.type})</option>
))}
```

- [ ] **Step 2: Image gallery skeleton**

In the same file, in the image gallery section (around lines 321–373), add a loading branch before the `(imagesList.data?.length ?? 0) > 0 &&` condition:
```tsx
{imagesList.isLoading && (
    <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-square bg-gray-100 animate-pulse rounded" />
        ))}
    </div>
)}
{!imagesList.isLoading && (imagesList.data?.length ?? 0) > 0 && (
    <div className="grid grid-cols-4 gap-3">
        {imagesList.data?.map((img) => (
            // ... existing image rendering unchanged
        ))}
    </div>
)}
```
(Preserve every child of the inner `.map()` exactly as it is.)

- [ ] **Step 3: Auctions page dropdowns**

In `apps/admin/app/(dashboard)/auctions/page.tsx`, lines 11–12:
```tsx
const { data: artworkList } = trpc.artworks.list.useQuery();
const { data: productList } = trpc.products.listAll.useQuery();
```
Destructure `isLoading`:
```tsx
const { data: artworkList, isLoading: artworkListLoading } = trpc.artworks.list.useQuery();
const { data: productList, isLoading: productListLoading } = trpc.products.listAll.useQuery();
```
Then in each `<select>` where these lists feed options, prepend a `disabled` option while loading:
```tsx
{artworkListLoading && <option disabled>Loading artworks…</option>}
{/* ... existing options ... */}
```
```tsx
{productListLoading && <option disabled>Loading products…</option>}
{/* ... existing options ... */}
```

- [ ] **Step 4: Verify**

```
pnpm turbo typecheck --filter=@vamy/admin
pnpm turbo build --filter=@vamy/admin
```

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/artworks/page.tsx apps/admin/app/\(dashboard\)/auctions/page.tsx
git commit -m "feat(admin): loading states on secondary queries (shipping, artworks, products, images)"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 14: Upgrade Stripe receipt email to branded template

**Files:**
- Create: `packages/db/src/emails/order-receipt.ts`
- Create: `packages/db/src/emails/__tests__/order-receipt.test.ts`
- Modify: `apps/website/app/api/webhooks/stripe/route.ts`
- Modify: `packages/db/src/index.ts` (re-export)

- [ ] **Step 1: Write the failing snapshot test**

Create `packages/db/src/emails/__tests__/order-receipt.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderOrderReceiptHtml } from "../order-receipt";

describe("renderOrderReceiptHtml", () => {
    const sample = {
        orderNumber: "order_test_42",
        buyerName: "Jane Smith",
        pieceName: "Whispers — Original",
        variantName: "Original — 70 × 100 cm",
        medium: "Oil on canvas",
        totalPaidEur: 2500,
        shippingAddress: {
            line1: "Rue du Louvre 5",
            line2: null,
            city: "Paris",
            postalCode: "75001",
            country: "France",
        },
        termsUrl: "https://vamy.art/terms",
        privacyUrl: "https://vamy.art/privacy",
    };

    it("includes order number, piece name, total, buyer name, and shipping address", () => {
        const html = renderOrderReceiptHtml(sample);
        expect(html).toContain("order_test_42");
        expect(html).toContain("Whispers — Original");
        expect(html).toContain("Original — 70 × 100 cm");
        expect(html).toContain("Jane Smith");
        expect(html).toContain("€2,500");
        expect(html).toContain("Rue du Louvre 5");
        expect(html).toContain("Paris");
        expect(html).toContain("75001");
        expect(html).toContain("— Maeve");
    });

    it("escapes HTML in user-controlled fields", () => {
        const evil = renderOrderReceiptHtml({
            ...sample,
            buyerName: '<script>alert(1)</script>',
            pieceName: 'Whispers & Co',
        });
        expect(evil).not.toContain("<script>alert(1)</script>");
        expect(evil).toContain("&lt;script&gt;");
        expect(evil).toContain("Whispers &amp; Co");
    });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```
pnpm --filter @vamy/db test order-receipt
```
Expected: FAIL — "Cannot find module ../order-receipt".

- [ ] **Step 3: Implement the template**

Create `packages/db/src/emails/order-receipt.ts`:
```ts
import { escapeHtml } from "../utils/escape-html";

export type OrderReceiptData = {
    orderNumber: string;
    buyerName: string;
    pieceName: string;
    variantName: string;
    medium: string | null;
    totalPaidEur: number;
    shippingAddress: {
        line1: string | null;
        line2: string | null;
        city: string | null;
        postalCode: string | null;
        country: string | null;
    };
    termsUrl: string;
    privacyUrl: string;
};

export function renderOrderReceiptHtml(d: OrderReceiptData): string {
    const addressLines = [
        d.shippingAddress.line1,
        d.shippingAddress.line2,
        [d.shippingAddress.city, d.shippingAddress.postalCode].filter(Boolean).join(" "),
        d.shippingAddress.country,
    ].filter(Boolean).map((line) => escapeHtml(String(line))).join("<br/>");

    const total = `€${d.totalPaidEur.toLocaleString("en-IE")}`;

    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Order ${escapeHtml(d.orderNumber)}</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">Thank you, ${escapeHtml(d.buyerName)}.</p>
<p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 28px;">Your piece will ship within 30 days. I'll email you tracking details once it's on its way.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:28px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Variant</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.variantName)}</td></tr>
${d.medium ? `<tr><td style="padding:8px 0;font-size:13px;color:#666;">Medium</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.medium)}</td></tr>` : ""}
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Total paid</td><td style="padding:8px 0;font-size:13px;font-weight:500;">${total}</td></tr>
</table>

<p style="font-size:12px;color:#888;margin:0 0 8px;">Ship to</p>
<p style="font-size:13px;line-height:1.6;margin:0 0 32px;">${addressLines}</p>

<p style="font-size:13px;line-height:1.6;color:#444;margin:0 0 8px;">— Maeve</p>

<p style="font-size:11px;color:#999;margin:28px 0 0;">
<a href="${escapeHtml(d.termsUrl)}" style="color:#999;text-decoration:underline;">Terms</a> ·
<a href="${escapeHtml(d.privacyUrl)}" style="color:#999;text-decoration:underline;">Privacy</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
```

- [ ] **Step 4: Re-export from the package**

In `packages/db/src/index.ts`, add:
```ts
export { renderOrderReceiptHtml, type OrderReceiptData } from "./emails/order-receipt";
```

- [ ] **Step 5: Run the test again**

```
pnpm --filter @vamy/db test order-receipt
```
Expected: PASS, 2/2 tests.

- [ ] **Step 6: Wire the template into the Stripe webhook**

In `apps/website/app/api/webhooks/stripe/route.ts`, replace lines 56–61 (the first `resend.emails.send` call that sends the placeholder receipt):
```ts
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: customer?.email ?? "",
      subject: "Order confirmed",
      html: `<p>Thank you for your order! We'll ship it soon.</p>`,
    });
```
with:
```ts
    try {
      // Fetch the variant + product + artwork so the email can name the piece.
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, variantId),
        with: { product: { with: { artwork: true } } },
      });

      const attrs = (variant?.attributes as Record<string, string> | null) ?? {};
      const receiptHtml = renderOrderReceiptHtml({
        orderNumber: inserted.id,
        buyerName: customer?.name ?? "",
        pieceName: variant?.product?.artwork?.title ?? variant?.product?.name ?? "Your piece",
        variantName: variant?.name ?? "",
        medium: attrs.medium ?? null,
        totalPaidEur: (session.amount_total ?? 0) / 100,
        shippingAddress: {
          line1: address?.line1 ?? null,
          line2: address?.line2 ?? null,
          city: address?.city ?? null,
          postalCode: address?.postal_code ?? null,
          country: address?.country ?? null,
        },
        termsUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art"}/terms`,
        privacyUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art"}/privacy`,
      });

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: customer?.email ?? "",
        replyTo: "maeve@vamy.art",
        subject: `Your piece is on the way — order #${inserted.id.slice(0, 8)}`,
        html: receiptHtml,
      });
    } catch (err) {
      // Don't block the webhook response on email failure — order is already committed.
      console.error("[stripe-webhook] receipt email failed", { orderId: inserted.id, err });
    }
```

Update the import at the top of the file (line 3):
```ts
import { db, orders, productVariants, escapeHtml, renderOrderReceiptHtml } from "@vamy/db";
```

Note: the existing second email ("New order received" → artist) keeps its plain-HTML format unchanged — only the buyer-facing email moves to the branded template.

- [ ] **Step 7: Verify build**

```
pnpm turbo typecheck --filter=@vamy/website
pnpm turbo build --filter=@vamy/website
pnpm turbo typecheck --filter=@vamy/db
```

- [ ] **Step 8: Commit**

```bash
git add packages/db/src/emails/order-receipt.ts packages/db/src/emails/__tests__/order-receipt.test.ts packages/db/src/index.ts apps/website/app/api/webhooks/stripe/route.ts
git commit -m "feat(emails): branded order receipt template; resilient send in stripe webhook"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 15: Add `trackingCarrier` column to `orders`

**Files:**
- Modify: `packages/db/src/schema.ts`
- Create: `packages/db/drizzle/NNNN_add_order_tracking_carrier.sql`

- [ ] **Step 1: Schema change**

In `packages/db/src/schema.ts`, locate the `orders` table (around line 75). Add a new column after `trackingNumber` (line 83):
```ts
  trackingNumber: text("tracking_number"),
  trackingCarrier: text("tracking_carrier"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
```

- [ ] **Step 2: Generate the migration**

```
pnpm --filter @vamy/db drizzle-kit generate
```
This should produce a new `.sql` file under `packages/db/drizzle/` named like `NNNN_add_order_tracking_carrier.sql`. Verify its content matches:
```sql
ALTER TABLE "orders" ADD COLUMN "tracking_carrier" text;
```
If the generator produces anything beyond that one statement, inspect — a drift means the working copy of `schema.ts` has unrelated changes; reset those first.

- [ ] **Step 3: Apply the migration to Supabase**

```
pnpm --filter @vamy/db drizzle-kit migrate
```
Expected: migration reports applied; Supabase's `orders` table now has the `tracking_carrier` column.

Verify directly:
```
pnpm --filter @vamy/db drizzle-kit studio
# or via psql:
# SELECT column_name FROM information_schema.columns WHERE table_name='orders';
```
The column must appear.

- [ ] **Step 4: Verify typecheck**

```
pnpm turbo typecheck --filter=@vamy/db
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add orders.tracking_carrier column"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 16: Upgrade `markShipped` — carrier select + branded tracking email

**Files:**
- Create: `packages/db/src/emails/carrier-urls.ts`
- Create: `packages/db/src/emails/order-tracking.ts`
- Create: `packages/db/src/emails/__tests__/carrier-urls.test.ts`
- Create: `packages/db/src/emails/__tests__/order-tracking.test.ts`
- Modify: `packages/db/src/trpc/routers/orders.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write failing test for carrier-urls**

Create `packages/db/src/emails/__tests__/carrier-urls.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { inferCarrierTrackingUrl } from "../carrier-urls";

describe("inferCarrierTrackingUrl", () => {
    it("returns a DHL URL for DHL carrier", () => {
        expect(inferCarrierTrackingUrl("DHL", "JD000123")).toBe(
            "https://www.dhl.com/en/express/tracking.html?AWB=JD000123"
        );
    });
    it("returns a GLS URL for GLS carrier", () => {
        expect(inferCarrierTrackingUrl("GLS", "ABCDEF")).toBe(
            "https://gls-group.com/track/ABCDEF"
        );
    });
    it("returns a UPS URL for UPS carrier", () => {
        expect(inferCarrierTrackingUrl("UPS", "1Z999")).toBe(
            "https://www.ups.com/track?tracknum=1Z999"
        );
    });
    it("returns an Econt URL for Econt carrier", () => {
        expect(inferCarrierTrackingUrl("Econt", "EC123")).toBe(
            "https://www.econt.com/en/services/track/EC123"
        );
    });
    it("returns null for unknown carrier", () => {
        expect(inferCarrierTrackingUrl("Other", "X")).toBeNull();
        expect(inferCarrierTrackingUrl("UnknownCarrier", "X")).toBeNull();
    });
    it("returns null for missing number", () => {
        expect(inferCarrierTrackingUrl("DHL", "")).toBeNull();
    });
});
```

- [ ] **Step 2: Run test — expect module-not-found**

```
pnpm --filter @vamy/db test carrier-urls
```
Expected: FAIL.

- [ ] **Step 3: Implement carrier-urls**

Create `packages/db/src/emails/carrier-urls.ts`:
```ts
export type Carrier = "DHL" | "GLS" | "UPS" | "Econt" | "Other";

const URL_BUILDERS: Partial<Record<Carrier, (trackingNumber: string) => string>> = {
    DHL:   (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
    GLS:   (n) => `https://gls-group.com/track/${encodeURIComponent(n)}`,
    UPS:   (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
    Econt: (n) => `https://www.econt.com/en/services/track/${encodeURIComponent(n)}`,
};

export function inferCarrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
    if (!carrier || !trackingNumber) return null;
    const builder = URL_BUILDERS[carrier as Carrier];
    return builder ? builder(trackingNumber) : null;
}
```

Fix the test: since `encodeURIComponent` is called, the test expectations need to be updated. `encodeURIComponent("JD000123")` is `"JD000123"` unchanged (alphanumeric), so those assertions hold. No test changes needed.

- [ ] **Step 4: Run test — expect pass**

```
pnpm --filter @vamy/db test carrier-urls
```
Expected: PASS, 6/6 tests.

- [ ] **Step 5: Write failing test for order-tracking template**

Create `packages/db/src/emails/__tests__/order-tracking.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { renderOrderTrackingHtml } from "../order-tracking";

describe("renderOrderTrackingHtml", () => {
    const base = {
        orderNumber: "order_test_7",
        buyerName: "Jane Smith",
        pieceName: "Whispers — Original",
        carrier: "DHL",
        trackingNumber: "JD000123",
        note: "Packed with care, should arrive within 3–7 working days.",
        termsUrl: "https://vamy.art/terms",
        privacyUrl: "https://vamy.art/privacy",
    };

    it("renders a tracking URL button when carrier is known", () => {
        const html = renderOrderTrackingHtml(base);
        expect(html).toContain("DHL");
        expect(html).toContain("JD000123");
        expect(html).toContain("https://www.dhl.com/en/express/tracking.html?AWB=JD000123");
        expect(html).toContain("Whispers — Original");
        expect(html).toContain("Packed with care");
        expect(html).toContain("— Maeve");
    });

    it("renders only the tracking number when carrier is unknown", () => {
        const html = renderOrderTrackingHtml({ ...base, carrier: "Other" });
        expect(html).toContain("JD000123");
        expect(html).not.toContain("https://www.dhl.com");
    });

    it("omits note block when no note provided", () => {
        const html = renderOrderTrackingHtml({ ...base, note: null });
        expect(html).not.toContain("Packed with care");
    });

    it("escapes HTML in user-controlled fields", () => {
        const evil = renderOrderTrackingHtml({ ...base, buyerName: "<script>x</script>" });
        expect(evil).not.toContain("<script>x</script>");
        expect(evil).toContain("&lt;script&gt;");
    });
});
```

- [ ] **Step 6: Run — expect module-not-found**

```
pnpm --filter @vamy/db test order-tracking
```
Expected: FAIL.

- [ ] **Step 7: Implement order-tracking template**

Create `packages/db/src/emails/order-tracking.ts`:
```ts
import { escapeHtml } from "../utils/escape-html";
import { inferCarrierTrackingUrl } from "./carrier-urls";

export type OrderTrackingData = {
    orderNumber: string;
    buyerName: string;
    pieceName: string;
    carrier: string;
    trackingNumber: string;
    note: string | null;
    termsUrl: string;
    privacyUrl: string;
};

export function renderOrderTrackingHtml(d: OrderTrackingData): string {
    const url = inferCarrierTrackingUrl(d.carrier, d.trackingNumber);
    const noteBlock = d.note
        ? `<p style="font-size:13px;line-height:1.6;color:#444;margin:0 0 20px;">${escapeHtml(d.note)}</p>`
        : "";
    const trackingCta = url
        ? `<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td><a href="${escapeHtml(url)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;letter-spacing:.04em;">Track your shipment</a></td></tr></table>`
        : "";

    return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Order ${escapeHtml(d.orderNumber)}</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">${escapeHtml(d.buyerName)}, your piece is on the way.</p>
${noteBlock}

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:8px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Carrier</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.carrier)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Tracking number</td><td style="padding:8px 0;font-size:13px;font-family:monospace;">${escapeHtml(d.trackingNumber)}</td></tr>
</table>

${trackingCta}

<p style="font-size:13px;line-height:1.6;color:#444;margin:16px 0 8px;">Care instructions are included in the package. Reach out any time — I'm happy to help for as long as you own the piece.</p>
<p style="font-size:13px;line-height:1.6;color:#444;margin:0;">— Maeve</p>

<p style="font-size:11px;color:#999;margin:28px 0 0;">
<a href="${escapeHtml(d.termsUrl)}" style="color:#999;text-decoration:underline;">Terms</a> ·
<a href="${escapeHtml(d.privacyUrl)}" style="color:#999;text-decoration:underline;">Privacy</a>
</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
```

- [ ] **Step 8: Re-export from package index**

In `packages/db/src/index.ts`, append:
```ts
export { renderOrderTrackingHtml, type OrderTrackingData } from "./emails/order-tracking";
export { inferCarrierTrackingUrl, type Carrier } from "./emails/carrier-urls";
```

- [ ] **Step 9: Run both email template tests**

```
pnpm --filter @vamy/db test
```
Expected: PASS on `carrier-urls.test.ts`, `order-tracking.test.ts`, `order-receipt.test.ts`. All existing tests continue to pass.

- [ ] **Step 10: Extend the `markShipped` mutation**

Rewrite `packages/db/src/trpc/routers/orders.ts` to:
- Join the variant + product + artwork so the email can name the piece.
- Accept `carrier` and `note` inputs.
- Write `trackingCarrier` to the orders table.
- Send the branded tracking email, failing soft.

Full file content:
```ts
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { orders, productVariants } from "../../schema";
import { Resend } from "resend";
import { renderOrderTrackingHtml } from "../../emails/order-tracking";

export const ordersRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.orders.findMany({
      with: { productVariant: { with: { product: { with: { artwork: true } } } } },
      orderBy: [desc(orders.createdAt)],
    });
  }),

  markShipped: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        carrier: z.enum(["DHL", "GLS", "UPS", "Econt", "Other"]),
        trackingNumber: z.string().min(1),
        note: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const resend = new Resend(process.env.RESEND_API_KEY);

      const [order] = await db
        .update(orders)
        .set({
          status: "shipped",
          trackingCarrier: input.carrier,
          trackingNumber: input.trackingNumber,
          shippedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      if (!order) {
        throw new Error("order not found");
      }

      // Fetch details needed for the email.
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, order.productVariantId),
        with: { product: { with: { artwork: true } } },
      });

      const pieceName = variant?.product?.artwork?.title ?? variant?.product?.name ?? "Your piece";
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art";

      try {
        const html = renderOrderTrackingHtml({
          orderNumber: order.id,
          buyerName: order.buyerName,
          pieceName,
          carrier: input.carrier,
          trackingNumber: input.trackingNumber,
          note: input.note ?? null,
          termsUrl: `${siteUrl}/terms`,
          privacyUrl: `${siteUrl}/privacy`,
        });

        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: order.buyerEmail,
          replyTo: "maeve@vamy.art",
          subject: "Your piece has shipped — tracking inside",
          html,
        });
      } catch (err) {
        console.error("[orders.markShipped] tracking email failed", { orderId: order.id, err });
      }

      return { success: true };
    }),
});
```

Note: the old mutation used optional `trackingNumber`. The new contract makes `trackingNumber` required + `carrier` required. The admin UI already provides the input, so this is safe — but confirm the admin orders page isn't calling `markShipped` without `trackingNumber` anywhere before you ship. (Step 4 of Task 17 is the matching admin change.)

- [ ] **Step 11: Verify tests + typecheck**

```
pnpm --filter @vamy/db test
pnpm turbo typecheck --filter=@vamy/db
pnpm turbo typecheck --filter=@vamy/admin
pnpm turbo typecheck --filter=@vamy/website
```
Expected: all PASS. Admin will fail typecheck until Task 17 updates the call site — that's expected if you're in the middle of Task 16; it resolves after Task 17.

- [ ] **Step 12: Commit**

```bash
git add packages/db/src/emails/carrier-urls.ts packages/db/src/emails/order-tracking.ts packages/db/src/emails/__tests__/ packages/db/src/index.ts packages/db/src/trpc/routers/orders.ts
git commit -m "feat(orders): branded tracking email with carrier URL inference; require carrier+tracking on markShipped"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 17: Admin orders page — carrier select + note + "Tracking sent ✓"

**Files:**
- Modify: `apps/admin/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Extend local state**

At the top of the component (around line 16 where `trackingInputs` state lives), change the state shape to carry carrier + number + note per order:
```tsx
type ShipDraft = { carrier: "DHL" | "GLS" | "UPS" | "Econt" | "Other"; trackingNumber: string; note: string };
const [drafts, setDrafts] = useState<Record<string, ShipDraft>>({});

function getDraft(orderId: string): ShipDraft {
    return drafts[orderId] ?? { carrier: "DHL", trackingNumber: "", note: "" };
}
function setDraft(orderId: string, patch: Partial<ShipDraft>) {
    setDrafts((prev) => ({ ...prev, [orderId]: { ...getDraft(orderId), ...patch } }));
}
```
Delete the old `trackingInputs` state.

- [ ] **Step 2: Replace the Tracking cell**

Replace the `<td>` for Tracking (lines 88–117) with:
```tsx
<td className="px-4 py-3">
  {o.status === "paid" && (
    <div className="flex flex-col gap-2 max-w-xs">
      <div className="flex gap-2 items-center">
        <select
          value={getDraft(o.id).carrier}
          onChange={(e) => setDraft(o.id, { carrier: e.target.value as ShipDraft["carrier"] })}
          className="border px-2 py-1 rounded text-xs bg-white"
        >
          <option value="DHL">DHL</option>
          <option value="GLS">GLS</option>
          <option value="UPS">UPS</option>
          <option value="Econt">Econt</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="text"
          placeholder="Tracking #"
          value={getDraft(o.id).trackingNumber}
          onChange={(e) => setDraft(o.id, { trackingNumber: e.target.value })}
          className="border px-2 py-1 rounded text-xs flex-1 min-w-0"
        />
      </div>
      <textarea
        placeholder="Optional note to buyer"
        value={getDraft(o.id).note}
        onChange={(e) => setDraft(o.id, { note: e.target.value })}
        rows={2}
        className="border px-2 py-1 rounded text-xs resize-none"
      />
      <button
        onClick={() => {
          const d = getDraft(o.id);
          if (!d.trackingNumber) return;
          markShipped.mutate({
            id: o.id,
            carrier: d.carrier,
            trackingNumber: d.trackingNumber,
            note: d.note || undefined,
          });
        }}
        disabled={markShipped.isPending || !getDraft(o.id).trackingNumber}
        className="text-xs bg-black text-white px-3 py-1.5 rounded disabled:opacity-50"
      >
        {markShipped.isPending ? "Sending…" : "Mark shipped & send tracking"}
      </button>
    </div>
  )}
  {o.status === "shipped" && o.trackingNumber && (
    <div className="flex flex-col">
      <p className="text-xs text-gray-500">
        {o.trackingCarrier ? `${o.trackingCarrier} · ` : ""}
        {o.trackingNumber}
      </p>
      <span className="text-xs text-gray-400 mt-0.5">Tracking sent ✓</span>
    </div>
  )}
</td>
```

- [ ] **Step 3: Update success toast**

Change the `markShipped` useMutation block (lines 12–15) to:
```tsx
const markShipped = trpc.orders.markShipped.useMutation({
  onSuccess: () => { refetch(); toast("tracking email sent", "success"); },
  onError: (e) => toast(e.message || "failed to send tracking", "error"),
});
```

- [ ] **Step 4: Verify**

```
pnpm turbo typecheck --filter=@vamy/admin
pnpm turbo build --filter=@vamy/admin
```
Expected: green.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/orders/page.tsx
git commit -m "feat(admin/orders): carrier select + note; 'Mark shipped & send tracking' sends branded email"
git push origin feat/ux-polish-2026-04-19
```

---

## Task 18: Integration smoke test + PR description update

**Files:**
- Modify: PR #3 description via `gh pr edit 3 --body ...`

- [ ] **Step 1: Full stack build**

```
pnpm turbo typecheck
pnpm turbo build
```
Expected: all green. TS errors at or below 50 baseline.

- [ ] **Step 2: Run all tests**

```
pnpm --filter @vamy/db test
```
Expected: all PASS. Include the three new template/URL test files from Tasks 14–16.

- [ ] **Step 3: Manual smoke on deploy preview**

After the final push, wait ~90s for Netlify, then on `https://deploy-preview-3--vamy-website.netlify.app`:

- `/` — "The Work" cards readable on 1600×1000, hero image fades in from gray placeholder.
- `/gallery/whispers` — "Available pieces" label, variant rows don't say "On The Horizon", terms checkbox gates Buy, Buy label cycles through "Select a piece to buy" → "Accept terms to continue" → "Buy", Stripe reassurance copy below the button, small "Or inquire about this piece" link beneath the card, no orphan bottom CTA.
- `/get-a-piece?piece=whispers` — no React #418 warning in console, landscape painting renders naturally (no crop), 8 steps visible, reply copy reads "I'll reply personally — usually within 2 working days. — Maeve".
- `/get-a-piece` checkbox wording matches ProductSelector checkbox wording.
- `/privacy` on 1600×1000 — footer pinned to bottom.
- `/terms` on 1600×1000 — content in a ~60–75ch reading column.
- `/favicon.ico` — 200 response, not 500.
- Admin `/orders` on a paid test order — carrier select, tracking input, note textarea all present; after submit, status becomes shipped, row shows "Tracking sent ✓".
- Trigger a €1 Stripe test checkout → receipt email arrives within 30s with the branded HTML showing order number, piece name, variant, total, shipping address.
- Click "Mark shipped & send tracking" with DHL carrier → tracking email arrives with the branded HTML and a working DHL tracking link.

- [ ] **Step 4: Update PR #3 description**

```bash
gh pr edit 3 --body "$(cat <<'EOF'
## Summary

This PR extends the initial UX polish (commits 471ac26..ea6e21c) with a full refinement pass: loading states, copy polish, layout fixes, legal gates on Buy, bug fixes, and the post-purchase email loop.

### What changed — UX polish

**Loading states**
- New `<LazyImage>` atom — placeholder/fade/error fallback, adopted across gallery tiles, PostLayout featured image, and `/get-a-piece` preview
- `ProductSelector` renders a full-fidelity skeleton instead of returning null
- `BidWidget` distinguishes "loading auction" from "no auction"
- Admin secondary queries (shipping dropdown, auctions dropdowns, image gallery) all show loading states

**Copy + layout**
- "Available Prints" → "Available pieces" on artwork pages (variants include Originals)
- Reply tagline: "I'll reply personally — usually within 2 working days. — Maeve" (both inquiry forms)
- "What happens next" expanded from 4 to 8 steps (packed / shipping / certificate / aftercare)
- Footer copyright "© 2026 Maeve Vamy"; footer pins to bottom on short pages via `min-h-screen flex flex-col`
- `/get-a-piece` preview now uses natural aspect (no more crop on landscape paintings)
- `/terms` content in a comfortable reading column (was a sliver on wide screens)
- Artwork page "Inquire about this piece" CTA pulled into the commerce column, no more orphan whitespace
- Home "The Work" grid responsive 2→4 columns with `max-w-6xl` cap

**Legal on Buy**
- Required `Terms + Privacy` checkbox gates the Buy button
- Adaptive Buy label: "Select a piece" → "Accept terms" → "Buy"
- Softer disabled opacity (0.6 vs 0.4)
- Reassurance: "Secure checkout via Stripe. Card, Apple Pay, Google Pay."
- All three forms (`/get-a-piece`, ReachOutBlock, ProductSelector) share identical checkbox wording

**Bug fixes**
- React hydration error #418 on `/get-a-piece` (removed `window.location.search` SSR branch)
- `/favicon.ico` 500 → 1×1 transparent ICO stub
- Variant sub-label "Fine Art Print — On The Horizon" no longer leaks wrong artwork name
- Footer "© 2026 Vamy" → "Maeve Vamy"

**Commerce**
- Stripe webhook now sends a branded receipt email (order number, piece, variant, total, address, — Maeve) — escapes HTML, resilient to Resend failures
- `orders.markShipped` extended with `carrier` + `note` inputs, ships a branded tracking email with a carrier-linked tracking button (DHL/GLS/UPS/Econt) or plain tracking number for "Other"
- Admin orders page: carrier select + tracking number + optional note; shows "Tracking sent ✓" after success
- New `orders.tracking_carrier` column (Drizzle migration)

## Design + plan docs

- `docs/plans/2026-04-20-ux-refinement-design.md`
- `docs/plans/2026-04-20-ux-refinement-plan.md`

## Test plan

- [ ] `pnpm turbo typecheck` — no new TS errors above the 50-error baseline
- [ ] `pnpm turbo build` — website and admin both green, 13 static pages generated
- [ ] `pnpm --filter @vamy/db test` — order-receipt, order-tracking, carrier-urls all pass
- [ ] Deploy preview: all bullets under "Manual smoke" in `docs/plans/2026-04-20-ux-refinement-plan.md#task-18`
- [ ] Stripe test €1 charge → branded receipt arrives
- [ ] Admin "Mark shipped & send tracking" with DHL → branded tracking email arrives with working DHL URL

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: No commit** — PR description edit is not a commit.

---

## Non-goals (recap)

- No Stripe live-mode cutover in this PR (user handles via Netlify env + Stripe dashboard off-repo)
- No committed Stripe go-live runbook
- No source-side detection of sk_test_ keys in production
- No i18n wiring for new copy
- No buyer accounts, no pagination, no gallery filtering
- No image optimization (webp/avif)
- No resend-tracking UI (v1 is fire-once)

---

## Self-review notes

**Spec coverage:**
- Section 1 (loading states) → Tasks 1, 2, 4, 5, 13
- Section 2 (copy + layout) → Tasks 2, 6, 7, 8, 9, 10, 11
- Section 3 (legal on Buy) → Tasks 3, 7
- Section 4 (bug fixes) → Tasks 2, 6, 12, 14 (email resilience)
- Section 5 (commerce) → Tasks 14, 15, 16, 17

**Type consistency check:**
- `markShipped` input: `{ id, carrier, trackingNumber, note? }` — same in Task 16 (router) and Task 17 (call site). ✓
- `renderOrderReceiptHtml` / `renderOrderTrackingHtml` named exports consistent across Task 14/16 impl, tests, and `packages/db/src/index.ts`. ✓
- `inferCarrierTrackingUrl` used inside `order-tracking.ts` and exported from the index. ✓
- `LazyImage` props extended in Task 5 Step 2 to accept pass-through props — depends on Task 1 atom; Task 5 explicitly updates the atom to match. ✓
- `orders.trackingCarrier` column: added in schema (Task 15), written in mutation (Task 16), read in admin UI (Task 17). ✓

**Placeholder scan:** None. Every task step has concrete code or a concrete command.
