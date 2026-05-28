# Buttondown Newsletter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Buttondown into all consent-bearing touchpoints (footer, inquiry, bid, Stripe checkout) with source tags + double opt-in, and produce a Maeve-facing checklist for one-time account configuration.

**Architecture:** Extract a single `subscribeToButtondown(email, source, locale)` service used by the newsletter router and the Stripe webhook. Push tags + metadata to Buttondown so subscribers are segmentable. Inquiry/bid forms get an unchecked-by-default opt-in checkbox; Stripe Checkout uses its native `consent_collection`. Local `newsletter_subscribers` table remains source of truth.

**Tech Stack:** Next.js 15 (Pages + App Router hybrid), tRPC v11, Drizzle, Buttondown REST API, Stripe Checkout, vitest.

**Spec:** [`docs/superpowers/specs/2026-05-28-buttondown-newsletter-design.md`](../specs/2026-05-28-buttondown-newsletter-design.md)

---

## File map

**Create:**
- `packages/db/src/services/buttondown.ts` — `subscribeToButtondown` service (local DB write + Buttondown API call + dedupe handling).
- `packages/db/src/services/buttondown.test.ts` — unit tests with mocked `fetch`.
- `docs/operations/buttondown-account-setup.md` — Maeve-facing one-time setup checklist.

**Modify:**
- `packages/db/src/trpc/routers/newsletter.ts` — accept `source` + `locale`, delegate to the service, return `alreadySubscribed`.
- `packages/db/src/index.ts` — export `subscribeToButtondown` so the webhook can import it.
- `packages/db/src/trpc/routers/checkout.ts` — add `consent_collection: { promotions: "auto" }`.
- `apps/website/app/api/webhooks/stripe/route.ts` — call `subscribeToButtondown` when `session.consent.promotions === "opt_in"`.
- `apps/website/src/components/sections/Footer/index.tsx` — pass `source: "footer"` + locale; update success messaging.
- `apps/website/src/components/blocks/FormBlock/index.tsx` — render hardcoded opt-in checkbox; subscribe on success if checked.
- `apps/website/src/components/blocks/BidWidget/BidModal.tsx` — render hardcoded opt-in checkbox; subscribe on success if checked.

---

## Task 1: Buttondown service — happy path

