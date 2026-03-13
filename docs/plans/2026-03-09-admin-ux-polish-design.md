# Admin UX Polish — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add toast notifications and loading skeletons to the admin panel so Maeve gets clear feedback on mutations and sees meaningful content during data fetches.

**Architecture:** A context-based toast provider wraps the dashboard layout; a shared `SkeletonTable` component replaces blank loading states across all six data pages. No external libraries — ~100 lines of new code total.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS, lucide-react (already installed)

---

## Toast System

A `ToastProvider` wraps `app/(dashboard)/layout.tsx` and exposes a `useToast()` hook. Each page calls `toast.success(...)` or `toast.error(...)` in mutation `onSuccess` / `onError` callbacks.

**Behaviour**
- Auto-dismiss after 3.5 seconds
- Stack in the top-right corner, 12px gap between toasts
- Maximum 3 visible at once (oldest drops off)

**Visual style**
- White background, thin left border (green = success, red = error, gray = info)
- `text-sm font-light` — same register as the rest of the admin
- No icons; the border colour carries the meaning

**Copy register**
Short, lowercase, direct. Examples:
- `"auction created"` / `"failed to create auction"`
- `"inquiry marked handled"`
- `"order marked shipped"`
- `"banner deleted"`
- `"welcome back"` (login)

**Files**
- Create: `apps/admin/components/ui/toast.tsx` — provider, hook, renderer
- Modify: `apps/admin/app/(dashboard)/layout.tsx` — wrap with `ToastProvider`
- Modify: all six page files — wire mutations to `useToast()`
- Modify: `apps/admin/app/login/page.tsx` — toast on login success

---

## Loading Skeletons

A shared `SkeletonTable` component replaces blank loading states on all six data pages.

**Pattern**
```tsx
if (query.isLoading) return <SkeletonTable rows={5} cols={4} />;
```

**Visual style**
- Gray pulse bars (`bg-gray-200 animate-pulse rounded`) inside a real `<table>` structure
- Column widths vary (short / long / short) to feel realistic, not perfectly uniform
- Header row: real column labels (not skeletonised) — keeps orientation

**Applies to**
| Page | Rows | Cols |
|------|------|------|
| Auctions | 4 | 5 |
| Orders | 5 | 6 |
| Artworks | 5 | 4 |
| Inquiries | 5 | 5 |
| Banners | 4 | 4 |
| Shipping | 4 | 3 |

**Files**
- Create: `apps/admin/components/ui/skeleton.tsx` — `SkeletonTable` component
- Modify: all six page files — replace `isLoading` blank states with `<SkeletonTable />`
