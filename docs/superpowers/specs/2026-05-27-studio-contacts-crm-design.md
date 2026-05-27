# Studio Contacts / CRM Foundation — Design

**Date:** 2026-05-27
**Status:** Approved
**Linear:** BLOX-354 (Phase 3 — admin panel, "collectors CRM")
**Scope:** `packages/db` (schema, service, router, backfill) + `apps/admin` (People page).
No website UI changes — public mutations gain one upsert call each, behaviour otherwise unchanged.

## Context

This is **Sub-project A** of a four-part effort to make the studio the single place the
artist runs her business (replacing logins to Resend/Buttondown). The full decomposition:

- **A. Contacts / CRM foundation** ← this spec (the backbone)
- B. Inquiry replies + message log
- C. Newsletter composer (Buttondown-triggered)
- D. Dashboard home

Today "a person" is smeared across five tables — `inquiries.email`, `orders.buyerEmail`,
`bids.bidderEmail`, `variant_waitlist.email`, `newsletter_subscribers.email`. There is no
unified view of who the artist's people are. This sub-project introduces a canonical
`contacts` entity keyed by email, so later sub-projects can log replies against a person,
target sends, and count contacts on the dashboard.

## Goal

A `contacts` table that treats a person (by email) as the canonical entity, kept in step
with the five source tables via an upsert on every touchpoint, surfaced in the studio as a
searchable, editable **People** page with a live per-person activity history.

## Design

### 1. Schema (`packages/db/src/schema.ts`)

```
contacts
  id            uuid pk default gen_random_uuid()
  email         text not null unique          -- identity key
  name          text                          -- best-known name
  tags          text[] not null default '{}'  -- free-form chips: collector, VIP, press…
  notes         text                          -- private artist notes
  doNotContact  boolean not null default false
  createdAt     timestamptz not null default now()
  updatedAt     timestamptz not null default now()
```

- **Tags are free-form** (`text[]`), not a fixed enum — an artist's vocabulary evolves and
  `text[]` costs nothing. The UI suggests previously-used tags.
- **`doNotContact` is a stored flag only in this sub-project.** Actual send-suppression is
  wired into sub-projects B and C, where sending happens.
- History (what a person *did*) is **derived**, never denormalized onto this row — it is
  queried live from the five source tables by email. Only human-entered fields (tags,
  notes, doNotContact) and identity (email, name) are stored here.

A Drizzle migration is generated for this table.

### 2. Upsert helper (`packages/db/src/services/upsert-contact.ts`)

```ts
export async function upsertContact(
  tx: DbOrTx,
  input: { email: string; name?: string | null }
): Promise<void>
```

- Trims the email; **returns early (no-op) if empty** — the Stripe webhook can produce
  `buyerEmail: ""`.
- `insert(...).onConflictDoUpdate({ target: contacts.email, set: {...} })`:
  - On conflict, set `name = COALESCE(NULLIF(contacts.name, ''), excluded.name)` — fill the
    name only when the stored one is null/empty; **never overwrite** an existing name.
  - Bump `updatedAt = now()`.
  - **Never** touch `tags`, `notes`, or `doNotContact` — the artist's edits survive every
    future touchpoint.
- Accepts a transaction handle (`tx`) so it joins the caller's existing transaction. Orders
  and bids already run inside `db.transaction(...)`; the helper must compose with those.

**Wired into all five touchpoints:**

| Touchpoint | File | Note |
|---|---|---|
| `inquiries.create` | `packages/db/src/trpc/routers/inquiries.ts:21` | name + email from input |
| `bids.place` | `packages/db/src/trpc/routers/bids.ts:75` | inside existing tx; bidderName/bidderEmail |
| `newsletter.subscribe` | `packages/db/src/trpc/routers/newsletter.ts:12` | email only (no name) |
| `waitlist.subscribe` | `packages/db/src/trpc/routers/waitlist.ts:22` | email only (no name) |
| order creation | `apps/website/app/api/webhooks/stripe/route.ts:38` | inside existing tx; buyerName/buyerEmail, may be empty |

### 3. Backfill (`packages/db/scripts/backfill-contacts.ts`)

A one-time, idempotent script (run manually) that unions the distinct non-empty emails from
inquiries, orders, bids, variant_waitlist, and newsletter_subscribers into `contacts`,
taking the **earliest-seen** name for each email. Implemented entirely with `upsertContact`
so it is safely re-runnable. Logs a count of contacts touched.

### 4. tRPC — `contactsRouter` (`packages/db/src/trpc/routers/contacts.ts`)

All `protectedProcedure`. Registered in the root router.

- **`list({ search?, tag?, page?, pageSize? })`** → paginated contacts ordered by
  `updatedAt desc`. `search` matches name OR email (case-insensitive `ilike`); `tag` filters
  by array membership. Returns `{ items, total, page, pageSize }`. Each item carries a
  `lastActivityAt` (max createdAt across that email's source rows) for the list display.
- **`get({ id })`** → the contact plus a **derived, time-sorted activity timeline** built by
  querying the five source tables `where email = contact.email`:
  - inquiries (piece interest, message, handledAt)
  - bids (auction, amount)
  - orders (amount, status, tracking)
  - waitlist entries (variant, notifiedAt)
  - subscription (subscribedAt)
  Each event normalized to `{ type, at, summary, ...detail }`, sorted newest-first.
- **`update({ id, tags, notes, doNotContact })`** → updates only those three fields + bumps
  `updatedAt`. Returns the updated row.

### 5. Studio People page (`apps/admin/app/(dashboard)/people/page.tsx`)

- New nav entry "People" in `apps/admin/app/(dashboard)/layout.tsx`.
- **List**: search box + tag filter; results use the existing responsive table→card pattern
  (real `<table>` `hidden lg:table` + `lg:hidden` card stack) established in the mobile work.
  Columns: name, email, tag chips, last activity.
- **Detail** (click a person): editable tag chips (add via input, remove via ✕), notes
  textarea, do-not-contact toggle (all saved via `contacts.update`), and the read-only
  activity timeline from `get`.
- Mobile-friendly by construction (reuse the patterns already in the studio).

### 6. Testing

`packages/db` vitest, following existing patterns (`waitlist.test.ts`):

- `upsert-contact.test.ts`: new insert creates a contact; second touchpoint with a name
  fills a previously-empty name; a touchpoint **never clobbers** existing name/tags/notes/
  doNotContact; empty/whitespace email is a no-op.
- `contacts.test.ts`: `get` merges and time-sorts events from multiple source tables for one
  email; `update` writes only the three editable fields; `list` search + tag filter +
  pagination.

## Constraints & Non-Goals

- **No website UI changes.** Only the five server-side mutations gain an `upsertContact` call.
- **No send-suppression yet.** `doNotContact` is stored but not enforced until B/C.
- **No new dependencies.**
- **No contact merge/dedupe UI.** Email is the identity; two emails = two contacts. (A merge
  tool is out of scope — revisit only if it becomes a real problem.)
- **No CSV import/export.** Out of scope for A.

## Risks

- **Transaction composition**: `upsertContact` must accept and use the caller's `tx` in the
  orders/bids paths, or it would deadlock / run outside the transaction. Helper signature
  takes the handle explicitly.
- **Empty emails**: guest checkout / Stripe can yield `""`; the helper must no-op on these,
  and the backfill must filter them, to avoid a bogus blank contact.
- **Name clobbering**: the upsert must only *fill* a missing name, never overwrite — verified
  by test.
- **History query cost**: five small per-email lookups on `get`; fine at current volume, and
  all five source columns are low-cardinality/indexed-by-email candidates if it grows.
