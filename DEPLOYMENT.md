# Deployment Guide

Everything needed to take vamy.art from a working dev environment to production. No secrets are stored here — values go in Netlify environment variable settings only.

---

## 1. Supabase

### 1.1 Run migrations

```bash
cd packages/db
DATABASE_URL=<your-production-db-url> pnpm migrate
```

All tables, enums, RLS policies, and indexes are created by the migration sequence in `packages/db/migrations/`.

### 1.2 Seed data

After migrations, create default shipping methods and banners via the admin panel. Or run the seed script:

```bash
cd packages/db
DATABASE_URL=<your-production-db-url> pnpm seed
```

### 1.3 Verify Row Level Security

In Supabase dashboard → Database → Tables, confirm the RLS shield icon is active on every table:

`artworks`, `products`, `product_variants`, `orders`, `auctions`, `bids`, `inquiries`, `newsletter_subscribers`, `shipping_methods`, `banners`

The anon key has read-only access. All writes go through the service role key (server-side tRPC only).

### 1.4 Enable Realtime on `bids`

Required for the live BidWidget. Without it, the widget falls back to 30-second polling.

Supabase dashboard → Database → Replication → enable `bids` table.

### 1.5 Create admin user

Supabase dashboard → Authentication → Users → Invite user → use the artist's email address.

---

## 2. Stripe

### 2.1 Register the webhook

Stripe dashboard → Developers → Webhooks → Add endpoint:

- URL: `https://vamy.art/api/webhooks/stripe`
- Events: `checkout.session.completed`
- Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` on the website Netlify site

### 2.2 Apple Pay domain verification

Stripe dashboard → Settings → Payment methods → Apple Pay → Add domain `vamy.art`.

Download the domain association file and place it at:
`apps/website/public/.well-known/apple-developer-merchantid-domain-association`

(Create the `.well-known/` directory under `public/` if it doesn't exist.)

### 2.3 Go live

Switch from test keys to live keys when ready to take real payments:

- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
- `STRIPE_SECRET_KEY` → `sk_live_...`
- Register a new webhook in live mode and update `STRIPE_WEBHOOK_SECRET`

---

## 3. Resend

### 3.1 Verify sending domain

Resend dashboard → Domains → Add domain → `vamy.art` → add the DNS records shown (SPF, DKIM, DMARC). Verification usually completes within 10 minutes.

Set `RESEND_FROM_EMAIL` to a verified address on this domain (e.g. `maeve@vamy.art`).

---

## 4. Buttondown

Buttondown dashboard → Settings → API → generate an API key → set as `BUTTONDOWN_API_KEY`.

Newsletter subscribers collected via the website are synced to Buttondown automatically on signup.

---

## 5. Netlify

### 5.1 Create two sites

Both sites connect to the same GitHub repo (`blox-eng/vamyart`), different base directories:

| Site | Base directory | Publish directory |
|---|---|---|
| Website (`vamy.art`) | `apps/website` | `.next` |
| Admin (private URL) | `apps/admin` | `.next` |

Build commands are defined in each app's `netlify.toml` — no manual entry needed.

### 5.2 Environment variables — Website site

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
RESEND_FROM_EMAIL
RESEND_ARTIST_EMAIL
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
NEXT_PUBLIC_SITE_URL=https://vamy.art
REVALIDATION_SECRET=<generate: openssl rand -hex 32>
```

### 5.3 Environment variables — Admin site

```
DATABASE_URL
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_WEBSITE_URL=https://vamy.art
REVALIDATION_SECRET=<same value as website site>
```

> `REVALIDATION_SECRET` must be identical on both sites. The admin calls the website's `/api/revalidate` endpoint using this shared secret to trigger ISR after content changes.

### 5.4 Domain

Netlify → website site → Domain management → Add custom domain → `vamy.art`. Netlify provisions TLS automatically.

---

## 6. Go-live checklist

- [ ] Migrations applied to production database
- [ ] RLS active on all 10 tables (verified in Supabase dashboard)
- [ ] Supabase Realtime enabled on `bids` table
- [ ] Admin user created in Supabase Auth
- [ ] Stripe webhook registered (`checkout.session.completed`) and signing secret set
- [ ] Apple Pay domain verified in Stripe (optional but recommended)
- [ ] Resend domain verified and DNS propagated
- [ ] All env vars set on both Netlify sites
- [ ] Website Netlify site base directory set to `apps/website`
- [ ] Admin Netlify site base directory set to `apps/admin`
- [ ] Custom domain added to website site, TLS provisioned
- [ ] Smoke test: submit an inquiry form
- [ ] Smoke test: newsletter signup
- [ ] Smoke test: place a test order end-to-end in Stripe test mode
- [ ] Switch Stripe to live mode (update keys + re-register webhook in live mode)
