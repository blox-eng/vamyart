# Design Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Elevate vamy.art to gallery-grade minimalism — Cormorant Garamond headlines, true-black tokens, zero border-radius everywhere, sharp commerce widgets, clean content, and proper READMEs for developers.

**Architecture:** All changes are purely presentational — design tokens, component CSS classes, and markdown content. No schema, no API, no auth changes. The token changes in `style.json` + `tailwind.config.js` cascade site-wide automatically via the existing plugin system.

**Tech Stack:** Next.js 15 Pages Router, Tailwind CSS (plugin-based token system via `style.json`), tRPC, Google Fonts

**Design doc:** `docs/plans/2026-03-09-design-overhaul-design.md`

---

### Task 1: Typeface — Cormorant Garamond + token activation

**Files:**
- Modify: `apps/website/src/css/main.css:1`
- Modify: `apps/website/tailwind.config.js:12` (fontFamily.serif)
- Modify: `apps/website/content/data/style.json` (fontHeadlines, h1.letterSpacing)

**No automated tests for visual changes. Manual verification step included.**

**Step 1: Replace the Google Fonts import**

In `apps/website/src/css/main.css`, replace line 1:
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&family=Roboto+Slab:wght@400;500;700&display=swap');
```
with:
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@400;500;700&display=swap');
```

**Step 2: Update tailwind font-serif**

In `apps/website/tailwind.config.js`, change:
```js
serif: ['Roboto Slab', 'serif']
```
to:
```js
serif: ['Cormorant Garamond', 'serif']
```

**Step 3: Activate serif for headlines and open h1 tracking**

In `apps/website/content/data/style.json`, make two changes:

Change `"fontHeadlines": "sans"` → `"fontHeadlines": "serif"`

Change h1 `"letterSpacing": "normal"` → `"letterSpacing": "wide"`

**Step 4: Run dev server and verify**

```bash
cd apps/website && pnpm dev
```

Open `http://localhost:3000`. All h1–h6 elements should now render in Cormorant Garamond. The homepage "Maeve Vamy" h1 should be noticeably more open in tracking. Inter remains for body text.

**Step 5: Commit**

```bash
git add apps/website/src/css/main.css apps/website/tailwind.config.js apps/website/content/data/style.json
git commit -m "feat: switch headline typeface to Cormorant Garamond, open h1 tracking"
```

---

### Task 2: Color token — true near-black

**Files:**
- Modify: `apps/website/content/data/style.json` (`dark` token)

**Step 1: Update the dark token**

In `apps/website/content/data/style.json`, change:
```json
"dark": "#4A4A4A"
```
to:
```json
"dark": "#111111"
```

**Step 2: Verify**

With dev server running, check the homepage. The `text-dark` class used on section titles should now render in near-black `#111111` — matching the conviction of the `bg-black` buttons and commerce components. Body text (Inter) should feel more grounded.

**Step 3: Commit**

```bash
git add apps/website/content/data/style.json
git commit -m "feat: set dark color token to true near-black #111111"
```

---

### Task 3: Button tokens — zero border-radius, remove bounce hover

**Files:**
- Modify: `apps/website/content/data/style.json` (button borderRadius tokens)
- Modify: `apps/website/src/css/main.css` (remove `hover:-translate-y-1`)

**Step 1: Zero out button border-radius in tokens**

In `apps/website/content/data/style.json`, for both `buttonPrimary` and `buttonSecondary`:
```json
"borderRadius": "none"
```
(was `"DEFAULT"`)

**Step 2: Remove the bounce hover from buttons**

In `apps/website/src/css/main.css`, find line ~128:
```css
@apply inline-flex justify-center items-center text-center border transition duration-200 ease-in hover:-translate-y-1;
```
Remove `hover:-translate-y-1`:
```css
@apply inline-flex justify-center items-center text-center border transition duration-200 ease-in;
```

**Step 3: Verify**

