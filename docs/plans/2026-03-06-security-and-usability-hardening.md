# Security & Usability Hardening Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the critical OWASP vulnerabilities and key usability issues identified in the security audit, in priority order.

**Architecture:** Add a `protectedProcedure` to the shared tRPC layer that checks for an authenticated Supabase user via request context; wire all admin-only mutations to use it. Add the missing Stripe webhook handler for order fulfillment. Sanitize user-supplied HTML in transactional emails. Fix the bid count race condition. Replace `alert()` with inline error UI.

**Tech Stack:** tRPC v11, Drizzle ORM, Supabase SSR, Stripe Node SDK, Resend, Next.js 15 (Pages Router for website, App Router for admin)

---

## Priority Order

| # | Issue | Severity |
|---|-------|----------|
| 1 | All admin mutations are publicly callable — no auth at API level | 🔴 Critical |
| 2 | Stripe webhook missing — fake events can create orders for free | 🔴 Critical |
| 3 | User HTML injected raw into Resend emails | 🟡 Medium |
| 4 | Bid count updated with read-modify-write, not atomic SQL | 🟡 Medium |
| 5 | `alert()` used for checkout errors in ProductSelector | 🟠 Low |

---

## Task 1: Add `userId` to tRPC context

The shared tRPC context (`packages/db/src/trpc/context.ts`) currently only carries `db`. We need to add an optional `userId` so that procedures can inspect who is calling them. The default (public) context sets `userId: null`.

**Files:**
- Modify: `packages/db/src/trpc/context.ts`

**Step 1: Update context type and factory**

Replace the entire file:

```ts
import { db } from "../client";

export async function createContext() {
  return { db, userId: null as string | null };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

**Step 2: Verify TypeScript compiles**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/db tsc --noEmit
```

Expected: no errors (or same errors as before — `ignoreBuildErrors` is on in website, but the package itself should be clean).

**Step 3: Commit**

```bash
git add packages/db/src/trpc/context.ts
git commit -m "feat(trpc): add userId to shared context, default null"
```

---

## Task 2: Add `protectedProcedure` to tRPC

Create a procedure middleware that throws `UNAUTHORIZED` if `ctx.userId` is null. All admin-only mutations will use this instead of `publicProcedure`.

**Files:**
- Modify: `packages/db/src/trpc/index.ts`

**Step 1: Add `protectedProcedure`**

Replace the entire file:

```ts
import { initTRPC, TRPCError } from "@trpc/server";
import { type Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not authenticated" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
```

**Step 2: Verify**

```bash
pnpm --filter @vamy/db tsc --noEmit
```

Expected: no errors.

**Step 3: Commit**

```bash
git add packages/db/src/trpc/index.ts
git commit -m "feat(trpc): add protectedProcedure that requires authenticated userId"
```

---

## Task 3: Admin API route passes Supabase user into context

The admin tRPC endpoint (`apps/admin/app/api/trpc/[trpc]/route.ts`) currently calls `createContext()` which always returns `userId: null`. We need it to read the Supabase session from the request cookies and pass the real `userId` (or `null` if unauthenticated).

**Files:**
- Modify: `apps/admin/app/api/trpc/[trpc]/route.ts`

**Background:** `@supabase/ssr`'s `createServerClient` can parse cookies from a raw `Request` object using `request.headers.get('cookie')`. We do NOT use Next.js `cookies()` here because this is a Route Handler context, not a Server Component — but we can still read from the request.

**Step 1: Rewrite the route handler**

```ts
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { createServerClient } from "@supabase/ssr";
import { appRouter } from "@vamy/db/trpc";
import { db } from "@vamy/db/client";

async function createAdminContext({ req }: { req: Request }) {
  // Parse Supabase session from request cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = req.headers.get("cookie") ?? "";
          return cookieHeader.split(";").flatMap((part) => {
            const [name, ...rest] = part.trim().split("=");
            if (!name) return [];
            return [{ name: name.trim(), value: rest.join("=").trim() }];
          });
        },
        setAll() {
          // Route handler — cookie setting handled by middleware
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  return { db, userId: user?.id ?? null };
}

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createAdminContext({ req }),
  });

export { handler as GET, handler as POST };
```

