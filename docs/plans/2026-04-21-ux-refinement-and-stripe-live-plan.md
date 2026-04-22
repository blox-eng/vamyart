# PR #5 — UX Refinement, Checkout Robustness, and Stripe Live Cutover

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a polished, bug-free buying and inquiry experience. Fix the dropdown that stays disabled when preselected from URL, the Stripe-return stuck "Redirecting to payment…" button, the wrong 30-day shipping wording on prints, and the footer/body width mismatch. Add an EU-compliant pre-purchase disclosure. Document how to flip Stripe from sandbox to live keys.

**Architecture:** No new deps. Surgical edits to existing components plus one new doc. All edits in `apps/website/src/…` and `packages/db/src/emails/…`. The Stripe cutover is env-var driven — no code change, just a runbook.

**Tech stack:** Next.js 15 (Pages Router), React 19, Tailwind, tRPC v11, Drizzle, Stripe Checkout (guest).

**Branch:** Cut `fix/ux-pr5-polish-and-stripe-live` from fresh `origin/main` (current branch `fix/lazyimage-cached-stuck` is already merged).

---

## Reconciliation with user observations

- ✅ **"Available Prints" → "Available pieces"** — already correct in code (`ProductSelector/index.tsx:28,74`). If user sees "Available Prints", they're on a stale cache/deploy. No code change; Task 7 verifies on preview.
- ✅ **"What happens next" stops at step 04** — code has all 8 steps (`get-a-piece.tsx:11-20`). Same stale-deploy theory. Task 7 verifies.
- ⚠️ **"Maeve will reply personally — no bots, no templates"** — this exact phrase is NOT in the current codebase. Current closing line on both inquiry forms is: `"I'll reply personally — usually within 2 working days. — Maeve"`. Task 6 rewrites it softer.
- ⚠️ **Preview cutoff on large screens** — no CSS cause surfaced from static read. Task 7 (Playwright) visually confirms or rules out before Task 7.fix decides if any change is needed.
- ℹ️ **Footer "smaller than the screen"** — footer inner uses `max-w-7xl` (1280px) while page body is `max-w-6xl` (1152px). On a 1920px viewport both leave gutters. Task 4 aligns them.
- ℹ️ **Legal checkboxes** — Terms/Privacy checkbox already exists on both `/get-a-piece` and `/gallery/<slug>` purchase form. What's *missing* for EU compliance is: (a) the Buy button must unambiguously convey payment obligation (Consumer Rights Directive 2011/83/EU Art. 8(2)); (b) 14-day right of withdrawal must be disclosed pre-purchase. Task 5 handles both without adding another checkbox.

---

## File changes summary

| File | Task | What changes |
|------|------|--------------|
| `apps/website/src/pages/get-a-piece.tsx` | T1, T6 | Remove `disabled={!!artwork}` on piece select; simplify "Pre-filled" note; rewrite closing line. |
| `apps/website/src/components/blocks/ProductSelector/index.tsx` | T2, T5 | Add `pageshow` listener to clear `isRedirecting` on bfcache restore; change Buy button label + add withdrawal disclosure. |
| `apps/website/src/components/blocks/ReachOutBlock/index.tsx` | T6 | Rewrite closing line to match T6 treatment. |
| `apps/website/src/components/sections/Footer/index.tsx` | T4 | Change footer inner `max-w-7xl` → `max-w-6xl` to match page body. |
| `packages/db/src/emails/order-receipt.ts` | T3 | Accept `leadTime` param in `OrderReceiptData`; interpolate into body. |
| `apps/website/src/pages/api/webhooks/stripe.ts` *(or the shared handler)* | T3 | Compute `leadTime` from variant attributes (original vs print) before calling receipt renderer. |
| `apps/website/content/pages/terms.md` | T3 | Add one-line distinction for originals (≤30d) vs prints (≤7d). |
| `docs/runbooks/stripe-live-cutover.md` (new) | T8 | Step-by-step env var + webhook rotation runbook. |

