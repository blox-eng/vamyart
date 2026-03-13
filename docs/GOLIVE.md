# Go-Live Guide

Blue/green deployment strategy: new Netlify sites on staging URLs → smoke test → domain swap. The old site stays live until the new one is proven.

---

## Phase 1: Code

- [ ] Push feature branch and merge to `main`

```bash
git push
# open PR or merge directly to main
```

---

## Phase 2: Supabase production

- [ ] Run migrations against production DB

```bash
cd packages/db
DATABASE_URL=<production-url> pnpm migrate
```

- [ ] Run seed for shipping methods and banner defaults

```bash
DATABASE_URL=<production-url> pnpm seed
```

- [ ] Verify RLS: Supabase dashboard → Database → Tables → confirm shield icon active on all 10 tables:
  `artworks`, `products`, `product_variants`, `orders`, `auctions`, `bids`, `inquiries`, `newsletter_subscribers`, `shipping_methods`, `banners`

- [ ] Enable Realtime on `bids`: Supabase dashboard → Database → Replication → enable `bids`

- [ ] Create admin user: Supabase dashboard → Authentication → Users → Invite user (Maeve's email)

---

## Phase 3: Netlify — new sites (staging URLs first)

Create two **new** Netlify sites from the same repo. Do not touch the existing live site yet.

| Site | Base directory | Publish directory | Branch |
|---|---|---|---|
| Website | `apps/website` | `.next` | `main` |
| Admin | `apps/admin` | `.next` | `main` |

### Website site env vars

```
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=
RESEND_ARTIST_EMAIL=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=          # set after step 4 below
NEXT_PUBLIC_SITE_URL=https://<website>.netlify.app   # update to vamy.art after domain swap
REVALIDATION_SECRET=            # openssl rand -hex 32
```

### Admin site env vars

```
DATABASE_URL=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_WEBSITE_URL=https://<website>.netlify.app  # update to vamy.art after domain swap
REVALIDATION_SECRET=            # same value as website site
```

- [ ] Both sites build and deploy successfully on the `.netlify.app` staging URLs

---

## Phase 4: External services (on staging URLs)

- [ ] **Stripe webhook**: register `https://<website>.netlify.app/api/webhooks/stripe`
  - Events: `checkout.session.completed`
  - Copy signing secret → set as `STRIPE_WEBHOOK_SECRET` on website Netlify site, redeploy

- [ ] **Resend domain**: Resend dashboard → Domains → Add `vamy.art` → add DNS records (SPF, DKIM, DMARC)
  - Can do this now — DNS verification is independent of which Netlify site is live

- [ ] **Smoke test on staging URL**:
  - [ ] Admin login works
  - [ ] Inquiry form submits and artist gets email
  - [ ] Newsletter signup saves and syncs to Buttondown
  - [ ] Stripe test checkout completes and order appears in admin
  - [ ] Bid widget loads and accepts a bid
  - [ ] ISR revalidation: save a product in admin, confirm website page updates

---

## Phase 5: Domain cutover

This is the only step with any downtime (< 5 minutes, just a DNS propagation gap).

- [ ] Netlify → **old site** → Domain management → remove `vamy.art` custom domain
- [ ] Netlify → **new website site** → Domain management → add `vamy.art`
- [ ] TLS auto-provisions (~ 2 minutes)
- [ ] Update `NEXT_PUBLIC_SITE_URL` on website site → `https://vamy.art`, redeploy
- [ ] Update `NEXT_PUBLIC_WEBSITE_URL` on admin site → `https://vamy.art`, redeploy
- [ ] **Stripe**: update webhook URL → `https://vamy.art/api/webhooks/stripe`
  - New signing secret → update `STRIPE_WEBHOOK_SECRET` on website site, redeploy

---

## Phase 6: Post-cutover

- [ ] Final smoke test on `vamy.art` (order, inquiry, newsletter, admin)
- [ ] Decommission old Netlify site
- [ ] Switch Stripe to live keys when ready to take real payments:
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
  - `STRIPE_SECRET_KEY` → `sk_live_...`
  - Register new webhook in Stripe live mode → update `STRIPE_WEBHOOK_SECRET`
- [ ] (Optional) Apple Pay: Stripe dashboard → Settings → Payment methods → Apple Pay → verify `vamy.art`
  - Download domain association file → place at `apps/website/public/.well-known/apple-developer-merchantid-domain-association`

---

## Key notes

- `REVALIDATION_SECRET` must be **identical** on both Netlify sites — admin calls website's `/api/revalidate` with this secret
- Stripe test mode is fine for launch; switch to live keys as a separate step when Maeve is ready to take real orders
- See `DEPLOYMENT.md` for full service-by-service reference