Buttons throughout the site (DISCOVER, CHECK OUT MY WORK, etc.) should now have sharp corners. Hovering a button should produce no upward movement — only any color/opacity change from the existing theme.

**Step 4: Commit**

```bash
git add apps/website/content/data/style.json apps/website/src/css/main.css
git commit -m "feat: remove border-radius and bounce hover from all buttons"
```

---

### Task 4: Header — remove shadow

**Files:**
- Modify: `apps/website/src/components/sections/Header/index.tsx` (~line 50)

**Step 1: Remove shadow-header from header className**

In `apps/website/src/components/sections/Header/index.tsx`, find the className array around line 50 that includes `'shadow-header'`. Remove that string from the array. If it's the only conditional, remove the condition entirely. Add `'border-b border-neutral'` to the same className list for a clean separator.

Current pattern (approximately):
```tsx
className={classNames(
  'sticky top-0 z-10',
  'shadow-header',
  ...
)}
```

Updated:
```tsx
className={classNames(
  'sticky top-0 z-10',
  'border-b border-neutral',
  ...
)}
```

**Step 2: Verify**

The header should no longer show a box shadow. A thin neutral line should separate it from the page content. The header should feel like it's part of the page, not floating above it.

**Step 3: Commit**

```bash
git add apps/website/src/components/sections/Header/index.tsx
git commit -m "feat: replace header box-shadow with thin border separator"
```

---

### Task 5: LocaleSwitcher — replace native select with text toggle

**Files:**
- Modify: `apps/website/src/components/sections/Header/index.tsx` (~lines 18–37)

The existing LocaleSwitcher is a native `<select>` (lines 25–37). Replace it with three plain buttons separated by slashes.

**Step 1: Replace the select element**

Find the existing LocaleSwitcher component in `Header/index.tsx`. The current implementation (approximately lines 18–37):
```tsx
const [locale, setLocale] = React.useState(() => {
    try { return localStorage.getItem('vamy-locale') ?? 'en'; } catch { return 'en'; }
});
<select value={locale} onChange={e => { localStorage.setItem('vamy-locale', e.target.value); setLocale(e.target.value); }}>
    <option value="en">EN</option>
    <option value="de">DE</option>
    <option value="bg">BG</option>
</select>
```

Replace with:
```tsx
const [locale, setLocale] = React.useState(() => {
    try { return localStorage.getItem('vamy-locale') ?? 'en'; } catch { return 'en'; }
});
const locales = ['en', 'de', 'bg'] as const;
<span className="flex items-center gap-1 text-xs tracking-widest uppercase">
    {locales.map((l, i) => (
        <React.Fragment key={l}>
            {i > 0 && <span className="opacity-30">/</span>}
            <button
                onClick={() => { localStorage.setItem('vamy-locale', l); setLocale(l); }}
                className={locale === l ? 'underline underline-offset-2' : 'opacity-50 hover:opacity-100 transition-opacity'}
            >
                {l.toUpperCase()}
            </button>
        </React.Fragment>
    ))}
</span>
```

**Step 2: Verify**

In the header, the language switcher should now appear as `EN / DE / BG` in small uppercase text. The active locale is underlined. No dropdown, no system chrome. Clicking a locale still persists to localStorage and updates state.

**Step 3: Commit**

```bash
git add apps/website/src/components/sections/Header/index.tsx
git commit -m "feat: replace native locale select with minimal text toggle"
```

---

