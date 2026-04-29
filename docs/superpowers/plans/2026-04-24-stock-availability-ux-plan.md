# Stock & Availability UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stock state accurate and trustworthy on the website, prevent sold-out pieces from reaching Stripe, and add an automated variant-level waitlist that notifies subscribers once per cycle when stock returns.

**Architecture:** New `variant_waitlist` table + public tRPC `waitlist.subscribe`. Admin variant-update mutations detect out→in transitions and fire Resend emails in-flight. Client uses tRPC `refetchOnWindowFocus` for freshness and a typed `PRECONDITION_FAILED` / `OUT_OF_STOCK` error for the pre-payment guard.

**Tech Stack:** Drizzle ORM (Postgres), tRPC v11, Resend, Next.js 15 (Pages Router for website, App Router for admin), Zod, Vitest.

Spec: [`docs/superpowers/specs/2026-04-24-stock-availability-ux-design.md`](../specs/2026-04-24-stock-availability-ux-design.md)

---

## File Map

**Create:**
- `packages/db/src/emails/back-in-stock.ts` — email template
- `packages/db/src/emails/__tests__/back-in-stock.test.ts` — template tests
- `packages/db/src/trpc/routers/waitlist.ts` — public `subscribe` + admin `countForVariant`, `listForVariant`
- `packages/db/src/trpc/routers/waitlist.test.ts` — router tests
- `packages/db/src/services/restock-notify.ts` — shared helper used by updateVariant/updateVariantStock
- `packages/db/src/services/restock-notify.test.ts` — helper tests
- `packages/db/drizzle/<next-n>_variant_waitlist.sql` — migration (generated via `pnpm --filter @vamy/db db:generate`)

**Modify:**
- `packages/db/src/schema.ts` — add `variantWaitlist` table + relations
- `packages/db/src/trpc/root.ts` — register `waitlist` router
- `packages/db/src/trpc/routers/checkout.ts` — typed `TRPCError`
- `packages/db/src/trpc/routers/products.ts` — transition detection in `updateVariant` + `updateVariantStock`
- `apps/website/src/components/blocks/ProductSelector/index.tsx` — freshness opts + OUT_OF_STOCK handling + notify-me form
- `apps/admin/app/(dashboard)/artworks/page.tsx` — waitlist count badge + restock toast

---

## Task 1: Waitlist schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts`
- Generate: `packages/db/drizzle/<n>_variant_waitlist.sql`

- [ ] **Step 1: Add table definition to schema.ts**

Add near the `productVariants` section (after line 71), before the `orders` table:

```ts
// ─── Variant Waitlist (back-in-stock notifications) ──────────────────────────
export const variantWaitlist = pgTable(
  "variant_waitlist",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productVariantId: uuid("product_variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => ({
    uniqueEmailVariant: unique("variant_waitlist_email_variant_unique").on(
      t.email,
      t.productVariantId,
    ),
  }),
);
```

Add `unique` to the imports at the top:

```ts
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  inet,
  unique,
} from "drizzle-orm/pg-core";
```

Append relations after the existing `productVariantsRelations`:

```ts
export const variantWaitlistRelations = relations(variantWaitlist, ({ one }) => ({
  productVariant: one(productVariants, {
    fields: [variantWaitlist.productVariantId],
    references: [productVariants.id],
  }),
}));
```

- [ ] **Step 2: Generate the migration**

Run: `cd packages/db && pnpm db:generate`
Expected: new SQL file in `packages/db/drizzle/` creating `variant_waitlist` with the unique constraint.

- [ ] **Step 3: Apply the migration locally**

Run: `cd packages/db && pnpm db:migrate`
Expected: success, `variant_waitlist` table exists in the local Supabase DB.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schema.ts packages/db/drizzle/
git commit -m "feat(db): add variant_waitlist table for back-in-stock notifications"
```

---

## Task 2: Back-in-stock email template

**Files:**
- Create: `packages/db/src/emails/back-in-stock.ts`
- Create: `packages/db/src/emails/__tests__/back-in-stock.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/emails/__tests__/back-in-stock.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { renderBackInStockHtml } from "../back-in-stock";