No files in `apps/admin` change in this PR.

---

## Task 1 — Fix inquiry dropdown stuck-disabled after URL preselect

**Root cause:** `get-a-piece.tsx:210` has `disabled={!!artwork}`. When the URL has `?piece=<slug>`, `artwork` is populated from tRPC. The "Change" button (line 223) only runs `setPiece('')` — it never clears `artwork`, so the select stays disabled forever. iOS Safari makes the disabled state more visually sticky but the bug is platform-agnostic.

**Fix approach:** Remove `disabled` entirely. The dropdown becomes naturally editable; the prefill still works via the existing `useEffect` on line 46. The "Change" button becomes unnecessary and is removed — users just tap the dropdown.

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx:205-228`

- [ ] **Step 1: Remove `disabled` prop and the Change affordance**

Edit `apps/website/src/pages/get-a-piece.tsx` around the piece-select block. Replace:

```tsx
<select
    id="inq-piece"
    value={piece}
    onChange={e => setPiece(e.target.value)}
    required
    disabled={!!artwork}
    className={`w-full border border-gray-200 px-4 py-3 rounded text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors ${artwork ? 'bg-gray-50 text-gray-600 cursor-not-allowed' : ''}`}
>
    <option value="">— select a piece</option>
    {ARTWORKS.map(a => (
        <option key={a.slug} value={a.title}>{a.title}</option>
    ))}
    <option value={COMMISSION_OPTION.title}>{COMMISSION_OPTION.title}</option>
    <option value={OTHER_OPTION.title}>{OTHER_OPTION.title}</option>
</select>
{artwork && (
    <p className="text-xs text-gray-400 mt-1.5">
        Pre-filled from the artwork page.{' '}
        <button type="button" onClick={() => setPiece('')} className="underline hover:no-underline">
            Change
        </button>
    </p>
)}
```

with:

```tsx
<select
    id="inq-piece"
    value={piece}
    onChange={e => setPiece(e.target.value)}
    required
    className="w-full border border-gray-200 px-4 py-3 rounded text-sm bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors"
>
    <option value="">— select a piece</option>
    {ARTWORKS.map(a => (
        <option key={a.slug} value={a.title}>{a.title}</option>
    ))}
    <option value={COMMISSION_OPTION.title}>{COMMISSION_OPTION.title}</option>
    <option value={OTHER_OPTION.title}>{OTHER_OPTION.title}</option>
</select>
{artwork && (
    <p className="text-xs text-gray-400 mt-1.5">
        Pre-filled from the artwork page — tap to change.
    </p>
)}
```

- [ ] **Step 2: Manual check on preview (desktop + iOS simulator via Playwright)**

Run: `pnpm --filter @vamy/website build` (must succeed).
Then via Playwright: navigate to `/get-a-piece/?piece=first-contact`, confirm dropdown opens, change selection, confirm new value persists, submit no-ops still validate.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(get-a-piece): allow changing preselected piece dropdown

Removed disabled state on the <select>; the Change button only cleared
piece but never cleared artwork, so the disabled flag stayed true
forever. iOS Safari made this most visible. Dropdown is now naturally
editable; prefill still works via the existing useEffect."
```

---

## Task 2 — Fix "Redirecting to payment…" stuck after back-from-Stripe (bfcache)

**Root cause:** `ProductSelector/index.tsx:61-69` calls `setIsRedirecting(true)` then `window.location.href = url`. When the user hits Back from Stripe, Safari/Chrome restores the page from the back-forward cache — React state is restored verbatim, so `isRedirecting === true` and the button reads "Redirecting to payment…" forever. There is no `pageshow` listener anywhere in the codebase today.

**Fix approach:** Add a `pageshow` listener that resets `isRedirecting` when `event.persisted` is true (bfcache restore). Also do a belt-and-braces reset when the component re-mounts.

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

- [ ] **Step 1: Add pageshow listener**

Add `useEffect` import (file already uses `useState`; add `useEffect`). Inside the component, after the `useState` block:

```tsx
// Reset checkout button if user returns via bfcache (e.g., Back from Stripe).
React.useEffect(() => {
    function onPageShow(e: PageTransitionEvent) {
        if (e.persisted) {
            setIsRedirecting(false);
            setCheckoutError(null);
        }
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
}, []);
```

Adjust the import line at top of file to: `import { useState, useEffect } from 'react';` (keeping consistent with existing named imports) or use `React.useEffect` — match whatever style is already used nearby. File currently uses `useState` named import; add `useEffect` named.

- [ ] **Step 2: Verify via Playwright**

Start dev server on preview deploy. Navigate to a gallery piece that has products. Click a variant, accept terms, click Buy → confirm it goes to Stripe Checkout. Hit browser back. Confirm button text is back to "Buy" (or "Accept terms to continue" / "Select a piece to buy" depending on state).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "fix(ProductSelector): reset stuck redirect state on bfcache restore

When user hits Back from Stripe Checkout the page is restored from the
back-forward cache with React state intact, so isRedirecting=true and
the Buy button stayed 'Redirecting to payment…' forever. Added a
pageshow listener that clears the flag when event.persisted is true."
```

---

## Task 3 — Differentiate shipping lead times: originals vs prints

**Current state:** `packages/db/src/emails/order-receipt.ts:42` hardcodes "Your piece will ship within 30 days." regardless of what was bought. Originals genuinely need 30 days (museum-grade packing, insurance); prints ship in ≤7 days (≤14 days worst case).

**Fix approach:** Add `leadTime: string` to `OrderReceiptData`. The stripe webhook handler computes it based on the purchased variant's type/attributes (or product category) and passes it in. Also update `content/pages/terms.md` to disclose both windows.

**Files:**
- Modify: `packages/db/src/emails/order-receipt.ts`
- Modify: stripe webhook handler (grep to confirm path — likely `apps/website/src/pages/api/webhooks/stripe.ts` or `apps/website/src/app/api/webhooks/stripe/route.ts` per prior memory)
- Modify: `apps/website/content/pages/terms.md`

- [ ] **Step 1: Find webhook handler**

Run: `rg -l "renderOrderReceiptHtml|order-receipt" apps/website packages/db --type ts`. Open the match that imports the renderer and sends email.

- [ ] **Step 2: Add `leadTime` field to receipt data**

Edit `packages/db/src/emails/order-receipt.ts`:

```ts
export type OrderReceiptData = {
    orderNumber: string;
    buyerName: string;
    pieceName: string;
    variantName: string;
    medium: string | null;
    totalPaidEur: number;
    leadTime: string;                 // e.g. "within 30 days", "within 7 days"
    shippingAddress: { /* ...unchanged... */ };
    termsUrl: string;
    privacyUrl: string;
};
```

In the template body, replace:

```html
<p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 28px;">Your piece will ship within 30 days. I'll email you tracking details once it's on its way.</p>
```

with:

```html
<p style="font-size:14px;line-height:1.6;color:#444;margin:0 0 28px;">Your piece will ship ${escapeHtml(d.leadTime)}. I'll email you tracking details once it's on its way.</p>
```

- [ ] **Step 3: Compute `leadTime` in the webhook handler**

In the webhook handler, where the receipt is assembled:

```ts
// Infer lead time from variant attributes. Originals pack & ship in 30 days;
// prints in 7 days. Fall back to 14 days if type is unknown.
function inferLeadTime(variant: { attributes: Record<string, unknown> | null }): string {
    const type = String(variant.attributes?.type ?? variant.attributes?.kind ?? '').toLowerCase();
    if (type.includes('original')) return 'within 30 days';
    if (type.includes('print')) return 'within 7 days';
    return 'within 14 days';
}
```

Pass `leadTime: inferLeadTime(variant)` into the `renderOrderReceiptHtml` call.

> **Scene-setting for implementer:** The schema uses JSONB `attributes` on `product_variants` per `packages/db/src/schema` (see memory). Inspect an actual row (or `packages/db/src/seed*`) to confirm whether type is under `attributes.type`, `attributes.kind`, or `variants.kind`. Match the actual key before shipping.

- [ ] **Step 4: Update terms.md**

`apps/website/content/pages/terms.md:83` currently: "Delivery Timeline: Artworks will be shipped within 30 days of payment confirmation". Replace the single-line wording with:

```markdown
**Delivery Timeline:**
- Originals: shipped within 30 days of payment confirmation.
- Prints: shipped within 7 working days of payment confirmation (14 days at peak periods).
```

- [ ] **Step 5: Build + commit**

```bash
pnpm --filter @vamy/website build
pnpm --filter @vamy/db build    # if packages/db has a build step
```

```bash
git add packages/db/src/emails/order-receipt.ts \
        apps/website/src/pages/api/webhooks/stripe.ts \
        apps/website/content/pages/terms.md
