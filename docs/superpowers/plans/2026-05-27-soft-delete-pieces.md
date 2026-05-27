# Soft-Delete Pieces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make piece deletion reversible — the studio Delete button soft-deletes (`deleted_at`), trashed pieces vanish from the site and studio, and a Trash view restores them.

**Architecture:** Add a nullable `deleted_at` to `artworks`. Rewrite `artworks.delete` to set the timestamp (keeping the order/active-auction guard) instead of cascading. Add `restore` + `listTrashed`. Add `deleted_at IS NULL` filters to every artwork read path (admin list, public `listPublic`/`getBySlug`, and the public slug lookups in auctions/products). Add a Trash section to the studio pieces page.

**Tech Stack:** Drizzle ORM + drizzle-kit, tRPC v11, Next.js App Router (admin), vitest (real-DB integration tests).

**Conventions for the implementer:**
- Always `cd` to repo root (`/home/blox-master/business/vamy/website/vamy.art`) before any git command.
- **Do not push or open a PR** — the controller does that at the end.
- DB verification: `pnpm --filter @vamy/db exec tsc --noEmit` (must be clean) and `pnpm --filter @vamy/db test <file>`.
- Admin verification: `pnpm --filter @vamy/admin exec tsc --noEmit`. **Baseline:** the admin package already reports ~6 pre-existing `newVariantForm` errors in `artworks/page.tsx`; those are NOT yours. Only new errors count.
- Tests hit the real dev DB (`DATABASE_URL` from repo-root `.env.local`). Each test creates and cleans up its own rows in `afterAll` (pattern: `contacts.test.ts`).
- `db` is imported from `../../client`; schema from `../../schema`.

---

### Task 1: Schema — add `deletedAt` to artworks + migration

**Files:**
- Modify: `packages/db/src/schema.ts` (artworks table, ~line 36)
- Create: `packages/db/migrations/0009_*.sql` (generated)

- [ ] **Step 1: Add the column**

In `packages/db/src/schema.ts`, inside `export const artworks = pgTable("artworks", { ... })`, add after `updatedAt` (line ~37):

```ts
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
```

(`timestamp` is already imported in this file.)

- [ ] **Step 2: Generate the migration**

Run from `packages/db`:
```bash
pnpm --filter @vamy/db generate
```
Expected: a new `migrations/0009_*.sql` containing `ALTER TABLE "artworks" ADD COLUMN "deleted_at" timestamp with time zone;` plus updated `meta/` snapshot + journal.

- [ ] **Step 3: Apply the migration to the dev DB**

Run from `packages/db`:
```bash
pnpm --filter @vamy/db migrate
```
Expected: applies `0009` with no error. (If it reports "No migrations to run", confirm the file exists and re-check.)

- [ ] **Step 4: Verify types**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: clean (no new errors).

- [ ] **Step 5: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/schema.ts packages/db/migrations/
git commit -m "feat(db): add artworks.deleted_at for soft delete"
```

---

### Task 2: Router — soft delete, restore, list filters, listTrashed

**Files:**
- Modify: `packages/db/src/trpc/routers/artworks.ts`

- [ ] **Step 1: Import `isNull`**

In `artworks.ts` line 2, add `isNull` to the drizzle-orm import:
```ts
import { eq, and, ne, asc, inArray, isNull } from "drizzle-orm";
```
(`createClient` / `getStorageClient` will become unused after this task — remove the `getStorageClient` function and the `createClient` import once nothing references them; see Step 3.)

- [ ] **Step 2: Filter the admin `list`**

Replace the `list` procedure body so it excludes trashed pieces:
```ts
  list: protectedProcedure.query(async () => {
    return db.query.artworks.findMany({
      where: (a, { isNull }) => isNull(a.deletedAt),
      orderBy: (artworks, { asc }) => [asc(artworks.sortOrder), asc(artworks.title)],
    });
  }),
