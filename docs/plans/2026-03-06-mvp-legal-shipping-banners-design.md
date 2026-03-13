# MVP Legal Compliance, Shipping Methods & Announcement Banners — Design

**Goal:** Make vamy.art legally ready to sell artwork in the EU, add admin-configurable shipping methods, and support announcement banners managed from the admin panel.

**Architecture:** Three parallel concerns — legal pages (content + structure), a new `shipping_methods` DB table with admin CRUD, and a new `banners` DB table with a website-side display component. All wired through existing tRPC + Drizzle stack.

**Tech Stack:** Next.js (Pages Router, website) + Next.js App Router (admin), Drizzle ORM, tRPC v11, Tailwind CSS, existing `packages/db` and `packages/ui`.

---

## 1. Shipping Methods

### Data Model

New table `shipping_methods`:

| field | type | notes |
|---|---|---|
| `id` | uuid PK | default gen_random_uuid() |
| `name` | text NOT NULL | admin label, e.g. "Free", "Custom", "Express DHL" |
| `displayText` | text NOT NULL | buyer-facing, e.g. "Free shipping", "Shipping arranged by artist" |
| `type` | enum `free\|paid\|custom` | drives checkout behaviour |
| `cost` | numeric(10,2) nullable | only populated when type = `paid` |
| `isDefault` | boolean NOT NULL default false | exactly one row should be default |
| `createdAt` | timestamp NOT NULL default now() |
| `updatedAt` | timestamp NOT NULL default now() |

`products` table gains a nullable FK: `shippingMethodId uuid REFERENCES shipping_methods(id)`.

### Seeded Defaults

On migration, insert two rows:
- `{ name: "Free", displayText: "Free shipping", type: "free", isDefault: false }` — assigned to print-type products
- `{ name: "Custom", displayText: "Shipping arranged by artist", type: "custom", isDefault: true }` — assigned to original-type products; global default for any new product

### Checkout Behaviour

| type | Stripe line item | Buyer sees |
|---|---|---|
| `free` | none | "Free shipping" |
| `custom` | none | "Shipping arranged by artist" |
| `paid` | shipping cost added as line item | "€X shipping" |

### tRPC Routers

`packages/db/src/trpc/routers/shippingMethods.ts`:
- `list: protectedProcedure` — all methods
- `create: protectedProcedure` — create new method
- `update: protectedProcedure` — edit name, displayText, type, cost, isDefault
- `delete: protectedProcedure` — delete (guard: cannot delete if products reference it, and cannot delete the default)

`products` router gains `updateShippingMethod: protectedProcedure` — assign a shippingMethodId to a product.

Public-facing: `products.listByArtworkSlug` already exists and will include the resolved shipping method via Drizzle relation.

### Admin UI

New "Shipping" page in admin (`/shipping`):
- Table of all shipping methods with inline edit (name, displayText, type, cost)
- Toggle to set as default (radio-style, only one default)
- Delete button with two-click confirm (disabled if method is in use or is default)
- "Add method" form at bottom

Product edit form (artworks page) gains a "Shipping method" dropdown — shows all methods, defaults to the current product's assigned method or the global default.

### Website UI

On artwork/product pages, below the price:
- Resolve shipping method: product's assigned method ?? global default
- Render a small line: e.g. "Free shipping" or "Shipping arranged by artist — we'll be in touch"
- `free`: green text. `custom`: muted text. `paid`: show cost.

Stripe `createSession` in checkout router:
- If method type is `paid`: add a `shipping_options` line item with the cost
- If `free` or `custom`: no change to current behaviour

---

## 2. Legal Compliance Pages

### Privacy Policy Page

New file `apps/website/content/pages/privacy.md` with `type: PageLayout`, slug `privacy`. Content placeholder — Maeve fills in or commissions legal text. Must include per GDPR Art. 13:
- Data controller: Мейв Вами ЕООД, EIK 208627302, Stara Zagora, Bulgaria
- Data collected: name, email, shipping address (via Stripe); IP address (bids)
- Processors: Stripe (payment), Resend (email), Supabase (database hosting)
- Retention periods
- User rights (access, rectification, erasure, portability)
- Contact: maeve@vamy.art

### Legal Notice in Footer

Add company details block to `content/data/footer.json` under a new `legalNotice` field (or as a `copyrightText` extension). Rendered in the Footer component below copyright.

Content:
```
Мейв Вами ЕООД · EIK 208627302 · Stara Zagora, Bulgaria · maeve@vamy.art
```

### Terms Corrections

Edit `content/pages/terms.md`:
1. Remove "PayPal and bank transfers" from payment methods — replace with "Credit/debit card via Stripe"
2. Remove "prices include VAT where applicable" — replace with "Prices are in EUR. Мейв Вами ЕООД is not VAT registered; no VAT is charged."
3. Add company details to Contact section: Мейв Вами ЕООД · EIK 208627302

### Footer Links

Ensure `content/data/footer.json` legalLinks array includes links to `/terms` and `/privacy`. Add these if not already present.

### Copyright Auto-Increment

In `apps/website/src/components/sections/Footer/index.tsx`, replace the hardcoded year in `copyrightText` at render time:

```tsx
{copyrightText.replace(/\d{4}/, String(new Date().getFullYear()))}
```

No content changes needed.

---

## 3. Announcement Banners

### Data Model

New table `banners`:

| field | type | notes |
|---|---|---|
| `id` | uuid PK | |
| `text` | text NOT NULL | the message shown to visitors |
| `isActive` | boolean NOT NULL default false | on/off toggle |
| `scope` | enum `global\|page` NOT NULL | global = all pages, page = one slug |
| `pageSlug` | text nullable | only used when scope = `page` |
| `createdAt` | timestamp NOT NULL default now() |
| `updatedAt` | timestamp NOT NULL default now() |

### Display Logic

On each website page, fetch active banners. Priority: page-scoped banner for the current slug takes precedence over a global banner. Only one banner shown at a time (the most specific active one).

Fetch is server-side (SSR via `getServerSideProps` or `getStaticProps` with revalidation) to avoid layout shift.

### tRPC Routers

`packages/db/src/trpc/routers/banners.ts`:
- `getActive: publicProcedure` — input: `{ slug: string }`, returns the highest-priority active banner for that page (page-scoped first, then global, then null)
- `list: protectedProcedure` — all banners for admin
- `create: protectedProcedure`
- `update: protectedProcedure` — text, isActive, scope, pageSlug
- `delete: protectedProcedure`

### Website Component

New `AnnouncementBanner` component (`apps/website/src/components/AnnouncementBanner.tsx`):
- Slim bar, sits between the site header and page content
- Text only, no close button for MVP
- Hidden if no active banner returned

Wired into `apps/website/src/pages/_app.tsx` (or the layout wrapper), passing current route slug.

### Admin UI

New "Banners" page in admin (`/banners`):
- Table of all banners: text preview, scope badge, active toggle, edit, delete
- Create form: text input, scope selector (global / page), conditional page slug input
- Two-click delete confirm

---

## What's Not Included

- Cookie consent banner (Stripe is 3rd party domain; Plausible is cookie-free — not needed for MVP)
- Dismissible banners with localStorage state
- Scheduled banners (start/end date)
- Multi-page scoping (one slug per banner is sufficient)
- Withdrawal form template (covered by existing terms text)
- Shipping carrier integration (Maeve selects carrier manually per order)
