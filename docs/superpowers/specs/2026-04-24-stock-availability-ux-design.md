# Stock & Availability UX — Design

**Date:** 2026-04-24
**Status:** Proposed

## Goal

Make stock state accurate and trustworthy to the buyer: the website reflects current stock without a hard reload, a sold-out piece cannot reach Stripe, and a buyer who misses a piece can leave their email and be notified automatically the next time that exact piece comes back in stock.

## Problem

1. **Stale stock on product pages.** Admin flips a variant to out-of-stock; the public page still shows "In stock" until a hard reload.
2. **Weak pre-payment guard.** `checkout.createSession` throws a generic `Error("Out of stock")`. The UI surfaces it as a toast-style error, but the flow still feels like the buyer "almost paid for something sold."
3. **Dead end on out-of-stock.** Sold-out variants show a disabled Buy button and nothing else. No way to express interest, no way to be told when it's back.

## Non-Goals

- Stock reservations / Stripe-window holds. Oversells are rare (mostly qty 1 originals that sell one-at-a-time; prints are reprintable). If an oversell happens, we refund.
- Realtime (Supabase subscriptions) on variant stock. Window-focus refetch is enough for this traffic volume.
- Unified waitlist + newsletter. Separate lists, separate consent (see "Waitlist vs. Newsletter" below).
- Per-product waitlist (product-level). Waitlist is per *variant* — that's the unit of availability.

## Scope (Three Parts)

### 1. Fresh stock on the website

**Change:** in `apps/website/src/components/blocks/ProductSelector/index.tsx`, configure the `products.listByArtworkSlug` query:

```ts
trpc.products.listByArtworkSlug.useQuery(
  { slug: artworkSlug },
  {
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  }
);
```

This means:
- When the buyer returns to the tab (e.g. after admin edited stock in another tab), stock is re-fetched.
- When the component remounts, stock is re-fetched.
- A tiny `staleTime` prevents thrash during the same page interaction.

No schema change, no SSR change, no cache header change. The page already renders the selector client-side.

**Success check:** open a variant page, flip stock in admin in another tab, switch back to the buyer tab, see the new state without hard reload.

### 2. Pre-payment guard

**Change 1 — server**: in `packages/db/src/trpc/routers/checkout.ts`, replace the generic errors with typed tRPC errors:

```ts
import { TRPCError } from "@trpc/server";
// ...
if (!variant) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
if (!variant.available || variant.stockQuantity <= 0) {
  throw new TRPCError({ code: "PRECONDITION_FAILED", message: "OUT_OF_STOCK" });
}
```

**Change 2 — client**: in `ProductSelector/index.tsx` `handleBuy`, detect the `OUT_OF_STOCK` case and switch the UI to the notify-me state *without* redirecting:

```ts
} catch (err) {
  const code = (err as any)?.data?.code;
  const msg = (err as any)?.message;
  if (code === "PRECONDITION_FAILED" && msg === "OUT_OF_STOCK") {
    // refetch so the variant row flips to Out of stock,
    // and show the notify-me form for this variant
    await productsQuery.refetch();
    setOutOfStockVariantId(selectedVariantId);
  } else {
    setCheckoutError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
  }
  setIsRedirecting(false);
}
```

No Stripe redirect happens for out-of-stock. The variant row visually updates on refetch, and the notify-me form appears inline.

### 3. Notify-me → back-in-stock automation

#### Data model

New table in `packages/db/src/schema.ts`:

```ts
export const variantWaitlist = pgTable("variant_waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  productVariantId: uuid("product_variant_id")
    .notNull()
    .references(() => productVariants.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  notifiedAt: timestamp("notified_at", { withTimezone: true }),
}, (t) => ({
  uniqueEmailVariant: unique().on(t.email, t.productVariantId),
}));
```

Migration: `packages/db/drizzle/` — new migration file.

#### Public tRPC route

New router `packages/db/src/trpc/routers/waitlist.ts`:

```ts
waitlist.subscribe({ variantId: uuid, email: email })
```

- Validates email with Zod.
- `INSERT ... ON CONFLICT (email, product_variant_id) DO NOTHING` — silent idempotent re-subscribe.
- If a conflict row exists with `notified_at IS NOT NULL`, update it to set `notified_at = null` so they'll be notified on the next cycle (they're re-declaring interest).
- Returns `{ success: true }` always. Does **not** reveal whether the email was already on the list.

#### Admin-side trigger (the automation)

In `packages/db/src/trpc/routers/variants.ts` (or wherever the admin `variants.update` / stock-toggle mutation lives — will confirm during implementation), wrap the stock change in a transaction and emit notifications *after* commit:

```
Read existing variant → mark `wasOutOfStock = (!available || stockQuantity <= 0)`
Apply update.
Compute `isInStockNow = (available && stockQuantity >= 1)`.
If (wasOutOfStock && isInStockNow):
  Fetch waitlist rows where product_variant_id = variant.id AND notified_at IS NULL.
  For each row:
    await resend.emails.send({ ... "back in stock" template ... })
    update variant_waitlist set notified_at = now() where id = row.id
  If any row's email fails, log the error with orderId-equivalent context and continue — do NOT silently swallow.
```

