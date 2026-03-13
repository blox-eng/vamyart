# MVP Legal Compliance, Shipping Methods & Announcement Banners — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Ship admin-configurable shipping methods, announcement banners, and legal compliance pages so vamy.art is ready for first sale.

**Architecture:** New `shipping_methods` and `banners` tables in Drizzle schema, migrated via Supabase MCP. New tRPC routers for both (same pattern as existing routers). Admin pages for CRUD. Website-side banner component in `_app.tsx` + shipping display in `ProductSelector`. Legal pages via markdown content + footer changes.

**Tech Stack:** Drizzle ORM, tRPC v11, Vitest, Next.js Pages Router (website), Next.js App Router (admin), Tailwind CSS, Supabase MCP for migrations.

---

## Context

- Monorepo root: `/home/blox-master/business/vamy/website/vamy.art`
- DB schema: `packages/db/src/schema.ts`
- tRPC root: `packages/db/src/trpc/root.ts`
- tRPC index (procedure builders): `packages/db/src/trpc/index.ts`
- Admin dashboard: `apps/admin/app/(dashboard)/` — App Router, `"use client"` pages
- Admin nav: `apps/admin/app/(dashboard)/layout.tsx` — add nav items here
- Website catch-all page: `apps/website/src/pages/[[...slug]].js` — static, avoid modifying
- Website app wrapper: `apps/website/src/pages/_app.tsx` — banner goes here
- Website footer: `apps/website/src/components/sections/Footer/index.tsx`
- Footer content: `apps/website/content/data/footer.json`
- Terms content: `apps/website/content/pages/terms.md`
- Run tests: `pnpm test` from repo root (Vitest via turbo)
- Existing test pattern: `packages/db/src/trpc/routers/bids.test.ts` — vi.mock the DB client, test exported pure functions only
- Supabase migration tool: use `mcp__plugin_supabase_supabase__apply_migration` MCP tool

---

## Task 1: DB Schema — shipping_methods + banners tables + products FK

**Files:**
- Modify: `packages/db/src/schema.ts`

**Context:** The schema uses `pgTable` from `drizzle-orm/pg-core`. Enums use `pgEnum`. Relations are defined at the bottom. `products` already has `artworkId`, `productType`, `name`, etc. We're adding `shippingMethodId` as a nullable FK on products and two new tables.

**Step 1: Add pgEnum imports and the two enums**

