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
