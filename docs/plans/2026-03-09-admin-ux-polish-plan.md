# Admin UX Polish — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add toast notifications and loading skeletons to the admin panel so mutations give clear feedback and data fetches show meaningful content while loading.

**Architecture:** A context-based `ToastProvider` wraps the dashboard layout and exposes `useToast()`. A shared `SkeletonTable` component replaces blank loading states on all six data pages. No external libraries — ~100 lines of new code total.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, lucide-react (already installed)

**Working directory:** `apps/admin` (all paths below are relative to repo root)

---

### Task 1: Toast system — provider, hook, renderer

**Files:**
- Create: `apps/admin/components/ui/toast.tsx`

**Step 1: Create the file**

```tsx
"use client";

import * as React from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    toast: (message: string, type?: ToastType) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);

    const toast = React.useCallback((message: string, type: ToastType = "info") => {
        const id = ++nextId;
        setToasts((prev) => [...prev.slice(-2), { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3500);
    }, []);

    return (
        <ToastContext.Provider value={{ toast }}>
            {children}
            <div
                aria-live="polite"
                aria-label="Notifications"
                className="fixed top-4 right-4 z-50 flex flex-col gap-3 pointer-events-none"
            >
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`bg-white shadow-md text-sm font-light px-4 py-3 min-w-[220px] max-w-xs border-l-2 pointer-events-auto ${
                            t.type === "success"
                                ? "border-green-500"
                                : t.type === "error"
                                ? "border-red-500"
                                : "border-gray-400"
                        }`}
                    >
                        {t.message}
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error("useToast must be used inside ToastProvider");
    return ctx.toast;
}
```

**Step 2: Verify the file was created**

```bash
cat apps/admin/components/ui/toast.tsx
```

Expected: file contents printed, no errors.

**Step 3: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add apps/admin/components/ui/toast.tsx
git commit -m "feat: add toast provider + useToast hook"
```

---

### Task 2: Wrap dashboard layout with ToastProvider

**Files:**
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

**Context:** The dashboard layout is at `apps/admin/app/(dashboard)/layout.tsx`. It is a client component that renders the sidebar nav + main content area. `ToastProvider` must wrap the outermost `<div>` so all dashboard pages can call `useToast()`.

**Step 1: Read the current file**

Read `apps/admin/app/(dashboard)/layout.tsx` and confirm the current imports and JSX structure.

**Step 2: Add the import**

Add this import after the existing imports:
```tsx
import { ToastProvider } from "../../../components/ui/toast";
```

**Step 3: Wrap the return**

The current return is:
```tsx
return (
    <div className="flex h-screen bg-gray-50">
      ...
    </div>
);
```

Wrap it:
```tsx
return (
    <ToastProvider>
        <div className="flex h-screen bg-gray-50">
          ...
        </div>
    </ToastProvider>
);
```

**Step 4: Verify the build compiles**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
```

Expected: build succeeds, no TypeScript errors.

**Step 5: Commit**

```bash
git add apps/admin/app/\(dashboard\)/layout.tsx
git commit -m "feat: wrap dashboard layout with ToastProvider"
```

---

### Task 3: Skeleton component

**Files:**
- Create: `apps/admin/components/ui/skeleton.tsx`

**Step 1: Create the file**

```tsx
interface SkeletonTableProps {
    rows?: number;
    cols?: number;
}

const COL_WIDTHS = ["w-24", "w-40", "w-20", "w-32", "w-16", "w-28"];

export function SkeletonTable({ rows = 5, cols = 4 }: SkeletonTableProps) {
    return (
        <div className="bg-white border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
                <tbody>
                    {Array.from({ length: rows }).map((_, r) => (
                        <tr key={r} className="border-b last:border-0">
                            {Array.from({ length: cols }).map((_, c) => (
                                <td key={c} className="px-4 py-3">
                                    <div
                                        className={`h-3 bg-gray-200 animate-pulse rounded ${
                                            COL_WIDTHS[(r + c) % COL_WIDTHS.length]
                                        }`}
                                    />
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
```

**Step 2: Verify**

```bash
cat apps/admin/components/ui/skeleton.tsx
```

Expected: file contents printed.

