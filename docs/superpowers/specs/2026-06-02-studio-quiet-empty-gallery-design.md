# Design: Studio Quiet — empty-gallery as a feature

**Date:** 2026-06-02
**Status:** DRAFT — pending review
**Mode:** Builder (office-hours session)
**Related:** [2026-05-31-newsletter-landing-pages-design.md](./2026-05-31-newsletter-landing-pages-design.md)

## The reframe

The original ask was "a placeholder for when Vamy hides all her pieces." Framed that way, it sounds like a 404-style fallback — a sad face on an empty list.

The studio voice already in production on `/letters/welcome` and `/letters/farewell` points to a different reading: **a gallery with nothing in it is not broken. It's quiet.** The wall is bare because Maeve took everything down — not because the site failed. The work keeps happening either way.

That single inversion changes the design. The page is not a fallback; it is a deliberate first-class screen — **Studio Quiet** — that triggers when no pieces are publicly listed.

## Why this matters (bigger picture)

1. **A controllable signal.** Maeve can intentionally hide everything for a window — a week, a day — before a drop. The gallery going dark becomes a *recognizable artistic gesture*: something is coming. Fashion houses and galleries do this routinely. Most artist sites cannot, because their gallery is static.
2. **The strongest newsletter conversion surface on the site.** A visitor who hits a quiet `/gallery` and reads "the work is between hangings — next pieces appear [date]" has more reason to subscribe than anywhere else. Right now the footer signup is passive ambient.
3. **A brand differentiator.** Most artist portfolios are archive sites: comprehensive, static, exhausting. A site that can *breathe* — full / quiet / full again — feels closer to how a working studio actually operates.
4. **SEO is a real but bounded cost.** Individual piece pages carry inbound art-search traffic. When the gallery is quiet, those pages may also be unpublished, so traffic dips. Mitigation: `/gallery` itself stays a 200, the copy is intentionally indexable, and the dip ends when pieces relist. Acceptable.

## Premises (agreed)

1. Empty gallery is a feature Maeve will use intentionally, not just an edge case.
2. No site chrome — same minimal-layout family as `/letters/welcome` and `/letters/farewell`.
3. Newsletter signup belongs on this page.
4. The page stays at `/gallery` — no redirect, same URL.
5. The trigger is `artworks.listPublic() === []`. No separate "studio is dark" toggle.
6. The countdown/teaser hook is optional: if Maeve has set a "next drop date," show it; otherwise fall back to plain quiet copy.

## Approaches considered

### Approach A — Studio Quiet, single moment (rejected)
Just one page, no date. Lowest effort, highest tonal consistency. Rejected because it leaves the reveal mechanic unused — the strongest part of the brand idea.

### Approach B — Studio Quiet + last-piece echo (rejected)
Show a faded thumbnail of the last hidden piece. Rejected: requires querying soft-deleted pieces, and the visual nostalgia conflicts with the "the work keeps happening" voice. We are not mourning the absence.

### Approach C — Studio Quiet + countdown/teaser hook (CHOSEN)
A new optional studio-controlled value (`nextDropAt: timestamp | null`). When `/gallery` has zero public pieces, render the Studio Quiet page; if `nextDropAt` is set and in the future, show a teaser line referencing it; otherwise show the unanchored quiet copy. Newsletter signup on the page regardless.

## Recommended approach (C)

### Page composition

Route: `/gallery` (unchanged) — only the rendered content swaps when items are empty.

Layout: minimal, no site header/footer. Centered, max-width ~520px. Same `font-serif` family as the letters pages. Staggered fade-in via the existing `letters-fade-in` keyframe (extract to a shared component if a second user appears).

Content (two variants):

**Variant 1: nextDropAt is set and in the future**
```
The studio is quiet.

The wall is bare right now. Next pieces hang [Friday, June 13].

[newsletter signup — single field, "be there first"]

— Maeve
```

**Variant 2: nextDropAt is null or past**
```
The studio is quiet.

The wall is bare right now. The work keeps happening either way.

[newsletter signup — single field, "be there when it's back"]

— Maeve
```

Single CTA link below: `→ back to vamy.art`.

### Data model

New `site_settings` table (key/value, single-row pattern) OR extend whatever the studio already uses for global config. Field added:

```ts
nextDropAt: timestamp | null
```

If `site_settings` doesn't exist yet, scope creates it as a typed singleton row, not a generic KV table — YAGNI.

### tRPC surface

- `siteSettings.get()` — public, returns `{ nextDropAt }`. Cached at the page level via `getStaticProps` revalidate.
- `siteSettings.update({ nextDropAt })` — studio-auth-gated mutation.

### Studio admin

A new "Studio status" panel (or a section in an existing settings page) with one date+time picker for `nextDropAt`, plus a "clear" action. Saving triggers website revalidation through the same auth-gated proxy already in place (`studio-website-revalidation` memory).

### Trigger logic in `apps/website/src/pages/gallery/index.js`

In `getStaticProps`:
- Fetch `artworks.listPublic()` and `siteSettings.get()` in parallel.
- If `artworks.length > 0`, render the existing `PostFeedLayout` (unchanged).
- If `artworks.length === 0`, render the new `StudioQuiet` page component with `nextDropAt` passed in.

### Files touched

- Create: `apps/website/src/components/StudioQuiet.tsx` (the empty-state page component)
- Modify: `apps/website/src/pages/gallery/index.js` (branch on empty)
- Modify: `packages/db/schema.ts` (add `site_settings` table)
- Modify: `packages/db/src/routers/siteSettings.ts` (new router)
- Modify: `packages/db/src/routers/_app.ts` (wire it up)
- Modify: `apps/admin/...` (new settings panel — one date picker + clear button)
- Migration: `packages/db/migrations/NNNN_site_settings.sql`

## What this is NOT

- Not a manual on/off toggle. The page appears purely as a function of `listPublic().length === 0`. Maeve controls the empty state by hiding pieces in the studio, which she already does.
- Not a countdown timer with seconds ticking. A single human-readable date line ("hang Friday, June 13"). No JS clock.
- Not a "coming soon" page. The wall is bare *now*. There is no "soon" implied unless `nextDropAt` is set.
- Not a different URL. Same `/gallery`.

## SEO

- `/gallery` stays a 200 response with real content.
- `<meta name="robots">` is **NOT** noindex — unlike the letters pages, this one is part of the public site surface and should accrue authority.
- `metaDescription` adapts: if `nextDropAt` is set, mention it; otherwise default.

## Open questions

- Should hidden-but-existing pieces leak metadata anywhere (sitemap, OG cards)? Probably not — they unpublish cleanly. Verify with current studio soft-delete flow.
- Does the home page need a parallel quiet state when the featured-pieces strip is empty? Out of scope for v1; revisit if it happens.

## Success criteria

- Hiding all pieces in the studio causes `/gallery` to render the Studio Quiet page within one revalidation cycle.
- Setting `nextDropAt` in the studio causes the teaser line to appear without a code change.
- Clearing `nextDropAt` falls back to the plain quiet copy.
- Newsletter signup on the quiet page tags subscribers via the existing Buttondown integration.
- Page passes Lighthouse a11y at 100, same as the letters pages (reduced-motion respected, AA contrast).

## The assignment

Before any code: spend 10 minutes with Maeve and confirm she'd actually *use* this feature. Show her the two copy variants. If her reaction is "I'd never hide everything on purpose," the entire premise of approach C collapses and you should fall back to approach A (single quiet moment, no admin field, ship in a day). The whole design hinges on whether the reveal mechanic is a real artist behavior for her or a feature only the developer would love.
