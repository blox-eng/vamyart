# Newsletter Landing Pages — Design

**Date:** 2026-05-31
**Status:** Approved, ready for plan
**Related:** [2026-05-28-buttondown-newsletter-design.md](./2026-05-28-buttondown-newsletter-design.md)

## Context

Buttondown is wired up on the free plan. Its default post-confirmation and post-unsubscribe pages are generic Buttondown-branded screens. Two custom pages on vamy.art replace those moments with something that matches the studio's voice.

The free plan locks the *email body* customization for confirmation and welcome emails, but it does allow setting custom **redirect URLs** for both the confirmation success and unsubscribe flows. That's the seam we exploit.

## Goals

- Confirmed subscribers land on a page that closes the open loop set up by the welcome email — a single hint at what's coming next.
- Unsubscribed people land on a page that says goodbye with no guilt, no resubscribe-begging, no list of "what you'll miss."
- Both pages feel like part of the studio, not part of Buttondown.
- Zero infra: static pages, no DB calls, no auth.

## Non-goals

- No personalization. The pages render the same for everyone.
- No subscriber-only gated content (token-gated archive was considered and rejected — overengineered for a list of zero).
- No admin UI for editing the teaser line (deferred until Maeve has a real cadence of letters going out — currently hardcoded).
- No newsletter signup form on either page.

## Routes & files

Two new Next.js Pages Router files under `apps/website/src/pages/letters/`:

- `welcome.tsx` — post-confirmation landing
- `farewell.tsx` — post-unsubscribe landing

Both:

- Fully static (no `getServerSideProps`, no API calls)
- `noindex` meta — these aren't part of the site's content surface
- Minimal layout: no site header, no site footer chrome. Centered, max-width ~520px, lots of whitespace.
- Same serif typography as the rest of the site

## `welcome.tsx`

**Content:**

```
You're in.

Next letter goes out when the paint is dry. You'll see it first.

— Maeve
vamy.art
```

**The novel bit:** the four content blocks (heading, teaser, signature, site) fade in one at a time, ~600ms apart, on page load. CSS-only — `animation-delay` per element. No JS framework needed. Effect: the page is being written in front of you, not displayed at you.

**CTAs (text links, no buttons, understated):**

- `→ see the gallery` → `/gallery`
- `→ back to vamy.art` → `/`

**Teaser line — hardcoded constant in the file:**

```ts
const TEASER = "Next letter goes out when the paint is dry. You'll see it first."
```

When Maeve has 3+ letters sent and a cadence, promote this to a Supabase `site_settings` KV table with an admin UI panel. Until then, it's a one-line edit + PR.

## `farewell.tsx`

The contrast is the whole point. Welcome = something arriving. Farewell = something receding. Same craft, opposite movement.

**Content:**

```
The door's closed.

You won't hear from the studio again. No hard feelings — the work
keeps happening either way.

If it was an accident, you can sign back up at vamy.art.

— Maeve
```

**The novel bit:** reverse fade. Lines fade in *from opacity 1 to opacity 0.4* — dimmed, not invisible. Text settles into a faded state, like ink that's already drying. One slow settle, then still. No loop.

**One CTA:**

- `→ back to vamy.art` → `/`

No "are you sure?" No resubscribe button. No "things you'll miss." The accident-recovery line covers genuine mistakes without prostration.

## Buttondown wiring

In the Buttondown dashboard → Settings → Subscribing:

- **Confirmation success redirect URL** → `https://vamy.art/letters/welcome`
- **Unsubscribe redirect URL** → `https://vamy.art/letters/farewell`

(Confirmed available on free plan.)

## Testing

- Render both pages locally, verify the staggered fade animation looks right at 600ms intervals.
- Verify `noindex` meta is set.
- Verify both pages render with no header/footer chrome.
- Smoke test end-to-end: sign up with a `+alias`, click confirm, land on `/letters/welcome`. Then unsubscribe from the welcome email, land on `/letters/farewell`.

## Summary of decisions

| Decision | Choice |
|---|---|
| Approach | Reveal-driven |
| Confirmed-page content | Single hardcoded teaser line |
| Teaser copy | *"Next letter goes out when the paint is dry. You'll see it first."* |
| Routes | `/letters/welcome` and `/letters/farewell` |
| Layout | Minimal — no site header/footer chrome |
| Animation | CSS-only staggered fade. Welcome: in. Farewell: settle to dim. |
| SEO | `noindex` on both |
| Data deps | None — fully static |
| Buttondown wiring | Both redirect URLs set in dashboard after deploy |