describe("renderBackInStockHtml", () => {
  it("includes piece name, variant name, and deep link", () => {
    const html = renderBackInStockHtml({
      pieceName: "Blue Harbour",
      variantName: "Original, 40×50cm",
      pieceUrl: "https://vamy.art/get-a-piece/blue-harbour/",
      termsUrl: "https://vamy.art/terms",
      privacyUrl: "https://vamy.art/privacy",
    });
    expect(html).toContain("Blue Harbour");
    expect(html).toContain("Original, 40×50cm");
    expect(html).toContain("https://vamy.art/get-a-piece/blue-harbour/");
    expect(html).toContain("one-time");
  });

  it("escapes untrusted input", () => {
    const html = renderBackInStockHtml({
      pieceName: "<script>alert(1)</script>",
      variantName: "A",
      pieceUrl: "https://vamy.art/x/",
      termsUrl: "https://vamy.art/terms",
      privacyUrl: "https://vamy.art/privacy",
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm vitest run src/emails/__tests__/back-in-stock.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Create template file**

Create `packages/db/src/emails/back-in-stock.ts`:

```ts
import { escapeHtml } from "../utils/escape-html";

export type BackInStockData = {
  pieceName: string;
  variantName: string;
  pieceUrl: string;
  termsUrl: string;
  privacyUrl: string;
};

export function renderBackInStockHtml(d: BackInStockData): string {
  return `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#fafafa;font-family:Georgia,serif;color:#222;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;padding:40px;">
<tr><td>
<h1 style="font-weight:300;font-size:22px;margin:0 0 8px;letter-spacing:.02em;">Maeve Vamy</h1>
<p style="font-size:12px;color:#888;margin:0 0 32px;">Back in stock</p>

<p style="font-size:16px;line-height:1.5;margin:0 0 20px;">The piece you asked about is available again.</p>

<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #eee;border-bottom:1px solid #eee;padding:16px 0;margin-bottom:8px;">
<tr><td style="padding:8px 0;font-size:13px;color:#666;width:40%;">Piece</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.pieceName)}</td></tr>
<tr><td style="padding:8px 0;font-size:13px;color:#666;">Variant</td><td style="padding:8px 0;font-size:13px;">${escapeHtml(d.variantName)}</td></tr>
</table>

<table cellpadding="0" cellspacing="0" style="margin:24px 0;"><tr><td>
<a href="${escapeHtml(d.pieceUrl)}" style="display:inline-block;background:#000;color:#fff;text-decoration:none;padding:12px 24px;font-size:13px;letter-spacing:.04em;">View the piece</a>
</td></tr></table>

<p style="font-size:13px;line-height:1.6;color:#444;margin:16px 0 8px;">Pieces tend to move quickly. This is a one-time notification — if you'd like to be told next time, sign up again after purchase.</p>
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

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/db && pnpm vitest run src/emails/__tests__/back-in-stock.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/emails/back-in-stock.ts packages/db/src/emails/__tests__/back-in-stock.test.ts
git commit -m "feat(db): add back-in-stock email template"
```

---

## Task 3: Restock-notify service (shared helper)

**Files:**
- Create: `packages/db/src/services/restock-notify.ts`
- Create: `packages/db/src/services/restock-notify.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/services/restock-notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectRestockTransition } from "./restock-notify";

describe("detectRestockTransition", () => {
  it("returns true only when moving from out-of-stock to in-stock", () => {
    expect(detectRestockTransition(
      { available: false, stockQuantity: 0 },
      { available: true,  stockQuantity: 1 },
    )).toBe(true);

    expect(detectRestockTransition(
      { available: true,  stockQuantity: 0 },
      { available: true,  stockQuantity: 5 },
    )).toBe(true);

    // already in stock
    expect(detectRestockTransition(
      { available: true,  stockQuantity: 3 },
      { available: true,  stockQuantity: 5 },
    )).toBe(false);

    // going out of stock
    expect(detectRestockTransition(
      { available: true,  stockQuantity: 3 },
      { available: true,  stockQuantity: 0 },
    )).toBe(false);

    // still out of stock
    expect(detectRestockTransition(
      { available: false, stockQuantity: 0 },
      { available: true,  stockQuantity: 0 },
    )).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm vitest run src/services/restock-notify.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helper**

Create `packages/db/src/services/restock-notify.ts`:

```ts
import { eq, and, isNull } from "drizzle-orm";
import { Resend } from "resend";
import { db } from "../client";
import { productVariants, variantWaitlist } from "../schema";
import { renderBackInStockHtml } from "../emails/back-in-stock";

export type VariantStockState = {
  available: boolean;
  stockQuantity: number;
};

export function detectRestockTransition(
  before: VariantStockState,
  after: VariantStockState,
): boolean {
  const wasOut = !before.available || before.stockQuantity <= 0;
  const isIn = after.available && after.stockQuantity >= 1;
  return wasOut && isIn;
}

export type RestockNotifyResult = {
  notified: number;
  failed: number;
};

export async function notifyWaitlistForVariant(
  variantId: string,
): Promise<RestockNotifyResult> {
  const resendKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vamy.art";
  if (!resendKey || !fromEmail) {
    console.error("[restock-notify] missing RESEND_API_KEY or RESEND_FROM_EMAIL; skipping");
    return { notified: 0, failed: 0 };
  }

  const variant = await db.query.productVariants.findFirst({
    where: eq(productVariants.id, variantId),
    with: { product: { with: { artwork: true } } },
  });
  if (!variant) return { notified: 0, failed: 0 };

  const rows = await db.query.variantWaitlist.findMany({
    where: and(
      eq(variantWaitlist.productVariantId, variantId),
      isNull(variantWaitlist.notifiedAt),
    ),
  });
  if (rows.length === 0) return { notified: 0, failed: 0 };

  const resend = new Resend(resendKey);
  const pieceName = variant.product?.artwork?.title ?? variant.product?.name ?? "Your piece";
  const slug = variant.product?.artwork?.slug;
  const pieceUrl = slug
    ? `${siteUrl}/get-a-piece/${slug}/`
    : `${siteUrl}/get-a-piece/`;
  const html = renderBackInStockHtml({
    pieceName,
    variantName: variant.name,
    pieceUrl,
    termsUrl: `${siteUrl}/terms`,
    privacyUrl: `${siteUrl}/privacy`,
  });

  let notified = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      await resend.emails.send({
        from: fromEmail,
        to: row.email,
        replyTo: "maeve@vamy.art",
        subject: "The piece you asked about is available again",
        html,
      });
      await db
        .update(variantWaitlist)
        .set({ notifiedAt: new Date() })
        .where(eq(variantWaitlist.id, row.id));
      notified += 1;
    } catch (err) {
      failed += 1;
      console.error("[restock-notify] send failed", { variantId, waitlistRowId: row.id, err });
    }
  }
  return { notified, failed };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/db && pnpm vitest run src/services/restock-notify.test.ts`
Expected: PASS (1 test, 5 assertions).

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/services/restock-notify.ts packages/db/src/services/restock-notify.test.ts
git commit -m "feat(db): add restock-notify helper with transition detection"
```

---

## Task 4: Waitlist tRPC router

**Files:**
- Create: `packages/db/src/trpc/routers/waitlist.ts`
- Create: `packages/db/src/trpc/routers/waitlist.test.ts`
- Modify: `packages/db/src/trpc/root.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/trpc/routers/waitlist.test.ts`:

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { eq, and } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { variantWaitlist, productVariants, products, artworks } from "../../schema";

async function seedVariant() {
  const [aw] = await db.insert(artworks).values({ slug: `wl-${Date.now()}`, title: "T" }).returning();
  const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
  const [v] = await db
    .insert(productVariants)
    .values({ productId: p.id, name: "V", price: "10", stockQuantity: 0, available: true })
    .returning();
  return v;
}

describe("waitlist.subscribe", () => {
  it("creates a new row for a new email/variant pair", async () => {
    const v = await seedVariant();
    const caller = createCaller({ userId: null });
    const res = await caller.waitlist.subscribe({ variantId: v.id, email: "a@example.com" });
    expect(res.success).toBe(true);

    const rows = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "a@example.com")),
    });
    expect(rows.length).toBe(1);
    expect(rows[0].notifiedAt).toBeNull();
  });

  it("is idempotent on duplicate unnotified subscription", async () => {
    const v = await seedVariant();
    const caller = createCaller({ userId: null });
    await caller.waitlist.subscribe({ variantId: v.id, email: "b@example.com" });
    await caller.waitlist.subscribe({ variantId: v.id, email: "b@example.com" });
    const rows = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "b@example.com")),
    });
    expect(rows.length).toBe(1);
  });

  it("resets notifiedAt on re-subscribe if previously notified", async () => {
    const v = await seedVariant();
    await db.insert(variantWaitlist).values({
      productVariantId: v.id,
      email: "c@example.com",
      notifiedAt: new Date(),
    });
    const caller = createCaller({ userId: null });
    await caller.waitlist.subscribe({ variantId: v.id, email: "c@example.com" });
    const [row] = await db.query.variantWaitlist.findMany({
      where: and(eq(variantWaitlist.productVariantId, v.id), eq(variantWaitlist.email, "c@example.com")),
    });
    expect(row.notifiedAt).toBeNull();
  });

  it("rejects invalid email", async () => {
    const v = await seedVariant();
    const caller = createCaller({ userId: null });
    await expect(
      caller.waitlist.subscribe({ variantId: v.id, email: "not-an-email" }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/waitlist.test.ts`
Expected: FAIL — router not found on caller.

- [ ] **Step 3: Create the router**

Create `packages/db/src/trpc/routers/waitlist.ts`:

```ts
import { z } from "zod";
import { eq, and, isNull } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { variantWaitlist, productVariants } from "../../schema";

export const waitlistRouter = router({
  subscribe: publicProcedure
    .input(
      z.object({
        variantId: z.string().uuid(),
        email: z.string().email().toLowerCase(),
      }),
    )
    .mutation(async ({ input }) => {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.variantId),
      });
      if (!variant) return { success: true }; // do not leak existence

      // Upsert: insert or, on conflict, clear notifiedAt so a future restock notifies again.
      await db
        .insert(variantWaitlist)
        .values({ productVariantId: input.variantId, email: input.email })
        .onConflictDoUpdate({
          target: [variantWaitlist.email, variantWaitlist.productVariantId],
          set: { notifiedAt: null },
        });
      return { success: true };
    }),

  countForVariant: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rows = await db.query.variantWaitlist.findMany({
        where: and(
          eq(variantWaitlist.productVariantId, input.variantId),
          isNull(variantWaitlist.notifiedAt),
        ),
        columns: { id: true },
      });
      return { count: rows.length };
    }),

  listForVariant: protectedProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.variantWaitlist.findMany({
        where: eq(variantWaitlist.productVariantId, input.variantId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      });
    }),
});
```

- [ ] **Step 4: Register router in root**

Modify `packages/db/src/trpc/root.ts`:

```ts
import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";
import { auctionsRouter } from "./routers/auctions";
import { bidsRouter } from "./routers/bids";
import { productsRouter } from "./routers/products";
import { checkoutRouter } from "./routers/checkout";
import { ordersRouter } from "./routers/orders";
import { artworksRouter } from "./routers/artworks";
import { shippingMethodsRouter } from "./routers/shippingMethods";
import { bannersRouter } from "./routers/banners";
import { artworkImagesRouter } from "./routers/artworkImages";
import { waitlistRouter } from "./routers/waitlist";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
  products: productsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
  artworks: artworksRouter,
  shippingMethods: shippingMethodsRouter,
  banners: bannersRouter,
  artworkImages: artworkImagesRouter,
  waitlist: waitlistRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/waitlist.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add packages/db/src/trpc/routers/waitlist.ts packages/db/src/trpc/routers/waitlist.test.ts packages/db/src/trpc/root.ts
git commit -m "feat(db): add waitlist.subscribe/countForVariant/listForVariant tRPC router"
```

---

## Task 5: Typed OUT_OF_STOCK error in checkout.createSession

**Files:**
- Modify: `packages/db/src/trpc/routers/checkout.ts`

- [ ] **Step 1: Write the failing test (extend checkout test if present, else create)**

Create/append `packages/db/src/trpc/routers/checkout.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { TRPCError } from "@trpc/server";
import { createCaller } from "../root";
import { db } from "../../client";
import { productVariants, products, artworks } from "../../schema";

describe("checkout.createSession", () => {
  it("throws PRECONDITION_FAILED with message OUT_OF_STOCK when variant sold out", async () => {
    const [aw] = await db.insert(artworks).values({ slug: `co-${Date.now()}`, title: "T" }).returning();
    const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
    const [v] = await db
      .insert(productVariants)
      .values({ productId: p.id, name: "V", price: "10", stockQuantity: 0, available: true })
      .returning();

    const caller = createCaller({ userId: null });
    try {
      await caller.checkout.createSession({ variantId: v.id });
      throw new Error("expected throw");
    } catch (err) {
      expect(err).toBeInstanceOf(TRPCError);
      expect((err as TRPCError).code).toBe("PRECONDITION_FAILED");
      expect((err as TRPCError).message).toBe("OUT_OF_STOCK");
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/checkout.test.ts`
Expected: FAIL — thrown error is not a TRPCError (generic `Error` thrown by current code).

- [ ] **Step 3: Update checkout.ts**

Modify `packages/db/src/trpc/routers/checkout.ts` — replace lines 1 and 25–28:

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { TRPCError } from "@trpc/server";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { productVariants, shippingMethods } from "../../schema";
```

```ts
      if (!variant) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });
      }
      if (!variant.available || variant.stockQuantity <= 0) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "OUT_OF_STOCK" });
      }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/checkout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/trpc/routers/checkout.ts packages/db/src/trpc/routers/checkout.test.ts
git commit -m "feat(checkout): throw typed OUT_OF_STOCK TRPCError so client can branch UI"
```

---

## Task 6: Wire restock-notify into admin variant mutations

**Files:**
- Modify: `packages/db/src/trpc/routers/products.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/db/src/trpc/routers/products.test.ts` (create if missing):

```ts
import { describe, it, expect, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { productVariants, products, artworks, variantWaitlist } from "../../schema";
import * as restockNotify from "../../services/restock-notify";

describe("products.updateVariant restock trigger", () => {
  it("calls notifyWaitlistForVariant when stock transitions 0 → 1", async () => {
    const spy = vi.spyOn(restockNotify, "notifyWaitlistForVariant")
      .mockResolvedValue({ notified: 0, failed: 0 });

    const [aw] = await db.insert(artworks).values({ slug: `up-${Date.now()}`, title: "T" }).returning();
    const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
    const [v] = await db
      .insert(productVariants)
      .values({ productId: p.id, name: "V", price: "10", stockQuantity: 0, available: true })
      .returning();

    const caller = createCaller({ userId: "admin" });
    const res = await caller.products.updateVariant({
      id: v.id,
      name: v.name,
      price: Number(v.price),
      stockQuantity: 3,
      available: true,
    });

    expect(spy).toHaveBeenCalledWith(v.id);
    expect(res.notified).toBe(0);
    spy.mockRestore();
  });

  it("does not call notifyWaitlistForVariant when stock stays in stock", async () => {
    const spy = vi.spyOn(restockNotify, "notifyWaitlistForVariant")
      .mockResolvedValue({ notified: 0, failed: 0 });

    const [aw] = await db.insert(artworks).values({ slug: `up2-${Date.now()}`, title: "T" }).returning();
    const [p] = await db.insert(products).values({ artworkId: aw.id, productType: "print", name: "P" }).returning();
    const [v] = await db
      .insert(productVariants)
      .values({ productId: p.id, name: "V", price: "10", stockQuantity: 5, available: true })
      .returning();

    const caller = createCaller({ userId: "admin" });
    await caller.products.updateVariant({
      id: v.id,
      name: v.name,
      price: Number(v.price),
      stockQuantity: 10,
      available: true,
    });

    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/products.test.ts`
Expected: FAIL — `notifyWaitlistForVariant` not called; response has no `notified`/`failed` fields.

- [ ] **Step 3: Update products.ts — import helpers and wrap updateVariant/updateVariantStock**

Modify `packages/db/src/trpc/routers/products.ts` — add to imports at the top:

```ts
import { detectRestockTransition, notifyWaitlistForVariant } from "../../services/restock-notify";
```

Replace the `updateVariantStock` mutation body with:

```ts
  updateVariantStock: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.id),
        columns: { available: true, stockQuantity: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });

      await db
        .update(productVariants)
        .set({
          stockQuantity: input.stockQuantity,
          ...(input.available !== undefined && { available: input.available }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id));

      const after = {
        available: input.available ?? before.available,
        stockQuantity: input.stockQuantity,
      };
      let notified = 0;
      let failed = 0;
      if (detectRestockTransition(before, after)) {
        ({ notified, failed } = await notifyWaitlistForVariant(input.id));
      }
      return { success: true, notified, failed };
    }),
```

Replace the `updateVariant` mutation body with:

```ts
  updateVariant: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean(),
        attributes: z.record(z.string(), z.unknown()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const before = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.id),
        columns: { available: true, stockQuantity: true },
      });
      if (!before) throw new TRPCError({ code: "NOT_FOUND", message: "Variant not found" });

      const [v] = await db
        .update(productVariants)
        .set({
          name: input.name,
          price: String(input.price),
          stockQuantity: input.stockQuantity,
          available: input.available,
          ...(input.attributes !== undefined && { attributes: input.attributes }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id))
        .returning();

      const after = { available: input.available, stockQuantity: input.stockQuantity };
      let notified = 0;
      let failed = 0;
      if (detectRestockTransition(before, after)) {
        ({ notified, failed } = await notifyWaitlistForVariant(input.id));
      }
      return { ...v, notified, failed };
    }),
