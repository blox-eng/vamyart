# @vamy/website

Public-facing artist site for Maeve Vamy. Gallery, auctions, shop, contact.

## Key facts

- **Router:** Next.js Pages Router. Do not migrate to App Router.
- **Content:** Artworks are markdown files in `content/pages/gallery/`. Page sections are YAML frontmatter — this drives the entire component tree via Contentlayer/Sourcebit.
- **Design tokens:** `content/data/style.json` controls typefaces, colors, and button styles. Changes here cascade site-wide via `tailwind.config.js`.
- **API:** tRPC client in `src/lib/trpc.ts`, mounted at `/api/trpc`. Routers come from `packages/db`.
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
