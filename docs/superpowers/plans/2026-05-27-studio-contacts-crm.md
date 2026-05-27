# Studio Contacts / CRM Foundation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a canonical `contacts` entity (keyed by email) kept in step with the five existing person-bearing tables via an upsert on every touchpoint, surfaced in the studio as a searchable, editable **People** page with a live per-person activity timeline.

**Architecture:** A new `contacts` table stores only identity (email, name) and human-entered fields (tags, notes, doNotContact). A shared `upsertContact(executor, {email, name})` helper is called from all five public touchpoints (inquiries, bids, newsletter, waitlist, Stripe-webhook order insert); it fills a missing name but never clobbers existing name/tags/notes/doNotContact, and no-ops on empty email. Per-person activity is **derived** at read time by querying the source tables by email — never denormalized. A `contactsRouter` (list/get/update) and a `/people` studio page complete the slice.

**Tech Stack:** Drizzle ORM + Postgres (Supabase), tRPC v11, Next.js App Router (admin), vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-05-27-studio-contacts-crm-design.md`

---

## Conventions for the implementer

- **Always `cd /home/blox-master/business/vamy/website/vamy.art` before any `git` command** (the repo root). The shell working directory can drift; git commands fail with "pathspec did not match" when run from a subdir.
- **Branch is already created:** `feat/studio-contacts-crm`. Do all work there. Do **not** push or open a PR until the final task — pushes trigger Netlify builds and we batch into one PR.
- **Typecheck:** `pnpm --filter @vamy/db exec tsc --noEmit` and `pnpm --filter @vamy/admin exec tsc --noEmit`. Do **not** run `next lint` (no eslint config; it prompts interactively).
- **DB tests:** `pnpm --filter @vamy/db test` (vitest). Tests hit the real Supabase dev DB via `DATABASE_URL` from `.env.local`; they create and clean up their own rows. Follow the existing `waitlist.test.ts` create/track/`afterAll`-delete pattern exactly.
- **Pre-existing tsc baseline in `apps/admin`:** ~6 `newVariantForm` possibly-null errors in `artworks/page.tsx`. These are out of scope — do not fix them and do not introduce new ones.

---

## File Structure

**Create:**
- `packages/db/src/services/upsert-contact.ts` — the shared upsert helper.
- `packages/db/src/services/upsert-contact.test.ts` — helper unit tests.
- `packages/db/src/trpc/routers/contacts.ts` — `contactsRouter` (list/get/update).
- `packages/db/src/trpc/routers/contacts.test.ts` — router tests.
- `packages/db/scripts/backfill-contacts.ts` — one-time idempotent backfill.
- `apps/admin/app/(dashboard)/people/page.tsx` — the People studio page.

**Modify:**
- `packages/db/src/schema.ts` — add `contacts` table (+ `sql` import for the array default).
- `packages/db/src/index.ts` — export `upsertContact`.
- `packages/db/src/trpc/root.ts` — register `contacts: contactsRouter`.
- `packages/db/src/trpc/routers/inquiries.ts` — call `upsertContact` in `create`.
- `packages/db/src/trpc/routers/newsletter.ts` — call `upsertContact` in `subscribe`.
- `packages/db/src/trpc/routers/waitlist.ts` — call `upsertContact` in `subscribe`.
- `packages/db/src/trpc/routers/bids.ts` — call `upsertContact` inside the existing tx in `place`.
- `apps/website/app/api/webhooks/stripe/route.ts` — call `upsertContact` inside the existing tx after the order insert.
- `apps/admin/app/(dashboard)/layout.tsx` — add the "People" nav item.

---

## Task 1: `contacts` schema + migration

**Files:**
- Modify: `packages/db/src/schema.ts` (add import + new table after `newsletterSubscribers`, ~line 162)
- Migration: generated into `packages/db/migrations/`

- [ ] **Step 1: Add the `sql` import**

In `packages/db/src/schema.ts`, the current line 14 is:

```ts
import { relations } from "drizzle-orm";
```

Change it to:

```ts
import { relations, sql } from "drizzle-orm";
```

- [ ] **Step 2: Add the `contacts` table**

In `packages/db/src/schema.ts`, immediately after the `newsletterSubscribers` table definition (the block ending at line ~161, before the blank line preceding `shippingMethods`), insert:

```ts
// ─── Contacts (CRM) ───────────────────────────────────────────────────────────
// Canonical person, keyed by email. Identity (email/name) is upserted from every
// touchpoint; tags/notes/doNotContact are artist-entered and never auto-clobbered.
// Per-person activity history is derived at read time from the source tables.
export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name"),
  tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
  notes: text("notes"),
  doNotContact: boolean("do_not_contact").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