**Step 3: Commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git add apps/admin/components/ui/skeleton.tsx
git commit -m "feat: add SkeletonTable component"
```

---

### Task 4: Wire toasts and skeleton — Auctions page

**Files:**
- Modify: `apps/admin/app/(dashboard)/auctions/page.tsx`

**Context:** This page has two mutations: `openAuction` and `closeAuction`. Both currently give no success feedback. The `auctionList` query has no loading skeleton.

**Step 1: Add imports**

At the top of the file, add:
```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Add `useToast` call inside the component**

Add after the existing hooks:
```tsx
const toast = useToast();
```

**Step 3: Wire `openAuction` mutation**

Change `openAuction` to:
```tsx
const openAuction = trpc.auctions.open.useMutation({
    onSuccess: () => { refetch(); setForm(null); toast("auction created", "success"); },
    onError: () => toast("failed to create auction", "error"),
});
```

**Step 4: Wire `closeAuction` mutation**

Change `closeAuction` to:
```tsx
const closeAuction = trpc.auctions.close.useMutation({
    onSuccess: () => { refetch(); toast("auction closed", "success"); },
    onError: () => toast("failed to close auction", "error"),
});
```

**Step 5: Add skeleton for loading state**

The page currently uses `const { data: auctionList, refetch } = trpc.auctions.list.useQuery();`

Change to:
```tsx
const { data: auctionList, refetch, isLoading: auctionsLoading } = trpc.auctions.list.useQuery();
```

Then, just before the `{/* Auction list */}` comment (after the form block), add:
```tsx
{auctionsLoading && <SkeletonTable rows={4} cols={5} />}
```

Only show the skeleton when `auctionsLoading` is true. Keep the existing `auctionList?.length === 0` empty state for when data has loaded but is empty.

**Step 6: Build check**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
```

Expected: no TypeScript errors.

**Step 7: Commit**

```bash
git add apps/admin/app/\(dashboard\)/auctions/page.tsx
git commit -m "feat: toasts + skeleton on auctions page"
```

---

### Task 5: Wire toasts and skeleton — Orders page

**Files:**
- Modify: `apps/admin/app/(dashboard)/orders/page.tsx`

**Context:** One mutation: `markShipped`. The `orderList` query has no loading skeleton.

**Step 1: Add imports**

```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Add `useToast` inside the component**

```tsx
const toast = useToast();
```

**Step 3: Wire `markShipped` mutation**

Change to:
```tsx
const markShipped = trpc.orders.markShipped.useMutation({
    onSuccess: () => { refetch(); toast("order marked shipped", "success"); },
    onError: () => toast("failed to update order", "error"),
});
```

**Step 4: Add skeleton**

Change:
```tsx
const { data: orderList, refetch } = trpc.orders.list.useQuery();
```
to:
```tsx
const { data: orderList, refetch, isLoading: ordersLoading } = trpc.orders.list.useQuery();
```

Just before the `<div className="bg-white border rounded-lg overflow-hidden">` table wrapper, add:
```tsx
{ordersLoading && <SkeletonTable rows={5} cols={6} />}
```

Wrap the table `<div>` so it only shows when `!ordersLoading`:
```tsx
{!ordersLoading && (
    <div className="bg-white border rounded-lg overflow-hidden">
        ...
    </div>
)}
```

**Step 5: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/\(dashboard\)/orders/page.tsx
git commit -m "feat: toasts + skeleton on orders page"
```

---

### Task 6: Wire toasts and skeleton — Inquiries page

**Files:**
- Modify: `apps/admin/app/(dashboard)/inquiries/page.tsx`

**Context:** One mutation: `markHandled`. The `inquiryList` query has no loading skeleton.

**Step 1: Add imports**

```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Add `useToast` inside the component**

```tsx
const toast = useToast();
```

**Step 3: Wire `markHandled` mutation**

Change to:
```tsx
const markHandled = trpc.inquiries.markHandled.useMutation({
    onSuccess: () => { refetch(); toast("inquiry marked handled", "success"); },
    onError: () => toast("failed to update inquiry", "error"),
});
```

**Step 4: Add skeleton**

Change:
```tsx
const { data: inquiryList, refetch } = trpc.inquiries.list.useQuery();
```
to:
```tsx
const { data: inquiryList, refetch, isLoading: inquiriesLoading } = trpc.inquiries.list.useQuery();
```