### Task 6: ProductSelector — remove rounded corners, fix variant borders

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx`

**Step 1: Remove rounded-lg from container (line ~40)**

Change:
```tsx
<div className="border border-black rounded-lg p-6 mt-4">
```
to:
```tsx
<div className="border border-black p-6 mt-4">
```

**Step 2: Fix variant row borders and remove rounded from buy button (lines ~46, ~82)**

Change variant row className (line ~46):
```tsx
className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${selectedVariantId === v.id ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
```
to:
```tsx
className={`flex items-center justify-between p-3 border cursor-pointer transition-colors ${selectedVariantId === v.id ? 'border-black bg-gray-50' : 'border-neutral hover:border-dark'}`}
```

Change buy button (line ~82):
```tsx
className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"
```
to:
```tsx
className="w-full bg-black text-white py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"
```

**Step 3: Verify**

Visit any artwork detail page with a product attached. The variant picker container and variant rows should have sharp corners. The buy button should be a perfect rectangle.

**Step 4: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "feat: remove border-radius from ProductSelector"
```

---

### Task 7: BidWidget + BidModal — remove all rounded corners

**Files:**
- Modify: `apps/website/src/components/blocks/BidWidget/index.tsx`
- Modify: `apps/website/src/components/blocks/BidWidget/BidModal.tsx`

**Step 1: BidWidget container (index.tsx line ~42)**

Change:
```tsx
<div className="border border-black rounded-lg p-6 mt-8">
```
to:
```tsx
<div className="border border-black p-6 mt-8">
```

Also fix the "Place Bid" button (line ~67):
```tsx
className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors"
```
to:
```tsx
className="w-full bg-black text-white py-3 text-sm tracking-wide hover:bg-gray-800 transition-colors"
```

**Step 2: BidModal (BidModal.tsx)**

Modal container (line ~40):
```tsx
<div className="bg-white rounded-lg p-8 max-w-md w-full">
```
to:
```tsx
<div className="bg-white p-8 max-w-md w-full">
```

All three inputs (lines ~44–46) — remove `rounded` from each:
```tsx
className="w-full border px-3 py-2 text-sm"
```
(was `"w-full border px-3 py-2 rounded text-sm"`)

Cancel button (line ~49):
```tsx
className="flex-1 border px-4 py-2 text-sm"
```

Submit button (line ~50):
```tsx
className="flex-1 bg-black text-white px-4 py-2 text-sm disabled:opacity-50"
```

**Step 3: Verify**

Open a live auction page, click Place Bid. The modal should appear with sharp corners on the container and all form inputs.

**Step 4: Commit**

```bash
git add apps/website/src/components/blocks/BidWidget/index.tsx apps/website/src/components/blocks/BidWidget/BidModal.tsx
git commit -m "feat: remove all border-radius from BidWidget and BidModal"
```

---

### Task 8: Footer newsletter form — underline input, remove hover-invert button

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx` (~lines 140–145)

**Step 1: Update input style (line ~140)**

Change:
```tsx
className="flex-1 px-3 py-2 text-sm border border-current rounded"
```
to:
```tsx
className="flex-1 px-0 py-2 text-sm border-b border-current bg-transparent outline-none"
```

**Step 2: Update submit button (line ~145)**

Change:
```tsx
className="px-4 py-2 text-sm border border-current rounded hover:bg-black hover:text-white transition-colors"
```
to:
```tsx
className="px-4 py-2 text-sm border border-current transition-opacity hover:opacity-60"
```

**Step 3: Verify**

Scroll to footer. The email input should appear as a borderless field with only an underline. The subscribe button should fade on hover, not invert.

**Step 4: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx
git commit -m "feat: refine footer newsletter form to underline input style"
```

---

### Task 9: Homepage content — hero title, alt text, section titles, card metadata

**Files:**
- Modify: `apps/website/content/pages/index.md`

**Step 1: Hero title**

Change:
```yaml
text: Fine Art
```
to:
```yaml
text: Maeve Vamy
```

**Step 2: Hero image alt text**

Change:
```yaml
altText: Unblock your team boost your time to production preview
```
to:
```yaml
altText: A painting by Maeve Vamy, oil on canvas
```

**Step 3: Style section title**

Change:
```yaml
text: Style
```
to:
```yaml
text: The Work
```

**Step 4: Card subtitle + border radius**

For the three FeaturedItem cards, make these changes:

Card 2 (Realism):
```yaml
subtitle: On Observation
```
(was `Unrealistic`)

Card 3 (Surreal):
```yaml
subtitle: On Abstraction
```
(was `Vibes`)

For all three cards, change:
```yaml
borderRadius: x-large
```
to:
```yaml
borderRadius: none
```

(Also change the image `borderRadius: x-large` to `borderRadius: none` in the Oil card.)

**Step 5: Verify**

Homepage hero should read "Maeve Vamy". The Style section should read "The Work" with sharp-cornered cards. Card subtitles should read "On Canvas", "On Observation", "On Abstraction".

**Step 6: Commit**

```bash
git add apps/website/content/pages/index.md
git commit -m "content: update homepage hero title, alt text, section titles, card borders"
```

---

### Task 10: Gallery feed — remove date and author metadata

**Files:**
- Modify: `apps/website/content/pages/gallery/index.md`

**Step 1: Disable date and author on gallery feed**

Change:
```yaml
showDate: true
showAuthor: true
```
to:
```yaml
showDate: false
showAuthor: false
```

**Step 2: Verify**

Visit `/gallery`. Artwork tiles should show thumbnail and title only — no date stamp, no "by Maeve Vamy" attribution.

**Step 3: Commit**

```bash
git add apps/website/content/pages/gallery/index.md
git commit -m "content: remove date and author from gallery artwork feed"
```

---

### Task 11: Inquiry page — migrate to ReachOutBlock, fix copy and border-radius

**Files:**
- Modify: `apps/website/content/pages/get-a-piece.md`

**Important:** Before changing `type: FormBlock` to `type: ReachOutBlock`, verify that ReachOutBlock renders correctly on the homepage (`/`). If it does, the component exists and is safe to reference.

**Step 1: Verify ReachOutBlock on homepage**

With dev server running, check `http://localhost:3000` — the contact section at the bottom should render a working form. If it does, proceed.

**Step 2: Update the inquiry page**

Replace the entire `media:` block:
```yaml
media:
  type: FormBlock
  fields: [...]
  submitButton:
    type: SubmitButtonFormControl
    label: Swoosh
    ...
  elementId: contact-form
  styles:
    self:
      ...
      borderRadius: large
```
with:
```yaml
media:
  type: ReachOutBlock
  elementId: contact-form
```

**Step 3: Update page copy**

Change:
```yaml
title:
  text: Get a piece
```
to:
```yaml
title:
  text: Acquire a Work
```

Change badge label:
```yaml
label: Found something you like?
```
to:
```yaml
label: Interested in acquiring a work?
```

Change SEO:
```yaml
metaTitle: Get a piece
metaDescription: If you fancy a piece of work - just reach out and get it.
```
to:
```yaml
metaTitle: Acquire a Work — Maeve Vamy
metaDescription: Interested in acquiring an original painting by Maeve Vamy? Reach out directly.
```

Also update the page-level `title` field:
```yaml
title: Acquire a Work
```

**Step 4: Verify**

Visit `/get-a-piece`. The page should show the ReachOutBlock form (same as homepage). Title should read "Acquire a Work".

**Step 5: Commit**

```bash
git add apps/website/content/pages/get-a-piece.md
git commit -m "content: migrate inquiry page to ReachOutBlock, elevate copy register"
```

---

### Task 12: Root README — full replacement

**Files:**
- Modify: `README.md`

**Step 1: Replace with developer-useful README**

Replace the entire contents of `README.md` with:

```markdown
# vamy.art

Artist website for Maeve Vamy — painter. Built to sell original works, run auctions, and handle inquiries.

## What This Is

A Next.js monorepo with two deployable apps:

- **`apps/website`** — public-facing artist site (gallery, auctions, shop, contact)
- **`apps/admin`** — Maeve's private admin panel (artworks, orders, bids, inquiries)

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Router | Pages Router (website), App Router (admin) |
| API | tRPC v11 inside Next.js API routes |
| ORM | Drizzle ORM |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (admin only — no buyer accounts) |
| Realtime | Supabase Realtime on `bids` table |
| Payments | Stripe Checkout (guest only) |
| Email | Resend (transactional), Buttondown (newsletter) |
| i18n | next-intl (EN / DE / BG) |
| Deploy | Netlify (two sites from one repo) |
| Package manager | pnpm + Turborepo |

## Monorepo Structure

```
apps/
  website/          # Public site — Pages Router
  admin/            # Admin panel — App Router
packages/
  db/               # Drizzle schema + tRPC routers (shared by both apps)
  ui/               # shadcn/ui primitives (shared)
  i18n/             # next-intl message files (EN/DE/BG)
docs/
  plans/            # Architecture decisions and implementation plans
```

## Local Dev

**Prerequisites:** Node 20+, pnpm 9+, a `.env.local` at repo root.

```bash
pnpm install
pnpm dev          # runs both apps in parallel via Turborepo
```

Or run a single app:
```bash
cd apps/website && pnpm dev   # http://localhost:3000
cd apps/admin && pnpm dev     # http://localhost:3001
```

**Environment variables:** Copy `.env.local.example` to `.env.local` and fill in keys for Supabase, Stripe (test keys), Resend, and Buttondown. See each app's README for specifics.

## Key Architectural Decisions

**Artworks live in markdown, not the database.** Content is in `apps/website/content/pages/gallery/`. The artwork `slug` is the join key to any DB records (products, auctions). Do not move artwork data to the DB.

**No buyer accounts.** Checkout is guest-only. Stripe handles identity. This avoids GDPR complexity and was a deliberate product decision.

**Pages Router stays on the website.** The admin uses App Router. Do not migrate the website to App Router — the content model is tightly coupled to Pages Router conventions.

**tRPC lives inside Next.js API routes.** There is no separate backend service. `packages/db` exports routers that both apps mount.

## Deploy

Two Netlify sites, same repo:

- Website: base dir `apps/website`, publish dir `.next`
- Admin: base dir `apps/admin`, publish dir `.next`

Each app has its own `netlify.toml`. Build command: `cd ../.. && pnpm turbo build --filter=@vamy/<app>`.

## Plans & Decisions

See `docs/plans/` for architecture decisions and implementation plans covering the sales integration, auction system, admin panel, and this design overhaul.
```

**Step 2: Commit**

```bash
git add README.md
git commit -m "docs: replace boilerplate README with developer documentation"
```

---

### Task 13: Sub-READMEs for apps and packages

**Files:**
- Create: `apps/website/README.md`
- Create: `apps/admin/README.md`
- Create: `packages/db/README.md`
- Create: `packages/ui/README.md`
- Create: `packages/i18n/README.md`

**Step 1: `apps/website/README.md`**

```markdown
# @vamy/website

Public-facing artist site for Maeve Vamy. Gallery, auctions, shop, contact.

## Key facts

- **Router:** Next.js Pages Router. Do not migrate to App Router.
- **Content:** Artworks are markdown files in `content/pages/gallery/`. Page sections are YAML frontmatter — this drives the entire component tree via Contentlayer/Sourcebit.
- **Design tokens:** `content/data/style.json` controls typefaces, colors, and button styles. Changes here cascade site-wide via `tailwind.config.js`.
- **API:** tRPC client in `src/utils/trpc.ts`, mounted at `/api/trpc`. Routers come from `packages/db`.
- **i18n:** next-intl, locale switcher in the header. Message files in `packages/i18n`.

## Run

```bash
pnpm dev    # from repo root, or:
cd apps/website && pnpm dev
```

## Environment variables

Requires `.env.local` at repo root (symlinked into this directory). Key vars:
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `STRIPE_SECRET_KEY` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET`
- `RESEND_API_KEY`
```

**Step 2: `apps/admin/README.md`**

```markdown
# @vamy/admin

Private admin panel for Maeve Vamy. Artworks, orders, bids, inquiries.

## Key facts

- **Router:** App Router (Next.js 15).
- **Auth:** Supabase Auth. Artist-only — no buyer accounts exist. Protected by middleware at `middleware.ts`.
- **API:** Same tRPC routers from `packages/db` as the website.

## Run

```bash
cd apps/admin && pnpm dev    # http://localhost:3001
```

## Environment variables

Same `.env.local` as the website. Additionally:
- `SUPABASE_SERVICE_ROLE_KEY` — needed for admin-level DB operations
```

**Step 3: `packages/db/README.md`**

```markdown
# @vamy/db

Drizzle ORM schema and tRPC routers. Shared by `apps/website` and `apps/admin`.

## Schema

8 tables: `artworks`, `products`, `product_variants`, `orders`, `auctions`, `bids`, `inquiries`, `newsletter_subscribers`.

Artworks in the DB are minimal records (slug, status). The canonical artwork data is markdown in `apps/website/content/pages/gallery/`. The `slug` field is the join key.

Product variants use a JSONB `attributes` column for flexible key/value pairs (size, frame, medium, etc.).

## Migrations

```bash
pnpm drizzle-kit generate   # generate SQL from schema changes
pnpm drizzle-kit migrate    # apply to database
```

Migrations are in `src/migrations/`. Never edit applied migrations — always generate new ones.

## Adding a router

1. Create `src/routers/<name>.ts` exporting a tRPC router
2. Add it to `src/index.ts` appRouter
3. Both apps get it automatically via the shared package
```

**Step 4: `packages/ui/README.md`**

```markdown
# @vamy/ui

Shared shadcn/ui component primitives. Used by `apps/admin` primarily; the website uses its own Tailwind-based components.

## Adding a component

```bash
# From repo root:
pnpm --filter @vamy/ui dlx shadcn@latest add <component>
```

Components land in `src/components/ui/`. Export from `src/index.ts`.

## Canvas components (future)

Three.js / React Three Fiber components will live in `src/components/canvas/`. Always use `dynamic(() => import(...), { ssr: false })` when consuming them.
```

**Step 5: `packages/i18n/README.md`**

```markdown
# @vamy/i18n

next-intl message files for EN / DE / BG.

## Structure

```
messages/
  en.json
  de.json
  bg.json
```

## Adding a translation key

1. Add the key and English value to `messages/en.json`
2. Add the translated value to `messages/de.json` and `messages/bg.json`
3. Use via `useTranslations()` hook in any component

Missing keys fall back to the key string — they don't throw, but they look bad in production. Always add all three languages.
```

**Step 6: Commit all sub-READMEs**

```bash
git add apps/website/README.md apps/admin/README.md packages/db/README.md packages/ui/README.md packages/i18n/README.md
git commit -m "docs: add sub-READMEs for all apps and packages"
```

---

## Summary

| Task | Scope | Files |
|---|---|---|
| 1 | Typeface — Cormorant Garamond | `main.css`, `tailwind.config.js`, `style.json` |
| 2 | Color — true near-black | `style.json` |
| 3 | Buttons — no radius, no bounce | `style.json`, `main.css` |
| 4 | Header — remove shadow | `Header/index.tsx` |
| 5 | LocaleSwitcher — text toggle | `Header/index.tsx` |
| 6 | ProductSelector — no radius | `ProductSelector/index.tsx` |
| 7 | BidWidget + BidModal — no radius | `BidWidget/index.tsx`, `BidModal.tsx` |
| 8 | Footer newsletter form | `Footer/index.tsx` |
| 9 | Homepage content | `content/pages/index.md` |
| 10 | Gallery feed metadata | `content/pages/gallery/index.md` |
| 11 | Inquiry page migration | `content/pages/get-a-piece.md` |
| 12 | Root README | `README.md` |
| 13 | Sub-READMEs | 5 new files |

All tasks are independent and can be executed in any order. Tasks 1–3 have the highest visual impact.
