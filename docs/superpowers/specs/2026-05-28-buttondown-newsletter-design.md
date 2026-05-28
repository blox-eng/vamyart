# Buttondown Newsletter — Setup & Integration Design

**Date:** 2026-05-28
**Status:** Approved (awaiting plan)
**Scope:** Account-side configuration + code integration to make the newsletter actually serve Vamy's vision (drop alerts, behind-the-scenes, collector nurture).

---

## Goal

Turn the existing Buttondown signup from "a form that sends emails to a list" into a properly configured, segmented, consent-clean newsletter system that supports three uses:

1. **Drop alerts** — broadcasts to all subscribers when new work is released.
2. **Behind-the-scenes** — periodic studio updates, low frequency, relational.
3. **Collector nurture** — segmentable audience (browsers vs. inquirers vs. bidders vs. buyers) so Maeve can tailor outreach over time.

Manual broadcasts only in this iteration. Automated drop drafts (admin-triggered) are out of scope and deferred.

## Current state

- `packages/db/src/trpc/routers/newsletter.ts` accepts `{ email }`, writes to `newsletter_subscribers`, upserts the CRM contact, POSTs to `https://api.buttondown.email/v1/subscribers`.
- Only the website footer (`apps/website/src/components/sections/Footer/index.tsx` → `NewsletterSignup`) calls this mutation.
- `BUTTONDOWN_API_KEY` is set in `.env.local`.
- No tags, no metadata, no source tracking, no opt-in surfaces beyond the footer.
- Buttondown account-side config (sender identity, double opt-in, welcome email, DKIM/SPF) has not been verified.
- Bidders, inquirers, and buyers land in the local CRM but never in Buttondown — a gap for nurture.

## Approach (B + double opt-in)

Smallest scope that moves toward all three goals:

- Configure the Buttondown account properly (one-time, dashboard).
- Enhance `newsletter.subscribe` to carry source tags and metadata.
- Surface an explicit, unchecked-by-default opt-in checkbox on the inquiry form and bid modal, plus a one-click "subscribe to updates" CTA on the order-confirmation page.
- Double opt-in turned on at the account level — Buttondown sends a confirmation email automatically; subscribers only become active after they click.

Backfill of historical contacts is explicitly excluded — those people never consented to marketing email.

---

## Section 1 — Buttondown account configuration

One-time setup Maeve performs in the Buttondown dashboard. Not code, but part of "set up properly."

- **Sender identity:** `Maeve · vamy` <`maeve@vamy.art`>.
- **Double opt-in:** enable "require subscribers to confirm" in settings.
- **Confirmation email:** short, on-brand copy ("Confirm you'd like to hear from vamy"). Plain text, signed by Maeve.
- **Welcome email:** one-time automation, fires after confirmation. Warm hello, what to expect (1–2 emails a month, drops + studio notes), unsubscribe footer.
- **DNS:** add Buttondown's DKIM and SPF records on `vamy.art`. Resend is already verified for transactional mail; Buttondown needs its own records. Document required records in the implementation plan.
- **Branding:** upload logo, set primary brand color, set link color.
- **Plan / limits check:** confirm the current Buttondown plan covers expected subscriber count and send volume.

The implementation plan will produce a Maeve-facing checklist with screenshots/links so she can knock this out independently.

## Section 2 — Enhance `newsletter.subscribe`

File: `packages/db/src/trpc/routers/newsletter.ts`.

**Input schema extension:**

```ts
z.object({
  email: z.string().email(),
  source: z.enum(["footer", "inquiry", "checkout", "bid"]).default("footer"),
  locale: z.string().optional(),
})
```

**Behavior changes:**

