# Admin Studio — Mobile Responsive Design

**Date:** 2026-05-26
**Status:** Approved
**Scope:** `apps/admin` only. Purely presentational — no backend/tRPC/schema changes.

## Goal

Make the entire admin studio (`apps/admin`) fully usable on a phone (~390px wide):
every screen readable, every control tappable, no horizontal page scroll, all
editing flows functional on touch.

## Constraints & Non-Goals

- **No new dependencies.** Pure Tailwind responsive utilities + one small drawer component.
- **No component-library swap, no design-system rewrite.**
- **No backend changes.** tRPC routers, schema, and data fetching are untouched.
- Preserve the existing visual language: Cormorant Garamond headings, black/white
  palette, `lucide-react` icons, `rounded-lg border bg-white` cards.
- Breakpoint: mobile-first; `lg:` (1024px) is the desktop threshold for the nav shell
  and tables. `sm:` (640px) for intermediate form/grid stacking.

## Current State (audit)

- **Shell** (`app/(dashboard)/layout.tsx`): fixed `w-56` sidebar, always visible —
  eats most of a phone screen. #1 blocker.
- **Raw `<table>`s** that overflow on mobile: Sales (`orders/page.tsx`),
  Messages (`inquiries/page.tsx`), Auctions inner bids table (`auctions/page.tsx:344`),
  Pieces variants table (`artworks/page.tsx:586`).
- **Pieces** (`artworks/page.tsx`, ~991 lines): `grid-cols-4` image gallery,
  variants table with inline edit inputs, New/Edit forms with multi-column rows.
  Reorder uses a dropdown + ↑/↓ buttons (NOT drag) — already touch-compatible.
- Every page wraps content in `<div className="p-8 max-w-{3,5}xl mx-auto">` —
  `p-8` (32px) wastes horizontal space on phones.
- Auctions stat block: `grid grid-cols-3` (`auctions/page.tsx:143`).
- A `fixed inset-0 z-10` dropdown overlay (`artworks/page.tsx:948`) — works on touch.

## Design

### 1. Navigation shell (`layout.tsx`)

- **Mobile (`< lg`)**: a sticky top bar — `☰ vamy studio` — menu button on the left.
  Tapping `☰` slides the existing sidebar in from the left as an overlay
  (`fixed inset-y-0 left-0`, `translate-x-0`/`-translate-x-full` transition) over a
  dimmed backdrop (`fixed inset-0 bg-black/40`).
- Drawer closes on: link tap, backdrop tap, `Escape` key, and route change
  (watch `usePathname` in an effect).
- **Desktop (`≥ lg`)**: today's fixed `w-56` sidebar (`hidden lg:flex`); top bar
  hidden (`lg:hidden`).
- One client component; `useState<boolean>` for open state. Touch targets ≥ 44px.
- Main content gets top padding on mobile to clear the sticky bar.

### 2. Shared table → card pattern

One consistent convention per table:
- Keep the real `<table>` for desktop: wrap header/body so it's `hidden lg:table`.
- Add a `lg:hidden` stack of cards for mobile: each row's cells become labeled
  `Label: value` rows inside a `rounded-lg border bg-white p-4` card.
- Same data array, same row handlers (edit/toggle/delete buttons reused verbatim) —
  only a second presentation layer. No data-fetch or state changes.

### 3. Per-page mapping

| Page | Change |
|------|--------|
| All pages | Outer wrapper `p-8` → `p-4 sm:p-8` |
| Sales (`orders`) | Table → card stack |
| Messages (`inquiries`) | Table → card stack |
| Auctions | Stat block `grid-cols-3` → `grid-cols-1 sm:grid-cols-3`; bids table → card stack |
| Pieces (`artworks`) | Image gallery `grid-cols-4` → `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4`; variants table → card stack with full-width inline edit inputs; New/Edit forms stack columns below `sm`, inputs `w-full`; reorder ↑/↓ buttons enlarged for touch |
| Shipping / Banners | Padding + input-width pass (already narrow `max-w-3xl` forms) |

### 4. Verification

After each page, verify in Playwright at:
- **Mobile** ~390×844, and **Desktop** ~1280×800.

Check per page: no horizontal page scroll; all controls tappable; drawer
opens/closes correctly; no overlapping/clipped content; editing inputs usable.
Point Playwright at the **local dev studio** — no production data required.

### 5. Process

- Subagent-driven, page-by-page, on branch `feat/admin-mobile-responsive`.
- Cautious with pushes (avoid accumulating Netlify build costs): all work stays
  local on the branch; single PR at the end.

## Risks

- Drawer focus management / scroll-lock on open — keep minimal but correct.
- Card layouts must reuse existing handlers exactly to avoid behavioral drift.
- Inline-edit inputs in variant cards must remain wired to the same state.
