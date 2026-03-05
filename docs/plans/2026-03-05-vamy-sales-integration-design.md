# vamy.art Sales & Bidding Integration — Design

**Date:** 2026-03-05
**Status:** Approved
**Covers:** Monorepo restructure, product catalog, bidding system, checkout, admin panel, i18n, Netlify deploy

---

## Goals

- Collectors can discover and bid on original artworks directly on the site
- Collectors can self-serve purchase prints and merchandise (Stripe Checkout)
- Artist manages auctions, orders, and inquiries via a protected admin panel
- No buyer accounts — zero GDPR complexity beyond shipping data for fulfillment
- Good SEO, fast, globally available via CDN
- No HubSpot. No Google Analytics. No Mailchimp. No Airtable.

---

## Key Decisions

| Concern | Decision | Rejected alternatives |
|--|--|--|
| Architecture | Turborepo monorepo, two Next.js apps | Separate repos |
| Backend | tRPC + Drizzle ORM (inside Next.js API routes) | Go microservice, Hasura, Hono |
| Database | Supabase (PostgreSQL + Auth + Realtime) | Neon, self-hosted Postgres |
| Realtime bids | Supabase Realtime | SSE, polling, GraphQL subscriptions |
| Admin auth | Supabase Auth (email + password) | Gate, env-var password |
| Buyer auth | None — guest checkout only | Supabase Auth for buyers |
| Product catalog | JSONB attributes on variants (Medusa pattern) | One table per product type |
| Bidding tools | Build (350 lines, own it) | BidJS, Bidlogix, Bidpath ($100–500/mo) |
| Express checkout | Stripe Link + Apple Pay + Google Pay (free, built-in) | Shop Pay (Shopify-only) |
| Email | Resend (transactional) + Buttondown (newsletter) | Mailchimp, SendGrid |
| Analytics | Plausible (self-hosted Hetzner) | Google Analytics |
| i18n | next-intl, URL-based locale routing | next-i18next |
| Artwork content | Markdown/frontmatter (static, git-deployed) | Database-driven CMS |
| Fulfillment | Custom (artist ships physically, inventory in DB) | Prodigi |

---

## Repository Structure

```
vamy/                             ← monorepo root (renamed from vamy.art)
├── apps/
│   ├── website/                  ← existing Next.js site (moved here)
│   │   ├── src/
│   │   ├── content/              ← markdown artwork pages stay here
│   │   ├── public/
│   │   └── netlify.toml
│   └── admin/                    ← new Next.js app (admin.vamy.art)
│       ├── src/
│       └── netlify.toml
├── packages/
│   ├── ui/                       ← shared shadcn/ui components
│   ├── db/                       ← Drizzle schema + queries (single source of truth)
│   └── i18n/                     ← message files (en/de/bg) + next-intl config
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Stack

### Both apps
- **React 19 + Next.js 15** (App Router)
- **Tailwind CSS + shadcn/ui** (via `packages/ui`)
- **tRPC v11** — route → service layer (type-safe procedures)
- **Drizzle ORM** — storage layer (schema-first, type-safe queries, migrations)
- **Supabase** — PostgreSQL, Auth, Realtime

### Website only
- **next-intl** — i18n, URL-based locale routing
- **Supabase Realtime client** — live bid widget updates

### Admin only
- **Supabase Auth** — artist login session
- **Supabase service role key** — full DB write access

### External services
- **Resend** — transactional email (bid alerts, inquiry confirmations, order receipts)
- **Buttondown** — newsletter list
- **Stripe Checkout** — print/merch payments, address collection, Stripe Link/Apple Pay/Google Pay
- **Plausible** — analytics (self-hosted)

---

## Layer Architecture

```
apps/website/app/api/trpc/[trpc]/route.ts    ← route layer (tRPC adapter)
packages/db/src/trpc/routers/bids.ts         ← service layer (procedures)
packages/db/src/queries/bids.ts              ← storage layer (Drizzle queries)
packages/db/src/schema.ts                    ← schema (single source of truth)
```

---

## Data Model

### `artworks`
Specification of each original artwork. Slug ties to the markdown page in `apps/website/content/`.

```sql
id            uuid pk
slug          text unique       -- joins to markdown frontmatter
title         text
year          int
medium        text              -- "Oil on canvas"
dimensions    text              -- "80 × 60 cm"
status        text              -- available | bidding | sold
created_at / updated_at
```

### `products`
A saleable item attached to an artwork (or standalone for merch).

```sql
id            uuid pk
artwork_id    uuid → artworks.id  (nullable)
product_type  text                -- print | tote | sticker | ...
name          text                -- "Fine Art Prints", "Canvas Tote"
description   text
active        bool default true
created_at / updated_at
```

### `product_variants`
Each purchasable SKU. Flexible JSONB attributes handle any product type without schema changes.

```sql
id              uuid pk
product_id      uuid → products.id
name            text              -- "A3 · Hahnemühle", "Black · M"
price           numeric(10,2)
stock_quantity  int default 0
available       bool default true
attributes      jsonb
-- print:   { "size": "A3", "paper": "Hahnemühle Photo Rag" }
-- tote:    { "colour": "Black", "material": "Canvas" }
-- sticker: { "pack_size": 10, "finish": "Matte" }
created_at / updated_at
```

### `orders`
Created on `checkout.session.completed` Stripe webhook. Single table covers all product types.

```sql
id                  uuid pk
product_variant_id  uuid → product_variants.id
buyer_name          text
buyer_email         text
shipping_address    jsonb         -- captured by Stripe Checkout
amount_paid         numeric(10,2)
stripe_session_id   text unique
status              text          -- pending | paid | shipped | cancelled
tracking_number     text
shipped_at          timestamptz
notes               text
created_at / updated_at
```

### `auctions`
Runtime state for bidding on an original artwork. Managed by artist via admin panel.

```sql
id              uuid pk
artwork_id      uuid → artworks.id  unique
min_bid         numeric(10,2)
min_increment   numeric(10,2) default 100
current_bid     numeric(10,2)     -- null until first bid
bid_count       int default 0
deadline        timestamptz
status          text default 'active'  -- active | closed | cancelled
winner_bid_id   uuid → bids.id
created_at / updated_at
```

### `bids`
Immutable. Append-only. One row per bid placed.

```sql
id            uuid pk
auction_id    uuid → auctions.id
bidder_name   text
bidder_email  text
amount        numeric(10,2)
ip_address    inet              -- basic spam prevention
created_at    timestamptz
```

### `inquiries`

```sql
id              uuid pk
name / email / piece_interest / message  text
created_at      timestamptz
handled_at      timestamptz   -- null = unhandled
```

### `newsletter_subscribers`

```sql
id            uuid pk
email         text unique
subscribed_at timestamptz
```

---

## Bidding Flow

```
1. Artist opens auction via /admin/auctions:
   POST /trpc/auctions.open { artwork_id, min_bid, min_increment, deadline }
   → creates auctions row, artwork status → bidding