```

(Ensure `TRPCError` is already imported — it is on line 2 of the current file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/db && pnpm vitest run src/trpc/routers/products.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/trpc/routers/products.ts packages/db/src/trpc/routers/products.test.ts
git commit -m "feat(products): fire restock-notify on out→in stock transitions in admin mutations"
```

---

## Task 7: Website — freshness + OUT_OF_STOCK handling + notify-me form

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

- [ ] **Step 1: Update query options for freshness**

In `ProductSelector/index.tsx`, replace line 21 with:

```tsx
    const productsQuery = trpc.products.listByArtworkSlug.useQuery(
        { slug: artworkSlug },
        {
            retry: false,
            staleTime: 10_000,
            refetchOnWindowFocus: true,
            refetchOnMount: true,
        },
    );
```

- [ ] **Step 2: Add notify-me state and mutation**

Just after the existing `useState` declarations at the top of the component (lines 5–8), add:

```tsx
    const [notifyForVariantId, setNotifyForVariantId] = useState<string | null>(null);
    const [notifyEmail, setNotifyEmail] = useState('');
    const [notifySubmitted, setNotifySubmitted] = useState<string | null>(null); // variantId once submitted
    const waitlistSubscribe = trpc.waitlist.subscribe.useMutation();
```

- [ ] **Step 3: Replace `handleBuy` with typed-error handling**