```

- [ ] **Step 3: Rewrite `delete` to soft-delete (keep guard, drop cascade + storage)**

Replace the entire `delete` procedure with:
```ts
  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const productRows = await db
        .select({ id: products.id })
        .from(products)
        .where(eq(products.artworkId, input.id));
      const productIds = productRows.map((p) => p.id);

      const variantRows = productIds.length
        ? await db
            .select({ id: productVariants.id })
            .from(productVariants)
            .where(inArray(productVariants.productId, productIds))
        : [];
      const variantIds = variantRows.map((v) => v.id);

      const orderRows = variantIds.length
        ? await db
            .select({ id: orders.id })
            .from(orders)
            .where(inArray(orders.productVariantId, variantIds))
        : [];

      const auctionRows = await db
        .select({ status: auctions.status })
        .from(auctions)
        .where(eq(auctions.artworkId, input.id));

      const blockReason = artworkDeleteBlockReason({
        orderCount: orderRows.length,
        auctionStatuses: auctionRows.map((a) => a.status),
      });
      if (blockReason) {
        throw new TRPCError({ code: "CONFLICT", message: blockReason });
      }

      const [a] = await db
        .update(artworks)
        .set({ deletedAt: new Date(), updatedAt: new Date() })
        .where(eq(artworks.id, input.id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return { success: true };
    }),
```

Then **delete** the now-unused `getStorageClient()` function and the
`import { createClient } from "@supabase/supabase-js";` line. Remove `artworkImages` from the
schema import **only if** nothing else in the file references it (check first — leave it if used elsewhere).

- [ ] **Step 4: Add `restore` and `listTrashed`**

Add these two procedures (e.g. right after `delete`):
```ts
  restore: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [a] = await db
        .update(artworks)
        .set({ deletedAt: null, updatedAt: new Date() })
        .where(eq(artworks.id, input.id))
        .returning();
      if (!a) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Artwork not found" });
      }
      return a;
    }),

  listTrashed: protectedProcedure.query(async () => {
    return db.query.artworks.findMany({
      where: (a, { isNull, not }) => not(isNull(a.deletedAt)),
      orderBy: (a, { desc }) => [desc(a.deletedAt)],
    });
  }),
```

- [ ] **Step 5: Filter `listPublic` and `getBySlug`**

In `listPublic`, change the `findMany` where to also exclude trashed:
```ts
      where: (a, { eq, and, isNull }) => and(eq(a.published, true), isNull(a.deletedAt)),
```

In `getBySlug`, the existing guard is `if (!a || !a.published) return null;` — extend it:
```ts
      if (!a || !a.published || a.deletedAt) return null;
```

- [ ] **Step 6: Verify types**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: clean. (If `inArray`/`asc` became unused, remove them from the import to keep it clean.)

- [ ] **Step 7: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/trpc/routers/artworks.ts
git commit -m "feat(db): soft-delete artworks (delete sets deleted_at, add restore + listTrashed)"
```

---

### Task 3: Hide trashed pieces from public slug lookups

**Files:**
- Modify: `packages/db/src/trpc/routers/auctions.ts` (line ~12)
- Modify: `packages/db/src/trpc/routers/products.ts` (lines ~37, ~67)

- [ ] **Step 1: auctions.getByArtworkSlug**

In `auctions.ts` line 2, change `import { eq } from "drizzle-orm";` to:
```ts
import { eq, and, isNull } from "drizzle-orm";
```
Then change the slug lookup (line ~11):
```ts
      const artwork = await db.query.artworks.findFirst({
        where: and(eq(artworks.slug, input.slug), isNull(artworks.deletedAt)),
      });
```

- [ ] **Step 2: products.getByArtworkSlug and listByArtworkSlug**