Replace the entire table `<div>` with:
```tsx
{inquiriesLoading ? (
    <SkeletonTable rows={5} cols={5} />
) : (
    <div className="bg-white border rounded-lg overflow-hidden">
        {/* existing table */}
    </div>
)}
```

**Step 5: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/\(dashboard\)/inquiries/page.tsx
git commit -m "feat: toasts + skeleton on inquiries page"
```

---

### Task 7: Wire toasts and skeleton — Banners page

**Files:**
- Modify: `apps/admin/app/(dashboard)/banners/page.tsx`

**Context:** Three mutations: `create`, `update`, `del`. All currently silent on success.

**Step 1: Add imports**

```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Add `useToast` inside the component**

```tsx
const toast = useToast();
```

**Step 3: Wire mutations**

```tsx
const create = trpc.banners.create.useMutation({
    onSuccess: () => { refetch(); toast("banner created", "success"); },
    onError: () => toast("failed to create banner", "error"),
});
const update = trpc.banners.update.useMutation({
    onSuccess: () => { refetch(); toast("banner updated", "success"); },
    onError: () => toast("failed to update banner", "error"),
});
const del = trpc.banners.delete.useMutation({
    onSuccess: () => { refetch(); toast("banner deleted", "success"); },
    onError: () => toast("failed to delete banner", "error"),
});
```

**Step 4: Add skeleton**

Change:
```tsx
const { data: bannerList, refetch } = trpc.banners.list.useQuery();
```
to:
```tsx
const { data: bannerList, refetch, isLoading: bannersLoading } = trpc.banners.list.useQuery();
```

Just before the `<div className="space-y-3 mb-10">`, add:
```tsx
{bannersLoading && <SkeletonTable rows={4} cols={4} />}
```

Wrap the `<div className="space-y-3 mb-10">` so it only renders when `!bannersLoading`.

**Step 5: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/\(dashboard\)/banners/page.tsx
git commit -m "feat: toasts + skeleton on banners page"
```

---

### Task 8: Wire toasts and skeleton — Artworks page

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx`

**Context:** Multiple mutations: `updateVariant`, `deleteVariant`, `createVariant`, `updateProduct`, `deleteProduct` (if it exists), `updateShipping`. Wire all of them.

**Step 1: Add imports**

```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Read the full file first** to confirm exact mutation names, then add `const toast = useToast();` inside the component.

**Step 3: Wire each mutation** — add `onSuccess` and `onError` to every `useMutation` call. Use these messages:
- `updateVariant` → `"variant updated"` / `"failed to update variant"`
- `deleteVariant` → `"variant deleted"` / `"failed to delete variant"`
- `createVariant` → `"variant added"` / `"failed to add variant"`
- `updateProduct` → `"product updated"` / `"failed to update product"`
- `deleteProduct` (if present) → `"product deleted"` / `"failed to delete product"`
- `updateShipping` → `"shipping updated"` / `"failed to update shipping"`
- Any `createProduct` mutation → `"product created"` / `"failed to create product"`

**Step 4: Add skeleton**

Change:
```tsx
const { data: productList, refetch } = trpc.products.listAll.useQuery();
```
to:
```tsx
const { data: productList, refetch, isLoading: productsLoading } = trpc.products.listAll.useQuery();
```

Find the main content area (likely a `<div className="space-y-...">` containing product cards) and add before it:
```tsx
{productsLoading && <SkeletonTable rows={5} cols={4} />}
```

Only render the product list when `!productsLoading`.

**Step 5: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/\(dashboard\)/artworks/page.tsx
git commit -m "feat: toasts + skeleton on artworks page"
```

---

### Task 9: Wire toasts and skeleton — Shipping page

**Files:**
- Modify: `apps/admin/app/(dashboard)/shipping/page.tsx`

**Context:** Three mutations: `create`, `update`, `del`. Currently shows inline `error` state.

**Step 1: Add imports**

```tsx
import { useToast } from "../../../components/ui/toast";
import { SkeletonTable } from "../../../components/ui/skeleton";
```

**Step 2: Add `useToast` inside the component**

```tsx
const toast = useToast();
```

**Step 3: Wire mutations**