**Step 2: Build the admin app to check for errors**

```bash
pnpm --filter @vamy/admin build 2>&1 | tail -20
```

Expected: clean build or only pre-existing type errors.

**Step 3: Commit**

```bash
git add apps/admin/app/api/trpc/\[trpc\]/route.ts
git commit -m "feat(admin): pass Supabase user into tRPC context from request cookies"
```

---

## Task 4: Apply `protectedProcedure` to all admin-only routers

Now wire `protectedProcedure` to every mutation (and admin-only query) that should require authentication. Public website routes (`products.listByArtworkSlug`, `auctions.getByArtworkSlug`, `bids.place`, `checkout.createSession`, `inquiries.create`, `newsletter.*`) stay as `publicProcedure`.

**Files to modify:**
- `packages/db/src/trpc/routers/products.ts`
- `packages/db/src/trpc/routers/orders.ts`
- `packages/db/src/trpc/routers/auctions.ts`
- `packages/db/src/trpc/routers/artworks.ts`
- `packages/db/src/trpc/routers/inquiries.ts`

**Step 1: Update products router**

In `packages/db/src/trpc/routers/products.ts`, change the import line:

```ts
import { router, publicProcedure, protectedProcedure } from "../index";
```

Then change these procedures from `publicProcedure` to `protectedProcedure`:
- `listAll` — admin-only (website uses `listByArtworkSlug`)
- `createVariant`
- `updateVariant`
- `updateVariantStock`
- `deleteVariant`
- `updateProduct`
- `deleteProduct`
- `createProduct`

Keep `listByArtworkSlug` as `publicProcedure`.

**Step 2: Update orders router**

In `packages/db/src/trpc/routers/orders.ts`:

```ts
import { router, protectedProcedure } from "../index";
```

Change both `list` and `markShipped` to `protectedProcedure`.

**Step 3: Update auctions router**

In `packages/db/src/trpc/routers/auctions.ts`:

```ts
import { router, publicProcedure, protectedProcedure } from "../index";
```

Keep `getByArtworkSlug` as `publicProcedure` (used by BidWidget on website).
Change `list`, `open`, and `close` to `protectedProcedure`.

**Step 4: Update artworks router**

In `packages/db/src/trpc/routers/artworks.ts`:

```ts
import { router, protectedProcedure } from "../index";
```

Change both `list` and `update` to `protectedProcedure`.

**Step 5: Update inquiries router**

In `packages/db/src/trpc/routers/inquiries.ts`, check what procedures exist. `create` must stay `publicProcedure`. Any `list` or `markHandled` mutations should become `protectedProcedure`.

**Step 6: Smoke-test the admin panel**

With the dev server running:
1. Open an incognito window and try `curl -X POST http://localhost:3001/api/trpc/products.deleteProduct -H "Content-Type: application/json" -d '{"json":{"id":"00000000-0000-0000-0000-000000000000"}}'`
2. Expected: `{"error":{"json":{"message":"Not authenticated","code":-32001,...}}}`

**Step 7: Verify logged-in admin still works**

Log into the admin panel, navigate to Artworks — data should load, edits should save.

**Step 8: Commit**

```bash
git add packages/db/src/trpc/routers/
git commit -m "security: apply protectedProcedure to all admin-only tRPC mutations"
```

---

## Task 5: Stripe webhook — signature verification + order creation

The website has no Stripe webhook handler. Without it: (a) anyone can POST fake payment events; (b) orders are never created in the DB; (c) stock is never decremented.

**Files:**
- Create: `apps/website/src/pages/api/webhooks/stripe.ts`

**Background:** Next.js Pages Router API routes need `bodyParser: false` to get the raw request body, which Stripe requires to verify the webhook signature with `stripe.webhooks.constructEvent`. The handler then processes `checkout.session.completed` events.

**Step 1: Create the webhook handler**