```

- [ ] **Step 3: Generate the migration**

Run: `pnpm --filter @vamy/db generate`
Expected: drizzle-kit prints that it created a new SQL file `packages/db/migrations/0008_*.sql` containing `CREATE TABLE "contacts" (...)` with a unique constraint on `email`. Verify the file exists and contains `CREATE TABLE "contacts"`.

- [ ] **Step 4: Apply the migration to the dev DB**

Run: `pnpm --filter @vamy/db migrate`
Expected: completes without error. Confirm by running:
`pnpm --filter @vamy/db exec tsx -e "import {db,contacts} from './src/index.ts'; db.select().from(contacts).limit(1).then(r=>{console.log('contacts table OK', r); process.exit(0)}).catch(e=>{console.error(e); process.exit(1)})"`
Expected: prints `contacts table OK []` (empty array — table exists, no rows yet).

- [ ] **Step 5: Typecheck**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: no new errors (the db package has no pre-existing errors; must stay clean).

- [ ] **Step 6: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/schema.ts packages/db/migrations/
git commit -m "feat(db): add contacts table (CRM foundation)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: `upsertContact` helper (TDD)

**Files:**
- Create: `packages/db/src/services/upsert-contact.ts`
- Create: `packages/db/src/services/upsert-contact.test.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/services/upsert-contact.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { inArray, eq } from "drizzle-orm";
import { db } from "../client";
import { contacts } from "../schema";
import { upsertContact } from "./upsert-contact";

const emails: string[] = [];
function uniq(label: string) {
  const e = `${label}-${Date.now()}-${Math.random()}@example.com`;
  emails.push(e);
  return e;
}