Replace the existing `async function handleBuy()` (lines 73–84) with:

```tsx
    async function handleBuy() {
        if (!selectedVariantId) return;
        setIsRedirecting(true);
        setCheckoutError(null);
        try {
            const { url } = await createSession.mutateAsync({ variantId: selectedVariantId });
            window.location.href = url;
        } catch (err) {
            const code = (err as { data?: { code?: string } })?.data?.code;
            const message = err instanceof Error ? err.message : '';
            if (code === 'PRECONDITION_FAILED' && message === 'OUT_OF_STOCK') {
                await productsQuery.refetch();
                setNotifyForVariantId(selectedVariantId);
                setCheckoutError('This piece just sold. Leave your email below and we’ll notify you once, when it’s available again.');
            } else {
                setCheckoutError(message || 'Something went wrong. Please try again.');
            }
            setIsRedirecting(false);
        }
    }

    async function handleNotifySubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!notifyForVariantId || !notifyEmail) return;
        try {
            await waitlistSubscribe.mutateAsync({ variantId: notifyForVariantId, email: notifyEmail });
            setNotifySubmitted(notifyForVariantId);
            setNotifyEmail('');
        } catch {
            // surfaced via waitlistSubscribe.error below
        }
    }
```

Add `import type { FormEvent } from 'react';` at the top if needed, or use `React.FormEvent` inline as above (already available via the default React import).