**Files:**
- Create: `packages/db/src/services/buttondown.ts`
- Create: `packages/db/src/services/buttondown.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/db/src/services/buttondown.test.ts
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "../client";
import { newsletterSubscribers, contacts } from "../schema";
import { subscribeToButtondown } from "./buttondown";

const emails: string[] = [];

afterAll(async () => {
  if (emails.length) {
    await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.email, emails));
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

beforeEach(() => {
  vi.restoreAllMocks();
  process.env.BUTTONDOWN_API_KEY = "test-key";
});

describe("subscribeToButtondown", () => {
  it("posts email with source tag and metadata", async () => {
    const email = `bd-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "sub_1" }), { status: 201 }),
    );

    const result = await subscribeToButtondown({ email, source: "footer", locale: "en" });

    expect(result).toEqual({ alreadySubscribed: false });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.buttondown.email/v1/subscribers",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Token test-key" }),
      }),
    );
    const body = JSON.parse((fetchMock.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({
      email_address: email,
      tags: ["footer"],
      metadata: { source: "footer", locale: "en" },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter=@vamy/db exec vitest run src/services/buttondown.test.ts`
Expected: FAIL with module-not-found for `./buttondown`.

- [ ] **Step 3: Write minimal implementation**

```ts
// packages/db/src/services/buttondown.ts
import { db } from "../client";
import { newsletterSubscribers } from "../schema";
import { upsertContact } from "./upsert-contact";

export type NewsletterSource = "footer" | "inquiry" | "checkout" | "bid";

export interface SubscribeInput {
  email: string;
  source: NewsletterSource;
  locale?: string;
}

export interface SubscribeResult {
  alreadySubscribed: boolean;
}

export async function subscribeToButtondown(input: SubscribeInput): Promise<SubscribeResult> {
  const { email, source, locale } = input;

  await db
    .insert(newsletterSubscribers)
    .values({ email })
    .onConflictDoNothing();

  try {
    await upsertContact(db, { email });
  } catch (err) {
    console.error("[buttondown] contact upsert failed", err);
  }

  const apiKey = process.env.BUTTONDOWN_API_KEY;
  if (!apiKey) {
    console.warn("[buttondown] BUTTONDOWN_API_KEY not set, skipping remote sync");
    return { alreadySubscribed: false };
  }

  const res = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      tags: [source],
      metadata: { source, ...(locale ? { locale } : {}) },
    }),
  });

  if (res.status === 201 || res.status === 200) {
    return { alreadySubscribed: false };
  }
  if (res.status === 400) {
    const text = await res.text().catch(() => "");
    if (text.toLowerCase().includes("already") || text.includes("email_already_exists")) {
      return { alreadySubscribed: true };
    }
    console.error("[buttondown] sync failed", res.status, text);
    return { alreadySubscribed: false };
  }

  console.error("[buttondown] sync failed", res.status, await res.text().catch(() => ""));
  return { alreadySubscribed: false };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter=@vamy/db exec vitest run src/services/buttondown.test.ts`
Expected: PASS (1 test).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/services/buttondown.ts packages/db/src/services/buttondown.test.ts
git commit -m "feat(db): buttondown subscribe service with tags + metadata"
```

---

## Task 2: Buttondown service — duplicate + failure paths

**Files:**
- Modify: `packages/db/src/services/buttondown.test.ts`

- [ ] **Step 1: Add duplicate-email test**

```ts
// append inside `describe("subscribeToButtondown", ...)` in packages/db/src/services/buttondown.test.ts
it("returns alreadySubscribed when Buttondown rejects as duplicate", async () => {
  const email = `dup-${Date.now()}-${Math.random()}@example.com`;
  emails.push(email);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response('{"code":"email_already_exists"}', { status: 400 }),
  );

  const result = await subscribeToButtondown({ email, source: "footer" });

  expect(result).toEqual({ alreadySubscribed: true });
});

it("does not fail when Buttondown is unreachable; still writes local row", async () => {
  const email = `fail-${Date.now()}-${Math.random()}@example.com`;
  emails.push(email);
  vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

  await expect(subscribeToButtondown({ email, source: "inquiry" })).rejects.toThrow();
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(inArray(newsletterSubscribers.email, [email]));
  expect(row).toBeTruthy();
});

it("returns alreadySubscribed=false when API key is unset", async () => {
  delete process.env.BUTTONDOWN_API_KEY;
  const email = `nokey-${Date.now()}-${Math.random()}@example.com`;
  emails.push(email);
  const result = await subscribeToButtondown({ email, source: "footer" });
  expect(result).toEqual({ alreadySubscribed: false });
});
```

- [ ] **Step 2: Run tests, expect failure on "does not fail when Buttondown is unreachable"**

Run: `pnpm --filter=@vamy/db exec vitest run src/services/buttondown.test.ts`
Expected: 1 FAIL — current code lets the fetch rejection propagate, which is fine for the test as written (it asserts `rejects.toThrow()`). Verify the local row was still written before the throw — if not, the test reveals an ordering bug.

If the row is written before fetch, the test passes. If not, fix the implementation order (DB insert first, then fetch).

- [ ] **Step 3: Harden the service against thrown fetch errors**

Replace the fetch call in `packages/db/src/services/buttondown.ts` with a try/catch so a network failure logs and returns rather than throwing — callers should not need to wrap. Update the third test to match.

```ts
// in subscribeToButtondown, replace the fetch block:
try {
  const res = await fetch("https://api.buttondown.email/v1/subscribers", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email_address: email,
      tags: [source],
      metadata: { source, ...(locale ? { locale } : {}) },
    }),
  });

  if (res.status === 201 || res.status === 200) return { alreadySubscribed: false };
  if (res.status === 400) {
    const text = await res.text().catch(() => "");
    if (text.toLowerCase().includes("already") || text.includes("email_already_exists")) {
      return { alreadySubscribed: true };
    }
    console.error("[buttondown] sync failed", res.status, text);
    return { alreadySubscribed: false };
  }
  console.error("[buttondown] sync failed", res.status, await res.text().catch(() => ""));
  return { alreadySubscribed: false };
} catch (err) {
  console.error("[buttondown] fetch threw", err);
  return { alreadySubscribed: false };
}
```

- [ ] **Step 4: Update the "unreachable" test to match the new contract**

Replace that test's body with:

```ts
it("does not fail when Buttondown is unreachable; still writes local row", async () => {
  const email = `fail-${Date.now()}-${Math.random()}@example.com`;
  emails.push(email);
  vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("network down"));

  const result = await subscribeToButtondown({ email, source: "inquiry" });

  expect(result).toEqual({ alreadySubscribed: false });
  const [row] = await db
    .select()
    .from(newsletterSubscribers)
    .where(inArray(newsletterSubscribers.email, [email]));
  expect(row).toBeTruthy();
});
```

- [ ] **Step 5: Re-run tests**

Run: `pnpm --filter=@vamy/db exec vitest run src/services/buttondown.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/services/buttondown.ts packages/db/src/services/buttondown.test.ts
git commit -m "feat(db): handle buttondown duplicate + unreachable cases"
```

---

## Task 3: Refactor newsletter router to use the service

**Files:**
- Modify: `packages/db/src/trpc/routers/newsletter.ts`
- Modify: `packages/db/src/index.ts` (export the service)

- [ ] **Step 1: Add export in `packages/db/src/index.ts`**

Read the current file first. Append (or extend the existing barrel):

```ts
export { subscribeToButtondown } from "./services/buttondown";
export type { NewsletterSource, SubscribeInput, SubscribeResult } from "./services/buttondown";
```

- [ ] **Step 2: Replace router body**

Overwrite `packages/db/src/trpc/routers/newsletter.ts` with:

```ts
import { z } from "zod";
import { router, publicProcedure } from "../index";
import { subscribeToButtondown } from "../../services/buttondown";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        email: z.string().email().toLowerCase(),
        source: z.enum(["footer", "inquiry", "checkout", "bid"]).default("footer"),
        locale: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { alreadySubscribed } = await subscribeToButtondown(input);
      return { success: true, alreadySubscribed };
    }),
});
```

- [ ] **Step 3: Run the existing contact-sync test that uses `newsletter.subscribe`**

Run: `pnpm --filter=@vamy/db exec vitest run src/trpc/routers/contacts-sync.test.ts`
Expected: PASS (the test calls `subscribe({ email })` which still works thanks to the defaulted `source`).

- [ ] **Step 4: Type-check the package**

Run: `pnpm --filter=@vamy/db exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/trpc/routers/newsletter.ts packages/db/src/index.ts
git commit -m "refactor(db): newsletter router delegates to buttondown service"
```

---

## Task 4: Footer — pass source + locale, refresh UX copy

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx` (the `NewsletterSignup` function around lines 104–148)

- [ ] **Step 1: Update `NewsletterSignup`**

Replace the existing `handleSubmit` and the success block. The full updated function:

```tsx
function NewsletterSignup() {
    const router = useRouter();
    const [email, setEmail] = React.useState('');
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const subscribe = trpc.newsletter.subscribe.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            await subscribe.mutateAsync({
                email,
                source: 'footer',
                locale: router.locale ?? 'en',
            });
            setStatus('success');
            setEmail('');
        } catch {
            setStatus('error');
        }
    }

    return (
        <div>
            <h2 className="uppercase text-base tracking-wide mb-2">Stay in the loop</h2>
            <p className="text-sm mb-4">New works, exhibitions, and studio updates.</p>
            {status === 'success' ? (
                <p className="text-sm text-green-600">Check your inbox to confirm.</p>
            ) : (
                <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 sm:gap-2 max-w-sm">
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 min-w-0 px-0 py-2 text-sm border-b border-current bg-transparent outline-none"
                    />
                    <button
                        type="submit"
                        disabled={subscribe.isPending}
                        className="shrink-0 px-4 py-2 text-sm border border-current transition-opacity hover:opacity-60"
                    >
                        {subscribe.isPending ? '...' : 'Subscribe'}
                    </button>
                </form>
            )}
            {status === 'error' && <p className="text-sm text-red-600 mt-2">Something went wrong.</p>}
        </div>
    );
}
```

- [ ] **Step 2: Add the `useRouter` import**

At the top of `apps/website/src/components/sections/Footer/index.tsx`, add:

```ts
import { useRouter } from 'next/router';
```

(Skip if already imported.)

- [ ] **Step 3: Type-check the website**

Run: `pnpm --filter=@vamy/website exec tsc --noEmit`
Expected: no new errors related to the footer.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx
git commit -m "feat(website): tag footer newsletter signups + double-opt-in copy"
```

