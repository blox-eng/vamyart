# Maeve Studio — Admin Rebrand Design

**Goal:** Restyle the admin panel (apps/admin) to feel like Maeve's own tool — matching the main site's typography, tone, and aesthetic — ahead of hosting it at studio.vamy.art.

**Architecture:** Pure cosmetic change. 5 files touched, no backend changes, no routing changes, no new dependencies beyond the Google Fonts import already used by the main site.

**Tech Stack:** Next.js App Router, Tailwind CSS, Google Fonts (Cormorant Garamond + Inter)

---

## Files to change

| File | Change |
|---|---|
| `apps/admin/app/layout.tsx` | Title metadata + font class on `<body>` |
| `apps/admin/app/globals.css` | Google Fonts import + font-family base styles |
| `apps/admin/tailwind.config.ts` | Extend theme with `fontFamily.serif` + `fontFamily.sans` |
| `apps/admin/app/(dashboard)/layout.tsx` | Sidebar label + nav renames + welcome toast copy |
| `apps/admin/app/login/page.tsx` | Heading, button copy, card style |

---

## Typography

Import from Google Fonts (same as `apps/website/src/css/main.css`):
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@400;500;700&display=swap');
```

Tailwind config extension:
```ts
fontFamily: {
  sans: ['Inter', 'sans-serif'],
  serif: ['Cormorant Garamond', 'serif'],
}
```

Page headings (`h1` on each dashboard page) get `font-serif` class. Body text stays `font-sans` (Inter) via the base `<body>` class.

---

## Branding changes

### Metadata (`app/layout.tsx`)
- `title`: `"vamy — Admin"` → `"Maeve Studio"`

### Sidebar header (`(dashboard)/layout.tsx`)
- Label next to logo: `"admin"` → `"studio"`

### Nav labels (`(dashboard)/layout.tsx`)
```ts
{ href: "/auctions",  label: "Auctions",      icon: LayoutGrid }   // unchanged
{ href: "/orders",    label: "Sales",          icon: ShoppingBag }  // was Orders
{ href: "/artworks",  label: "Pieces",         icon: ImageIcon }    // was Artworks
{ href: "/inquiries", label: "Messages",       icon: Mail }         // was Inquiries
{ href: "/shipping",  label: "Shipping",       icon: Truck }        // unchanged
{ href: "/banners",   label: "Announcements",  icon: Megaphone }    // was Banners
```

### Welcome toast (`(dashboard)/layout.tsx`)
- `"welcome back"` → `"welcome back, Maeve"`

### Login page (`login/page.tsx`)
- Heading: `"vamy admin"` → `"Maeve Studio"`
- Submit button: `"Sign in"` → `"Enter studio"`
- Card style: remove `rounded-lg shadow-sm` → `border` (flat, no shadow)

---

## What does NOT change

- Layout structure, sidebar width, colors, spacing
- All functional table/form UI on every page
- Auth logic, tRPC calls, routing
- The `SkeletonTable` loading states (already implemented on all 6 pages)