The send loop is inside the mutation response path so errors show up to the admin (unlike the current `orders.markShipped` which always returns `{ success: true }` even on Resend failure — we fix that pattern here by returning `{ success, notified: N, failed: M }`).

#### Email template

New file: `packages/db/src/emails/back-in-stock.ts`. Minimal, matches existing `order-tracking.ts` aesthetic:

- Subject: `"The piece you asked about is available again"`
- Body: piece name + variant name + link to `/get-a-piece/<artworkSlug>/` (deep link) + a short "this is a one-time notification; sign up again if you'd like to be told next time."
- Footer: Terms · Privacy links.

Sent via Resend (transactional). Not Buttondown — Buttondown is broadcast newsletter only.

#### Notify-me UI on the website

In `ProductSelector`, when the selected variant is out of stock (either because stock was already out on load, or because the pre-payment guard caught it):

```
[variant row]
  Name                              €1,200
  Out of stock

[inline form, replacing Buy button for this variant]
  Notify me when this piece is available again
  [email input] [Notify me]

  (After submit)
  ✓ We'll email you once.
```

Minimal component, no schema gymnastics. Reuses existing Tailwind classes.

#### Admin UX

On the variant edit screen in apps/admin (studio), next to the stock field:

- "3 people on waitlist" badge (read-only, clickable reveals the emails list in a drawer for transparency).
- On save, if the transition was out→in, toast: `"Saved. 3 waitlist subscribers notified."` (or `"Saved. 2 notified, 1 failed — check logs."`)

## Waitlist vs. Newsletter

**Separate tables, separate consent, separate unsubscribe.** Rationale:

- Newsletter = marketing broadcast. Infrequent. GDPR-relevant consent text.
- Waitlist = specific transactional interest in one piece. Single email per event. Auto-expires after one send.

Conflating them would farm newsletter subscribers under the guise of restock alerts, which is exactly the dark pattern we don't want. The footer newsletter signup stays where it is; it's unaffected by this work.

## Re-notify Policy

**Once per subscription, done.** After `notified_at` is set, the row is inert. If stock cycles 0→1→0→1, existing subscribers are not re-emailed on the second cycle. A buyer who wants future alerts submits the form again (which resets `notified_at`).

Rationale: spam avoidance. The alternative (re-notify every cycle) creates an email flood when Maeve edits stock multiple times during a listing session.

## Error Handling

- Invalid email → 400, Zod error surfaced inline on the notify-me form.
- Duplicate subscription → success with no-op (user sees the same confirmation).
- Resend send failure during restock trigger → per-email logged to console with `{ variantId, waitlistRowId, err }`; tally surfaced in admin mutation response; the row is **not** marked notified, so it's retried next time the admin re-saves (or a future automation could retry).
- DB constraint violation → surfaced as generic error, not leaked.
- No auth on `waitlist.subscribe` (public); rate limiting out of scope — existing tRPC procedures don't have it either, and this endpoint is low-abuse-value.

## Testing

- Unit: schema migration applies cleanly; `waitlist.subscribe` upsert logic (new, existing-unnotified, existing-notified).
- Integration: checkout.createSession throws typed `OUT_OF_STOCK` when variant is out of stock; website handler swaps UI without redirecting.
- Integration: variants.update transition detection — write tests for each of the four state quadrants (was-in/is-in, was-in/is-out, was-out/is-in, was-out/is-out); only was-out/is-in fires emails.
- Email rendering: snapshot test on `renderBackInStockHtml` to guard against accidental template breakage (same pattern as existing email tests if any).
- Manual: browser flip test (stock-freshness), buy-sold-out flow, full notify-me → restock → email received.

## Files Touched

**New:**
- `packages/db/drizzle/<n>_variant_waitlist.sql` — migration
- `packages/db/src/trpc/routers/waitlist.ts` — public tRPC router
- `packages/db/src/emails/back-in-stock.ts` — email template
- Tests alongside the above

**Modified:**
- `packages/db/src/schema.ts` — add `variantWaitlist` table + relation
- `packages/db/src/trpc/index.ts` (or app router) — register `waitlist` router
- `packages/db/src/trpc/routers/checkout.ts` — typed TRPCError
- `packages/db/src/trpc/routers/variants.ts` — transition detection + notify loop
- `apps/website/src/components/blocks/ProductSelector/index.tsx` — staleTime/refetchOnFocus + typed error handling + notify-me form
- `apps/admin/app/.../variants/.../page.tsx` (exact path TBD during implementation) — waitlist count badge + toast

## Rollout

No feature flag. Ship the DB migration, deploy, done. The new table is empty initially; the notify-me form only appears on out-of-stock variants (which right now is a small set). If anything misbehaves, the fallback is still the pre-existing behavior on the rest of the page.

## Security Notes

- Email input is Zod-validated (`z.string().email()`); no HTML injection vector in templates — all dynamic content passes through existing `escapeHtml` helper.
- No PII leak on duplicate signup (same response shape regardless).
- Waitlist rows are buyer-specific contact info; admin-only access is enforced by `protectedProcedure` on any admin-side read.
