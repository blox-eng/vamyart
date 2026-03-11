# Pre-Launch Fixes & Deployment Documentation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all code-review-identified bugs and gaps, then produce a DEPLOYMENT.md that guides production setup without exposing secrets.

**Architecture:** Small, surgical fixes across packages/db and apps/website. No new abstractions. One new migration file for the missing tables. One new DEPLOYMENT.md at repo root.

**Tech Stack:** TypeScript, Zod v4, tRPC v11, Drizzle ORM, Next.js 15 (Pages Router), pnpm

---

## Chunk 1: TypeScript compile fixes

### Task 1: Fix `auction` out-of-scope in `bids.ts`

**Files:**
- Modify: `packages/db/src/trpc/routers/bids.ts`

The transaction returns only the inserted bid. `auction` is local to the transaction callback and used outside it on line 114. Fix: return `auction` alongside the bid from the transaction.

- [ ] **Step 1: Edit the transaction return to include `auction`**

In `bids.ts`, change the transaction so it returns `[auction, newBid]`:

```typescript
// Line 51 — change:
const [newBid] = await db.transaction(async (tx) => {
// to:
const [auction, newBid] = await db.transaction(async (tx) => {
```

Then change the `return inserted;` at line 94 to `return [auction, inserted[0]] as const;`.

The full corrected transaction block (lines 51–95):
```typescript
const [auction, newBid] = await db.transaction(async (tx) => {
  const [auction] = await tx
    .select()
    .from(auctions)
    .where(eq(auctions.id, input.auctionId))
    .for("update");

  if (!auction || auction.status !== "active") {
    throw new Error("Auction not found or not active");
  }

  const validation = validateBid({
    amount: input.amount,
    currentBid: auction.currentBid ? Number(auction.currentBid) : null,
    minBid: Number(auction.minBid),
    minIncrement: Number(auction.minIncrement),
    deadline: auction.deadline,
  });

  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const [inserted] = await tx
    .insert(bids)
    .values({
      auctionId: input.auctionId,
      bidderName: input.bidderName,
      bidderEmail: input.bidderEmail,
      amount: String(input.amount),
      ipAddress: input.ipAddress,
    })
    .returning();

  await tx
    .update(auctions)
    .set({
      currentBid: String(input.amount),
      bidCount: sql`bid_count + 1`,
      updatedAt: new Date(),
    })
    .where(eq(auctions.id, input.auctionId));

  return [auction, inserted] as const;
});
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/db && pnpm tsc --noEmit
```

Expected: no errors on `bids.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/trpc/routers/bids.ts
git commit -m "fix(bids): return auction from transaction to fix out-of-scope reference"
```

---

### Task 2: Fix `z.record()` Zod v4 arity in `products.ts`

**Files:**
- Modify: `packages/db/src/trpc/routers/products.ts`

Zod v4 requires `z.record(keySchema, valueSchema)`. Lines 82 and 127 use the Zod v3 single-argument form.

- [ ] **Step 1: Fix both `z.record()` calls**

Line 82 — change:
```typescript
attributes: z.record(z.string()).optional(),
```
to:
```typescript
attributes: z.record(z.string(), z.unknown()).optional(),
```

Line 127 — change:
```typescript
attributes: z.record(z.unknown()).optional(),
```
to:
```typescript
attributes: z.record(z.string(), z.unknown()).optional(),
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd packages/db && pnpm tsc --noEmit
```