At the top of `packages/db/src/schema.ts`, add `pgEnum` to the import:

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
} from "drizzle-orm/pg-core";
```

Then add enums after the imports, before the tables:

```ts
export const shippingMethodType = pgEnum("shipping_method_type", ["free", "paid", "custom"]);
export const bannerScope = pgEnum("banner_scope", ["global", "page"]);
```

**Step 2: Add the shipping_methods table**

After the `newsletterSubscribers` table and before the Relations section:

```ts
// ─── Shipping Methods ─────────────────────────────────────────────────────────
export const shippingMethods = pgTable("shipping_methods", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  displayText: text("display_text").notNull(),
  type: shippingMethodType("type").notNull(),
  cost: numeric("cost", { precision: 10, scale: 2 }),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Banners ──────────────────────────────────────────────────────────────────
export const banners = pgTable("banners", {
  id: uuid("id").primaryKey().defaultRandom(),
  text: text("text").notNull(),
  isActive: boolean("is_active").notNull().default(false),
  scope: bannerScope("scope").notNull().default("global"),
  pageSlug: text("page_slug"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Step 3: Add shippingMethodId FK to products table**

In the `products` table definition, add after `active`:

```ts
  shippingMethodId: uuid("shipping_method_id").references(() => shippingMethods.id),
```

**Step 4: Add relations**

In the Relations section, update `productsRelations` to include the shipping method:

```ts
export const productsRelations = relations(products, ({ one, many }) => ({
  artwork: one(artworks, { fields: [products.artworkId], references: [artworks.id] }),
  variants: many(productVariants),
  shippingMethod: one(shippingMethods, { fields: [products.shippingMethodId], references: [shippingMethods.id] }),
}));
```

Add a new relation for shipping methods:

```ts
export const shippingMethodsRelations = relations(shippingMethods, ({ many }) => ({
  products: many(products),
}));
```

**Step 5: Commit**

```bash
git add packages/db/src/schema.ts
git commit -m "feat: add shipping_methods and banners tables to schema"
```

---

## Task 2: Supabase Migration + Seed

**Context:** The project uses Supabase MCP to apply migrations directly. The migration must create the two enums, two tables, and add the FK column to `products`. After migration, seed two shipping methods.

**Step 1: Apply the migration via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration` with project `ytgbohzmipyfrezsctbl` and this SQL:

```sql
-- Enums
CREATE TYPE shipping_method_type AS ENUM ('free', 'paid', 'custom');
CREATE TYPE banner_scope AS ENUM ('global', 'page');

-- Shipping methods
CREATE TABLE shipping_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  display_text TEXT NOT NULL,
  type shipping_method_type NOT NULL,
  cost NUMERIC(10,2),
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Banners
CREATE TABLE banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  scope banner_scope NOT NULL DEFAULT 'global',
  page_slug TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- FK on products
ALTER TABLE products ADD COLUMN shipping_method_id UUID REFERENCES shipping_methods(id);
```

**Step 2: Seed shipping methods**

Run a second migration (or use `mcp__plugin_supabase_supabase__execute_sql`) to seed:

```sql
INSERT INTO shipping_methods (name, display_text, type, is_default) VALUES
  ('Free', 'Free shipping', 'free', false),
  ('Custom', 'Shipping arranged by artist', 'custom', true);

-- Assign Free to all existing print-type products
UPDATE products SET shipping_method_id = (
  SELECT id FROM shipping_methods WHERE name = 'Free'
) WHERE product_type = 'print';

-- Assign Custom to all existing original-type products
UPDATE products SET shipping_method_id = (
  SELECT id FROM shipping_methods WHERE name = 'Custom'
) WHERE product_type = 'original';
```

**Step 3: Verify**

```bash
# Via Supabase MCP execute_sql, run:
SELECT * FROM shipping_methods;
SELECT id, name, product_type, shipping_method_id FROM products;
```

Expected: 2 rows in shipping_methods, products updated.

**Step 4: Commit**

```bash
git commit --allow-empty -m "feat: apply shipping_methods/banners migration and seed"
```

---

## Task 3: tRPC — shippingMethods router

**Files:**
- Create: `packages/db/src/trpc/routers/shippingMethods.ts`
- Modify: `packages/db/src/trpc/root.ts`

**Context:** Follow the exact pattern of existing routers. `protectedProcedure` requires a valid admin session. `publicProcedure` is for the website. Import from `"../index"` for procedures, `"../../client"` for db, `"../../schema"` for tables.

**Step 1: Create the router**

```ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { shippingMethods } from "../../schema";

export const shippingMethodsRouter = router({
  list: protectedProcedure.query(async () => {
    return db.query.shippingMethods.findMany({
      orderBy: (sm, { asc }) => [asc(sm.name)],
    });
  }),

  getDefault: publicProcedure.query(async () => {
    return db.query.shippingMethods.findFirst({
      where: eq(shippingMethods.isDefault, true),
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        displayText: z.string().min(1),
        type: z.enum(["free", "paid", "custom"]),
        cost: z.number().positive().optional(),
        isDefault: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const [sm] = await db.insert(shippingMethods).values({
        name: input.name,
        displayText: input.displayText,
        type: input.type,
        cost: input.cost != null ? String(input.cost) : null,
        isDefault: input.isDefault,
      }).returning();
      return sm;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        name: z.string().min(1).optional(),
        displayText: z.string().min(1).optional(),
        type: z.enum(["free", "paid", "custom"]).optional(),
        cost: z.number().positive().nullable().optional(),
        isDefault: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, cost, ...fields } = input;
      const updateData: Record<string, unknown> = { ...fields, updatedAt: new Date() };
      if (cost !== undefined) updateData.cost = cost != null ? String(cost) : null;
      const [sm] = await db
        .update(shippingMethods)
        .set(updateData)
        .where(eq(shippingMethods.id, id))
        .returning();
      return sm;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      // Guard: cannot delete if any products reference this method
      const inUse = await db.query.products.findFirst({
        where: (p, { eq }) => eq(p.shippingMethodId, input.id),
      });
      if (inUse) throw new Error("Cannot delete: shipping method is in use by products");

      const inUseDefault = await db.query.shippingMethods.findFirst({
        where: (sm, { and, eq }) => and(eq(sm.id, input.id), eq(sm.isDefault, true)),
      });
      if (inUseDefault) throw new Error("Cannot delete the default shipping method");

      await db.delete(shippingMethods).where(eq(shippingMethods.id, input.id));
      return { success: true };
    }),
});
```

**Step 2: Register in root.ts**

```ts
import { shippingMethodsRouter } from "./routers/shippingMethods";

export const appRouter = router({
  // ... existing
  shippingMethods: shippingMethodsRouter,
});
```

**Step 3: Commit**

```bash
git add packages/db/src/trpc/routers/shippingMethods.ts packages/db/src/trpc/root.ts
git commit -m "feat: add shippingMethods tRPC router"
```

---

## Task 4: tRPC — banners router

**Files:**
- Create: `packages/db/src/trpc/routers/banners.ts`
- Create: `packages/db/src/trpc/routers/banners.test.ts`
- Modify: `packages/db/src/trpc/root.ts`

**Step 1: Write the failing test**

```ts
// packages/db/src/trpc/routers/banners.test.ts
import { describe, it, expect } from "vitest";
import { selectActiveBanner } from "./banners";

describe("selectActiveBanner", () => {
  const global = { id: "1", text: "Sale", isActive: true, scope: "global" as const, pageSlug: null };
  const scoped = { id: "2", text: "Gallery sale", isActive: true, scope: "page" as const, pageSlug: "gallery" };

  it("returns null when no banners", () => {
    expect(selectActiveBanner([], "gallery")).toBeNull();
  });

  it("returns page-scoped banner over global for matching slug", () => {
    expect(selectActiveBanner([global, scoped], "gallery")).toEqual(scoped);
  });

  it("returns global banner when no scoped match", () => {
    expect(selectActiveBanner([global, scoped], "shop")).toEqual(global);
  });

  it("returns null when only inactive banners exist", () => {
    const inactive = { ...global, isActive: false };
    expect(selectActiveBanner([inactive], "shop")).toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
pnpm test --filter @vamy/db
```

Expected: FAIL — `selectActiveBanner` not defined.

**Step 3: Create the router with the exported helper**

```ts
// packages/db/src/trpc/routers/banners.ts
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure, protectedProcedure } from "../index";
import { db } from "../../client";
import { banners } from "../../schema";

type Banner = {
  id: string;
  text: string;
  isActive: boolean;
  scope: "global" | "page";
  pageSlug: string | null;
};

export function selectActiveBanner(all: Banner[], slug: string): Banner | null {
  const active = all.filter((b) => b.isActive);
  const scoped = active.find((b) => b.scope === "page" && b.pageSlug === slug);
  if (scoped) return scoped;
  return active.find((b) => b.scope === "global") ?? null;
}

export const bannersRouter = router({
  getActive: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const all = await db.query.banners.findMany();
      return selectActiveBanner(all, input.slug);
    }),

  list: protectedProcedure.query(async () => {
    return db.query.banners.findMany({
      orderBy: (b, { desc }) => [desc(b.createdAt)],
    });
  }),

  create: protectedProcedure
    .input(
      z.object({
        text: z.string().min(1),
        isActive: z.boolean().default(false),
        scope: z.enum(["global", "page"]).default("global"),
        pageSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [banner] = await db.insert(banners).values({
        text: input.text,
        isActive: input.isActive,
        scope: input.scope,
        pageSlug: input.pageSlug ?? null,
      }).returning();
      return banner;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        text: z.string().min(1).optional(),
        isActive: z.boolean().optional(),
        scope: z.enum(["global", "page"]).optional(),
        pageSlug: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, ...fields } = input;
      const [banner] = await db
        .update(banners)
        .set({ ...fields, updatedAt: new Date() })
        .where(eq(banners.id, id))
        .returning();
      return banner;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      await db.delete(banners).where(eq(banners.id, input.id));
      return { success: true };
    }),
});
```

**Step 4: Run test to verify it passes**

```bash
pnpm test --filter @vamy/db
```

Expected: all banner tests PASS.

**Step 5: Register in root.ts**

```ts
import { bannersRouter } from "./routers/banners";

export const appRouter = router({
  // ... existing
  shippingMethods: shippingMethodsRouter,
  banners: bannersRouter,
});
```

**Step 6: Commit**

```bash
git add packages/db/src/trpc/routers/banners.ts packages/db/src/trpc/routers/banners.test.ts packages/db/src/trpc/root.ts
git commit -m "feat: add banners tRPC router with selectActiveBanner logic"
```

---

## Task 5: Update products router — include shippingMethod + updateShippingMethod

**Files:**
- Modify: `packages/db/src/trpc/routers/products.ts`

**Context:** `listByArtworkSlug` is public and used by the website's `ProductSelector`. It must now return the shipping method so the website can display it. `listAll` is used by admin. Add `updateShippingMethod` mutation.

**Step 1: Update listByArtworkSlug to include shippingMethod**

In `listByArtworkSlug`, the query returns products with variants. Add `shippingMethod: true` to the `with` clause:

```ts
return db.query.products.findMany({
  where: and(
    eq(products.artworkId, artwork.id),
    eq(products.active, true)
  ),
  with: {
    variants: {
      where: eq(productVariants.available, true),
    },
    shippingMethod: true,
  },
});
```

**Step 2: Update listAll to include shippingMethod**

```ts
listAll: protectedProcedure.query(async () => {
  return db.query.products.findMany({
    with: { variants: true, artwork: true, shippingMethod: true },
    orderBy: (products, { desc }) => [desc(products.createdAt)],
  });
}),
```

**Step 3: Add updateShippingMethod mutation**

```ts
updateShippingMethod: protectedProcedure
  .input(
    z.object({
      productId: z.string().uuid(),
      shippingMethodId: z.string().uuid().nullable(),
    })
  )
  .mutation(async ({ input }) => {
    const [p] = await db
      .update(products)
      .set({ shippingMethodId: input.shippingMethodId, updatedAt: new Date() })
      .where(eq(products.id, input.productId))
      .returning();
    return p;
  }),
```

**Step 4: Commit**

```bash
git add packages/db/src/trpc/routers/products.ts
git commit -m "feat: include shippingMethod in product queries, add updateShippingMethod"
```

---

## Task 6: Update checkout router — handle paid shipping

**Files:**
- Modify: `packages/db/src/trpc/routers/checkout.ts`

**Context:** Currently `createSession` creates a Stripe checkout with no shipping line item. When `shippingMethod.type === "paid"`, we must add the cost. The variant query already has `product` with `artwork` — add `shippingMethod` to that.

**Step 1: Update the variant query to include shipping method**

```ts
const variant = await db.query.productVariants.findFirst({
  where: eq(productVariants.id, input.variantId),
  with: {
    product: {
      with: { artwork: true, shippingMethod: true },
    },
  },
});
```

**Step 2: Resolve the effective shipping method**

After the variant null check, before creating the Stripe session:

```ts
// Resolve shipping: product's assigned method, or fall back to global default
let shippingType: "free" | "paid" | "custom" = "custom";
let shippingCost: number | null = null;
let shippingDisplayText = "Shipping arranged by artist";

const method = variant.product.shippingMethod;
if (method) {
  shippingType = method.type;
  shippingCost = method.cost ? Number(method.cost) : null;
  shippingDisplayText = method.displayText;
} else {
  // Fall back to global default
  const defaultMethod = await db.query.shippingMethods.findFirst({
    where: eq(shippingMethods.isDefault, true),
  });
  if (defaultMethod) {
    shippingType = defaultMethod.type;
    shippingCost = defaultMethod.cost ? Number(defaultMethod.cost) : null;
    shippingDisplayText = defaultMethod.displayText;
  }
}
```

Add `shippingMethods` to the import from `"../../schema"`.

**Step 3: Add shipping_options to Stripe session only for paid type**

Replace the `session` creation:

```ts
const sessionParams: Stripe.Checkout.SessionCreateParams = {
  mode: "payment",
  payment_method_types: ["card"],
  line_items: [
    {
      price_data: {
        currency: "eur",
        product_data: {
          name: `${variant.product.name} — ${variant.name}`,
          metadata: { variantId: variant.id },
        },
        unit_amount: Math.round(Number(variant.price) * 100),
      },
      quantity: 1,
    },
  ],
  shipping_address_collection: {
    allowed_countries: ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"],
  },
  metadata: { variantId: variant.id },
  success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
};

if (shippingType === "paid" && shippingCost != null) {
  sessionParams.shipping_options = [
    {
      shipping_rate_data: {
        type: "fixed_amount",
        fixed_amount: { amount: Math.round(shippingCost * 100), currency: "eur" },
        display_name: shippingDisplayText,
      },
    },
  ];
}

const session = await getStripe().checkout.sessions.create(sessionParams);
```

**Step 4: Commit**

```bash
git add packages/db/src/trpc/routers/checkout.ts
git commit -m "feat: wire shipping method type into Stripe checkout session"
```

---

## Task 7: Admin — Shipping Methods Page

**Files:**
- Create: `apps/admin/app/(dashboard)/shipping/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

**Context:** All admin pages are `"use client"` App Router components. They use `trpc` from `"../../lib/trpc"`. Look at `apps/admin/app/(dashboard)/inquiries/page.tsx` for the exact import style and UI pattern. Icons come from `lucide-react`. The nav items array in `layout.tsx` drives the sidebar.

**Step 1: Add Shipping nav item to layout.tsx**

In `layout.tsx`, add to `navItems`:

```ts
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, LogOut } from "lucide-react";

const navItems = [
  { href: "/auctions", label: "Auctions", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/artworks", label: "Artworks", icon: ImageIcon },
  { href: "/inquiries", label: "Inquiries", icon: Mail },
  { href: "/shipping", label: "Shipping", icon: Truck },
  { href: "/banners", label: "Banners", icon: Megaphone },
];
```

**Step 2: Create shipping/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc";

type MethodType = "free" | "paid" | "custom";

export default function ShippingPage() {
  const { data: methods, refetch } = trpc.shippingMethods.list.useQuery();
  const create = trpc.shippingMethods.create.useMutation({ onSuccess: () => refetch() });
  const update = trpc.shippingMethods.update.useMutation({ onSuccess: () => refetch() });
  const del = trpc.shippingMethods.delete.useMutation({ onSuccess: () => refetch() });

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDisplay, setEditDisplay] = useState("");
  const [editType, setEditType] = useState<MethodType>("free");
  const [editCost, setEditCost] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  // New method form state
  const [newName, setNewName] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newType, setNewType] = useState<MethodType>("free");
  const [newCost, setNewCost] = useState("");
  const [newDefault, setNewDefault] = useState(false);

  function startEdit(m: NonNullable<typeof methods>[0]) {
    setEditId(m.id);
    setEditName(m.name);
    setEditDisplay(m.displayText);
    setEditType(m.type as MethodType);
    setEditCost(m.cost ?? "");
    setError("");
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      await update.mutateAsync({
        id: editId,
        name: editName,
        displayText: editDisplay,
        type: editType,
        cost: editType === "paid" && editCost ? Number(editCost) : undefined,
      });
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await del.mutateAsync({ id });
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot delete");
      setConfirmDelete(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        name: newName,
        displayText: newDisplay,
        type: newType,
        cost: newType === "paid" && newCost ? Number(newCost) : undefined,
        isDefault: newDefault,
      });
      setNewName(""); setNewDisplay(""); setNewType("free"); setNewCost(""); setNewDefault(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Shipping Methods</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-3 mb-10">
        {(methods ?? []).map((m) =>
          editId === m.id ? (
            <div key={m.id} className="border rounded-lg p-4 space-y-3">
              <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
              <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Display text (buyer-facing)" value={editDisplay} onChange={e => setEditDisplay(e.target.value)} />
              <select className="w-full border px-3 py-2 rounded text-sm" value={editType} onChange={e => setEditType(e.target.value as MethodType)}>
                <option value="free">Free</option>
                <option value="custom">Custom (arranged by artist)</option>
                <option value="paid">Paid</option>
              </select>
              {editType === "paid" && (
                <input type="number" className="w-full border px-3 py-2 rounded text-sm" placeholder="Cost (€)" value={editCost} onChange={e => setEditCost(e.target.value)} />
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} className="bg-black text-white px-4 py-2 rounded text-sm">Save</button>
                <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{m.name} {m.isDefault && <span className="text-xs text-gray-400 ml-1">(default)</span>}</p>
                <p className="text-xs text-gray-500">{m.displayText} · {m.type}{m.type === "paid" && m.cost ? ` · €${m.cost}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(m)} className="border px-3 py-1 rounded text-xs">Edit</button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className={`px-3 py-1 rounded text-xs ${confirmDelete === m.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                >
                  {confirmDelete === m.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          )
        )}
      </div>

      <h2 className="text-lg font-light mb-4">Add shipping method</h2>
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Name (e.g. Express DHL)" value={newName} onChange={e => setNewName(e.target.value)} required />
        <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Display text (buyer-facing)" value={newDisplay} onChange={e => setNewDisplay(e.target.value)} required />
        <select className="w-full border px-3 py-2 rounded text-sm" value={newType} onChange={e => setNewType(e.target.value as MethodType)}>
          <option value="free">Free</option>
          <option value="custom">Custom (arranged by artist)</option>
          <option value="paid">Paid</option>
        </select>
        {newType === "paid" && (
          <input type="number" className="w-full border px-3 py-2 rounded text-sm" placeholder="Cost (€)" value={newCost} onChange={e => setNewCost(e.target.value)} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={newDefault} onChange={e => setNewDefault(e.target.checked)} />
          Set as default
        </label>
        <button type="submit" disabled={create.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {create.isPending ? "Adding…" : "Add method"}
        </button>
      </form>
    </div>
  );
}
```

**Step 3: Verify**

Start admin dev server and navigate to `/shipping`. Verify the two seeded methods appear, edit/delete/create work.

**Step 4: Commit**

```bash
git add apps/admin/app/(dashboard)/shipping/page.tsx apps/admin/app/(dashboard)/layout.tsx
git commit -m "feat: add Shipping Methods admin page and nav items"
```

---

## Task 8: Admin — Banners Page

**Files:**
- Create: `apps/admin/app/(dashboard)/banners/page.tsx`

**Context:** Layout nav already updated in Task 7. Same UI pattern as shipping page.

**Step 1: Create banners/page.tsx**

```tsx
"use client";

import { useState } from "react";
import { trpc } from "../../lib/trpc";

export default function BannersPage() {
  const { data: bannerList, refetch } = trpc.banners.list.useQuery();
  const create = trpc.banners.create.useMutation({ onSuccess: () => refetch() });
  const update = trpc.banners.update.useMutation({ onSuccess: () => refetch() });
  const del = trpc.banners.delete.useMutation({ onSuccess: () => refetch() });

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editScope, setEditScope] = useState<"global" | "page">("global");
  const [editSlug, setEditSlug] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newScope, setNewScope] = useState<"global" | "page">("global");
  const [newSlug, setNewSlug] = useState("");

  function startEdit(b: NonNullable<typeof bannerList>[0]) {
    setEditId(b.id);
    setEditText(b.text);
    setEditScope(b.scope as "global" | "page");
    setEditSlug(b.pageSlug ?? "");
  }

  async function toggleActive(b: NonNullable<typeof bannerList>[0]) {
    await update.mutateAsync({ id: b.id, isActive: !b.isActive });
  }

  async function saveEdit() {
    if (!editId) return;
    await update.mutateAsync({
      id: editId,
      text: editText,
      scope: editScope,
      pageSlug: editScope === "page" ? editSlug : null,
    });
    setEditId(null);
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    await del.mutateAsync({ id });
    setConfirmDelete(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      text: newText,
      scope: newScope,
      pageSlug: newScope === "page" ? newSlug : null,
    });
    setNewText(""); setNewScope("global"); setNewSlug("");
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Announcement Banners</h1>

      <div className="space-y-3 mb-10">
        {(bannerList ?? []).map((b) =>
          editId === b.id ? (
            <div key={b.id} className="border rounded-lg p-4 space-y-3">
              <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} value={editText} onChange={e => setEditText(e.target.value)} />
              <select className="w-full border px-3 py-2 rounded text-sm" value={editScope} onChange={e => setEditScope(e.target.value as "global" | "page")}>
                <option value="global">Global (all pages)</option>
                <option value="page">Specific page</option>
              </select>
              {editScope === "page" && (
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Page slug (e.g. gallery)" value={editSlug} onChange={e => setEditSlug(e.target.value)} />
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} className="bg-black text-white px-4 py-2 rounded text-sm">Save</button>
                <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div key={b.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{b.text}</p>
                <p className="text-xs text-gray-400">{b.scope === "global" ? "All pages" : `Page: /${b.pageSlug}`}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(b)}
                  className={`px-3 py-1 rounded text-xs font-medium ${b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                >
                  {b.isActive ? "Live" : "Off"}
                </button>
                <button onClick={() => startEdit(b)} className="border px-3 py-1 rounded text-xs">Edit</button>
                <button
                  onClick={() => handleDelete(b.id)}
                  className={`px-3 py-1 rounded text-xs ${confirmDelete === b.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                >
                  {confirmDelete === b.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          )
        )}
        {(bannerList ?? []).length === 0 && <p className="text-sm text-gray-400">No banners yet.</p>}
      </div>

      <h2 className="text-lg font-light mb-4">Create banner</h2>
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="Banner text" value={newText} onChange={e => setNewText(e.target.value)} required />
        <select className="w-full border px-3 py-2 rounded text-sm" value={newScope} onChange={e => setNewScope(e.target.value as "global" | "page")}>
          <option value="global">Global (all pages)</option>
          <option value="page">Specific page</option>
        </select>
        {newScope === "page" && (
          <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Page slug (e.g. gallery)" value={newSlug} onChange={e => setNewSlug(e.target.value)} required />
        )}
        <button type="submit" disabled={create.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {create.isPending ? "Creating…" : "Create banner"}
        </button>
      </form>
    </div>
  );
}
```

**Step 2: Verify**

Navigate to `/banners` in admin. Create a global banner, toggle it live, verify edit/delete work.

**Step 3: Commit**

```bash
git add apps/admin/app/(dashboard)/banners/page.tsx
git commit -m "feat: add Banners admin page"
```

---

## Task 9: Admin — Shipping dropdown on Artworks/Products page

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

**Context:** This page has a product accordion per artwork. Each product is shown with its variants. We need to add a "Shipping" dropdown to each product row that calls `trpc.products.updateShippingMethod`. Add `trpc.shippingMethods.list` query at the top to populate the dropdown.

**Step 1: Read the current artworks/page.tsx to find the product row JSX**

The product row shows product name, type, description, and variant list. Find the product edit section and add a shipping method `<select>`.

**Step 2: Add shippingMethods query**

At the top of the component (alongside other trpc queries):

```ts
const { data: shippingMethodsList } = trpc.shippingMethods.list.useQuery();
const updateShipping = trpc.products.updateShippingMethod.useMutation({ onSuccess: () => refetch() });
```

**Step 3: Add shipping dropdown to each product row**

Where product details are shown (find the product name/type display), add below the product type:

```tsx
<div className="flex items-center gap-2 mt-2">
  <span className="text-xs text-gray-500">Shipping:</span>
  <select
    className="text-xs border rounded px-2 py-1"
    value={product.shippingMethodId ?? ""}
    onChange={async (e) => {
      await updateShipping.mutateAsync({
        productId: product.id,
        shippingMethodId: e.target.value || null,
      });
    }}
  >
    <option value="">— use default —</option>
    {(shippingMethodsList ?? []).map(sm => (
      <option key={sm.id} value={sm.id}>{sm.name} ({sm.type})</option>
    ))}
  </select>
</div>
```

**Step 4: Verify**

Navigate to `/artworks`. Each product row should show a shipping dropdown. Changing it should persist on refresh.

**Step 5: Commit**

```bash
git add apps/admin/app/(dashboard)/artworks/page.tsx
git commit -m "feat: add shipping method selector to product rows in admin"
```

---

## Task 10: Website — AnnouncementBanner component

**Files:**
- Create: `apps/website/src/components/AnnouncementBanner.tsx`
- Modify: `apps/website/src/pages/_app.tsx`

**Context:** The website uses Pages Router. `_app.tsx` wraps every page. The banner must appear on every page below the header. Since we're using client-side tRPC, the banner loads after hydration — acceptable for MVP. Use `useRouter` from `next/router` to get the current slug.

**Step 1: Create AnnouncementBanner.tsx**

```tsx
import { useRouter } from 'next/router';
import { trpc } from '../lib/trpc';

export function AnnouncementBanner() {
    const router = useRouter();
    const slug = (router.query.slug as string[] | undefined)?.join('/') ?? router.pathname.replace(/^\//, '');
    const { data: banner } = trpc.banners.getActive.useQuery({ slug });

    if (!banner) return null;

    return (
        <div className="bg-black text-white text-center text-sm py-2 px-4">
            {banner.text}
        </div>
    );
}
```

**Step 2: Wire into _app.tsx**

Import and render the banner inside the providers, before `<Component>`:

```tsx
import { AnnouncementBanner } from '../components/AnnouncementBanner';

// Inside the return:
return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
            <AnnouncementBanner />
            <Component {...pageProps} />
        </QueryClientProvider>
    </trpc.Provider>
);
```

**Step 3: Verify**

Create a global banner in admin and toggle it live. Reload the website — banner should appear above the page content. Create a page-scoped banner for slug `gallery` — verify it shows only on `/gallery`.

**Step 4: Commit**

```bash
git add apps/website/src/components/AnnouncementBanner.tsx apps/website/src/pages/_app.tsx
git commit -m "feat: add AnnouncementBanner component, wire into website layout"
```

---

## Task 11: Website — Shipping info in ProductSelector

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

**Context:** `ProductSelector` fetches products via `trpc.products.listByArtworkSlug`. After Task 5, each product now includes `shippingMethod`. Show the shipping info below the variant list and above the Buy button.

**Step 1: Resolve shipping display**

In `ProductSelector`, after the products query, resolve the shipping info. Products in a single artwork typically share one shipping method — use the first product's method:

```tsx
const shippingMethod = productList?.[0]?.shippingMethod;
const shippingDisplay = shippingMethod
    ? shippingMethod.displayText
    : null;
const shippingClass = shippingMethod?.type === 'free'
    ? 'text-green-600'
    : 'text-gray-500';
```

**Step 2: Render shipping line**

Add between the variant list and the error/buy button:

```tsx
{shippingDisplay && (
    <p className={`text-xs mb-3 ${shippingClass}`}>
        {shippingDisplay}
    </p>
)}
```

**Step 3: Verify**

On an artwork page with prints (free shipping), verify "Free shipping" appears in green. On an artwork page with originals, verify "Shipping arranged by artist" appears in muted text.

**Step 4: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "feat: display shipping method in ProductSelector"
```

---

## Task 12: Legal — Privacy page, footer, terms corrections, copyright

**Files:**
- Create: `apps/website/content/pages/privacy.md`
- Modify: `apps/website/content/data/footer.json`
- Modify: `apps/website/src/components/sections/Footer/index.tsx`
- Modify: `apps/website/content/pages/terms.md`

**Step 1: Create privacy.md**

Create `apps/website/content/pages/privacy.md`:

```markdown
---
type: PageLayout
title: Privacy Policy
sections:
  - type: GenericSection
    title:
      type: TitleBlock
      text: Privacy Policy
      color: text-dark
    subtitle: ''
    text: >
      **Last Updated: 06.03.2026**


      **Data Controller:** Мейв Вами ЕООД (Maeve Vamy EOOD), EIK 208627302,
      Stara Zagora, Bulgaria. Contact: maeve@vamy.art


      ## What We Collect


      When you make a purchase or place a bid, we collect: your name, email
      address, and shipping address. Bids also record your IP address for
      fraud prevention. We do not store payment card details — these are
      handled by Stripe.


      ## How We Use It


      Your data is used only to process orders, send order confirmations, and
      ship artwork. We do not sell or share your data with third parties except
      as listed below.


      ## Third-Party Processors


      *   **Stripe** — payment processing (stripe.com/privacy)


      *   **Resend** — transactional email delivery


      *   **Supabase** — database hosting (EU region)


      ## Retention


      Order data is retained for 7 years per Bulgarian accounting law. Bid
      data is retained for 2 years. You may request deletion of personal data
      not required for legal compliance by emailing maeve@vamy.art.


      ## Your Rights


      Under GDPR you have the right to access, correct, or delete your personal
      data. To exercise these rights, email maeve@vamy.art.


      ## Cookies


      This website does not use tracking cookies. Stripe's checkout page
      (stripe.com) uses cookies governed by their own privacy policy.
    actions: []
    colors: bg-light-fg-dark
    styles:
      self:
        alignItems: flex-start
slug: privacy
isDraft: false
seo:
  type: Seo
  metaTitle: Privacy Policy — Vamy
  metaDescription: How Maeve Vamy EOOD collects and uses your personal data.
  addTitleSuffix: false
---
```

**Step 2: Add Privacy link to footer.json legalLinks**

In `apps/website/content/data/footer.json`, the `legalLinks` array currently has only Terms. Add Privacy:

```json
"legalLinks": [
    {
        "label": "Terms",
        "url": "/terms",
        "icon": "arrowRight",
        "iconPosition": "right",
        "style": "secondary",
        "type": "Link"
    },
    {
        "label": "Privacy",
        "url": "/privacy",
        "icon": "arrowRight",
        "iconPosition": "right",
        "style": "secondary",
        "type": "Link"
    }
]
```

Also update `copyrightText` to remove the hardcoded year (it will be injected by the component):

```json
"copyrightText": "All rights reserved © Vamy\n"
```

And add the legal notice. Append a new field `legalNotice` to the JSON:

```json
"legalNotice": "Мейв Вами ЕООД · EIK 208627302 · Stara Zagora, Bulgaria · maeve@vamy.art"
```

**Step 3: Update Footer component — copyright year + legal notice**

In `apps/website/src/components/sections/Footer/index.tsx`:

Destructure `legalNotice` from props:

```tsx
const {
    // ... existing
    copyrightText,
    legalNotice,
    // ...
} = props;
```

Where `{copyrightText}` is rendered inside the `<Markdown>` component, replace:

```tsx
{copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))}
```

Below the copyright block, add:

```tsx
{legalNotice && (
    <p className="text-xs text-gray-400 mt-1">{legalNotice}</p>
)}
```

**Step 4: Fix terms.md — two corrections**

In `apps/website/content/pages/terms.md`:

1. Find `PayPal and bank transfers` and replace with:
   ```
   Credit and debit card via Stripe. Payment must be completed before artwork shipment.
   ```

2. Find `all prices include VAT where applicable` and replace with:
   ```
   all prices are in EUR. Мейв Вами ЕООД is not VAT registered; no VAT is charged.
   ```

3. In the Contact section, add under the email line:
   ```
   **Company:** Мейв Вами ЕООД · EIK 208627302
   ```

**Step 5: Verify**

- Navigate to `/privacy` — page renders with placeholder content
- Footer shows Terms + Privacy links, legal notice line, and current year in copyright
- Navigate to `/terms` — payment methods and VAT text corrected

**Step 6: Commit**

```bash
git add apps/website/content/pages/privacy.md apps/website/content/data/footer.json apps/website/src/components/sections/Footer/index.tsx apps/website/content/pages/terms.md
git commit -m "feat: add privacy page, legal notice in footer, fix terms text, auto-increment copyright year"
```

---

## Final Verification

Run the full test suite:

```bash
pnpm test
```

Expected: all existing tests pass, new banner tests pass.

Start both apps and do a manual smoke test:
- Admin: shipping methods list, create, edit, delete; banners CRUD + toggle; product shipping dropdown updates
- Website: banner appears/disappears based on admin toggle; ProductSelector shows correct shipping text; footer has Privacy link + legal notice + current year; `/privacy` page loads; `/terms` has correct payment/VAT text