`products.ts` already imports `and`. Add `isNull`:
```ts
import { eq, and, isNull } from "drizzle-orm";
```
Then in **both** `getByArtworkSlug` (line ~37) and `listByArtworkSlug` (line ~67), change:
```ts
        where: eq(artworks.slug, input.slug),
```
to:
```ts
        where: and(eq(artworks.slug, input.slug), isNull(artworks.deletedAt)),
```

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/trpc/routers/auctions.ts packages/db/src/trpc/routers/products.ts
git commit -m "feat(db): exclude soft-deleted artworks from public slug lookups"
```

---

### Task 4: Integration tests for soft delete

**Files:**
- Create: `packages/db/src/trpc/routers/artworks-soft-delete.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { describe, it, expect, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { artworks, products, productVariants, orders } from "../../schema";

const ctx = { db, userId: "test-admin" } as const;
const caller = createCaller(ctx);

const suffix = `${Date.now()}-${Math.random()}`;
const slug = `soft-del-${suffix}`;
const createdArtworkIds: string[] = [];

async function makeArtwork(s: string, title: string) {
  const a = await caller.artworks.create({ title, slug: s, published: true });
  createdArtworkIds.push(a.id);
  return a;
}

afterAll(async () => {
  // orders/variants/products are created only in the guard test; clean defensively.
  for (const id of createdArtworkIds) {
    const prods = await db.select({ id: products.id }).from(products).where(eq(products.artworkId, id));
    for (const p of prods) {
      const vars = await db.select({ id: productVariants.id }).from(productVariants).where(eq(productVariants.productId, p.id));
      for (const v of vars) {
        await db.delete(orders).where(eq(orders.productVariantId, v.id));
      }
      await db.delete(productVariants).where(eq(productVariants.productId, p.id));
    }
    await db.delete(products).where(eq(products.artworkId, id));
    await db.delete(artworks).where(eq(artworks.id, id));
  }
});

describe("artworks soft delete", () => {
  it("delete sets deleted_at, keeps the row, and hides it from list/listPublic/getBySlug", async () => {
    const a = await makeArtwork(slug, "Soft Delete Target");

    await caller.artworks.delete({ id: a.id });

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row).toBeTruthy();
    expect(row!.deletedAt).not.toBeNull();

    const list = await caller.artworks.list();
    expect(list.some((x) => x.id === a.id)).toBe(false);

    const pub = await caller.artworks.listPublic();
    expect(pub.some((x) => x.id === a.id)).toBe(false);

    const bySlug = await caller.artworks.getBySlug({ slug });
    expect(bySlug).toBeNull();
  });

  it("restore clears deleted_at and brings the piece back into list", async () => {
    const a = await makeArtwork(`${slug}-restore`, "Restore Target");
    await caller.artworks.delete({ id: a.id });
    await caller.artworks.restore({ id: a.id });

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row!.deletedAt).toBeNull();

    const list = await caller.artworks.list();
    expect(list.some((x) => x.id === a.id)).toBe(true);

    const trashed = await caller.artworks.listTrashed();
    expect(trashed.some((x) => x.id === a.id)).toBe(false);
  });

  it("listTrashed returns only trashed pieces", async () => {
    const live = await makeArtwork(`${slug}-live`, "Live Piece");
    const dead = await makeArtwork(`${slug}-dead`, "Dead Piece");
    await caller.artworks.delete({ id: dead.id });

    const trashed = await caller.artworks.listTrashed();
    expect(trashed.some((x) => x.id === dead.id)).toBe(true);
    expect(trashed.some((x) => x.id === live.id)).toBe(false);
  });

  it("delete is blocked (CONFLICT) when the piece has an order, and deleted_at stays null", async () => {
    const a = await makeArtwork(`${slug}-guard`, "Guarded Piece");
    const [p] = await db.insert(products).values({ artworkId: a.id, name: "Print", productType: "print" }).returning();
    const [v] = await db
      .insert(productVariants)
      .values({ productId: p.id, name: "A3", price: "100", stock: 1 })
      .returning();
    await db.insert(orders).values({
      productVariantId: v.id,
      buyerName: "Buyer",
      buyerEmail: `buyer-${suffix}@example.com`,
      amountPaid: "100",
      status: "paid",
    });

    await expect(caller.artworks.delete({ id: a.id })).rejects.toThrow(/order/i);

    const row = await db.query.artworks.findFirst({ where: eq(artworks.id, a.id) });
    expect(row!.deletedAt).toBeNull();
  });
});
```

**Note:** the exact column set for `products`/`productVariants`/`orders` inserts must match the
current schema. Before running, open `packages/db/src/schema.ts` and confirm the required
(NOT NULL, no-default) fields for these three tables. Adjust the insert `.values({...})` above
to satisfy them (e.g. add any required column this snippet omits). This is the one place to
cross-check against schema rather than copy blindly.

- [ ] **Step 2: Run the tests**

Run: `pnpm --filter @vamy/db test artworks-soft-delete`
Expected: 4 passing. If an insert fails on a missing required column, fix the `.values({...})` per the note and re-run. Confirm no leftover rows by re-running once (idempotent cleanup).

- [ ] **Step 3: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/trpc/routers/artworks-soft-delete.test.ts
git commit -m "test(db): soft delete + restore + guard integration tests"
```