- Send `tags: [source]` and `metadata: { source, locale }` in the Buttondown POST.
- Detect Buttondown's duplicate-email response (HTTP 400 with `code: "email_already_exists"`): treat as success, return `{ success: true, alreadySubscribed: true }`. Do not log as an error.
- Other Buttondown failures: log + return `{ success: true, alreadySubscribed: false }` (local row was saved — don't fail the user-facing call). Existing behavior, kept.
- Successful new subscribe: return `{ success: true, alreadySubscribed: false }`.

Local DB insert + CRM upsert behavior is unchanged.

## Section 3 — Opt-in surfaces

Three new call sites for `newsletter.subscribe`. Checkbox copy is identical across all three: **"Email me about new work and studio updates"**. Default state: **unchecked**.

### 3a. Inquiry form

- Add the checkbox to `apps/website/src/components/blocks/FormBlock/index.tsx` (or wherever the inquiry form lives — verify in the plan).
- On successful `inquiries.create`, if checkbox was checked, call `newsletter.subscribe` with `{ email, source: "inquiry", locale }`. Fire-and-forget; do not block the success state on it.

### 3b. Bid modal

- Add the checkbox to the bid form component (path to be confirmed in the plan — likely `apps/website/src/components/bidding/*`).
- On successful bid placement, if checked, call `newsletter.subscribe` with `{ email: bidderEmail, source: "bid", locale }`. Fire-and-forget.

### 3c. Stripe checkout — native consent collection

- Add `consent_collection: { promotions: 'auto' }` to the `checkout.sessions.create` params in `packages/db/src/trpc/routers/checkout.ts`. Stripe shows a marketing-consent checkbox on its hosted page.
- In the webhook handler (`apps/website/app/api/webhooks/stripe/route.ts`), after the order is inserted, check `session.consent?.promotions === "opt_in"`. If so, call the Buttondown subscribe helper server-side with `{ email: customer.email, source: "checkout", locale }`. Fire-and-forget; webhook still returns 200 on Buttondown failure.
- No success-page UI changes. Consent is captured during checkout, recorded by Stripe, and processed server-side from the webhook — no session lookup, no extra PII surface.

### Privacy note

Next to every checkbox / CTA: *"Unsubscribe anytime. We won't share your email."* Link "Unsubscribe anytime" to the privacy section if one exists; otherwise plain text.

## Section 4 — UX states

- Footer success message: change from `"You're on the list."` to `"Check your inbox to confirm."` whenever double opt-in is active.
- When the API returns `alreadySubscribed: true`, show the same `"Check your inbox to confirm."` message rather than treating it as a new signup — this is honest and avoids leaking whether the address is already in the list (small privacy + anti-enumeration win).
- Error state (network/server failure): existing `"Something went wrong."` is fine.

## Section 5 — Testing

- Unit test `newsletter.subscribe` (mock `fetch`):
  - Passes `tags` and `metadata` to Buttondown.
  - Duplicate-email 400 from Buttondown returns `alreadySubscribed: true`, does not log as error.
  - Buttondown failure does not prevent the local DB write.
  - Default `source = "footer"` when omitted.
- One light integration test per form/CTA that the checkbox/click triggers `newsletter.subscribe` with the correct `source`. Skipping the checkbox does not trigger it.

---

## Out of scope (explicit non-goals)

- **Admin-side "Notify subscribers" draft button** for piece publishes (approach C). Defer until manual broadcasts become painful.
- **Backfilling historical contacts** (existing inquirers, bidders, buyers) into Buttondown. They never consented to marketing email.
- **Automated drop emails** triggered by piece publishing.
- **Multi-list / segmented sending logic** beyond Buttondown's native tag filtering.
- **i18n of newsletter content** — Maeve writes broadcasts in whatever language; subscriber `locale` metadata is stored for future use only.

## Resolved paths

- Inquiry form: `apps/website/src/components/blocks/FormBlock/index.tsx` (dynamic fields; the checkbox is rendered alongside, not added as a content-modeled field).
- Bid modal: `apps/website/src/components/blocks/BidWidget/BidModal.tsx`.
- Stripe checkout session: `packages/db/src/trpc/routers/checkout.ts`.
- Stripe webhook: `apps/website/app/api/webhooks/stripe/route.ts`.
- Locale: not currently threaded; will read from `useRouter().locale` client-side, default to `"en"` server-side. Stored as metadata only, not used for routing logic.

## Related

- [Architecture decision (BLOX-349)](../../plans/2026-03-05-vamy-sales-integration-design.md)
- [Studio contacts CRM design](./2026-05-27-studio-contacts-crm-design.md) — local CRM that Buttondown intentionally does *not* duplicate; Buttondown is the marketable-with-consent subset.
