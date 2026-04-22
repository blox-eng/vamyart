# Stripe live cutover runbook

## Preconditions
- Stripe account is activated (business details, bank account verified, ID verified).
- Test/sandbox flow on deploy preview works end-to-end.
- vamy.art domain is verified in Stripe Dashboard → Settings → Payment methods → Apple Pay / domains.

## Step-by-step

1. In Stripe Dashboard, toggle **Viewing: Live mode** (top-left).
2. **Create live webhook endpoint:**
   - Developers → Webhooks → Add endpoint
   - URL: `https://vamy.art/api/webhooks/stripe`
   - Events: `checkout.session.completed`, `payment_intent.payment_failed`
   - Copy the signing secret (`whsec_…`).
3. **Copy live API keys:**
   - Developers → API keys
   - Copy Secret key (`sk_live_…`) and Publishable key (`pk_live_…`).
4. **Update Netlify env vars** on the vamy-website site (Site settings → Environment variables):
   - `STRIPE_SECRET_KEY` → paste `sk_live_…`
   - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → paste `pk_live_…`
   - `STRIPE_WEBHOOK_SECRET` → paste `whsec_…` from step 2
   - Scope: Production only (keep test keys on deploy previews).
5. **Trigger a Netlify redeploy** (Deploys → Trigger deploy → Clear cache and deploy site) so the new env vars take effect.
6. **Smoke test with a real low-value transaction** (≤€5 if possible, or buy something small yourself):
   - Complete checkout on production.
   - Confirm receipt email arrives from Resend with correct lead time.
   - Confirm artist notification email arrives.
   - Confirm the order row lands in Supabase `orders` with `payment_status = paid`.
   - Confirm the live webhook delivery in Stripe Dashboard shows `200 OK`.
7. **Refund the test purchase** if applicable (Stripe → Payments → … → Refund).

## Rollback
- Revert the three Netlify env vars to the test values (keep test keys in a password manager).
- Redeploy.

## Keys hygiene
- Never commit live keys to git. They belong in Netlify env and 1Password only.
- If a live secret leaks: rotate immediately (Stripe Dashboard → API keys → Roll key), then update Netlify + webhook endpoint signing secret.