git commit -m "feat(orders): variant-aware shipping lead time in receipt + terms

Prints ship in ≤7 days, originals in ≤30 days. Receipt email now
interpolates the correct window based on variant type; terms page
discloses both."
```

---

## Task 4 — Align footer width with page body

**Current state:** `Footer/index.tsx:32` uses `max-w-7xl` (1280px) for the footer's inner container. Page body uses `max-w-6xl` (1152px) throughout (home, /gallery, /get-a-piece, post layout). On ≥1920px viewports the mismatch is visible: footer content is slightly wider than the page content above it.

**Fix approach:** Change footer inner to `max-w-6xl`. If this feels too narrow for a footer with newsletter + social icons, keep as-is and tell the user why. Default: align to `max-w-6xl`.

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx:32`

- [ ] **Step 1: Edit**

Change:

```tsx
<div className="mx-auto max-w-7xl">
```

to:

```tsx
<div className="mx-auto max-w-6xl">
```

- [ ] **Step 2: Visual check**

Playwright snapshot at 1920×1080 comparing page body and footer content edges. Should be flush.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx
git commit -m "fix(footer): align inner max-width to match page body (max-w-6xl)"
```

---

## Task 5 — EU-compliant pre-purchase disclosure + explicit Buy button

**Current state:** Buy button text is `'Buy'` (`ProductSelector:136`). EU Consumer Rights Directive 2011/83/EU Art. 8(2) requires the purchase button (or equivalent function) be labelled with words "clearly and unambiguously" indicating that placing the order entails obligation to pay. Common compliant labels: "Buy — pay now", "Order with obligation to pay", German "Kostenpflichtig bestellen". Also, the 14-day withdrawal right must be disclosed before purchase (not only in Terms).

**Fix approach:**
- Change button label from `'Buy'` to `'Buy — pay €${price}'` (price is known from selected variant).
- Add a concise two-line disclosure between the terms checkbox and the Buy button: price/VAT treatment + 14-day withdrawal right (with a link to `/terms#withdrawal` for details).
- No extra checkbox — keep the existing Terms checkbox as the binding acknowledgment.

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`
- Modify: `apps/website/content/pages/terms.md` — ensure a `#withdrawal` anchor section exists; add if missing.

- [ ] **Step 1: Wire price into button label**

Inside `ProductSelector`, compute the selected variant's price near the top of the return:

```tsx
const selectedVariant = variants.find(v => v.id === selectedVariantId) ?? null;
const priceLabel = selectedVariant ? `€${Number(selectedVariant.price).toLocaleString()}` : '';
```

Change button label block:

```tsx
{isRedirecting
    ? 'Redirecting to payment…'
    : !selectedVariantId
        ? 'Select a piece to buy'
        : !termsAccepted
            ? 'Accept terms to continue'
            : `Buy — pay ${priceLabel}`}
```

- [ ] **Step 2: Add disclosure above the button**

Between the existing terms `<label>` (ends at line 124) and the `<button>`:

