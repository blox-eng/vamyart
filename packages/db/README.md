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
