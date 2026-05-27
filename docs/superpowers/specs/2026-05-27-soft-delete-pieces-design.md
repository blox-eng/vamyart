# Soft-Delete Pieces — Design

**Date:** 2026-05-27
**Status:** Approved
**Linear:** BLOX-354 (Phase 3 — admin panel)
**Scope:** `packages/db` (schema, artworks/auctions/products routers, tests) + `apps/admin` (Edit panel + Trash view).
No public website code changes beyond the read-path filters already in `listPublic`/`getBySlug`.

## Context

Today `artworks.delete` performs a **hard delete**: it cascades products → variants →
auctions → bids → images and purges the image files from Supabase storage, guarded so it
refuses when the piece has any order or an *active* auction. There is no way to recover a
deleted piece. The artist wants deletion to be reversible: hide a piece from the site and the
studio, but keep all its data, with a way to bring it back.

## Goal

Replace the destructive delete with a **soft delete** (`deleted_at` timestamp): the existing
Delete button hides the piece everywhere (studio + public site) without destroying data, the
order/active-auction guard is retained, and a **Trash** view in the studio lists trashed
pieces with a **Restore** action.

## Design

### 1. Schema (`packages/db/src/schema.ts`)

Add one nullable column to `artworks`:

```
deletedAt  timestamptz   -- NULL = live; set = trashed
```

- `slug` keeps its existing `unique` constraint. A trashed piece **retains its slug**; to
  reuse a slug you must restore the piece first. There is no permanent-delete path (we chose
  "replace, don't keep both"), so a slug held by a trashed piece stays held. Acceptable at
  this volume; documented as a known limitation, not a bug.
- A drizzle migration (`0009_*.sql`) is generated for the new column.

### 2. Router — `artworksRouter` (`packages/db/src/trpc/routers/artworks.ts`)

- **`delete`** (existing, rewritten): keep the order/active-auction guard
  (`artworkDeleteBlockReason` and its queries are unchanged), but on success set
  `deletedAt = now()` instead of cascading deletes and storage cleanup. The cascade
  transaction and `getStorageClient()` image-removal block are removed. Returns `{ success: true }`.
- **`restore`** (new, `protectedProcedure`, input `{ id: uuid }`): set `deletedAt = null`,
  bump `updatedAt`. Throws `NOT_FOUND` if no row updated. Returns the row.
- **`list`** (admin): add `where deletedAt IS NULL` (keeps the existing sort).
- **`listTrashed`** (new, `protectedProcedure`): rows where `deletedAt IS NOT NULL`, ordered
  by `deletedAt desc` (most recently trashed first).
- **`listPublic`**: add `deletedAt IS NULL` to the existing `published = true` filter.
- **`getBySlug`**: return `null` when the matched row is soft-deleted (alongside the existing
  `!a.published` null-return).

`artworkDeleteBlockReason` and `slugify` are unchanged. `assertSlugFree` is unchanged — it
intentionally still sees trashed rows, which is why a trashed slug stays reserved.

### 3. Cross-router slug lookups

A trashed piece must not accept new auctions or products:

- `auctions.ts` `create` — the `db.query.artworks.findFirst({ where: eq(artworks.slug, …) })`
  gains `and(eq(slug), isNull(deletedAt))`, so a trashed slug resolves to "not found".
- `products.ts` — the two `findFirst` slug lookups (lines ~36 and ~66) get the same
  `isNull(deletedAt)` guard.

### 4. Studio UI

- **`EditPiecePanel.tsx`**: no visible change. The "Delete piece" / "Confirm delete" flow and
  its error toasts stay exactly as-is — the `artworks.delete` mutation is now soft, so the
  piece simply leaves the list. (Revalidation paths unchanged.)
- **`artworks/page.tsx`**: add a "Show trash" toggle. When on, render trashed pieces from
  `trpc.artworks.listTrashed` (title, slug, when trashed) each with a **Restore** button wired
  to `trpc.artworks.restore`. On restore: invalidate/refetch both `list` and `listTrashed`,
  revalidate `["/", "/gallery"]`, toast. Reuse the existing styling patterns on the page; no
  new component library.

### 5. Testing (`packages/db`, real-DB pattern)

New integration file `artworks-soft-delete.test.ts` using `createCaller({ db, userId })`
(like `contacts.test.ts`), creating its own artwork(s) and cleaning up in `afterAll`:

- `delete` sets `deletedAt` (row still present via direct DB read), and the piece is excluded
  from `list`, `listPublic`, and `getBySlug` (returns null).
- the order/active-auction guard still blocks `delete` (seed an order, expect `CONFLICT`,
  assert `deletedAt` stays null).
- `restore` clears `deletedAt`; the piece reappears in `list` and disappears from `listTrashed`.
- `listTrashed` returns only trashed pieces.

The existing `artworks.test.ts` unit tests (`slugify`, `artworkDeleteBlockReason`) stay green
untouched.

## Constraints & Non-Goals

- **No permanent delete** anywhere in the studio (the "keep both" option was rejected). Data
  removal, if ever needed, is a manual DB operation.
- **No slug-freeing for trashed pieces** — restore-then-rename is the path. Documented.
- **No new dependencies.**
- **No public website UI changes** beyond the read-path filters.
- **No auto-purge / retention policy** — trash is kept indefinitely.

## Risks

- **Missed read path**: any query that lists or resolves an artwork without the
  `deletedAt IS NULL` filter would leak a trashed piece. The four read paths
  (`list`, `listPublic`, `getBySlug`, and the auctions/products slug lookups) are enumerated
  above; tests cover the artwork-facing ones.
- **Guard regression**: the soft-delete rewrite must keep the order/active-auction guard, or a
  piece mid-transaction could be hidden. Covered by the guard test.
