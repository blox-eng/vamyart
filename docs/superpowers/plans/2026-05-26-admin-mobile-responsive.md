# Admin Studio Mobile-Responsive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every screen of the admin studio (`apps/admin`) fully usable on a phone (~390px): readable, tappable, no horizontal page scroll, all editing flows functional.

**Architecture:** Pure Tailwind responsive utilities, mobile-first. `lg:` (1024px) is the desktop threshold for the nav shell and tables; `sm:` (640px) for intermediate form stacking. Data tables keep the real `<table>` for `lg:` and up (`hidden lg:table`) and gain a parallel `lg:hidden` card stack that reuses the exact same row data and handlers. One new client-side drawer in the layout. No new dependencies, no backend/tRPC/schema changes.

**Tech Stack:** Next.js App Router, React 19, Tailwind, `lucide-react`, tRPC (read-only here), Playwright (visual verification).

---

## Conventions for every task

**Branch:** `feat/admin-mobile-responsive` (already created and checked out).

**Working directory:** repo root `/home/blox-master/business/vamy/website/vamy.art`. The Bash tool's CWD can drift — always `cd` to repo root before `git`.

**No unit tests:** this is presentational work; there is no test framework in `apps/admin`. "Verify" means the two checks below.

**Verification (run after each task):**
1. **Typecheck + lint (automated):**
   ```bash
   cd /home/blox-master/business/vamy/website/vamy.art && pnpm --filter @vamy/admin lint && pnpm --filter @vamy/admin exec tsc --noEmit
   ```
   Expected: no NEW errors versus the pre-existing baseline. (Baseline note: `artworks/page.tsx` has pre-existing `newVariantForm` possibly-null TS warnings around lines 779–803; do not introduce others.)