---

### Task 5: Studio Trash view + Restore

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

Context: `ArtworksPage` already uses `trpc.artworks.list.useQuery()` (as `artworkList` /
`refetchArtworks`), `useToast`, `revalidatePaths`, and `trpc.useUtils()`. The "Delete piece"
button lives in `EditPiecePanel` and needs **no change** (its `artworks.delete` mutation is now
soft). Add the Trash UI to the page.

- [ ] **Step 1: Add trash query + restore mutation + toggle state**

Near the other hooks at the top of `ArtworksPage`, add:
```tsx
  const [showTrash, setShowTrash] = useState(false);
  const { data: trashedList, refetch: refetchTrashed } = trpc.artworks.listTrashed.useQuery(undefined, {
    enabled: showTrash,
  });
  const restore = trpc.artworks.restore.useMutation({
    onSuccess: async () => {
      await revalidatePaths(["/", "/gallery"]);
      refetchArtworks();
      refetchTrashed();
      toast("Piece restored", "success");
    },
    onError: (e) => toast(e.message || "Failed to restore", "error"),
  });
```
(`useState` is already imported.)

- [ ] **Step 2: Render the Trash section**

At the bottom of the page's returned JSX (just before the closing wrapper element), add:
```tsx
      <div className="mt-10 border-t pt-6">
        <button
          onClick={() => setShowTrash((s) => !s)}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          {showTrash ? "Hide trash" : "Show trash"}
        </button>
        {showTrash && (
          <div className="mt-4 space-y-2">
            {trashedList && trashedList.length === 0 && (
              <p className="text-sm text-gray-400">Trash is empty.</p>
            )}
            {trashedList?.map((a) => (
              <div key={a.id} className="flex items-center justify-between border rounded px-3 py-2 bg-gray-50">
                <div className="text-sm">
                  <span className="font-medium text-gray-700">{a.title}</span>
                  <span className="ml-2 text-gray-400">/{a.slug}</span>
                </div>
                <button
                  onClick={() => restore.mutate({ id: a.id })}
                  disabled={restore.isPending}
                  className="text-sm px-3 py-1 rounded border text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
```
Match the surrounding JSX placement (the page already has a clear single root wrapper — insert
inside it as the last child). If exact insertion point is ambiguous, place it immediately after
the existing pieces/products list block and before the wrapper's closing tag.

- [ ] **Step 3: Verify types**

Run: `pnpm --filter @vamy/admin exec tsc --noEmit`
Expected: only the pre-existing ~6 `newVariantForm` baseline errors. **No new errors** referencing the trash code, `listTrashed`, or `restore`. If new errors appear, fix them before committing.

- [ ] **Step 4: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add "apps/admin/app/(dashboard)/artworks/page.tsx"
git commit -m "feat(admin): Trash view with Restore on pieces page"
```

---

## Final verification (controller, after all tasks)

- [ ] `pnpm --filter @vamy/db exec tsc --noEmit` — clean.
- [ ] `pnpm --filter @vamy/db test` — all green (new soft-delete tests + existing suites).
- [ ] `pnpm --filter @vamy/admin exec tsc --noEmit` — only the known `newVariantForm` baseline, no new errors.
- [ ] Visual check of the Trash toggle / Restore is left to the user.
