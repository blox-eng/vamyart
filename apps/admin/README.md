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
- `OPENROUTER_API_KEY` — server-only; the Critique page's vision-model call
- `CRITIQUE_MODEL` — optional OpenRouter model id (default `google/gemini-3.8-flash`)
- `CRITIQUE_FN_SECRET` — shared secret between the tRPC server and the `critique-run-background` Netlify function. Unset locally: the run then happens in the dev server process.