2. **Visual (Playwright, manual gate):** with the local dev studio running (`pnpm --filter @vamy/admin dev` → http://localhost:3001) and logged in, view the changed page at viewport **390×844** and **1280×800**. Confirm: no horizontal page scroll (`document.documentElement.scrollWidth <= window.innerWidth`), all buttons/inputs reachable and ≥40px tall on mobile, nothing clipped or overlapping. The dashboard is auth-gated — if Playwright lands on `/login`, request admin credentials from the user before proceeding; do not commit secrets.

**Commit** at the end of each task with the message shown in that task.

**Do NOT push.** All work stays local on the branch; a single PR is opened only at the very end (Task 8), to avoid accumulating Netlify build costs.

---

## Task 1: Responsive navigation shell

Replace the always-visible fixed sidebar with: a desktop sidebar (`hidden lg:flex`) + a mobile sticky top bar with a hamburger that opens the sidebar as an overlay drawer.

**Files:**
- Modify: `apps/admin/app/(dashboard)/layout.tsx` (full rewrite of the returned JSX; logic/nav array unchanged)

- [ ] **Step 1: Add drawer state, icons, and close-on-navigation**

In `apps/admin/app/(dashboard)/layout.tsx`, update the imports to add `Menu` and `X` from lucide and `useState`/`useEffect` from React:

```tsx
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, LogOut, Menu, X } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { ToastProvider, useToast } from "@/components/ui/toast";
import React, { useEffect, useState } from "react";
```

Keep `WelcomeToast` and the `navItems` array exactly as they are.

- [ ] **Step 2: Rewrite the layout body**

Replace the entire `export default function DashboardLayout(...) { ... }` (the version currently rendering `<aside className="w-56 …">`) with:

```tsx
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const SidebarBody = (
    <>
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <img src="/vamy-black.png" alt="vamy" className="h-6 w-auto" />
          <span className="text-sm font-light tracking-widest text-gray-500">studio</span>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex items-center gap-3 px-3 py-3 rounded text-sm transition-colors ${
              pathname.startsWith(href)
                ? "bg-black text-white"
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Icon size={16} aria-hidden />
            {label}
          </Link>
        ))}
      </nav>
      <div className="p-3 border-t">
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 px-3 py-3 rounded text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
        >
          <LogOut size={16} aria-hidden />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <WelcomeToast />
      <div className="flex h-screen bg-gray-50">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-56 bg-white border-r flex-col shrink-0">
          {SidebarBody}
        </aside>

        {/* Mobile drawer + backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col shrink-0 transition-transform duration-200 lg:hidden ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!drawerOpen}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          {SidebarBody}
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b px-4 h-14 shrink-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:text-black"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <img src="/vamy-black.png" alt="vamy" className="h-5 w-auto" />
            <span className="text-xs font-light tracking-widest text-gray-500">studio</span>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 3: Verify** — run the typecheck/lint command. Then in Playwright at 390px: top bar shows, tapping ☰ slides the drawer in over a dim backdrop; tapping a link, the backdrop, the ✕, or pressing Escape closes it; navigating changes the active highlight. At 1280px: the top bar is hidden and the fixed sidebar looks exactly like before.

- [ ] **Step 4: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/layout.tsx && git commit -m "feat(admin): responsive nav shell with mobile drawer

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 2: Sales page — table → card stack (pattern template)

This task establishes the table→card pattern reused by Tasks 3–5. Keep the existing `<table>` for `lg:` and add a `lg:hidden` card list using the same `orderList` map and the same `getDraft`/`setDraft`/`markShipped` handlers.

**Files:**
- Modify: `apps/admin/app/(dashboard)/orders/page.tsx`

- [ ] **Step 1: Shrink outer padding**

Change the outer wrapper:

```tsx
    <div className="p-8 max-w-5xl mx-auto">
```
to:
```tsx
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
```

- [ ] **Step 2: Gate the existing table to desktop**

The current table is wrapped in `<div className="bg-white border rounded-lg overflow-hidden">`. Change that wrapper to be desktop-only:

```tsx
      <div className="hidden lg:block bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
        … (unchanged table markup) …
        </table>
      </div>
```

- [ ] **Step 3: Add the mobile card stack**

Immediately AFTER that desktop `</div>` (and still inside the `{ordersLoading ? … : ( … )}` branch), add a mobile-only card list. To keep the shipping form DRY between table and cards, first extract a `ShipForm` helper component at the bottom of the file (outside `OrdersPage`):

```tsx
function ShipForm({
  order,
  draft,
  onPatch,
  onSubmit,
  pending,
}: {
  order: any;
  draft: ShipDraft;
  onPatch: (patch: Partial<ShipDraft>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  if (order.status === "shipped" && order.trackingNumber) {
    return (
      <div className="flex flex-col">
        <p className="text-xs text-gray-500">
          {order.trackingCarrier ? `${order.trackingCarrier} · ` : ""}
          {order.trackingNumber}
        </p>
        <span className="text-xs text-gray-400 mt-0.5">Tracking sent ✓</span>
      </div>
    );
  }
  if (order.status !== "paid") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <select
          value={draft.carrier}
          onChange={(e) => onPatch({ carrier: e.target.value as ShipDraft["carrier"] })}
          className="border px-2 py-1.5 rounded text-xs bg-white"
        >
          <option value="DHL">DHL</option>
          <option value="GLS">GLS</option>
          <option value="UPS">UPS</option>
          <option value="Econt">Econt</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="text"
          placeholder="Tracking #"
          value={draft.trackingNumber}
          onChange={(e) => onPatch({ trackingNumber: e.target.value })}
          className="border px-2 py-1.5 rounded text-xs flex-1 min-w-0"
        />
      </div>
      <textarea
        placeholder="Optional note to buyer"
        value={draft.note}
        onChange={(e) => onPatch({ note: e.target.value })}
        rows={2}
        className="border px-2 py-1.5 rounded text-xs resize-none"
      />
      <button
        onClick={onSubmit}
        disabled={pending || !draft.trackingNumber}
        className="text-xs bg-black text-white px-3 py-2 rounded disabled:opacity-50"
      >
        {pending ? "Sending…" : "Mark shipped & send tracking"}
      </button>
    </div>
  );
}
```

Then add the mobile card list after the desktop table wrapper:

```tsx
      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {orderList?.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No orders yet.</p>
        )}
        {orderList?.map((o) => (
          <div key={o.id} className="bg-white border rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{o.buyerName}</p>
                <a
                  href={`mailto:${o.buyerEmail}?subject=Your vamy order`}
                  className="text-xs text-blue-600 hover:underline break-all"
                >
                  {o.buyerEmail}
                </a>
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
                  o.status === "shipped"
                    ? "bg-green-100 text-green-800"
                    : o.status === "paid"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {o.status}
              </span>
            </div>
            {o.shippingAddress && (
              <p className="text-xs text-gray-500 whitespace-pre-line">
                {typeof o.shippingAddress === "string"
                  ? o.shippingAddress
                  : JSON.stringify(o.shippingAddress, null, 2)}
              </p>
            )}
            <div className="flex justify-between text-gray-600">
              <span>{o.productVariant?.name ?? "—"}</span>
              <span className="font-medium text-gray-900">€{Number(o.amountPaid).toLocaleString()}</span>
            </div>
            {o.productVariant?.product?.name && (
              <p className="text-xs text-gray-400 -mt-2">{o.productVariant.product.name}</p>
            )}
            <p className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
            </p>
            <ShipForm
              order={o}
              draft={getDraft(o.id)}
              onPatch={(patch) => setDraft(o.id, patch)}
              onSubmit={() => {
                const d = getDraft(o.id);
                if (!d.trackingNumber) return;
                markShipped.mutate({
                  id: o.id,
                  carrier: d.carrier,
                  trackingNumber: d.trackingNumber,
                  note: d.note || undefined,
                });
              }}
              pending={markShipped.isPending}
            />
          </div>
        ))}
      </div>
```

(Optional DRY follow-up: the desktop table's Tracking `<td>` may also be replaced with `<ShipForm … />`, but that is not required — leave the table cell as-is to minimize churn.)

- [ ] **Step 4: Verify** — typecheck/lint, then Playwright at 390px (cards show, table hidden, shipping form usable, no horizontal scroll) and 1280px (table shows, cards hidden, unchanged).

- [ ] **Step 5: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/orders/page.tsx && git commit -m "feat(admin): mobile card layout for Sales

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Messages page — table → card stack

**Files:**
- Modify: `apps/admin/app/(dashboard)/inquiries/page.tsx`

- [ ] **Step 1: Shrink outer padding** — `p-8 max-w-5xl mx-auto` → `p-4 sm:p-8 max-w-5xl mx-auto`.

- [ ] **Step 2: Gate the table to desktop** — change the table wrapper `<div className="bg-white border rounded-lg overflow-hidden">` to `<div className="hidden lg:block bg-white border rounded-lg overflow-hidden">`.

- [ ] **Step 3: Add the mobile card stack** after the desktop wrapper, inside the `{inquiriesLoading ? … : ( … )}` branch:

```tsx
      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {inquiryList?.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No inquiries yet.</p>
        )}
        {inquiryList?.map((inq) => (
          <div key={inq.id} className="bg-white border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{inq.name}</p>
                <a
                  href={`mailto:${inq.email}?subject=Re: ${inq.pieceInterest}&body=Hi ${inq.name},%0A%0A`}
                  className="text-xs text-blue-600 hover:underline break-all"
                >
                  {inq.email}
                </a>
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
                  inq.handledAt ? "bg-gray-100 text-gray-500" : "bg-yellow-100 text-yellow-800"
                }`}
              >
                {inq.handledAt ? "handled" : "open"}
              </span>
            </div>
            <p className="text-xs text-gray-500">Piece: <span className="text-gray-700">{inq.pieceInterest}</span></p>
            <p className="text-gray-600">{inq.message ?? "—"}</p>
            <p className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(inq.createdAt), { addSuffix: true })}
            </p>
            {!inq.handledAt && (
              <button
                onClick={() => markHandled.mutate({ id: inq.id })}
                disabled={markHandled.isPending}
                className="text-xs border px-3 py-2 rounded text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Mark handled
              </button>
            )}
          </div>
        ))}
      </div>
```

- [ ] **Step 4: Verify** — typecheck/lint + Playwright 390px/1280px.

- [ ] **Step 5: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/inquiries/page.tsx && git commit -m "feat(admin): mobile card layout for Messages

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Auctions page — responsive form grid, stacking rows, bids cards

Three changes: the new-auction form's `grid-cols-3`, the auction list row (a flex layout with fixed-width columns that crowd on mobile), and the inner bids `<table>`.

**Files:**
- Modify: `apps/admin/app/(dashboard)/auctions/page.tsx`

- [ ] **Step 1: Shrink outer padding** — `p-8 max-w-5xl mx-auto` → `p-4 sm:p-8 max-w-5xl mx-auto`.

- [ ] **Step 2: Stack the form's number fields on mobile** — change `<div className="grid grid-cols-3 gap-4">` (the Min bid / Min increment / Deadline row) to:

```tsx
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
```

- [ ] **Step 3: Stack the auction row on mobile** — the row container `<div className="flex items-center gap-4 px-5 py-4">` packs four columns horizontally. Make it stack below `sm` and reset the fixed-width/right-aligned columns:

Change the row container to:
```tsx
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-4 sm:px-5 py-4">
```

Change the bid-info column `<div className="text-right shrink-0">` to:
```tsx
                <div className="text-left sm:text-right shrink-0">
```

Change the deadline column `<div className="text-right shrink-0 w-32">` to:
```tsx
                <div className="text-left sm:text-right shrink-0 sm:w-32">
```

Change the actions column `<div className="flex items-center gap-2 shrink-0">` to:
```tsx
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
```

(Buttons already use `px-3 py-1` — leave as-is; wrapping handles the narrow case.)

- [ ] **Step 4: Reflow the bids table to cards** — the bids `<table className="w-full text-xs">` lives in the expanded section. Gate it to desktop and add a mobile card list. Replace the whole `(a.bids?.length ?? 0) === 0 ? ( … ) : ( <table>…</table> )` ternary's table branch so both presentations render:

Change the `<table className="w-full text-xs">` opening tag to `<table className="hidden sm:table w-full text-xs">`, then immediately AFTER the `</table>` add:

```tsx
                      {/* Mobile bid cards */}
                      <div className="sm:hidden space-y-2">
                        {a.bids?.map((b: any, i: number) => (
                          <div key={b.id} className="border rounded p-2 text-xs bg-white">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">{b.bidderName}</span>
                              <span className="font-medium">€{Number(b.amount).toLocaleString()}</span>
                            </div>
                            <a href={`mailto:${b.bidderEmail}`} className="text-blue-500 hover:underline break-all">
                              {b.bidderEmail}
                            </a>
                            <div className="flex justify-between text-gray-400 mt-1">
                              <span>{formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}</span>
                              {i === 0 && <span className="text-green-600 font-medium">leading</span>}
                            </div>
                          </div>
                        ))}
                      </div>
```

- [ ] **Step 5: Verify** — typecheck/lint + Playwright 390px (form fields stack, auction rows stack cleanly, expand an auction → bid cards show; no horizontal scroll) and 1280px (unchanged: 3-col form, horizontal rows, bids table).

- [ ] **Step 6: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/auctions/page.tsx && git commit -m "feat(admin): responsive Auctions layout (form, rows, bid cards)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Pieces page — padding, image grid, variants cards, reorder buttons

The heaviest page. Five focused changes in `artworks/page.tsx`; the New/Edit form components already use `flex flex-wrap` with `w-full max-w-*` inputs and reflow acceptably, so they need no changes.

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

- [ ] **Step 1: Shrink outer padding** — `p-8 max-w-5xl mx-auto` → `p-4 sm:p-8 max-w-5xl mx-auto`.

- [ ] **Step 2: Responsive image grids** — there are TWO `grid grid-cols-4 gap-3` blocks (the loading skeleton and the real grid). Change BOTH occurrences of `className="grid grid-cols-4 gap-3"` to:

```tsx
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
```

Also, the image action overlay currently appears only on hover (`opacity-0 group-hover:opacity-100`) — on touch there is no hover. Change the overlay `<div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">` to be always visible on touch but hover-reveal on desktop:

```tsx
                      <div className="absolute inset-0 bg-black/60 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
```

- [ ] **Step 3: Enlarge the reorder ↑/↓ buttons for touch** — change the two buttons:

```tsx
          <button type="button" onClick={() => moveSelected(-1)} className="ml-2 text-xs border px-2 py-1 rounded" title="Move earlier">↑</button>
          <button type="button" onClick={() => moveSelected(1)} className="text-xs border px-2 py-1 rounded" title="Move later">↓</button>
```
to:
```tsx
          <button type="button" onClick={() => moveSelected(-1)} className="ml-2 text-sm border px-3 py-2 rounded" title="Move earlier">↑</button>
          <button type="button" onClick={() => moveSelected(1)} className="text-sm border px-3 py-2 rounded" title="Move later">↓</button>
```

- [ ] **Step 4: Reflow the variants table to cards on mobile**

The variants `<table className="w-full text-sm mb-4">` holds both read rows and inline-edit rows. Rather than rebuild the edit UI, gate the whole table to desktop and render a mobile card stack that reuses the same `editingVariant` state and the same handlers (`startEditVariant`, `saveVariant`, `cancelEditVariant`, `setVariantAvailable`, `handleDeleteVariant`, `setEditingVariant`).

First, change the table opening tag:
```tsx
                <table className="hidden lg:table w-full text-sm mb-4">
```

Then, immediately AFTER the table's closing `</table>`, add the mobile card list (still inside the `px-6 py-4` variants container, before the "Add variant form" block):

```tsx
                {/* Mobile variant cards */}
                <div className="lg:hidden space-y-3 mb-4">
                  {p.variants.map((v: any) => {
                    const ve = editingVariant[v.id];
                    if (ve) {
                      return (
                        <div key={v.id} className="border rounded-lg p-3 bg-blue-50 space-y-2">
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Name</label>
                            <input
                              className="border rounded px-2 py-1.5 text-sm w-full"
                              value={ve.name}
                              onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, name: e.target.value } }))}
                            />
                          </div>
                          <div className="flex gap-2">
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-0.5">Price (€)</label>
                              <input
                                type="number" min="0" step="0.01"
                                className="border rounded px-2 py-1.5 text-sm w-full"
                                value={ve.price}
                                onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, price: e.target.value } }))}
                              />
                            </div>
                            <div className="flex-1">
                              <label className="block text-xs text-gray-500 mb-0.5">Stock</label>
                              <input
                                type="number" min="0"
                                className="border rounded px-2 py-1.5 text-sm w-full"
                                value={ve.stock}
                                onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, stock: e.target.value } }))}
                              />
                            </div>
                          </div>
                          <label className="flex items-center gap-2 text-xs text-gray-600">
                            <input
                              type="checkbox"
                              checked={ve.available}
                              onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, available: e.target.checked } }))}
                            />
                            Shown in store
                          </label>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Medium</label>
                            <input
                              className="border rounded px-2 py-1.5 text-sm w-full"
                              value={ve.medium}
                              onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, medium: e.target.value } }))}
                              placeholder="e.g. Giclée on Hahnemühle"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-0.5">Dimensions</label>
                            <input
                              className="border rounded px-2 py-1.5 text-sm w-full"
                              value={ve.dimensions}
                              onChange={(e) => setEditingVariant((prev) => ({ ...prev, [v.id]: { ...ve, dimensions: e.target.value } }))}
                              placeholder="e.g. 30 × 40 cm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => saveVariant(v.id)} disabled={updateVariant.isPending} className="text-xs bg-black text-white px-3 py-2 rounded disabled:opacity-50">Save</button>
                            <button onClick={() => cancelEditVariant(v.id)} className="text-xs border px-3 py-2 rounded">Cancel</button>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={v.id} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium text-sm">{v.name}</p>
                          <button
                            type="button"
                            onClick={() => setVariantAvailable.mutate({ id: v.id, available: !v.available })}
                            disabled={setVariantAvailable.isPending}
                            title={v.available ? "Visible to customers — click to hide" : "Hidden from customers — click to show"}
                            className={`shrink-0 px-2 py-1 rounded text-xs disabled:opacity-50 ${
                              v.available ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-600"
                            }`}
                          >
                            {v.available ? "Visible" : "Hidden"}
                          </button>
                        </div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>€{Number(v.price).toLocaleString()}</span>
                          <span className="flex items-center">Stock: {v.stockQuantity}<WaitlistBadge variantId={v.id} /></span>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button onClick={() => startEditVariant(v)} className="text-xs border px-3 py-2 rounded hover:bg-gray-100">Edit</button>
                          <button
                            onClick={() => handleDeleteVariant(v.id)}
                            disabled={deleteVariant.isPending}
                            className={`text-xs px-3 py-2 rounded disabled:opacity-50 ${
                              confirmDelete === v.id ? "bg-red-600 text-white" : "border text-red-500 hover:bg-red-50"
                            }`}
                          >
                            {confirmDelete === v.id ? "Confirm" : "Delete"}
                          </button>
                          {confirmDelete === v.id && (
                            <button onClick={() => setConfirmDelete(null)} className="text-xs border px-3 py-2 rounded">✕</button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
```

- [ ] **Step 5: Verify** — typecheck/lint (no new errors beyond the documented `newVariantForm` baseline). Playwright at 390px: select a piece, expand Images (grid is 2-up, action buttons visible without hover), variant cards render, tap Edit → inline card editor with full-width inputs works, Visible/Hidden toggles, reorder ↑/↓ are comfortably tappable, no horizontal scroll. At 1280px: image grid 4-up, variants table unchanged.

- [ ] **Step 6: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/artworks/page.tsx && git commit -m "feat(admin): responsive Pieces page (image grid, variant cards, touch targets)

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Shipping & Banners — row layout + padding polish

Both already use `w-full` inputs in their forms; the only mobile weakness is the list rows (`flex items-center justify-between` with multiple action buttons) and the wide `p-8` padding.

**Files:**
- Modify: `apps/admin/app/(dashboard)/shipping/page.tsx`
- Modify: `apps/admin/app/(dashboard)/banners/page.tsx`

- [ ] **Step 1: Shipping padding & row stacking**

In `shipping/page.tsx`, change `<div className="p-8 max-w-3xl">` → `<div className="p-4 sm:p-8 max-w-3xl">`.

Change the read-row `<div className="border rounded-lg p-4 flex items-center justify-between">` to stack on mobile:
```tsx
            <div key={m.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
```
Enlarge its action buttons for touch — change `className="border px-3 py-1 rounded text-xs"` (Edit) to `className="border px-3 py-2 rounded text-xs"`, and the Delete button's `px-3 py-1` to `px-3 py-2`.

- [ ] **Step 2: Banners padding & row stacking**

In `banners/page.tsx`, change `<div className="p-8 max-w-3xl">` → `<div className="p-4 sm:p-8 max-w-3xl">`.

Change the read-row `<div className="border rounded-lg p-4 flex items-center justify-between gap-4">` to:
```tsx
              <div key={b.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
```
The actions container `<div className="flex items-center gap-2 shrink-0">` → add wrapping: `<div className="flex items-center gap-2 shrink-0 flex-wrap">`. Enlarge the three buttons (Live/Edit/Delete) from `px-3 py-1` to `px-3 py-2`.

- [ ] **Step 3: Verify** — typecheck/lint + Playwright 390px (rows stack, buttons tappable, no horizontal scroll) and 1280px (rows unchanged horizontal layout).

- [ ] **Step 4: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art && git add apps/admin/app/\(dashboard\)/shipping/page.tsx apps/admin/app/\(dashboard\)/banners/page.tsx && git commit -m "feat(admin): responsive Shipping & Banners rows

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Full-studio responsive sweep + login check

A final pass verifying every screen together and catching anything missed (including the `/login` page and the dashboard index `page.tsx`).

**Files:**
- Modify (only if the sweep finds a problem): any of the above, plus `apps/admin/app/login/page.tsx`, `apps/admin/app/(dashboard)/page.tsx`.

- [ ] **Step 1: Production build** — confirm nothing is broken:
  ```bash
  cd /home/blox-master/business/vamy/website/vamy.art && pnpm --filter @vamy/admin build
  ```
  Expected: build succeeds.

- [ ] **Step 2: Playwright sweep at 390×844** — walk every route: `/login`, `/auctions`, `/orders`, `/artworks`, `/inquiries`, `/shipping`, `/banners`, and `/` (dashboard index). For each, assert `document.documentElement.scrollWidth <= window.innerWidth + 1` (no horizontal scroll) and visually confirm the drawer nav works from each page. If `/login` or the index card overflow, fix with the same `p-4 sm:p-8` / `w-full` idiom and note it.

- [ ] **Step 3: Playwright sweep at 1280×800** — confirm the desktop experience is visually unchanged from before this branch (sidebar visible, tables visible, no card duplication leaking in).

- [ ] **Step 4: Commit** any fixes found:
  ```bash
  cd /home/blox-master/business/vamy/website/vamy.art && git add -A && git commit -m "fix(admin): responsive sweep follow-ups

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
  ```
  (If the sweep found nothing, skip the commit.)

---

## Task 8: Open PR (single push)

- [ ] **Step 1: Push the branch and open a PR** (only after all tasks verified):
  ```bash
  cd /home/blox-master/business/vamy/website/vamy.art && git push -u origin feat/admin-mobile-responsive && gh pr create --title "feat(admin): make the studio fully mobile-friendly" --body "$(cat <<'EOF'
## Summary
Makes the admin studio fully usable on a phone: hamburger-drawer navigation, data tables reflow to card stacks below `lg:`, responsive image grid and variant editing, larger touch targets, tighter mobile padding. Pure Tailwind/presentational — no backend, tRPC, or schema changes.

## Test plan
- Verified each screen in Playwright at 390×844 and 1280×800: no horizontal scroll, all controls tappable, drawer opens/closes, desktop layout unchanged.
- `pnpm --filter @vamy/admin build` passes.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
  ```

- [ ] **Step 2:** Report the PR URL to the user. Do not merge — leave that to the user.