```tsx
<p className="text-xs text-gray-500 mb-3 leading-relaxed">
    Prices include VAT where applicable. You have a 14-day right of withdrawal after delivery —{' '}
    <a href="/terms#withdrawal" className="underline hover:no-underline" target="_blank" rel="noreferrer">
        details
    </a>.
</p>
```

- [ ] **Step 3: Ensure terms.md has a withdrawal anchor**

Open `apps/website/content/pages/terms.md`. If there's no `## Right of withdrawal` (or similar) heading, add one with the standard EU 14-day language. If one exists, ensure it renders with an id that matches `#withdrawal` (Markdown usually slugifies headings; add `<a id="withdrawal"></a>` if needed).

- [ ] **Step 4: Build + commit**

```bash
pnpm --filter @vamy/website build
git add apps/website/src/components/blocks/ProductSelector/index.tsx \
        apps/website/content/pages/terms.md
git commit -m "feat(checkout): EU-compliant Buy button + pre-purchase disclosure

Button now shows 'Buy — pay €X' so payment obligation is unambiguous
per Directive 2011/83/EU Art. 8(2). Added a two-line notice above the
button covering VAT treatment and 14-day withdrawal right with a link
to /terms#withdrawal."
```

---

## Task 6 — Wording polish: inquiry form closing line

**Current:** `"I'll reply personally — usually within 2 working days. — Maeve"` (on `get-a-piece.tsx:284` and `ReachOutBlock:140`).

**New:** `"A personal reply from Maeve — usually within 2 working days."`

Softer, no em-dash-and-signature awkwardness, reads more naturally. If user prefers the signature retained, fall back to: `"Maeve replies personally — usually within 2 working days."`

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx:284`
- Modify: `apps/website/src/components/blocks/ReachOutBlock/index.tsx:140`

- [ ] **Step 1: Replace both occurrences** with the new wording. Keep the same class names.

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx \
        apps/website/src/components/blocks/ReachOutBlock/index.tsx
git commit -m "copy: soften inquiry form closing line across both forms"
```

---

## Task 7 — Playwright visual audit on deploy preview

**Purpose:** (a) confirm the stale-deploy theories (Available Prints / 4-step list), (b) locate the /get-a-piece preview "cutoff" on large screens, (c) sweep for any other UX issues worth fixing in this PR.

This is a short (≤20 min) pass. Don't rat-hole.

- [ ] **Step 1: Once PR is open and Netlify deploy preview is live, run Playwright on the preview URL.**

Viewports to test: 375×812 (iPhone), 1440×900 (laptop), 1920×1080 (large desktop).

Pages to visit: `/`, `/gallery`, `/gallery/<a-piece>`, `/get-a-piece/`, `/get-a-piece/?piece=<a-slug>`, `/terms`.

Observations to capture:
- Piece-page ProductSelector shows "Available pieces" (not Prints).
- /get-a-piece left-panel image rendering at 1920×1080 — screenshot to confirm whether there's any actual cutoff.
- /get-a-piece "What happens next" shows 8 steps.
- /get-a-piece dropdown opens on iOS simulation (Playwright mobile viewport).
- Buy flow: click → Stripe → back → button reset.
- Footer visual alignment with page body at 1920.
- Anything else the pass surfaces (loading jank, layout shift, a11y warnings).

- [ ] **Step 2: If preview cutoff exists and is real**, add a fix-commit (likely `object-fit: contain` + `max-h-[70vh]` on the LazyImage wrapper in `get-a-piece.tsx` left column). If it doesn't exist, note it in the PR description and move on.

- [ ] **Step 3: For each genuine issue found beyond this plan**, decide: fix-now (small, same file area as other tasks) vs. file a follow-up issue. Bias toward fix-now if ≤5 min and in-scope.

---

## Task 8 — Stripe sandbox → live cutover runbook (doc only)

**Purpose:** Give Maeve (and future-you) a clean checklist to flip Stripe from sandbox to live without breaking orders. No code changes — this is env var + dashboard work.