2. Artwork page loads:
   GET /trpc/auctions.getByArtworkSlug(slug)
   → active auction found → BidWidget renders with current_bid + countdown

3. Supabase Realtime:
   website subscribes to bids table filtered by auction_id
   → every new bid broadcasts instantly → current_bid updates live

4. Bidder places bid:
   POST /trpc/bids.place { auction_id, name, email, amount }
   → validate: auction active, deadline not passed,
               amount ≥ current_bid + min_increment (or ≥ min_bid if first bid)
   → Postgres transaction:
        INSERT bids row
        UPDATE auctions SET current_bid = amount, bid_count++
   → Resend: "outbid" email to previous highest bidder
   → Resend: "new bid" notification to artist

5. Deadline passes → artist reviews bids in /admin/auctions
   → selects winner → sends Stripe Payment Link manually to winner
   → marks auction closed, artwork status → sold
```

---

## Print / Merch Checkout Flow

```
1. Artwork page shows available product variants (size/paper combos)
   → stock_quantity > 0 AND available = true → "In Stock"
   → otherwise → "Out of Stock"

2. Buyer selects variant → "Buy" button
   POST /trpc/checkout.create { variant_id }
   → validate stock > 0
   → create Stripe Checkout session
        (price, product name, shipping address collection, Stripe Link enabled)
   → redirect to Stripe hosted page

3. Buyer pays via card / Apple Pay / Google Pay / Stripe Link
   Stripe collects shipping address

4. Stripe webhook → checkout.session.completed
   → Postgres transaction:
        INSERT orders row (with shipping_address from Stripe session)
        UPDATE product_variants SET stock_quantity = stock_quantity - 1
   → Resend: order confirmation to buyer
   → Resend: new order notification to artist

5. Artist fulfills physically
   /admin/orders → mark shipped → add tracking number
   → Resend: shipping confirmation + tracking to buyer
```

---

## Admin Panel (`admin.vamy.art`)

Single Supabase Auth session for the artist. Four views:

### `/admin/auctions`
- List of artworks with active/past auctions (current bid, time remaining, bid count)
- "Open Auction" form: select artwork, set min_bid, min_increment, deadline
- Per auction: view full bid history, close early, identify winner

### `/admin/orders`
- Fulfillment queue: variant name, buyer name, shipping address, amount, status badge
- Mark shipped + add tracking number → triggers shipping email to buyer
- Inline row expand — no separate detail page needed (YAGNI)

### `/admin/artworks`
- List artworks with status badges
- Per artwork: edit specs (medium, dimensions, year, status)
- Manage products attached to artwork (add product type, name)
- Per product: manage variants (size/paper/colour, price, stock, available toggle)
- Add arbitrary JSONB attribute key-value pairs per variant freely

### `/admin/inquiries`
- Table: name, email, piece interest, message, date
- Mark handled
- Email link opens mail client pre-addressed (no in-app reply needed)

---

## i18n (Website Only)

**Library:** next-intl with URL-based locale routing.

```
vamy.art/en/...   English (default)
vamy.art/de/...   German
vamy.art/bg/...   Bulgarian
```

Message files in `packages/i18n/messages/`:
```
en.json
de.json
bg.json
```

Adding a language = one new JSON file + add locale to next-intl config. No code changes.

Header includes locale switcher. Browser locale detected on first visit.

Admin is English only — artist is the only user.

---

## Netlify Deploy

Two separate Netlify sites, same GitHub repo.

**Website site (`vamy.art`):**
```toml
# apps/website/netlify.toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/website"
  publish = ".next"
```
- Base directory in Netlify UI: `apps/website`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`, `STRIPE_PUBLIC_KEY`, `RESEND_API_KEY`, `BUTTONDOWN_API_KEY`

**Admin site (`admin.vamy.art`):**
```toml
# apps/admin/netlify.toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/admin"
  publish = ".next"
```
- Base directory in Netlify UI: `apps/admin`
- Env vars: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`

Auto-deploy on push to `main`. Turborepo caching skips unchanged packages.

---

## What Is Explicitly Out of Scope

- Buyer accounts (no auth, no PII beyond shipping address)
- Gallery CRM / collector profiles (Stripe is source of truth for paying customers)
- Revenue dashboards (use Stripe dashboard)
- Artwork image upload via admin (images stay in code/markdown)
- Prodigi or print-on-demand fulfillment (artist ships physical inventory)
- Print-on-demand (artist holds inventory, ships manually)
- HubSpot, Google Analytics, Mailchimp, Airtable
