# Website Polish — Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Upgrade the public website from portfolio template to gallery-grade storefront. Add pricing, availability, and structured artwork presentation across all pages. Redesign the footer, add an About page, and fix data issues.

**Architecture:** Artwork metadata (price, availability, medium, dimensions) lives in the Supabase DB via the existing products/product_variants tables. Gallery cards, artwork detail pages, and the homepage hero all query the DB at render time via tRPC. The admin panel's Artworks page gains new fields for medium, dimensions, and a featured toggle.

**Tech Stack:** Next.js 15 (Pages Router), tRPC v11, Drizzle ORM, Supabase PostgreSQL, Tailwind CSS

---

## 1. Gallery Cards — Saatchi-Inspired

Each card in `/gallery/` shows the artwork image, title, medium, dimensions, price, and availability.

**Card structure:**
```
[artwork image]
Title
Oil on canvas · 70 × 100 cm
€4,751
● Available
```

**Data source:** tRPC query joins artwork slug to the products + product_variants tables. Each card renders:
- **Price** from `product_variants.price`. Voss-style specific numbers (e.g. `€4,751`, `€7,230`). If no variant or price is null, show "Price on request."
- **Availability** derived from `product_variants.available` boolean: `● Available` (green dot), `● Sold` (gray), `● On auction` (amber if an active auction exists for this artwork).
- **Medium + dimensions** from `product_variants.attributes` JSONB (`{ medium: "Oil on canvas", dimensions: "70 × 100 cm" }`).
- No artist name on cards — Maeve is the only artist.
- No heart/cart/collection icons — this is not a marketplace.

**Pricing philosophy (Chris Voss + luxury positioning):**
- Specific, non-round numbers signal deliberation. `€4,751` feels researched; `€5,000` feels arbitrary.
- Never justify the price. The number stands alone.
- No charm pricing (`€4,999`). That signals discount retail.

---

## 2. Homepage Hero — Featured Artwork

Replace the placeholder canvas image with a real artwork image, configurable from the admin panel.

**Mechanism:**
- Add a `featured` boolean column to the `products` table (or `artworks` table if it exists separately). Only one product should be featured at a time.
- The homepage queries for the latest featured product via tRPC, retrieves the artwork image URL, and renders it in the hero.
- Admin panel: add a "Featured" toggle to the Artworks page. When Maeve toggles one on, the previous featured is toggled off automatically.
- Fallback: if no product is featured, show the existing placeholder image.

**Image source:** remains local (`/public/images/`). The featured query returns the artwork slug, which maps to the image path via the markdown content or a new `imageUrl` field in the DB.

---

## 3. Get-a-Piece Page — DB-Driven

Remove the hardcoded `ARTWORK_MAP` from `src/pages/get-a-piece.tsx`. Replace with a tRPC query.

**Changes:**
- The `?piece=` param takes an artwork slug (e.g. `?piece=whispers`), not a piece ID hash.
- Query `trpc.products.getByArtworkSlug` (new router method) to fetch title, image, medium, dimensions, price.
- Left panel renders the artwork image (large, with presence), title, medium, dimensions, price — all from DB.
- Right panel: keep the existing form (name, email, which piece, message, legal terms, submit). Already wired to tRPC.
- If no `?piece=` param or slug not found, show generic "Interested in owning a piece?" without artwork preview.
- Gallery cards link to `/get-a-piece?piece={slug}` via an "Inquire" action.

---

## 4. Artwork Detail Pages — Two-Column Layout

Redesign `/gallery/{slug}` from single-column markdown flow to a structured two-column layout.

**Layout:**
```
┌─────────────────────┬──────────────────────┐
│                     │ Title                │
│  [Large artwork     │ Oil on canvas        │
│   image]            │ 70 × 100 cm          │
│                     │ €4,751               │
│                     │ ● Available           │
│                     │                      │
│                     │ [Inquire]            │
│                     │                      │
│                     │ Description text...  │
│                     │                      │
│                     │ [BidWidget]          │
│                     │ [ProductSelector]    │
└─────────────────────┴──────────────────────┘
```

- **Left column:** large artwork image, full height, maximum visual presence.
- **Right column:** structured details — title, medium, dimensions, price, availability, description (from markdown content), then the existing commerce widgets (BidWidget + ProductSelector).
- Data from both sources: markdown (description, image) and DB (price, availability, medium, dimensions).
- Replaces the current PostLayout single-column render.

---

## 5. Footer Redesign

**New layout (two rows):**

Row 1:
- Far left: V logo + "Maeve Vamy" text
- Right of logo: newsletter section — heading ("Stay in the loop"), subtitle, email input + subscribe button
- Below the newsletter input: social icons (email + Instagram)

Row 2 (bottom bar):
- `© 2026 Vamy` (year added)
- Terms · Privacy links
- Legal entity line

**Changes to `content/data/footer.json`:**
- Fix Instagram URL: `https://www.instagram.com/maeve_vamy_art`

**Changes to `content/pages/index.md`:**
- Fix hero "Follow me" Instagram URL: `https://www.instagram.com/maeve_vamy_art`

**Changes to Footer component (`src/components/sections/Footer/index.tsx`):**
- Restructure grid to match the new layout
- Add current year dynamically to copyright
- Move social icons below the newsletter signup

---

## 6. About Page

New custom page at `/about/`.

**Structure:**
- Hero: full-width studio photo placeholder (`/images/about-placeholder.jpg` — Maeve replaces later)
- Bio section: third person, 2-3 paragraphs of placeholder copy
- Artist statement: first person, short italic block
- Clean, minimal, no sidebar — matches the site's design language

**Implementation:** custom TSX page at `src/pages/about.tsx` (like get-a-piece), not content-model-driven. Add "About" to header navigation in `content/data/header.json`.

---

## 7. Admin Panel Changes

**Artworks page (`apps/admin`):**
- Add medium + dimensions input fields to the variant editor. Values stored in `product_variants.attributes` JSONB (no migration needed — JSONB is flexible).
- Add a "Featured" toggle per product. When toggled on, un-feature any other product. Stored as a new `featured` boolean column on the `products` table (requires a small Drizzle migration).

**New tRPC routes (in `packages/db`):**
- `products.getByArtworkSlug` — returns product + variants for a given artwork slug
- `products.getFeatured` — returns the currently featured product (for homepage hero)

---

## 8. Instagram URL Fix

Update `maevevamyart` → `maeve_vamy_art` in:
- `apps/website/content/data/footer.json` (social links)
- `apps/website/content/pages/index.md` (hero "Follow me" action)
- Any other references found via grep