---

## Task 5: Inquiry form opt-in checkbox

**Files:**
- Modify: `apps/website/src/components/blocks/FormBlock/index.tsx`

- [ ] **Step 1: Add state + subscribe mutation**

Inside `FormBlock`, after the existing `createInquiry` line, add:

```ts
const subscribeNewsletter = trpc.newsletter.subscribe.useMutation();
const router = useRouter();
const [marketingOptIn, setMarketingOptIn] = React.useState(false);
```

Add `import { useRouter } from 'next/router';` at the top.

- [ ] **Step 2: Trigger subscribe after successful inquiry**

In `handleSubmit`, immediately after `await createInquiry.mutateAsync({...})` resolves successfully, add:

```ts
if (marketingOptIn) {
    void subscribeNewsletter
        .mutateAsync({
            email: String(data.get('email') ?? ''),
            source: 'inquiry',
            locale: router.locale ?? 'en',
        })
        .catch((err) => console.error('[inquiry] newsletter opt-in failed', err));
}
```

This is fire-and-forget — the user sees the inquiry success state regardless.

- [ ] **Step 3: Render the checkbox in the form**

Inside the `<form>`, after the dynamic-fields `<div>` block and before the submit button block, insert:

```tsx
<label className="mt-6 flex items-start gap-3 text-sm cursor-pointer">
    <input
        type="checkbox"
        checked={marketingOptIn}
        onChange={(e) => setMarketingOptIn(e.target.checked)}
        className="mt-1 shrink-0"
    />
    <span>
        Email me about new work and studio updates.{' '}
        <span className="text-gray-500">Unsubscribe anytime. We won&apos;t share your email.</span>
    </span>
</label>
```