afterAll(async () => {
  if (emails.length) {
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

describe("upsertContact", () => {
  it("creates a new contact with email and name", async () => {
    const email = uniq("new");
    await upsertContact(db, { email, name: "Ada Lovelace" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
    expect(row.name).toBe("Ada Lovelace");
    expect(row.tags).toEqual([]);
    expect(row.doNotContact).toBe(false);
  });

  it("fills a previously-missing name on a later touchpoint", async () => {
    const email = uniq("fill");
    await upsertContact(db, { email, name: null });
    await upsertContact(db, { email, name: "Grace Hopper" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row.name).toBe("Grace Hopper");
  });

  it("never overwrites an existing name, tags, notes, or doNotContact", async () => {
    const email = uniq("preserve");
    await upsertContact(db, { email, name: "Original Name" });
    // Simulate artist edits + a different inbound name.
    await db
      .update(contacts)
      .set({ tags: ["VIP"], notes: "met at gallery", doNotContact: true })
      .where(eq(contacts.email, email));
    await upsertContact(db, { email, name: "Different Name" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row.name).toBe("Original Name");
    expect(row.tags).toEqual(["VIP"]);
    expect(row.notes).toBe("met at gallery");
    expect(row.doNotContact).toBe(true);
  });

  it("no-ops on empty or whitespace email", async () => {
    await upsertContact(db, { email: "", name: "Nobody" });
    await upsertContact(db, { email: "   ", name: "Nobody" });
    const rows = await db.select().from(contacts).where(eq(contacts.name, "Nobody"));
    expect(rows.length).toBe(0);
  });

  it("trims and lowercases the email", async () => {
    const base = uniq("Case");
    await upsertContact(db, { email: `  ${base.toUpperCase()}  `, name: "Trimmed" });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, base.toLowerCase()));
    expect(row).toBeTruthy();
    emails.push(base.toLowerCase());
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vamy/db test upsert-contact`
Expected: FAIL — cannot find module `./upsert-contact` (file not created yet).

- [ ] **Step 3: Implement the helper**

Create `packages/db/src/services/upsert-contact.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "../client";
import { contacts } from "../schema";

// Accepts either the db proxy or a transaction handle, so callers already inside
// a db.transaction(...) (orders, bids) can pass their tx and compose atomically.
type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Upsert the canonical contact for an email.
 * - No-op on empty/whitespace email.
 * - Fills `name` only when the stored name is null/empty; never overwrites it.
 * - Never touches tags/notes/doNotContact (artist-owned fields).
 */
export async function upsertContact(
  executor: DbExecutor,
  input: { email: string; name?: string | null },
): Promise<void> {
  const email = input.email.trim().toLowerCase();
  if (!email) return;
  const name = input.name?.trim() || null;

  await executor
    .insert(contacts)
    .values({ email, name })
    .onConflictDoUpdate({
      target: contacts.email,
      set: {
        name: sql`coalesce(nullif(${contacts.name}, ''), excluded.name)`,
        updatedAt: new Date(),
      },
    });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @vamy/db test upsert-contact`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Export the helper from the package index**

In `packages/db/src/index.ts`, after the `restock-notify` export block (the last export, ending ~line 13), add:

```ts
export { upsertContact } from "./services/upsert-contact";
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/services/upsert-contact.ts packages/db/src/services/upsert-contact.test.ts packages/db/src/index.ts
git commit -m "feat(db): add upsertContact helper with tests

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Wire the five touchpoints

Each touchpoint gains one `upsertContact` call. The two transactional callers (bids, Stripe webhook) pass their `tx`; the others pass `db`. Wrap each call so a contacts failure can never break the primary flow only where the call is **outside** a transaction (inquiries/newsletter/waitlist) — inside a transaction we want it to participate so it rolls back together, which is correct.

**Files:**
- Modify: `packages/db/src/trpc/routers/inquiries.ts`
- Modify: `packages/db/src/trpc/routers/newsletter.ts`
- Modify: `packages/db/src/trpc/routers/waitlist.ts`
- Modify: `packages/db/src/trpc/routers/bids.ts`
- Modify: `apps/website/app/api/webhooks/stripe/route.ts`
- Create: `packages/db/src/trpc/routers/contacts-sync.test.ts`

- [ ] **Step 1: Write the failing integration test**

Create `packages/db/src/trpc/routers/contacts-sync.test.ts`:

```ts
import { describe, it, expect, afterAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { contacts, inquiries, newsletterSubscribers } from "../../schema";

const ctx = { db, userId: null } as const;
const emails: string[] = [];

afterAll(async () => {
  if (emails.length) {
    await db.delete(inquiries).where(inArray(inquiries.email, emails));
    await db.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.email, emails));
    await db.delete(contacts).where(inArray(contacts.email, emails));
  }
});

describe("contact sync on touchpoints", () => {
  it("creates a contact when an inquiry is submitted", async () => {
    const email = `inq-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const caller = createCaller(ctx);
    await caller.inquiries.create({
      name: "Inq Person",
      email,
      pieceInterest: "Whispers",
      message: "hi",
    });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
    expect(row.name).toBe("Inq Person");
  });

  it("creates a contact when someone subscribes to the newsletter", async () => {
    const email = `news-${Date.now()}-${Math.random()}@example.com`;
    emails.push(email);
    const caller = createCaller(ctx);
    await caller.newsletter.subscribe({ email });
    const [row] = await db.select().from(contacts).where(eq(contacts.email, email));
    expect(row).toBeTruthy();
  });
});
```

> Note: `inquiries.create` and `newsletter.subscribe` make outbound Resend/Buttondown calls. In the dev environment these may log a failure but must not throw (newsletter already swallows Buttondown errors; inquiries' Resend call may reject if `RESEND_API_KEY` is unset). If the inquiries test flakes because Resend throws, that is a pre-existing behavior of `inquiries.create`, not this task — see Step 3 for where the upsert must sit (before the email sends) so the contact is written regardless.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vamy/db test contacts-sync`
Expected: FAIL — no contact row found (upserts not wired yet).

- [ ] **Step 3: Wire `inquiries.create`**

In `packages/db/src/trpc/routers/inquiries.ts`:

Change the import line:
```ts
import { inquiries } from "../../schema";
```
to:
```ts
import { inquiries } from "../../schema";
import { upsertContact } from "../../services/upsert-contact";
```

Then in the `create` mutation, the current body starts:
```ts
      const resend = new Resend(process.env.RESEND_API_KEY);
      await db.insert(inquiries).values(input);
```
Change to:
```ts
      const resend = new Resend(process.env.RESEND_API_KEY);
      await db.insert(inquiries).values(input);
      await upsertContact(db, { email: input.email, name: input.name });
```

- [ ] **Step 4: Wire `newsletter.subscribe`**

In `packages/db/src/trpc/routers/newsletter.ts`:

Change the import line:
```ts
import { newsletterSubscribers } from "../../schema";
```
to:
```ts
import { newsletterSubscribers } from "../../schema";
import { upsertContact } from "../../services/upsert-contact";
```

Then, immediately after the local insert block:
```ts
      await db
        .insert(newsletterSubscribers)
        .values({ email: input.email })
        .onConflictDoNothing();
```
add:
```ts
      await upsertContact(db, { email: input.email });
```

- [ ] **Step 5: Wire `waitlist.subscribe`**

In `packages/db/src/trpc/routers/waitlist.ts`:

Change the import line:
```ts
import { variantWaitlist, productVariants } from "../../schema";
```
to:
```ts
import { variantWaitlist, productVariants } from "../../schema";
import { upsertContact } from "../../services/upsert-contact";
```

Then, after the `onConflictDoUpdate(...)` block in `subscribe` and before `return { success: true };`, add:
```ts
      await upsertContact(db, { email: input.email });
```

- [ ] **Step 6: Wire `bids.place` (inside the existing transaction)**

In `packages/db/src/trpc/routers/bids.ts`:

Change the import line:
```ts
import { bids, auctions } from "../../schema";
```
to:
```ts
import { bids, auctions } from "../../schema";
import { upsertContact } from "../../services/upsert-contact";
```

Inside the `db.transaction(async (tx) => { ... })` block, after the `tx.update(auctions)...where(eq(auctions.id, input.auctionId));` call and before `return [auctionRow, inserted] as const;`, add:
```ts
        await upsertContact(tx, { email: input.bidderEmail, name: input.bidderName });
```

- [ ] **Step 7: Wire the Stripe webhook (inside the existing transaction)**

In `apps/website/app/api/webhooks/stripe/route.ts`:

Change the import to include `upsertContact`. The current line 3 is:
```ts
import { db, orders, productVariants, escapeHtml, renderOrderReceiptHtml, notifyWaitlistForVariant, detectRestockTransition } from "@vamy/db";
```
Change to:
```ts
import { db, orders, productVariants, escapeHtml, renderOrderReceiptHtml, notifyWaitlistForVariant, detectRestockTransition, upsertContact } from "@vamy/db";
```

Inside the `db.transaction(async (tx) => { ... })`, the block currently ends:
```ts
      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`GREATEST(stock_quantity - 1, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));

      return rows;
```
Change to:
```ts
      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`GREATEST(stock_quantity - 1, 0)`, updatedAt: new Date() })
        .where(eq(productVariants.id, variantId));

      await upsertContact(tx, { email: customer?.email ?? "", name: customer?.name ?? null });

      return rows;
```

(The helper no-ops on empty email, so a guest checkout missing an email is safe.)

- [ ] **Step 8: Run the integration test to verify it passes**

Run: `pnpm --filter @vamy/db test contacts-sync`
Expected: PASS — both contact rows found. (If the inquiries case throws due to Resend in dev, set a throwaway `RESEND_API_KEY` is **not** required — `resend.emails.send` rejects are awaited after the upsert, so the contact is already written; if the whole mutation rejects, re-confirm the upsert line sits immediately after the inquiries insert as in Step 3.)

- [ ] **Step 9: Typecheck both packages**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: no errors.
Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors versus baseline.

- [ ] **Step 10: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/trpc/routers/inquiries.ts packages/db/src/trpc/routers/newsletter.ts packages/db/src/trpc/routers/waitlist.ts packages/db/src/trpc/routers/bids.ts packages/db/src/trpc/routers/contacts-sync.test.ts apps/website/app/api/webhooks/stripe/route.ts
git commit -m "feat(db): upsert contact on every touchpoint (inquiry/bid/order/newsletter/waitlist)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Backfill script

**Files:**
- Create: `packages/db/scripts/backfill-contacts.ts`

- [ ] **Step 1: Write the script**

Create `packages/db/scripts/backfill-contacts.ts`:

```ts
/**
 * One-time, idempotent backfill: unions distinct non-empty emails from inquiries,
 * orders, bids, variant_waitlist, and newsletter_subscribers into `contacts`,
 * taking the earliest-seen name per email. Safe to re-run (all upserts).
 *
 * Run with: pnpm --filter @vamy/db exec tsx scripts/backfill-contacts.ts
 */
import { db } from "../src/client";
import { inquiries, orders, bids } from "../src/schema";
import { upsertContact } from "../src/services/upsert-contact";

async function main() {
  // Collect {email, name, seenAt} from every source, then upsert earliest-first
  // so the earliest name wins (upsertContact only fills a missing name).
  const rows: { email: string; name: string | null; seenAt: Date }[] = [];

  const inqs = await db
    .select({ email: inquiries.email, name: inquiries.name, seenAt: inquiries.createdAt })
    .from(inquiries);
  rows.push(...inqs);

  const ords = await db
    .select({ email: orders.buyerEmail, name: orders.buyerName, seenAt: orders.createdAt })
    .from(orders);
  rows.push(...ords);

  const bds = await db
    .select({ email: bids.bidderEmail, name: bids.bidderName, seenAt: bids.createdAt })
    .from(bids);
  rows.push(...bds);

  // waitlist + newsletter have no name column
  const wl = await db.execute<{ email: string; seen_at: Date }>(
    // raw to avoid importing extra symbols; columns are stable
    // eslint-disable-next-line
    require("drizzle-orm").sql`select email, created_at as seen_at from variant_waitlist`,
  );
  for (const r of wl as unknown as { email: string; seen_at: Date }[]) {
    rows.push({ email: r.email, name: null, seenAt: r.seen_at });
  }

  const ns = await db.execute<{ email: string; seen_at: Date }>(
    require("drizzle-orm").sql`select email, subscribed_at as seen_at from newsletter_subscribers`,
  );
  for (const r of ns as unknown as { email: string; seen_at: Date }[]) {
    rows.push({ email: r.email, name: null, seenAt: r.seen_at });
  }

  // Earliest first so the earliest name fills the contact.
  rows.sort((a, b) => new Date(a.seenAt).getTime() - new Date(b.seenAt).getTime());

  const seen = new Set<string>();
  let count = 0;
  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email) continue;
    await upsertContact(db, { email, name: r.name });
    if (!seen.has(email)) {
      seen.add(email);
      count++;
    }
  }

  console.log(`[backfill-contacts] processed ${rows.length} source rows → ${count} distinct contacts`);
  process.exit(0);
}

main().catch((err) => {
  console.error("[backfill-contacts] failed:", err);
  process.exit(1);
});
```

> If `db.execute` typing is awkward, prefer the typed query-builder form instead: import `variantWaitlist` and `newsletterSubscribers` from `../src/schema` and use `db.select({ email: variantWaitlist.email, seenAt: variantWaitlist.createdAt }).from(variantWaitlist)` (and the newsletter equivalent with `subscribedAt`). Use whichever compiles cleanly — both are equivalent; the typed form is preferred.

- [ ] **Step 2: Prefer the typed form (replace the two raw blocks)**

Replace the two `db.execute(... require("drizzle-orm").sql ...)` blocks with typed selects:

```ts
import { inquiries, orders, bids, variantWaitlist, newsletterSubscribers } from "../src/schema";
```
```ts
  const wl = await db
    .select({ email: variantWaitlist.email, seenAt: variantWaitlist.createdAt })
    .from(variantWaitlist);
  for (const r of wl) rows.push({ email: r.email, name: null, seenAt: r.seenAt });

  const ns = await db
    .select({ email: newsletterSubscribers.email, seenAt: newsletterSubscribers.subscribedAt })
    .from(newsletterSubscribers);
  for (const r of ns) rows.push({ email: r.email, name: null, seenAt: r.seenAt });
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the backfill against the dev DB**

Run: `pnpm --filter @vamy/db exec tsx scripts/backfill-contacts.ts`
Expected: prints `[backfill-contacts] processed N source rows → M distinct contacts` and exits 0.

- [ ] **Step 5: Verify idempotency (run again)**

Run: `pnpm --filter @vamy/db exec tsx scripts/backfill-contacts.ts`
Expected: same `M distinct contacts` count; no errors, no duplicate-key crash.

- [ ] **Step 6: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/scripts/backfill-contacts.ts
git commit -m "feat(db): one-time idempotent contacts backfill script

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: `contactsRouter` (list / get / update) — TDD

**Files:**
- Create: `packages/db/src/trpc/routers/contacts.ts`
- Create: `packages/db/src/trpc/routers/contacts.test.ts`
- Modify: `packages/db/src/trpc/root.ts`

**Design note (deliberate simplification of the spec):** the spec described list `lastActivityAt` as `max(createdAt)` across the five source tables. Because `upsertContact` bumps `contacts.updatedAt` on **every** touchpoint, `updatedAt` already tracks last activity (give or take infrequent artist edits) without a per-row correlated subquery. The list therefore orders by and displays `contacts.updatedAt`. This is intentional and simpler; documented here so it is a visible decision, not drift.

- [ ] **Step 1: Write the failing test**

Create `packages/db/src/trpc/routers/contacts.test.ts`:

```ts
import { describe, it, expect, afterAll, beforeAll } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { createCaller } from "../root";
import { db } from "../../client";
import { contacts, inquiries, bids, auctions, artworks } from "../../schema";

const ctx = { db, userId: null } as const;

const email = `crm-${Date.now()}-${Math.random()}@example.com`;
let artworkId: string;
let auctionId: string;

beforeAll(async () => {
  // Seed a contact via the helper path (an inquiry) + a separate bid for timeline merge.
  const caller = createCaller(ctx);
  await caller.inquiries.create({
    name: "Timeline Tester",
    email,
    pieceInterest: "Aurora",
    message: "interested",
  });
  const [aw] = await db.insert(artworks).values({ slug: `crm-${Date.now()}-${Math.random()}`, title: "Aurora" }).returning();
  artworkId = aw.id;
  const [auc] = await db
    .insert(auctions)
    .values({ artworkId: aw.id, minBid: "100", deadline: new Date(Date.now() + 86400000) })
    .returning();
  auctionId = auc.id;
  await db.insert(bids).values({ auctionId: auc.id, bidderName: "Timeline Tester", bidderEmail: email, amount: "150" });
});

afterAll(async () => {
  await db.delete(bids).where(eq(bids.auctionId, auctionId));
  await db.delete(auctions).where(eq(auctions.id, auctionId));
  await db.delete(artworks).where(eq(artworks.id, artworkId));
  await db.delete(inquiries).where(eq(inquiries.email, email));
  await db.delete(contacts).where(eq(contacts.email, email));
});

describe("contacts.list", () => {
  it("finds a contact by email search", async () => {
    const caller = createCaller(ctx);
    const res = await caller.contacts.list({ search: email });
    expect(res.items.some((c) => c.email === email)).toBe(true);
    expect(typeof res.total).toBe("number");
  });
});

describe("contacts.get", () => {
  it("returns the contact plus a merged, newest-first timeline", async () => {
    const caller = createCaller(ctx);
    const list = await caller.contacts.list({ search: email });
    const id = list.items.find((c) => c.email === email)!.id;
    const res = await caller.contacts.get({ id });
    expect(res.contact.email).toBe(email);
    const types = res.timeline.map((e) => e.type);
    expect(types).toContain("inquiry");
    expect(types).toContain("bid");
    // newest-first
    for (let i = 1; i < res.timeline.length; i++) {
      expect(new Date(res.timeline[i - 1].at).getTime()).toBeGreaterThanOrEqual(
        new Date(res.timeline[i].at).getTime(),
      );
    }
  });
});

describe("contacts.update", () => {
  it("updates only tags, notes, and doNotContact", async () => {
    const caller = createCaller(ctx);
    const list = await caller.contacts.list({ search: email });
    const id = list.items.find((c) => c.email === email)!.id;
    const updated = await caller.contacts.update({
      id,
      tags: ["collector", "VIP"],
      notes: "met at the spring show",
      doNotContact: true,
    });
    expect(updated.tags).toEqual(["collector", "VIP"]);
    expect(updated.notes).toBe("met at the spring show");
    expect(updated.doNotContact).toBe(true);
    expect(updated.email).toBe(email); // identity unchanged
  });

  it("rejects an unauthenticated caller", async () => {
    const anon = createCaller({ db, userId: null } as const);
    // protectedProcedure throws UNAUTHORIZED regardless of input
    await expect(anon.contacts.list({})).rejects.toThrow();
  });
});
```

> Note: the last assertion documents that these are `protectedProcedure`s. The test `ctx` uses `userId: null`, so **all** `contacts.*` calls would throw UNAUTHORIZED. To let the authenticated tests run, the test `ctx` must carry a non-null `userId`. **Fix in Step 1b before running.**

- [ ] **Step 1b: Use an authenticated context for the authenticated tests**

In `contacts.test.ts`, change the top context to authenticated and add a separate anon caller only for the rejection test:

```ts
const ctx = { db, userId: "test-admin" } as const;
```
And in the "rejects an unauthenticated caller" test, keep `const anon = createCaller({ db, userId: null } as const);`. Remove the `userId: null` from the main `ctx`. (The `inquiries.create` in `beforeAll` is a public procedure, so it works under either context.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @vamy/db test contacts.test`
Expected: FAIL — `caller.contacts` is undefined (router not created/registered).

- [ ] **Step 3: Implement the router**

Create `packages/db/src/trpc/routers/contacts.ts`:

```ts
import { z } from "zod";
import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../index";
import { db } from "../../client";
import { contacts, inquiries, bids, orders, variantWaitlist, newsletterSubscribers } from "../../schema";

export type TimelineEvent = {
  type: "inquiry" | "bid" | "order" | "waitlist" | "subscription";
  at: Date;
  summary: string;
};

export const contactsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          tag: z.string().optional(),
          page: z.number().int().min(1).default(1),
          pageSize: z.number().int().min(1).max(100).default(50),
        })
        .default({}),
    )
    .query(async ({ input }) => {
      const conds = [];
      if (input.search?.trim()) {
        const q = `%${input.search.trim()}%`;
        conds.push(or(ilike(contacts.name, q), ilike(contacts.email, q)));
      }
      if (input.tag?.trim()) {
        // array membership: tag = ANY(tags)
        conds.push(sql`${input.tag} = any(${contacts.tags})`);
      }
      const where = conds.length ? and(...conds) : undefined;

      const [items, totalRow] = await Promise.all([
        db
          .select()
          .from(contacts)
          .where(where)
          .orderBy(desc(contacts.updatedAt))
          .limit(input.pageSize)
          .offset((input.page - 1) * input.pageSize),
        db.select({ count: sql<number>`count(*)::int` }).from(contacts).where(where),
      ]);

      return {
        items,
        total: totalRow[0]?.count ?? 0,
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  get: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .query(async ({ input }) => {
      const contact = await db.query.contacts.findFirst({ where: eq(contacts.id, input.id) });
      if (!contact) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });

      const email = contact.email;
      const [inqs, bds, ords, wl, ns] = await Promise.all([
        db.select().from(inquiries).where(eq(inquiries.email, email)),
        db.select().from(bids).where(eq(bids.bidderEmail, email)),
        db.select().from(orders).where(eq(orders.buyerEmail, email)),
        db.select().from(variantWaitlist).where(eq(variantWaitlist.email, email)),
        db.select().from(newsletterSubscribers).where(eq(newsletterSubscribers.email, email)),
      ]);

      const timeline: TimelineEvent[] = [
        ...inqs.map((r) => ({
          type: "inquiry" as const,
          at: r.createdAt,
          summary: `Inquired about ${r.pieceInterest}${r.handledAt ? " (handled)" : ""}`,
        })),
        ...bds.map((r) => ({
          type: "bid" as const,
          at: r.createdAt,
          summary: `Bid €${Number(r.amount).toLocaleString()}`,
        })),
        ...ords.map((r) => ({
          type: "order" as const,
          at: r.createdAt,
          summary: `Ordered (€${Number(r.amountPaid).toLocaleString()}, ${r.status})`,
        })),
        ...wl.map((r) => ({
          type: "waitlist" as const,
          at: r.createdAt,
          summary: `Joined a waitlist${r.notifiedAt ? " (notified)" : ""}`,
        })),
        ...ns.map((r) => ({
          type: "subscription" as const,
          at: r.subscribedAt,
          summary: "Subscribed to the newsletter",
        })),
      ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

      return { contact, timeline };
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        tags: z.array(z.string().min(1)).max(20),
        notes: z.string().nullable(),
        doNotContact: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const [row] = await db
        .update(contacts)
        .set({
          tags: input.tags,
          notes: input.notes,
          doNotContact: input.doNotContact,
          updatedAt: new Date(),
        })
        .where(eq(contacts.id, input.id))
        .returning();
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "Contact not found" });
      return row;
    }),
});
```

- [ ] **Step 4: Register the router**

In `packages/db/src/trpc/root.ts`:

Add the import after the `waitlistRouter` import (line ~13):
```ts
import { contactsRouter } from "./routers/contacts";
```
Add the registration inside `appRouter` after `waitlist: waitlistRouter,`:
```ts
  contacts: contactsRouter,
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @vamy/db test contacts.test`
Expected: PASS — list/get/update all green; the anon rejection test passes too.

- [ ] **Step 6: Run the full db test suite (no regressions)**

Run: `pnpm --filter @vamy/db test`
Expected: all suites pass (upsert-contact, contacts-sync, contacts, plus pre-existing waitlist/bids/etc.).

- [ ] **Step 7: Typecheck**

Run: `pnpm --filter @vamy/db exec tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add packages/db/src/trpc/routers/contacts.ts packages/db/src/trpc/routers/contacts.test.ts packages/db/src/trpc/root.ts
git commit -m "feat(db): contactsRouter (list/get/update) with derived timeline

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Studio "People" page + nav