```ts
import type { NextApiRequest, NextApiResponse } from "next";
import Stripe from "stripe";
import { buffer } from "micro";
import { eq, sql } from "drizzle-orm";
import { db } from "@vamy/db/client";
import { orders, productVariants } from "@vamy/db/schema";

export const config = { api: { bodyParser: false } };

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).end("Method not allowed");

  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: "Missing stripe-signature header or webhook secret" });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await buffer(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("Stripe webhook signature verification failed:", msg);
    return res.status(400).json({ error: `Webhook Error: ${msg}` });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const variantId = session.metadata?.variantId;

    if (!variantId) {
      console.error("Webhook: missing variantId in session metadata", session.id);
      return res.status(400).json({ error: "Missing variantId in metadata" });
    }

    const shipping = session.shipping_details?.address;

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        productVariantId: variantId,
        buyerName: session.shipping_details?.name ?? session.customer_details?.name ?? "Unknown",
        buyerEmail: session.customer_details?.email ?? "unknown@unknown.com",
        shippingAddress: shipping
          ? {
              line1: shipping.line1,
              line2: shipping.line2,
              city: shipping.city,
              state: shipping.state,
              postalCode: shipping.postal_code,
              country: shipping.country,
            }
          : {},
        amountPaid: String((session.amount_total ?? 0) / 100),
        stripeSessionId: session.id,
        status: "paid",
      });

      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`stock_quantity - 1`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));
    });

    console.log("Order created for session:", session.id, "variant:", variantId);
  }

  res.json({ received: true });
}
```

**Step 2: Install `micro` (used for raw body parsing in Pages Router)**

```bash
pnpm --filter @vamy/website add micro
pnpm --filter @vamy/website add -D @types/micro
```

**Step 3: Add `STRIPE_WEBHOOK_SECRET` to `.env.local`**

Get the webhook secret from the Stripe dashboard (Developers → Webhooks → your endpoint → Signing secret). Add to `.env.local`:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Step 4: Test with Stripe CLI**

```bash
# In a separate terminal:
stripe listen --forward-to localhost:3000/api/webhooks/stripe

# Trigger a test event:
stripe trigger checkout.session.completed
```

Expected: terminal shows `200 OK`, DB gets a new row in `orders`.

**Step 5: Commit**

```bash
git add apps/website/src/pages/api/webhooks/stripe.ts
git commit -m "feat: add Stripe webhook handler with signature verification and order creation"
```

---

## Task 6: Sanitize user HTML in transactional emails

User-supplied strings are interpolated directly into HTML email templates in three routers. This allows HTML/script injection into emails sent to Maeve and to other bidders.

**Files to modify:**
- `packages/db/src/trpc/routers/bids.ts`
- `packages/db/src/trpc/routers/orders.ts`
- `packages/db/src/trpc/routers/inquiries.ts`

**Step 1: Add a simple escape helper to each router file (or a shared util)**

Create `packages/db/src/utils/escape-html.ts`:

```ts
const HTML_ENTITIES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (c) => HTML_ENTITIES[c] ?? c);
}
```

**Step 2: Wire it into `bids.ts`**

```ts
import { escapeHtml } from "../../utils/escape-html";

// Artist notification:
html: `<p><strong>${escapeHtml(input.bidderName)}</strong> bid €${input.amount}. Total bids: ${auction.bidCount + 1}.</p>`

// Outbid email — no user content in subject/body beyond amount (number, safe)
```

**Step 3: Wire it into `orders.ts`**

```ts
import { escapeHtml } from "../../utils/escape-html";

html: `<p>Hi ${escapeHtml(order.buyerName)}, your order is on its way! Tracking: ${escapeHtml(input.trackingNumber ?? "")}</p>`
```

**Step 4: Wire it into `inquiries.ts`**

Find any email notification in `inquiries.ts` and apply `escapeHtml` to `input.name`, `input.message`, `input.pieceInterest`.

**Step 5: Run existing tests to confirm nothing broke**

```bash
pnpm --filter @vamy/db test
```

**Step 6: Commit**

```bash
git add packages/db/src/utils/escape-html.ts packages/db/src/trpc/routers/
git commit -m "security: escape user HTML in all Resend email templates"
```

---

## Task 7: Fix bid count race condition

`bids.ts` currently does:

```ts
bidCount: auction.bidCount + 1,  // ← read-modify-write, stale under concurrency
```

Under concurrent bids, two requests both read `bidCount = 5`, both write `6`. Replace with a SQL-level atomic increment.

**Files:**
- Modify: `packages/db/src/trpc/routers/bids.ts`

**Step 1: Import `sql` from drizzle-orm**

```ts
import { eq, desc, sql } from "drizzle-orm";
```

**Step 2: Replace the bid count update inside the transaction**

Change:
```ts
await tx
  .update(auctions)
  .set({
    currentBid: String(input.amount),
    bidCount: auction.bidCount + 1,
    updatedAt: new Date(),
  })
  .where(eq(auctions.id, input.auctionId));
```

To:
```ts
await tx
  .update(auctions)
  .set({
    currentBid: String(input.amount),
    bidCount: sql`bid_count + 1`,
    updatedAt: new Date(),
  })
  .where(eq(auctions.id, input.auctionId));
```

**Step 3: Run tests**

```bash
pnpm --filter @vamy/db test
```

**Step 4: Commit**

```bash
git add packages/db/src/trpc/routers/bids.ts
git commit -m "fix: use atomic SQL increment for auction bid count"
```

---

## Task 8: Replace `alert()` with inline error in ProductSelector

`ProductSelector` uses `alert()` on checkout error. This is jarring (blocks the thread, can't be styled, bypasses React state) and violates Nielsen H9.

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

**Step 1: Add error state**

Add `const [checkoutError, setCheckoutError] = useState<string | null>(null);`

**Step 2: Replace `alert()` with state update**

```ts
async function handleBuy() {
    if (!selectedVariantId) return;
    setIsRedirecting(true);
    setCheckoutError(null);
    try {
        const { url } = await createSession.mutateAsync({ variantId: selectedVariantId });
        window.location.href = url;
    } catch (err) {
        setCheckoutError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
        setIsRedirecting(false);
    }
}
```

**Step 3: Render the error inline, above the Buy button**

```tsx
{checkoutError && (
    <p className="text-sm text-red-600 mb-3">{checkoutError}</p>
)}
<button ...>
```

**Step 4: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "fix(ux): replace alert() with inline error state in ProductSelector"
```

---

## Task 9: End-to-end smoke test

**Step 1: Start both dev servers**

```bash
# Terminal 1
pnpm --filter @vamy/website dev

# Terminal 2
pnpm --filter @vamy/admin dev
```

**Step 2: Verify protected routes reject unauthenticated API calls**

```bash
curl -s -X POST "http://localhost:3001/api/trpc/products.deleteProduct" \
  -H "Content-Type: application/json" \
  -d '{"json":{"id":"00000000-0000-0000-0000-000000000000"}}' | jq .
```

Expected: `"code": "UNAUTHORIZED"`

**Step 3: Verify admin panel still works after logging in**

- Log in at `http://localhost:3001/login`
- Navigate Artworks, Orders, Auctions — all data loads
- Edit a variant stock — saves correctly

**Step 4: Verify Stripe webhook (if CLI available)**

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
stripe trigger checkout.session.completed
```

Expected: `200 OK` in stripe CLI, new row in `orders` table.

**Step 5: Verify checkout error renders inline**

Open an artwork page, select a variant, intercept the network request and simulate a failure (or temporarily break the endpoint). Error should appear below the variant list, not as a browser alert.

---

## Notes for future hardening (not in this plan)

- **Rate limiting**: Add Upstash Redis rate limiter to `bids.place` and `inquiries.create` (10 req/min per IP). Requires Upstash account + `@upstash/ratelimit`.
- **Stock reservation**: True atomic oversell prevention requires a DB-level `CHECK (stock_quantity >= 0)` constraint + catching the constraint violation in checkout, or a Redis reservation lock with TTL.
- **Pagination**: Add cursor-based pagination to `orders.list`, `auctions.list` using Drizzle's `limit`/`offset`.
- **Error monitoring**: Add Sentry to both apps (`@sentry/nextjs`).
- **Security headers**: Add CSP, X-Frame-Options, HSTS to `next.config.js` headers array.