- [ ] **Step 4: Build the website to catch type errors**

Run: `pnpm --filter=@vamy/website exec tsc --noEmit`
Expected: no new errors in `FormBlock/index.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/blocks/FormBlock/index.tsx
git commit -m "feat(website): newsletter opt-in checkbox on inquiry form"
```

---

## Task 6: Bid modal opt-in checkbox

**Files:**
- Modify: `apps/website/src/components/blocks/BidWidget/BidModal.tsx`

- [ ] **Step 1: Add state + subscribe mutation**

Near the top of the component, after the existing `placeBid` line, add:

```ts
const subscribeNewsletter = trpc.newsletter.subscribe.useMutation();
const router = useRouter();
const [marketingOptIn, setMarketingOptIn] = useState(false);
```

Add at top of file:

```ts
import { useRouter } from 'next/router';
```

- [ ] **Step 2: Trigger subscribe after successful bid**

Inside `handleSubmit`, immediately after `await placeBid.mutateAsync({...})`, before `onSuccess()`:

```ts
if (marketingOptIn) {
    void subscribeNewsletter
        .mutateAsync({
            email,
            source: 'bid',
            locale: router.locale ?? 'en',
        })
        .catch((err) => console.error('[bid] newsletter opt-in failed', err));
}
```

- [ ] **Step 3: Render the checkbox**

Insert between the `<input type="number" ... />` and `{error && ...}` lines:

```tsx
<label className="flex items-start gap-3 text-sm cursor-pointer">
    <input
        type="checkbox"
        checked={marketingOptIn}
        onChange={(e) => setMarketingOptIn(e.target.checked)}
        className="mt-1 shrink-0"
    />
    <span>
        Email me about new work and studio updates.{' '}
        <span className="text-gray-500">Unsubscribe anytime.</span>
    </span>
</label>
```

- [ ] **Step 4: Type-check**

Run: `pnpm --filter=@vamy/website exec tsc --noEmit`
Expected: no new errors in `BidModal.tsx`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/blocks/BidWidget/BidModal.tsx
git commit -m "feat(website): newsletter opt-in checkbox on bid modal"
```

---

## Task 7: Stripe checkout — native consent collection

**Files:**
- Modify: `packages/db/src/trpc/routers/checkout.ts` (around line 77, inside `sessionParams`)

- [ ] **Step 1: Add `consent_collection` to `sessionParams`**

In `packages/db/src/trpc/routers/checkout.ts`, change the `sessionParams` object to include the consent field. After the `metadata: { variantId: variant.id },` line, add:

```ts
consent_collection: { promotions: "auto" },
```

So the params block reads:

```ts
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: "payment",
  line_items: [
    /* unchanged */
  ],
  shipping_address_collection: {
    allowed_countries: ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"],
  },
  metadata: { variantId: variant.id },
  consent_collection: { promotions: "auto" },
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
};
```

- [ ] **Step 2: Type-check the package**

Run: `pnpm --filter=@vamy/db exec tsc --noEmit`
Expected: no new errors. The Stripe Node types accept `consent_collection.promotions: "auto" | "none"`.

- [ ] **Step 3: Manual smoke check (write down for later, do not run now)**

Note in `docs/operations/buttondown-account-setup.md` (created in Task 9): after deploy, run a Stripe test checkout and confirm the marketing-consent checkbox renders on the hosted page.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/trpc/routers/checkout.ts
git commit -m "feat(checkout): collect Stripe marketing consent on hosted page"
```

---

## Task 8: Stripe webhook — subscribe on opt-in

**Files:**
- Modify: `apps/website/app/api/webhooks/stripe/route.ts`

- [ ] **Step 1: Import the service**

At line 3, extend the `@vamy/db` import to include `subscribeToButtondown`:

```ts
import { db, orders, productVariants, escapeHtml, renderOrderReceiptHtml, notifyWaitlistForVariant, detectRestockTransition, upsertContact, subscribeToButtondown } from "@vamy/db";
```

- [ ] **Step 2: Call the service after a successful order insert**

In the `if (event.type === "checkout.session.completed")` branch, after `if (!inserted) return new Response(null, { status: 200 });` and before the receipt-email try/catch, add:

```ts
if (session.consent?.promotions === "opt_in" && customer?.email) {
  try {
    await subscribeToButtondown({
      email: customer.email,
      source: "checkout",
      locale: session.locale ?? "en",
    });
  } catch (err) {
    console.error("[stripe-webhook] buttondown subscribe failed", { orderId: inserted.id, err });
  }
}
```

- [ ] **Step 3: Type-check**

Run: `pnpm --filter=@vamy/website exec tsc --noEmit`
Expected: no new errors. `session.consent.promotions` is typed by Stripe as `"opt_in" | "opt_out" | null`. `session.locale` is `string | null | undefined`.

- [ ] **Step 4: Run all package tests to make sure nothing regressed**

Run: `pnpm -r test`
Expected: all existing tests still pass; the new buttondown service tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/website/app/api/webhooks/stripe/route.ts
git commit -m "feat(webhook): subscribe buyers to newsletter on Stripe opt-in"
```

---

## Task 9: Maeve-facing Buttondown account checklist

**Files:**
- Create: `docs/operations/buttondown-account-setup.md`

- [ ] **Step 1: Write the checklist doc**

```markdown
# Buttondown — One-Time Account Setup

This is what Maeve does in the Buttondown dashboard to make the newsletter
trustworthy, on-brand, and GDPR-clean. Do this once; the code side is wired.