**Files:**
- Create: `docs/runbooks/stripe-live-cutover.md`

- [ ] **Step 1: Write the runbook**

Content outline:

```markdown
# Stripe live cutover runbook

## Preconditions
- Stripe account is activated (business details, bank account verified, ID verified).
- Test/sandbox flow on deploy preview works end-to-end.
- vamy.art domain is verified in Stripe Dashboard → Settings → Payment methods → Apple Pay / domains.

## Step-by-step

1. In Stripe Dashboard, toggle **Viewing: Live mode** (top-left).
2. **Create live webhook endpoint:**
   - Developers → Webhooks → Add endpoint
   - URL: `https://vamy.art/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`
   - Copy the signing secret (`whsec_…`).
3. **Copy live API keys:**
   - Developers → API keys
   - Copy Secret key (`sk_live_…`) and Publishable key (`pk_live_…`).
4. **Update Netlify env vars** on the vamy-website site (Site settings → Environment variables):
   - `STRIPE_SECRET_KEY` → paste `sk_live_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → paste `pk_live_…`
   - `STRIPE_WEBHOOK_SECRET` → paste `whsec_…` from step 2
   - Scope: Production only (keep test keys on deploy previews)
5. **Trigger a Netlify redeploy** (Deploys → Trigger deploy → Clear cache and deploy site) so the new env vars take effect.
6. **Smoke test with a real low-value transaction** (≤€5 if possible, or buy something small yourself):
   - Complete checkout on production.
   - Confirm receipt email arrives from Resend with correct lead time.
   - Confirm artist notification email arrives.
   - Confirm the order row lands in Supabase `orders` with `payment_status = paid`.
   - Confirm the live webhook delivery in Stripe Dashboard shows `200 OK`.
7. **Refund the test purchase** if applicable (Stripe → Payments → … → Refund).

## Rollback
- Revert the three Netlify env vars to the test values (keep test keys in a password manager).
- Redeploy.

## Keys hygiene
- Never commit live keys to git. They belong in Netlify env and 1Password only.
- If a live secret leaks: rotate immediately (Stripe Dashboard → API keys → Roll key), then update Netlify + webhook endpoint signing secret.
```

- [ ] **Step 2: Commit**

```bash
git add docs/runbooks/stripe-live-cutover.md
git commit -m "docs: add Stripe sandbox→live cutover runbook"
```

---

## Task 9 — Sanity regression pass + code review

- [ ] **Step 1:** `pnpm --filter @vamy/website build` — must pass.
- [ ] **Step 2:** `pnpm --filter @vamy/db build` (if applicable) — must pass.
- [ ] **Step 3:** Push branch, open PR, wait for Netlify preview.
- [ ] **Step 4:** Re-run Task 7 Playwright pass on the final preview.
- [ ] **Step 5:** Dispatch `superpowers:code-reviewer` subagent on the full diff (BASE_SHA=origin/main, HEAD_SHA=HEAD). Fix any Critical/Important issues; defer Minor.
- [ ] **Step 6:** Update PR description with a screenshot-backed checklist mapping user observations → commits.
- [ ] **Step 7:** Merge.

---

## Open questions for the user (must answer before T1 starts)

1. **Button label wording (T5):** OK with "Buy — pay €X" in English? Or would you prefer just "Buy now" plus the disclosure above, without the price? The "with price" form is more compliant but a touch more verbose.
2. **Footer width (T4):** Align footer to `max-w-6xl` (matches page body exactly), or leave as `max-w-7xl` (slightly wider, as today)? Default plan: align to `max-w-6xl`.
3. **Inquiry closing line (T6):** Prefer "A personal reply from Maeve — usually within 2 working days." or "Maeve replies personally — usually within 2 working days."? (Or something else entirely.)
4. **Stripe cutover (T8):** Do you want this PR to just ship the runbook, or should I also run the cutover with you on a call? (Runbook is safe to ship independently; cutover itself is your action.)

---