Expected: no errors on `products.ts`.

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/trpc/routers/products.ts
git commit -m "fix(products): use z.record(key, value) for Zod v4 compatibility"
```

---

## Chunk 2: Missing Drizzle migration

### Task 3: Add migration for `shipping_methods`, `banners`, FK columns, and their RLS

**Files:**
- Create: `packages/db/migrations/0002_shipping_banners.sql`
- Modify: `packages/db/migrations/meta/_journal.json`

The live Supabase DB already has these tables (created manually), but the migration history is missing them. This migration makes the codebase reproducible and also enables RLS on the two new tables.

Note: The FK column `shipping_method_id` on `products` and `product_variant_id` on `auctions` also need to be included if not already in 0000.

- [ ] **Step 1: Check which columns are in 0000 migration**

```bash
grep -i "shipping_method_id\|product_variant_id" packages/db/migrations/0000_nifty_ricochet.sql
```

If they appear — they were already in the initial migration. Skip those lines from the new migration. If they don't appear — include them.

- [ ] **Step 2: Create `0002_shipping_banners.sql`**

```sql
-- Create shipping_method_type enum if not exists
DO $$ BEGIN
  CREATE TYPE shipping_method_type AS ENUM ('free', 'paid', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create banner_scope enum if not exists
DO $$ BEGIN
  CREATE TYPE banner_scope AS ENUM ('global', 'page');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- shipping_methods table
CREATE TABLE IF NOT EXISTS "shipping_methods" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "display_text" text NOT NULL,
  "type" shipping_method_type NOT NULL,
  "cost" numeric(10, 2),
  "is_default" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- banners table
CREATE TABLE IF NOT EXISTS "banners" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "text" text NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "scope" banner_scope NOT NULL DEFAULT 'global',
  "page_slug" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

-- FK: products.shipping_method_id (add if not exists)
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "shipping_method_id" uuid REFERENCES "shipping_methods"("id");

-- FK: auctions.product_variant_id (add if not exists)
ALTER TABLE "auctions" ADD COLUMN IF NOT EXISTS "product_variant_id" uuid REFERENCES "product_variants"("id");

-- RLS on new tables
ALTER TABLE "shipping_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banners" ENABLE ROW LEVEL SECURITY;

-- Policies: public read, no public write (service role bypasses RLS)
CREATE POLICY IF NOT EXISTS "shipping_methods_public_read" ON "shipping_methods"
  FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "banners_public_read" ON "banners"
  FOR SELECT TO anon USING (true);
```

- [ ] **Step 3: Add entry to `_journal.json`**

Append a new entry after the existing `0001_brief_swordsman` entry:

```json
{
  "idx": 2,
  "version": "7",
  "when": 1741694400000,
  "tag": "0002_shipping_banners",
  "breakpoints": true
}
```

- [ ] **Step 4: Apply in Supabase SQL editor (manual step, document it)**

Since the live DB already has these tables, run only the RLS and policy lines in Supabase SQL editor to avoid duplicate table errors:

```sql
ALTER TABLE "shipping_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "banners" ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "shipping_methods_public_read" ON "shipping_methods"
  FOR SELECT TO anon USING (true);

CREATE POLICY IF NOT EXISTS "banners_public_read" ON "banners"
  FOR SELECT TO anon USING (true);
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/migrations/0002_shipping_banners.sql packages/db/migrations/meta/_journal.json
git commit -m "feat(db): add migration for shipping_methods, banners tables and RLS policies"
```

---

## Chunk 3: Security & correctness fixes

### Task 4: Fix timing-safe comparison in `revalidate.ts`

**Files:**
- Modify: `apps/website/src/pages/api/revalidate.ts`

The early-return on length difference defeats timing-safe comparison. Fix by hashing both strings first (constant-length buffers).

- [ ] **Step 1: Update `secretsMatch` function**

Replace:
```typescript
function secretsMatch(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
```

With:
```typescript
import { timingSafeEqual, createHash } from "crypto";

function secretsMatch(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}
```

Note: `createHash` is already in Node's `crypto` — just add it to the import on line 2.

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/pages/api/revalidate.ts
git commit -m "fix(security): use hash-then-compare for timing-safe secret validation"
```

---

### Task 5: Surface Buttondown errors in `newsletter.ts`

**Files:**
- Modify: `packages/db/src/trpc/routers/newsletter.ts`

The Buttondown `fetch` response is never checked. Log errors and surface a warning to the caller without breaking the flow (local DB insert already succeeded).

- [ ] **Step 1: Check and log the Buttondown response**

Replace:
```typescript
// Sync to Buttondown
await fetch("https://api.buttondown.email/v1/subscribers", {
  method: "POST",
  headers: {
    Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email_address: input.email }),
});

return { success: true };
```

With:
```typescript
// Sync to Buttondown
const bdRes = await fetch("https://api.buttondown.email/v1/subscribers", {
  method: "POST",
  headers: {
    Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ email_address: input.email }),
});

if (!bdRes.ok) {
  // Don't throw — local record was saved. Log for ops visibility.
  console.error("[newsletter] Buttondown sync failed:", bdRes.status, await bdRes.text());
}

return { success: true };
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/trpc/routers/newsletter.ts
git commit -m "fix(newsletter): log Buttondown sync errors instead of silently swallowing"
```

---

### Task 6: Remove `payment_method_types` restriction to re-enable Apple Pay / Google Pay

**Files:**
- Modify: `packages/db/src/trpc/routers/checkout.ts`

Line 54: `payment_method_types: ["card"]` disables Apple Pay and Google Pay. Omitting it lets Stripe enable all supported methods automatically.

- [ ] **Step 1: Remove the `payment_method_types` line**

Delete line 54:
```typescript
payment_method_types: ["card"],
```

The `sessionParams` object should now start directly with `mode: "payment"` and `line_items`.

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/trpc/routers/checkout.ts
git commit -m "fix(checkout): remove payment_method_types to enable Apple Pay and Google Pay"
```

---

## Chunk 4: Netlify config and env var documentation

### Task 7: Add `@netlify/plugin-nextjs` to website `netlify.toml`

**Files:**
- Modify: `apps/website/netlify.toml`

Without this plugin, on-demand ISR (`res.revalidate()`) won't work on Netlify.

- [ ] **Step 1: Add plugin block**

Change `apps/website/netlify.toml` from:
```toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/website"
  publish = ".next"
```

To:
```toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/website"
  publish = ".next"

[[plugins]]
  package = "@netlify/plugin-nextjs"
```

- [ ] **Step 2: Verify plugin is in website package.json devDeps or root**

```bash
grep -r "@netlify/plugin-nextjs" apps/website/package.json package.json
```

If missing from `apps/website/package.json`, add it:
```bash
cd apps/website && pnpm add -D @netlify/plugin-nextjs
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/netlify.toml apps/website/package.json
git commit -m "fix(netlify): add @netlify/plugin-nextjs to website for ISR on-demand revalidation"
```

---

### Task 8: Add missing env vars to README and update env var table

**Files:**
- Modify: `README.md`

Two env vars are used in code but not in the README env var table: `REVALIDATION_SECRET` and `NEXT_PUBLIC_WEBSITE_URL`.

- [ ] **Step 1: Add missing vars to the env table**

In `README.md`, find the `NEXT_PUBLIC_SITE_URL=` line in the env block and add below it:

```
REVALIDATION_SECRET=
NEXT_PUBLIC_WEBSITE_URL=
```

Add a note: `NEXT_PUBLIC_WEBSITE_URL` is used by the admin app to call the website's revalidation endpoint. Set it to `https://vamy.art` on the admin Netlify site.

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add REVALIDATION_SECRET and NEXT_PUBLIC_WEBSITE_URL to env var table"
```

---

### Task 9: Create `DEPLOYMENT.md`

**Files:**
- Create: `DEPLOYMENT.md`

A production deployment guide that covers all external service setup without exposing secrets. Generic enough to commit publicly.

- [ ] **Step 1: Write `DEPLOYMENT.md`**

Create with the following content (see below).

- [ ] **Step 2: Commit**

```bash
git add DEPLOYMENT.md
git commit -m "docs: add DEPLOYMENT.md with production setup checklist for all external services"
```

---

## DEPLOYMENT.md content

```markdown
# Deployment Guide

This document covers everything needed to take vamy.art from a working dev environment to a production deployment. It is service-agnostic (no secrets, no project IDs) and safe to commit.

---

## Prerequisites

- Accounts: Netlify, Supabase, Stripe, Resend, Buttondown
- A domain pointed to Netlify (or Netlify DNS)
- `.env.local` filled with real production credentials (never commit this file)

---

## 1. Supabase

### 1.1 Database setup

Run migrations against your production Supabase project:

```bash
cd packages/db
DATABASE_URL=<your-production-db-url> pnpm migrate
```

All tables, enums, and indexes are created by the migration sequence in `packages/db/migrations/`.

### 1.2 Seed data

After migrations, seed default shipping methods and banners via the admin panel, or run:

```bash
cd packages/db
DATABASE_URL=<your-production-db-url> pnpm seed
```

### 1.3 Row Level Security

All tables have RLS enabled by migration. Verify in the Supabase dashboard:
- Database → Tables → confirm the RLS shield icon is active on every table
- Tables that must have RLS: `artworks`, `products`, `product_variants`, `orders`, `auctions`, `bids`, `inquiries`, `newsletter_subscribers`, `shipping_methods`, `banners`

The anon key has read-only access. All writes go through service-role (server-side tRPC only).

### 1.4 Realtime on `bids`

The BidWidget uses Supabase Realtime for live bid updates:

1. Supabase dashboard → Database → Replication
2. Enable Realtime on the `bids` table

Without this, the widget falls back to 30-second polling (functional but not live).

### 1.5 Auth

Admin auth uses Supabase Auth. Create the artist's account:

1. Supabase dashboard → Authentication → Users → Invite user
2. Use the artist's email address
3. The admin app's middleware verifies the session on every request — no additional config needed

---

## 2. Stripe

### 2.1 Products and prices

Products and prices are created dynamically per checkout session using `price_data`. No Stripe product catalog setup is required.

### 2.2 Webhook

The website exposes a Stripe webhook endpoint at `/api/webhooks/stripe`.

1. Stripe dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://vamy.art/api/webhooks/stripe`
3. Events to listen for: `checkout.session.completed`
4. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in Netlify env vars (website site)

### 2.3 Apple Pay / Google Pay domain verification

Stripe Checkout handles Apple Pay and Google Pay automatically. To enable Apple Pay:

1. Stripe dashboard → Settings → Payment methods → Apple Pay
2. Add `vamy.art` as a verified domain
3. Download the domain verification file and serve it at `/.well-known/apple-developer-merchantid-domain-association`

For Next.js, place the file in `apps/website/public/.well-known/` (create the directory).

### 2.4 Go live

Switch from test keys to live keys:
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → live publishable key (`pk_live_...`)
- `STRIPE_SECRET_KEY` → live secret key (`sk_live_...`)
- Register a new webhook in live mode and update `STRIPE_WEBHOOK_SECRET`

---

## 3. Resend

### 3.1 Domain verification

1. Resend dashboard → Domains → Add domain → `vamy.art`
2. Add the DNS records shown (SPF, DKIM, DMARC)
3. Wait for verification (usually < 10 minutes)
4. Set `RESEND_FROM_EMAIL` to a verified address on this domain (e.g. `maeve@vamy.art`)

### 3.2 Environment variables

| Variable | Value |
|---|---|
| `RESEND_API_KEY` | From Resend dashboard → API Keys |
| `RESEND_FROM_EMAIL` | Verified sender address |
| `RESEND_ARTIST_EMAIL` | Artist's personal inbox for order/bid notifications |

---

## 4. Buttondown

### 4.1 API key

1. Buttondown dashboard → Settings → API → Generate key
2. Set as `BUTTONDOWN_API_KEY`

Subscribers collected via the website footer form are synced to Buttondown automatically.

---

## 5. Netlify

Two Netlify sites are deployed from this monorepo.

### 5.1 Site setup

Create two sites in Netlify, both connected to the same GitHub repo:

| Site | Base directory | Publish directory |
|---|---|---|
| Website (`vamy.art`) | `apps/website` | `.next` |
| Admin (private URL) | `apps/admin` | `.next` |

Build command for both: (defined in each app's `netlify.toml`, no manual entry needed)

### 5.2 Environment variables

Set the following on the **website** Netlify site:

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_ARTIST_EMAIL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_SITE_URL=https://vamy.art
REVALIDATION_SECRET=<random 32+ char string, generate with: openssl rand -hex 32>
```

Set the following on the **admin** Netlify site:

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WEBSITE_URL=https://vamy.art
REVALIDATION_SECRET=<same value as on the website site>
```

> **Note:** `REVALIDATION_SECRET` must be identical on both sites — the admin calls the website's `/api/revalidate` endpoint using this shared secret.

### 5.3 Deploy hooks / branch deploys

- Set `main` as the production branch
- Enable deploy previews for pull requests (optional but recommended)

### 5.4 Domain

1. Netlify → vamy.art site → Domain management → Add custom domain
2. Point the domain's nameservers or CNAME to Netlify
3. Netlify provisions a TLS certificate automatically

---

## 6. ISR (Incremental Static Regeneration)

Pages are statically generated and revalidated in two ways:

1. **Time-based**: every 3600 seconds automatically
2. **On-demand**: the admin panel calls `POST https://vamy.art/api/revalidate` after saving artworks or products

For on-demand revalidation to work on Netlify, `@netlify/plugin-nextjs` must be installed (already configured in `apps/website/netlify.toml`).

---

## 7. Go-live checklist

- [ ] Migrations applied to production DB
- [ ] RLS verified active on all tables in Supabase dashboard
- [ ] Supabase Realtime enabled on `bids` table
- [ ] Admin user created in Supabase Auth
- [ ] Stripe webhook registered and `STRIPE_WEBHOOK_SECRET` set
- [ ] Apple Pay domain verified in Stripe (if desired)
- [ ] Stripe live keys set (when ready to take real payments)
- [ ] Resend domain verified and DNS propagated
- [ ] All env vars set on both Netlify sites
- [ ] Website site base dir set to `apps/website` in Netlify UI
- [ ] Admin site base dir set to `apps/admin` in Netlify UI
- [ ] Custom domain added and TLS certificate provisioned
- [ ] Smoke test: place a test order end-to-end in Stripe test mode
- [ ] Smoke test: submit an inquiry
- [ ] Smoke test: newsletter signup
- [ ] Switch Stripe to live mode
```

---

## Summary of changes

| Task | Files |
|---|---|
| 1: Fix bids.ts auction scope | `packages/db/src/trpc/routers/bids.ts` |
| 2: Fix z.record() Zod v4 | `packages/db/src/trpc/routers/products.ts` |
| 3: Add missing migration | `packages/db/migrations/0002_shipping_banners.sql`, `_journal.json` |
| 4: Fix timing-safe comparison | `apps/website/src/pages/api/revalidate.ts` |
| 5: Log Buttondown errors | `packages/db/src/trpc/routers/newsletter.ts` |
| 6: Remove payment_method_types | `packages/db/src/trpc/routers/checkout.ts` |
| 7: Add netlify plugin to website | `apps/website/netlify.toml` |
| 8: Document missing env vars | `README.md` |
| 9: Create DEPLOYMENT.md | `DEPLOYMENT.md` |