**Files:**
- Create: `apps/admin/app/(dashboard)/people/page.tsx`
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

This task has no unit test (UI); verification is typecheck + the final `pnpm --filter @vamy/admin build`. The user owns visual/Playwright verification.

- [ ] **Step 1: Add the "People" nav item**

In `apps/admin/app/(dashboard)/layout.tsx`, the icon import line (top of file) imports from `lucide-react`. Add `Users` to that import. For example, if the import is:
```ts
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, Menu } from "lucide-react";
```
add `Users`:
```ts
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, Menu, Users } from "lucide-react";
```
(If the existing import differs, just add `Users` to the existing destructured list — do not remove anything.)

Then in the `navItems` array (line ~21), add an entry after the `inquiries` ("Messages") item:
```ts
  { href: "/people",    label: "People",         icon: Users },
```

- [ ] **Step 2: Create the People page**

Create `apps/admin/app/(dashboard)/people/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

export default function PeoplePage() {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading } = trpc.contacts.list.useQuery({ search: search.trim() || undefined });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-6">People</h1>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full sm:w-80 mb-6 border rounded-lg px-3 py-2 text-sm"
      />

      {isLoading ? (
        <SkeletonTable rows={6} cols={4} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden lg:block bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Tags</th>
                  <th className="px-4 py-3">Last seen</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 text-sm">
                      No people yet.
                    </td>
                  </tr>
                )}
                {data?.items.map((c) => (
                  <tr
                    key={c.id}
                    onClick={() => setSelectedId(c.id)}
                    className="border-b last:border-0 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3">{c.name || <span className="text-gray-400">—</span>}</td>
                    <td className="px-4 py-3 text-gray-600">{c.email}</td>
                    <td className="px-4 py-3">
                      <TagChips tags={c.tags} />
                      {c.doNotContact && (
                        <span className="ml-1 text-xs text-red-600">do-not-contact</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatDistanceToNow(new Date(c.updatedAt), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="lg:hidden space-y-3">
            {data?.items.length === 0 && (
              <p className="text-center text-gray-400 text-sm py-8">No people yet.</p>
            )}
            {data?.items.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="w-full text-left rounded-lg border bg-white p-4"
              >
                <div className="font-medium">{c.name || c.email}</div>
                <div className="text-sm text-gray-600">{c.email}</div>
                <div className="mt-2"><TagChips tags={c.tags} /></div>
                {c.doNotContact && <div className="text-xs text-red-600 mt-1">do-not-contact</div>}
              </button>
            ))}
          </div>
        </>
      )}

      {selectedId && (
        <ContactDetail id={selectedId} onClose={() => setSelectedId(null)} onSaved={() => toast("contact saved", "success")} />
      )}
    </div>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags?.length) return <span className="text-gray-400">—</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {tags.map((t) => (
        <span key={t} className="text-xs bg-gray-100 border rounded px-2 py-0.5">{t}</span>
      ))}
    </span>
  );
}

function ContactDetail({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.contacts.get.useQuery({ id });
  const [tags, setTags] = useState<string[] | null>(null);
  const [notes, setNotes] = useState<string | null>(null);
  const [dnc, setDnc] = useState<boolean | null>(null);
  const [tagInput, setTagInput] = useState("");

  const update = trpc.contacts.update.useMutation({
    onSuccess: () => {
      utils.contacts.list.invalidate();
      utils.contacts.get.invalidate({ id });
      onSaved();
    },
  });

  if (isLoading || !data) return null;
  const c = data.contact;
  const curTags = tags ?? c.tags;
  const curNotes = notes ?? c.notes ?? "";
  const curDnc = dnc ?? c.doNotContact;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={onClose}>
      <div
        className="w-full sm:max-w-lg max-h-[90vh] overflow-y-auto bg-white rounded-t-lg sm:rounded-lg p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-light">{c.name || c.email}</h2>
            <p className="text-sm text-gray-600">{c.email}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none">×</button>
        </div>

        {/* Tags */}
        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Tags</label>
        <div className="flex flex-wrap gap-1 mb-2">
          {curTags.map((t) => (
            <span key={t} className="text-xs bg-gray-100 border rounded px-2 py-0.5 flex items-center gap-1">
              {t}
              <button onClick={() => setTags(curTags.filter((x) => x !== t))} className="text-gray-400 hover:text-red-600">×</button>
            </span>
          ))}
        </div>
        <input
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && tagInput.trim()) {
              e.preventDefault();
              if (!curTags.includes(tagInput.trim())) setTags([...curTags, tagInput.trim()]);
              setTagInput("");
            }
          }}
          placeholder="Add a tag, press Enter"
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        />

        {/* Notes */}
        <label className="block text-xs uppercase tracking-wide text-gray-500 mb-1">Notes</label>
        <textarea
          value={curNotes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 text-sm mb-4"
        />

        {/* Do not contact */}
        <label className="flex items-center gap-2 text-sm mb-6">
          <input type="checkbox" checked={curDnc} onChange={(e) => setDnc(e.target.checked)} />
          Do not contact
        </label>

        <button
          onClick={() => update.mutate({ id, tags: curTags, notes: curNotes || null, doNotContact: curDnc })}
          disabled={update.isPending}
          className="w-full bg-black text-white py-2.5 text-sm rounded-lg hover:bg-gray-800 disabled:opacity-50 mb-6"
        >
          {update.isPending ? "Saving…" : "Save"}
        </button>

        {/* Timeline */}
        <h3 className="text-xs uppercase tracking-wide text-gray-500 mb-2">Activity</h3>
        <ul className="space-y-2">
          {data.timeline.length === 0 && <li className="text-sm text-gray-400">No activity.</li>}
          {data.timeline.map((e, i) => (
            <li key={i} className="text-sm flex justify-between gap-3">
              <span>{e.summary}</span>
              <span className="text-gray-400 whitespace-nowrap">
                {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck the admin app**

Run: `pnpm --filter @vamy/admin exec tsc --noEmit`
Expected: only the ~6 pre-existing `newVariantForm` errors in `artworks/page.tsx`; **no new errors** from `people/page.tsx` or `layout.tsx`.

- [ ] **Step 4: Build the admin app**

Run: `pnpm --filter @vamy/admin build`
Expected: build succeeds; the route list includes `/people`. If `next build` modifies `apps/admin/next-env.d.ts` (adds a `routes.d.ts` reference), revert it with `git checkout apps/admin/next-env.d.ts` so the PR stays clean.

- [ ] **Step 5: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add "apps/admin/app/(dashboard)/people/page.tsx" "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): People (contacts CRM) page with editable tags/notes + timeline

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Final verification (after all tasks)

- [ ] Run the full db suite: `pnpm --filter @vamy/db test` — all green.
- [ ] Typecheck db: `pnpm --filter @vamy/db exec tsc --noEmit` — clean.
- [ ] Typecheck admin: `pnpm --filter @vamy/admin exec tsc --noEmit` — only the known `newVariantForm` baseline.
- [ ] Typecheck website: `pnpm --filter @vamy/website exec tsc --noEmit` — no new errors.
- [ ] Build admin: `pnpm --filter @vamy/admin build` — succeeds, `/people` present.
- [ ] Confirm `apps/admin/next-env.d.ts` is unmodified (revert if `next build` touched it).
- [ ] Dispatch a final code-review subagent over the whole branch (`origin/main..HEAD`).
- [ ] Hand off to `superpowers:finishing-a-development-branch` (push + PR — first push of the branch; the user authorizes push/PR/merge).

---

## Self-review notes (author)

- **Spec coverage:** schema (Task 1) ✓; upsert helper + 5 touchpoints (Tasks 2–3) ✓; backfill (Task 4) ✓; router list/get/update with derived timeline (Task 5) ✓; People page + nav (Task 6) ✓; tests across helper/sync/router ✓.
- **Deliberate spec refinement:** list "last activity" uses `contacts.updatedAt` (bumped by every touchpoint) instead of a per-row `max(createdAt)` correlated subquery. Documented in Task 5.
- **Type consistency:** `upsertContact(executor, { email, name })` used identically in Tasks 2–4 and all touchpoints; `TimelineEvent { type, at, summary }` defined in Task 5 and consumed by the People page in Task 6; `contacts.update` input `{ id, tags, notes, doNotContact }` matches the page's `update.mutate` call.
- **Non-goals honored:** no website UI changes (only the webhook + server mutations), no send-suppression enforcement, no merge/dedupe, no CSV import/export.
