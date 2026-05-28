# Buttondown — One-Time Account Setup

This is what Maeve does in the Buttondown dashboard to make the newsletter
trustworthy, on-brand, and GDPR-clean. Do this once; the code side is wired.

## 1. Sender identity
- **Settings → Sending → From name:** `Maeve · vamy`
- **From email:** `maeve@vamy.art`
- **Reply-to:** `maeve@vamy.art`

## 2. Domain authentication (DNS)
Buttondown sends from its own infrastructure, not Resend. You need separate DKIM/SPF records on `vamy.art`.

- Go to **Settings → Sending → Custom domain** in Buttondown.
- Copy the DKIM CNAME records they show.
- In your DNS provider (where vamy.art is registered), add those CNAME records exactly as shown.
- Wait 10–30 minutes, then click "Verify" in Buttondown.
- Add the SPF `include:` they specify to your existing SPF record (don't replace it — Resend's is also there).

## 3. Enable double opt-in
- **Settings → Subscribers → Require confirmation:** ON.
- This is non-negotiable for EU subscribers.

## 4. Confirmation email
- **Settings → Email templates → Confirmation email**
- Subject: `Confirm you'd like to hear from vamy`
- Body (short, signed by you). Buttondown auto-inserts the confirmation link.

## 5. Welcome email
- **Automations → Welcome email:** ON.
- Send: immediately after confirmation.
- Write a warm 3–4 sentence hello: who you are, what subscribers will get (new work + studio notes, ~1–2/month), gratitude.

## 6. Branding
- **Settings → Branding**
- Upload the vamy logo (square favicon SVG works).
- Primary color: match site (black or your accent).
- Link color: same.

## 7. Tags reference (set up by the code, FYI)
Subscribers arrive with one of these tags so you can segment broadcasts:

- `footer` — signed up from the website footer
- `inquiry` — opted in on the "Get a piece" inquiry form
- `bid` — opted in when placing a bid
- `checkout` — opted in on the Stripe checkout page after a purchase

To send a drop alert to buyers only: **New email → Filter → Tag is `checkout`**.

## 8. Smoke checks after the code deploys
- [ ] Submit your own email via the footer → confirm you get the confirmation email → click it → confirm you get the welcome email.
- [ ] Make a test inquiry with the checkbox ticked → confirmation arrives.
- [ ] Place a Stripe **test** checkout (sandbox keys) and tick the marketing-consent box → confirmation arrives.
- [ ] In Buttondown, all three subscribers should appear with the correct tag.

## 9. Plan check
- Check your current Buttondown plan covers expected list size.
- The free tier caps at 100 subscribers — upgrade before you cross it.