- [ ] **Step 4: Add notify-me UI inline**

Replace the variant-row block (lines 89–116) so out-of-stock rows can expose a notify-me form. Replace that `<div className="space-y-2 mb-6">...</div>` block with:

```tsx
            <div className="space-y-2 mb-6">
                {variants.map(v => {
                    const isOut = v.stockQuantity <= 0;
                    const showNotify = isOut && notifyForVariantId === v.id;
                    const submitted = notifySubmitted === v.id;
                    return (
                        <div key={v.id}>
                            <label
                                className={`flex items-center justify-between p-3 border transition-colors ${
                                    isOut
                                        ? 'border-neutral opacity-70 cursor-default'
                                        : selectedVariantId === v.id
                                            ? 'border-black bg-gray-50 cursor-pointer'
                                            : 'border-neutral hover:border-dark cursor-pointer'
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    <input
                                        type="radio"
                                        name="variant"
                                        value={v.id}
                                        disabled={isOut}
                                        checked={selectedVariantId === v.id}
                                        onChange={() => { setSelectedVariantId(v.id); setCheckoutError(null); }}
                                        className="sr-only"
                                    />
                                    <div>
                                        <p className="text-sm font-medium">{v.name}</p>
                                    </div>
                                </div>
                                <div className="text-right flex items-center gap-3">
                                    <div>
                                        <p className="text-sm">€{Number(v.price).toLocaleString()}</p>
                                        <p className={`text-xs ${v.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {v.stockQuantity > 0 ? 'In stock' : 'Out of stock'}
                                        </p>
                                    </div>
                                    {isOut && !showNotify && !submitted && (
                                        <button
                                            type="button"
                                            onClick={() => { setNotifyForVariantId(v.id); setNotifySubmitted(null); }}
                                            className="text-xs underline hover:no-underline"
                                        >
                                            Notify me
                                        </button>
                                    )}
                                </div>
                            </label>
                            {showNotify && !submitted && (
                                <form onSubmit={handleNotifySubmit} className="flex gap-2 mt-2 items-start">
                                    <input
                                        type="email"
                                        required
                                        placeholder="you@example.com"
                                        value={notifyEmail}
                                        onChange={(e) => setNotifyEmail(e.target.value)}
                                        className="flex-1 border border-neutral px-3 py-2 text-sm"
                                        aria-label={`Email to be notified when ${v.name} is available`}
                                    />
                                    <button
                                        type="submit"
                                        disabled={waitlistSubscribe.isPending}
                                        className="bg-black text-white px-4 py-2 text-xs tracking-wide disabled:opacity-60"
                                    >
                                        {waitlistSubscribe.isPending ? 'Sending…' : 'Notify me'}
                                    </button>
                                </form>
                            )}
                            {submitted && (
                                <p className="text-xs text-green-700 mt-2">
                                    ✓ We&rsquo;ll email you once, the next time this piece is available.
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>
```

- [ ] **Step 5: Manual browser test**

Run: `pnpm --filter @vamy/website dev`
- Open a product page with a variant, confirm stock shows.
- Flip stock to 0 in admin (another tab).
- Switch back to buyer tab — "Out of stock" should appear without hard reload.
- Click "Notify me", submit an email, confirm "We'll email you once…" message.
- Flip stock back to 1 in admin — email should arrive at the submitted address (if Resend env vars are set locally) OR log show send attempt.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "feat(website): fresh stock on focus + inline notify-me on out-of-stock"
```

---

## Task 8: Admin — waitlist count badge + restock toast

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

- [ ] **Step 1: Add waitlist count query per variant row**

In the variant row rendering (around line 666 where `{v.stockQuantity}` is displayed), adjacent to the stock column header, render a waitlist badge. Add this near the other trpc hooks (around line 46, alongside `updateVariant`):

```tsx
  const utils = trpc.useUtils();
```

Inside the table row for each variant `v`, add a cell (or inline next to stock):

```tsx
<WaitlistBadge variantId={v.id} />
```

And define `WaitlistBadge` at the bottom of the same file, before the default export:

```tsx
function WaitlistBadge({ variantId }: { variantId: string }) {
  const { data } = trpc.waitlist.countForVariant.useQuery({ variantId });
  if (!data || data.count === 0) return null;
  return (
    <span
      className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded ml-2"
      title={`${data.count} ${data.count === 1 ? 'person is' : 'people are'} waiting for this variant`}
    >
      {data.count} waiting
    </span>
  );
}
```

- [ ] **Step 2: Surface restock toast on save**

Find the `updateVariant.mutate(...)` call (around line 199). Replace with a callback that inspects the result:

```tsx
    updateVariant.mutate(
      { id, name: d.name, price: Number(d.price), stockQuantity: Number(d.stock), available: d.available, attributes },
      {
        onSuccess: (result) => {
          if (result && typeof result === 'object' && 'notified' in result) {
            const n = (result as { notified: number }).notified;
            const f = (result as { failed: number }).failed;
            if (n > 0 || f > 0) {
              const parts = [] as string[];
              if (n > 0) parts.push(`${n} waitlist subscriber${n === 1 ? '' : 's'} notified`);
              if (f > 0) parts.push(`${f} failed — check logs`);
              // Use existing toast mechanism in the file; if none, fallback to alert.
              if (typeof window !== 'undefined') window.alert(`Saved. ${parts.join(', ')}.`);
            }
          }
          utils.waitlist.countForVariant.invalidate({ variantId: id });
        },
      },
    );
```

(If the file already has a toast library wired, replace `window.alert` with it; the existing mutation callbacks in this file show the pattern.)

- [ ] **Step 3: Manual test**

Run: `pnpm --filter @vamy/admin dev`
- Open the artworks page, find a variant, observe no badge when waitlist is empty.
- Subscribe from the website (Task 7).
- Refresh admin — badge shows "1 waiting".
- Save the variant with stock ≥ 1 (was 0) — alert says "1 waitlist subscriber notified."
- Badge disappears (all rows now have `notified_at` set, so count drops to 0 after invalidation).

- [ ] **Step 4: Commit**

```bash
git add apps/admin/app/\(dashboard\)/artworks/page.tsx
git commit -m "feat(admin): waitlist count badge + restock notification toast"
```

---

## Self-review

**Spec coverage:**
- §1 Fresh stock → Task 7 step 1 ✔
- §2 Pre-payment guard → Task 5 (server) + Task 7 step 3 (client) ✔
- §3.1 Data model → Task 1 ✔
- §3.2 Public tRPC route → Task 4 ✔
- §3.3 Admin trigger → Tasks 3 + 6 ✔
- §3.4 Email template → Task 2 ✔
- §3.5 Notify-me UI → Task 7 step 4 ✔
- §3.6 Admin UX (count badge, toast) → Task 8 ✔
- Re-notify policy (once per subscription, re-sub resets) → Task 4 (waitlistRouter.subscribe upsert) ✔
- Fix silent-failure pattern → Task 6 (updateVariant returns `{notified, failed}`); Task 8 surfaces `failed` in toast. The `orders.markShipped` silent-failure refactor was mentioned in the spec as a side fix; it is **out of scope** of this plan to keep focus tight — tracked separately.

**Placeholder scan:** no TBD/TODO; all code blocks complete.

**Type consistency:** `notifyWaitlistForVariant` return type `{notified: number, failed: number}` used consistently in Tasks 3, 6, 8. `detectRestockTransition(before, after)` signature matches. Schema name `variantWaitlist` consistent across Tasks 1, 3, 4, 6. tRPC router key `waitlist` consistent in Tasks 4, 7, 8.
