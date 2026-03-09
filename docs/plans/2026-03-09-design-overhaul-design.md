# Design Overhaul — vamy.art

**Date:** 2026-03-09
**Goal:** Elevate vamy.art to match the gravitas required to sell paintings at €1,000,000+. Design seed: **core minimalism** — restrained, intentional, letting the art breathe.

Reference galleries: Hauser & Wirth, Pace Gallery, David Zwirner.

---

## 1. Design Tokens

### Typography
- `fontHeadlines` in `style.json`: `"sans"` → `"serif"`
- Google Fonts import in `main.css`: replace Roboto Slab with **Cormorant Garamond** at `ital,wght@0,300;0,400;0,600;1,300;1,400`
- `tailwind.config.js` `fontFamily.serif`: `['Roboto Slab', 'serif']` → `['Cormorant Garamond', 'serif']`
- h1 `letterSpacing` in `style.json`: `"normal"` → `"wide"` (opens display text at 6xl)

### Color
- `"dark"` in `style.json`: `"#4A4A4A"` → `"#111111"` (true near-black; resolves schism with hardcoded `bg-black` in commerce components)

### Buttons
- `buttonPrimary.borderRadius` and `buttonSecondary.borderRadius`: `"DEFAULT"` → `"none"`
- Remove `hover:-translate-y-1` from `.sb-component-button` in `main.css` (SaaS micro-interaction, not gallery)

### Header
- Remove `shadow-header` from Header component className (sticky app-bar feel; replace with `border-b border-neutral` if visual separation is needed)

---

## 2. Component Code Changes

### ProductSelector (`src/components/blocks/ProductSelector/index.tsx`)
- Remove `rounded-lg` from container
- Variant row borders: `border-gray-200` / `border-gray-400` → `border-neutral` / `border-dark`

### BidWidget (`src/components/blocks/BidWidget/index.tsx`)
- Remove `rounded-lg` from container

### BidModal (`src/components/blocks/BidWidget/BidModal.tsx`)
- Remove `rounded-lg` from modal container
- Remove `rounded` from form inputs (use sharp-cornered inputs throughout)

### LocaleSwitcher (`src/components/sections/Header/index.tsx`)
- Replace native `<select>` with text toggle: `EN / DE / BG`
- Each locale is a plain `<button>` — active locale gets `underline`, inactive gets `opacity-60`
- Slash separators are static `<span>` text. No border, no background, no system chrome.

### Footer newsletter form (`src/components/sections/Footer/index.tsx`)
- Input: remove `rounded`, use `border-b border-current` (underline input style)
- Submit: plain text or `→` — remove hover-invert button pattern

---

## 3. Content Changes

### Homepage (`content/pages/index.md`)
- Hero `title.text`: `"Fine Art"` → `"Maeve Vamy"`
- Hero image `altText`: `"Unblock your team boost your time to production preview"` → `"A painting by Maeve Vamy, oil on canvas"`
- Style section title: `"Style"` → `"The Work"`
- Style card subtitles: `"Unrealistic"` → `"On Observation"`, `"Vibes"` → `"On Abstraction"` (editorial register)
- All three FeaturedItem `borderRadius`: `x-large` → `none`

### Gallery index (`content/pages/gallery/index.md`)
- `showDate: true` → `showDate: false`
- `showAuthor: true` → `showAuthor: false`

### Inquiry page (`content/pages/get-a-piece.md`)
- `type: FormBlock` → `type: ReachOutBlock` (migrates off HubSpot, matches homepage)
- Submit button label: `"Swoosh"` → `"Send"`
- Form `borderRadius: large` → `borderRadius: none`
- Page title: `"Get a piece"` → `"Acquire a Work"`
- SEO `metaTitle`: `"Get a piece"` → `"Acquire a Work — Maeve Vamy"`
- Badge label: `"Found something you like?"` → `"Interested in acquiring a work?"`

---

## 4. READMEs

### Root `README.md` — full replacement
Cover: what the repo is, tech stack at a glance, monorepo structure, local dev setup, key architectural decisions, deploy.

### Sub-READMEs — new files in:
- `apps/website/README.md` — what this app is, Pages Router caveat, how to run standalone
- `apps/admin/README.md` — auth model (Supabase Auth, artist only), how to run
- `packages/db/README.md` — schema overview, migrations, tRPC router patterns
- `packages/ui/README.md` — shared components, how to add shadcn primitives
- `packages/i18n/README.md` — message file structure, how to add translations

---

## Constraints

- Pages Router stays — do not touch App Router migration
- No new dependencies for the LocaleSwitcher change
- `ReachOutBlock` on `get-a-piece.md` must be verified to render correctly before the FormBlock reference is removed
- All changes are non-breaking: no schema, no API, no auth