## 1. Sender identity
- **Settings → Sending → From name:** `Maeve · vamy`
- **From email:** `maeve@vamy.art`
- **Reply-to:** `maeve@vamy.art`

## 2. Domain authentication (DNS)
Buttondown sends from its own infrastructure, not Resend. You need separate DKIM/SPF records on `vamy.art`.

- Go to **Settings → Sending → Custom domain** in Buttondown.
- Copy the DKIM CNAME records they show.
- In your DNS provider (where vamy.art is registered), add those CNAME records exactly as shown.
- Wait 10–30 minutes, then click "Verify" in Buttondown.
- Add the SPF `include:` they specify to your existing SPF record (don't replace it — Resend's is also there).

## 3. Enable double opt-in
- **Settings → Subscribers → Require confirmation:** ON.
- This is non-negotiable for EU subscribers.

## 4. Confirmation email
- **Settings → Email templates → Confirmation email**
- Subject: `Confirm you'd like to hear from vamy`
- Body (short, signed by you). Buttondown auto-inserts the confirmation link.

## 5. Welcome email
- **Automations → Welcome email:** ON.
- Send: immediately after confirmation.
- Write a warm 3–4 sentence hello: who you are, what subscribers will get (new work + studio notes, ~1–2/month), gratitude.

## 6. Branding
- **Settings → Branding**
- Upload the vamy logo (square favicon SVG works).
- Primary color: match site (black or your accent).
- Link color: same.

## 7. Tags reference (set up by the code, FYI)
Subscribers arrive with one of these tags so you can segment broadcasts:

- `footer` — signed up from the website footer
- `inquiry` — opted in on the "Get a piece" inquiry form
- `bid` — opted in when placing a bid
- `checkout` — opted in on the Stripe checkout page after a purchase

To send a drop alert to buyers only: **New email → Filter → Tag is `checkout`**.

## 8. Smoke checks after the code deploys
- [ ] Submit your own email via the footer → confirm you get the confirmation email → click it → confirm you get the welcome email.
- [ ] Make a test inquiry with the checkbox ticked → confirmation arrives.
- [ ] Place a Stripe **test** checkout (sandbox keys) and tick the marketing-consent box → confirmation arrives.
- [ ] In Buttondown, all three subscribers should appear with the correct tag.

## 9. Plan check
- Check your current Buttondown plan covers expected list size.
- The free tier caps at 100 subscribers — upgrade before you cross it.
```

- [ ] **Step 2: Commit**

```bash
git add docs/operations/buttondown-account-setup.md
git commit -m "docs: buttondown one-time account setup checklist"
```

---

## Final verification

- [ ] **Step 1: Run all tests**

Run: `pnpm -r test`
Expected: all green.

- [ ] **Step 2: Type-check everything**

Run: `pnpm -r exec tsc --noEmit` (or equivalent per-package commands if no root script).
Expected: no new errors. Pre-existing errors in `apps/admin/app/(dashboard)/artworks/page.tsx` are tech debt and out of scope.

- [ ] **Step 3: Build the website**

Run: `pnpm --filter=@vamy/website build`
Expected: build succeeds.

- [ ] **Step 4: Open a PR**

```bash
git push -u origin feat/buttondown-setup
gh pr create --base main --title "feat: buttondown newsletter integration (tags, opt-in surfaces, Stripe consent)" --body "Implements docs/superpowers/specs/2026-05-28-buttondown-newsletter-design.md.

- Extracted Buttondown sync into a shared service (\`subscribeToButtondown\`) used by the newsletter router and the Stripe webhook.
- Tags + metadata sent to Buttondown so subscribers are segmentable (footer / inquiry / bid / checkout).
- Inquiry form and bid modal got an unchecked-by-default opt-in checkbox.
- Stripe Checkout uses native \`consent_collection.promotions: 'auto'\`; webhook subscribes buyers server-side when they opt in.
- Footer copy switched to 'Check your inbox to confirm.' for double opt-in.
- Added Maeve-facing setup checklist at \`docs/operations/buttondown-account-setup.md\`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```
