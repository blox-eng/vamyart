# UX Refinement — Design

**Date:** 2026-04-20
**Branch:** `feat/ux-polish-2026-04-19` (extends PR #3)

## Goal

Resolve every usability rough edge visible in the current deploy preview so the browse → inquire → purchase flow feels seamless. Scope bundled in one PR: loading states, copy polish, layout fixes, legal gates on purchase, bug fixes, and the post-purchase email loop (Resend receipt + admin Send-tracking button).

Stripe live-mode cutover is operational (Netlify env + Stripe dashboard) and handled off-repo per user direction — no committed runbook, no source-side test-key detector.

---

## Section 1 — Loading states

Goal: no empty-then-pop state anywhere on either site.

### 1.1 Website (Pages Router)

**`ProductSelector` on `/gallery/[slug]`** — today returns `null` until `trpc.products.listByArtworkSlug` resolves. Replace that branch with a full-fidelity skeleton matching the card layout: header bar + 3 variant rows + shipping line + CTA button, all `animate-pulse`. The dynamic-import wrapper in `PostLayout` keeps its existing placeholder for the first-paint / bundle-fetch moment.

**`BidWidget` on `/gallery/[slug]`** — currently returns `null` whether the query is loading or has resolved with no auction. Split the states: while `isLoading`, render a small muted card ("Checking auction status…"); once resolved, keep the existing "null when no active auction" behavior.

**Image loading — introduce `<LazyImage>` atom** at `apps/website/src/components/atoms/LazyImage.tsx`. A thin wrapper around `<img>` that renders a `bg-gray-100` placeholder of the same dimensions until `onLoad` fires, then fades the real image in. Used by:
- Homepage hero painting
- Gallery tile images (`PostFeedSection/PostFeedItem`)
- `PostLayout` featured artwork (`/gallery/[slug]`)
- `/get-a-piece` preview aside

Net code change is slightly negative — the three current ad-hoc `onError` handlers consolidate into one atom with consistent placeholder + error fallback.

### 1.2 Admin (App Router)

Existing `SkeletonTable` already covers every primary query on all 6 dashboard pages. Remaining gaps:
- `shippingMethods.list` dropdown on `artworks/page.tsx` — render "Loading shipping…" as the only option while `isLoading`.
- `artworks.list` + `products.listAll` on `auctions/page.tsx` — same pattern on both select inputs.
- `artworkImages.list` grid inside the images panel — 4-square skeleton grid while `isLoading`.

---

## Section 2 — Copy + layout

### 2.1 Copy changes

- **"Available Prints" → "Available pieces"** (`ProductSelector/index.tsx:41`). Variants include the Original, so "pieces" is the honest umbrella.
- **Reply promise rewrite**, both surfaces, first-person from Maeve:
  - `/get-a-piece:277`: `"Maeve will reply personally — no bots, no templates."` → `"I'll reply personally — usually within 2 working days. — Maeve"`
  - `ReachOutBlock:133`: same string, same attribution.
  - Success states remain third-person ("Maeve will get back to you…"). Two voices: Maeve speaking directly pre-submit, the site narrating after.
- **"What happens next" expanded** (`/get-a-piece:10-15`) from 4 to 8 steps:
  ```
  01 Send your inquiry    — Fill in the form — takes under a minute.
  02 Maeve gets back      — Personally, within 2 working days.
  03 Discuss the details  — Shipping, insurance, payment — all sorted together.
  04 Secure payment       — Via Stripe link — card, Apple Pay, Google Pay.
  05 Packed with care     — Museum-grade packaging, fully insured, dispatched within 30 days.
  06 Tracked shipping     — Maeve will email tracking details once your piece is on its way.
  07 Certificate included — Signed certificate of authenticity and provenance documentation.
  08 Aftercare            — Care instructions included, and Maeve is reachable long after.
  ```
- **Footer copyright** `Footer/index.tsx:77`: `"© 2026 Vamy"` → `"© 2026 Maeve Vamy"`.

### 2.2 Layout changes

- **`/get-a-piece` preview aspect** (`get-a-piece.tsx:100`): drop `aspect-[3/4] object-cover`, use `w-full h-auto`. Landscape paintings render at natural aspect, no crop. The skeleton keeps `aspect-[3/4]` (placeholder has no intrinsic orientation).
- **Footer sticky-on-short-content:** wrap `DefaultBaseLayout` children in `<div className="min-h-screen flex flex-col">` with `<main className="flex-1">`. Footer pins to bottom on short pages (`/privacy`, `/terms` on tall displays), flows naturally on tall pages.
- **Terms page width:** widen the content column on `/terms` to a comfortable reading measure (`max-w-prose`, ≈65ch) instead of the current ~40% sliver on 1600px. Implementation picks the minimum-blast-radius path: either a per-page styles override in the markdown frontmatter or a container class adjustment in the page layout. Either way, observable change: terms becomes a comfortable reading column.
- **Artwork page orphan CTA:** pull the "Inquire about this piece" button out of the `bottomSections` block and inline it directly beneath the ProductSelector in `PostLayout`. Then remove the orphaned bottomSection from all 3 gallery markdown files (`content/pages/gallery/whispers.md`, `first-contact.md`, `on-the-horizon.md`). CTA now sits with its context instead of floating in whitespace.
- **Home "The Work" cards:** switch from 4-column always to `lg:grid-cols-2 xl:grid-cols-4` (2 columns on `lg`, 4 on `xl`) with a `max-w-6xl` container cap. Individual cards stay ~260px+ wide on every viewport so body copy isn't cramped.

---

## Section 3 — Legal on Buy

### 3.1 `ProductSelector` changes

Before `handleBuy` can fire, the user must check a required terms checkbox.

```tsx
const [termsAccepted, setTermsAccepted] = useState(false);

// Rendered directly above the Buy button:
<label className="flex items-start gap-3 cursor-pointer mt-4">
  <input
    type="checkbox"
    required
    checked={termsAccepted}
    onChange={(e) => setTermsAccepted(e.target.checked)}
    className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-black/60"
  />
  <span className="text-xs text-gray-600">
    I have read and accept the{' '}
    <a href="/terms" target="_blank" rel="noreferrer" className="underline hover:no-underline">Terms</a>
    {' '}and{' '}
    <a href="/privacy" target="_blank" rel="noreferrer" className="underline hover:no-underline">Privacy Policy</a>.
  </span>
</label>
```

Buy button `disabled` condition becomes:
```ts
disabled={!selectedVariantId || !termsAccepted || isRedirecting}
```

### 3.2 Supporting reassurance copy

Under the Buy button, a muted `text-xs text-gray-500` line:
```
Secure checkout via Stripe. Card, Apple Pay, Google Pay.
```

Shipping-method display line (already rendered via `shippingMethod.displayText`) confirmed to appear near the checkbox — no new data, just verifying placement.

### 3.3 Parity across all three forms

`/get-a-piece` and `ReachOutBlock` already have a "legal terms" single-link checkbox. Update both to match the Buy wording: `"I have read and accept the Terms and Privacy Policy."` with both links. All three forms speak identically.

### 3.4 Out of scope

- No Buy button label change (kept as "Buy"; see Section 4.4 for context-adaptive variants when *disabled*).
- No inline 14-day withdrawal notice — covered in `/terms`.
- No separate privacy checkbox — one checkbox covers both docs.

---

## Section 4 — Bug fixes

### 4.1 React hydration warning on `/get-a-piece`

`get-a-piece.tsx:19-21` currently reads `window.location.search` on the client with `router.query` as the SSR fallback, which produces a client/server mismatch (React error #418).

Fix: drop the `typeof window` branch. Read only from `router.query.piece`, coerced:
```ts
const pieceSlug = typeof router.query.piece === 'string' ? router.query.piece : '';
```
`useRouter` hydrates correctly on the client; no UX change.

### 4.2 Favicon 500

`/favicon.ico` returns 500 (template cleanup removed the source asset while browsers still probe `.ico`). Add a 1×1 transparent `public/favicon.ico` (~200 bytes) as a compatibility stub. Existing `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` remains the primary; the stub kills the noise for clients that ignore SVG.

### 4.3 Variant sub-label shows wrong artwork name

`ProductSelector:59` renders `{v.productName}`, a free-form product name typed in admin that has drifted from the joined artwork ("Fine Art Print — On The Horizon" shows even on `/gallery/whispers`). Fix: remove the second `<p>` entirely. `v.name` already carries the scale info ("A3 — 30 × 42 cm", "Original — 70 × 100 cm"). No data migration needed.

### 4.4 Buy button disabled state too loud

Current: `disabled:opacity-40` on solid black = flat gray, unclear why it's disabled. Fix:
- Soften to `disabled:opacity-60`.
- Make the button label adaptive:
  - No variant selected: `Select a piece to buy`
  - Variant selected but terms unchecked: `Accept terms to continue`
  - Both ready: `Buy`
- Removes the need for a separate inline nudge — the button self-explains.

---

## Section 5 — Commerce

### 5.1 Post-purchase receipt email (Resend)

Stripe webhook at `apps/website/app/api/webhooks/stripe/route.ts` already handles `checkout.session.completed` and inserts an order row. It sends no email. Add a Resend call immediately after the successful insert.

**Template** — `packages/db/src/emails/order-receipt.tsx` (React Email component):
- Monochrome layout, Maeve Vamy header, short first-person body from Maeve
- Order number, piece name + variant + dimensions, total paid, echoed shipping address
- Closing line: *"Thank you — your piece will ship within 30 days. I'll email you tracking details once it's on its way. — Maeve"*
- Footer: links to `/terms` and `/privacy`

**Sending details**
- From: `Maeve Vamy <orders@vamy.art>` (Resend-verified)
- Subject: `Your piece is on the way — order #{orderNumber}`
- Reply-to: `maeve@vamy.art`

**Failure handling**
- Wrap Resend call in try/catch. If it throws, log `console.error` with `orderId` and return 200 to Stripe anyway. We do NOT let an email failure cause Stripe to retry the entire webhook — the order is written, payment is captured, that's the source of truth.
- No retry logic in this PR. YAGNI until we see a real failure pattern.

### 5.2 Admin "Send tracking" button

**Schema (Drizzle migration):**
```sql
ALTER TABLE orders ADD COLUMN tracking_carrier text;
ALTER TABLE orders ADD COLUMN tracking_number text;
ALTER TABLE orders ADD COLUMN tracking_sent_at timestamptz;
```
Derived `trackingSent` = `tracking_sent_at IS NOT NULL`.

**tRPC mutation** — new `orders.sendTracking` in `packages/db/src/trpc/routers/orders.ts`:
```ts
input: { orderId, carrier, trackingNumber, note? }
```
Renders `packages/db/src/emails/order-tracking.tsx`, sends via Resend, updates the three columns above. Returns the updated order row.

**Tracking URL inference** — static map:
```ts
const carrierUrls: Record<string, (n: string) => string> = {
  DHL:  (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${n}`,
  GLS:  (n) => `https://gls-group.com/track/${n}`,
  UPS:  (n) => `https://www.ups.com/track?tracknum=${n}`,
  Econt:(n) => `https://www.econt.com/en/services/track/${n}`,
};
```
`Other` falls back to rendering the number as text only. The email template prefers a linked button when a URL is inferrable, plain text otherwise.

**Admin UI** — `apps/admin/app/(dashboard)/orders/page.tsx`:
- Row shows a "Send tracking" action when `order.status === 'paid'` && `!order.tracking_sent_at`.
- Click opens an inline form (not a modal — keeps it visually local): Carrier select, Tracking number input, optional Note textarea, Send button.
- After success, the button becomes `Tracking sent ✓` (muted, non-interactive). No resend in v1.

**Email template** — `packages/db/src/emails/order-tracking.tsx`:
- Same Maeve Vamy branding as 5.1
- Subject: `Your piece has shipped — tracking inside`
- Body: carrier, tracking number (linked when inferrable), optional note from Maeve, a line reiterating the care-instructions inclusion

### 5.3 Out of scope

- `GOLIVE-STRIPE.md` runbook (rejected: public repo).
- Test-key production detector (same reason).
- `.env.example` edits pointing at go-live steps.
- Automated carrier URL inference beyond the static map above.
- Resend-tracking UI (fire-once in v1).
- Live Stripe cutover itself — Maeve/admin flips env vars on Netlify and registers the live webhook via the Stripe dashboard. No code change required.

---

## File map

**Modify:**
- `apps/website/src/pages/get-a-piece.tsx` — hydration fix, aspect change, copy, steps, LazyImage adoption
- `apps/website/src/components/blocks/ProductSelector/index.tsx` — loading skeleton, "Available pieces", terms checkbox, adaptive Buy label, drop variant sub-label, reassurance copy
- `apps/website/src/components/blocks/BidWidget/index.tsx` — loading state
- `apps/website/src/components/blocks/ReachOutBlock/index.tsx` — reply copy, checkbox wording
- `apps/website/src/components/sections/Footer/index.tsx` — copyright
- `apps/website/src/components/layouts/DefaultBaseLayout/index.tsx` — flex sticky-footer wrapper
- `apps/website/src/components/layouts/PostLayout/index.tsx` — inline Inquire CTA below ProductSelector, LazyImage for featured image
- `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` — LazyImage for tiles
- `apps/website/content/pages/gallery/{whispers,first-contact,on-the-horizon}.md` — remove orphan Inquire bottomSection
- `apps/website/content/pages/index.md` — Work grid cols + max-width
- `apps/website/content/pages/terms.md` — width styling
- `apps/admin/app/(dashboard)/artworks/page.tsx` — loading states on shipping dropdown + image grid
- `apps/admin/app/(dashboard)/auctions/page.tsx` — loading states on artwork + product dropdowns
- `apps/admin/app/(dashboard)/orders/page.tsx` — Send tracking action
- `apps/website/app/api/webhooks/stripe/route.ts` — Resend receipt call
- `packages/db/src/schema.ts` (or equivalent) — orders.tracking_carrier/number/sent_at columns
- `packages/db/src/trpc/routers/orders.ts` — `sendTracking` mutation

**Create:**
- `apps/website/src/components/atoms/LazyImage.tsx`
- `apps/website/public/favicon.ico` (1×1 stub)
- `packages/db/src/emails/order-receipt.tsx`
- `packages/db/src/emails/order-tracking.tsx`
- `packages/db/drizzle/NNNN_add_order_tracking.sql` (migration for 5.2)

**Delete:**
- None. This PR only adds and modifies.

---

## Testing

- `pnpm turbo typecheck` — no new TS errors above baseline.
- `pnpm turbo build --filter=@vamy/website` — green.
- `pnpm turbo build --filter=@vamy/admin` — green.
- Manual on deploy preview:
  - `/get-a-piece?piece=whispers` on 1600×1000 — image renders landscape, no crop, no hydration warning in console.
  - `/gallery/whispers` — ProductSelector shows skeleton on slow network then real card, "Available pieces" label, terms checkbox gates Buy, adaptive button label cycles correctly.
  - `/privacy` on 1600×1000 — footer pinned to bottom, not mid-page.
  - `/terms` on 1600×1000 — content in comfortable reading column.
  - `/` — "The Work" cards readable at xl width, hero/tile images show placeholder then fade in on slow network.
  - `/favicon.ico` returns 200 (not 500).
- Stripe checkout: complete a €1 test charge → receive receipt email from `orders@vamy.art` within 30s. Order row shows in admin orders view.
- Admin: on the new order, click "Send tracking" with a fake DHL number → test inbox receives tracking email with a DHL-linked button. Order row shows `Tracking sent ✓`.
- All three forms (get-a-piece, ReachOutBlock, ProductSelector) show the same `"I have read and accept the Terms and Privacy Policy."` checkbox wording.

---

## Non-goals

- Stripe live-mode cutover (handled off-repo).
- i18n wiring for the new copy (English only for now).
- Image optimization (webp/avif, responsive sizes) — separate concern.
- Bespoke 14-day withdrawal UX flow — `/terms` covers it.
- Paginated/filterable gallery — out of scope.