```tsx
const create = trpc.shippingMethods.create.useMutation({
    onSuccess: () => { refetch(); toast("shipping method created", "success"); },
    onError: () => toast("failed to create shipping method", "error"),
});
const update = trpc.shippingMethods.update.useMutation({
    onSuccess: () => { refetch(); toast("shipping method updated", "success"); },
    onError: () => toast("failed to update shipping method", "error"),
});
const del = trpc.shippingMethods.delete.useMutation({
    onSuccess: () => { refetch(); toast("shipping method deleted", "success"); },
    onError: () => toast("failed to delete shipping method", "error"),
});
```

The existing `setError(...)` inline error state can remain for form validation errors (wrong input) — toasts are for mutation outcomes.

**Step 4: Add skeleton**

Change:
```tsx
const { data: methods, refetch } = trpc.shippingMethods.list.useQuery();
```
to:
```tsx
const { data: methods, refetch, isLoading: methodsLoading } = trpc.shippingMethods.list.useQuery();
```

Add before the methods list:
```tsx
{methodsLoading && <SkeletonTable rows={4} cols={3} />}
```

Wrap the methods list so it only renders when `!methodsLoading`.

**Step 5: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/\(dashboard\)/shipping/page.tsx
git commit -m "feat: toasts + skeleton on shipping page"
```

---

### Task 10: Toast on login

**Files:**
- Modify: `apps/admin/app/login/page.tsx`

**Context:** The login page is outside the `(dashboard)` layout, so `ToastProvider` is not available. The login success case immediately redirects (no time for a toast there). The login error case currently shows an inline error message — keep that as-is.

The only useful addition here is a "welcome back" toast on the dashboard after redirect. The cleanest way: after `router.push("/auctions")`, store a flag in `sessionStorage`, then read it in the dashboard layout and fire a toast.

**Step 1: In `login/page.tsx`, set a flag before redirecting**

In the `else` branch of `handleLogin`:
```tsx
} else {
    sessionStorage.setItem("vamy-admin-just-logged-in", "1");
    router.push("/auctions");
    router.refresh();
}
```

**Step 2: In `apps/admin/app/(dashboard)/layout.tsx`, read the flag**

Add a `useEffect` inside `DashboardLayout`:
```tsx
import { useToast } from "../../../components/ui/toast";
// ...
const toast = useToast(); // add this line inside the component

React.useEffect(() => {
    if (sessionStorage.getItem("vamy-admin-just-logged-in")) {
        sessionStorage.removeItem("vamy-admin-just-logged-in");
        toast("welcome back", "success");
    }
}, [toast]);
```

**Important:** `useToast()` is valid here because `DashboardLayout` renders *inside* `ToastProvider` (the provider wraps the return JSX). Confirm this is the case before adding — the provider wraps `children`, and `DashboardLayout` itself is the provider, so `useToast()` must be called in a *child* component.

Since `DashboardLayout` IS the provider, it cannot call `useToast()` itself. Instead, create a tiny child component:

```tsx
// Inside layout.tsx, above the DashboardLayout function:
function WelcomeToast() {
    const toast = useToast();
    React.useEffect(() => {
        if (sessionStorage.getItem("vamy-admin-just-logged-in")) {
            sessionStorage.removeItem("vamy-admin-just-logged-in");
            toast("welcome back", "success");
        }
    }, [toast]);
    return null;
}
```

Then add `<WelcomeToast />` as the first child inside the `<ToastProvider>` wrapper.

**Step 3: Build check + commit**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -20
git add apps/admin/app/login/page.tsx apps/admin/app/\(dashboard\)/layout.tsx
git commit -m "feat: welcome back toast on login redirect"
```

---

### Task 11: Final build verification

**Step 1: Full build**

```bash
cd /home/blox-master/business/vamy/website/vamy.art
pnpm --filter @vamy/admin build 2>&1 | tail -30
```

Expected: `✓ Compiled successfully` or similar. Zero TypeScript errors. Zero ESLint errors blocking build.

**Step 2: Confirm all pages compile**

The build output will list all routes. Confirm these appear:
- `/login`
- `/auctions`
- `/orders`
- `/artworks`
- `/inquiries`
- `/banners`
- `/shipping`

**Step 3: Commit if any fixes were needed, then done.**

```bash
git add -A
git commit -m "fix: admin UX polish build fixes"
```
