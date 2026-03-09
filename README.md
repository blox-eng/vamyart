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

**Environment variables:** Create `.env.local` at repo root and fill in the following keys (get values from the team):

```
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_ARTIST_EMAIL=
BUTTONDOWN_API_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=
```

See each app's README for which variables each app requires.

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
