# Browse + Purchase UX Polish — Design

**Date:** 2026-04-19
**Branch:** `feat/ux-polish-2026-04-15` (continuation) or a fresh `feat/ux-polish-2026-04-19`
**Scope:** Polish existing browse/purchase surfaces on `apps/website`. No new routes, no new services, no new subscriptions.

## Goal

The browse → inquire flow works end-to-end today (home → `/gallery` → `/gallery/[slug]` → `/get-a-piece?piece=...`). But several surfaces have broken trust signals, a11y regressions, and copy/style inconsistencies between the two inquire forms. This spec is a tight audit-driven polish pass to make the existing site feel finished, ahead of Phase 4 (Stripe Checkout) work.

## Non-goals

- Adding gallery filters, sold/available state indicators (needs product-data pipeline work)
- Image zoom / lightbox on artwork pages (larger effort, deferred)
- Wiring next-intl to actually translate content (separate milestone)
- Surfacing Stripe Checkout UI (Phase 4, not this iteration)

## Constraints

- No new services, subscriptions, or SaaS
- No new dependencies unless absolutely required (prefer in-stack primitives)
- Keep each change localized; single PR, single merge

## The audit (verified against `apps/website` as of 2026-04-19)

### Cross-cutting

1. **LocaleSwitcher is cosmetic** — `apps/website/src/components/sections/Header/index.tsx` renders a 3-locale switcher (EN / DE / BG) that flips `localStorage` but has no effect on content because next-intl isn't wired on the website yet. Mounting it implies functionality we don't have.
2. **Focus rings stripped without replacement** — every input on `/get-a-piece` and `ReachOutBlock` uses `focus:outline-none focus:border-*`, which removes the OS focus ring without providing a keyboard-visible alternative. This is an a11y regression.
3. **No image fallback on `/get-a-piece` aside** — `apps/website/src/pages/get-a-piece.tsx` renders `<img src={`/images/${artwork.slug}.jpg`}>` directly. A missing asset yields a broken-image icon, not a graceful fallback.
4. **No loading skeleton on `/get-a-piece`** — when a `?piece=` slug is present, the `trpc.products.getByArtworkSlug` query silently waits; the aside shows the fallback copy first and then flickers to the artwork block. Feels janky.
5. **tRPC errors are one-line dead ends** — both forms show `"Something went wrong — please try again."` with no retry button; user has to re-type.
6. **Price formatting is inline and inconsistent** — `€${Number(variant.price).toLocaleString()}` at `apps/website/src/pages/get-a-piece.tsx:32`. No shared formatter, uses browser default locale.

### Gallery page — `apps/website/content/pages/gallery/index.md`

7. **`metaDescription: 'Discover '`** (literal, with a trailing space) — that's the social-share / SEO description for the gallery page. Needs a real sentence.

### Artwork detail pages — `apps/website/content/pages/gallery/{slug}.md` via `PostLayout`

8. **No back-to-gallery affordance** at the top of the artwork page. Users must hit the browser back button.
9. **No next / previous piece navigation** near the CTA, so browsing the (small) collection requires bouncing back to the gallery index each time.
10. **`pieceId` frontmatter is never rendered** — e.g. `pieceId: '#seascape-w2025'` on `whispers.md` sits unused. It's a catalog number; letting it surface as muted metadata is authentic art-world detail.
11. **Shouty CTA copy** — `INQUIRE ABOUT THE ORIGINAL` in all caps clashes with the gentle typography everywhere else on the site. Sentence case ("Inquire about this piece") fits.

### Forms — `/get-a-piece` + `ReachOutBlock`

12. **Terms checkbox parity** — `/get-a-piece` requires a legal-terms checkbox; `ReachOutBlock` does not. Both produce the same `inquiries.create` mutation server-side. Add it to ReachOutBlock for GDPR hygiene and UX consistency.
13. **Reply-time copy drift** — `/get-a-piece` STEPS copy says "within 2 working days"; ReachOutBlock success state says "usually within 2 days". Pick one. "within 2 working days" is the more honest claim.
14. **Input styling drift** — `/get-a-piece` uses `border-gray-200 px-4 py-3 rounded`; `ReachOutBlock` uses `border-gray-300 px-3 py-2` flat. Unify on the `/get-a-piece` treatment (more breathing room, rounded corners).
15. **Disabled-button opacity drift** — `opacity-40` vs `opacity-50`. Pick one (go with `opacity-50`, standard Tailwind muted state).

### Home — `apps/website/content/pages/index.md`

16. **"The Work" cards have no hover affordance** — 4 concept cards (Oil / Realism / Surreal / Craft) with `actions: []`. A user can't tell whether they're clickable or not. They're editorial-only by design, so the fix is to make that *honest*: remove the subtle hover state that suggests clickability, or deliberately add one with a purpose. Recommendation: keep them non-interactive but ensure the cursor stays default and there's no hover elevation that implies a click target.

## Approach

All changes are additive or style-tweaks on existing files. No migrations, no route changes. Group by surface so each commit is reviewable in isolation:

1. **Commit 1 — cross-cutting:** focus rings utility class, image fallback, skeleton, error retry button, shared `formatPrice` helper, remove LocaleSwitcher from mounted header variants (keep the component file dormant).
2. **Commit 2 — gallery + artwork content:** fix metaDescription; add `Back to gallery` + next/prev to `PostLayout` (or wrap); render `pieceId`; sentence-case each artwork's CTA label in frontmatter.
3. **Commit 3 — form coherence:** port terms checkbox + unified styling into ReachOutBlock; align reply-time copy; standardize disabled opacity.
4. **Commit 4 — home micro-polish:** remove any accidental hover-suggests-click styling on "The Work" cards.

## Components touched

- `apps/website/src/components/sections/Header/index.tsx` — stop mounting LocaleSwitcher
- `apps/website/src/pages/get-a-piece.tsx` — focus rings, image fallback, loading skeleton, error retry, `formatPrice` call site
- `apps/website/src/components/blocks/ReachOutBlock/index.tsx` — focus rings, terms checkbox, input styling, reply-time copy, disabled opacity, error retry
- `apps/website/src/lib/formatPrice.ts` — **new** (tiny helper, single file)
- `apps/website/src/components/layouts/PostLayout/index.tsx` (or equivalent) — back-to-gallery, next/prev, pieceId rendering
- `apps/website/content/pages/gallery/index.md` — metaDescription fix
- `apps/website/content/pages/gallery/*.md` — sentence-case CTA labels
- `apps/website/content/pages/index.md` — "The Work" cards styling (if any hover override present)

Will verify the exact `PostLayout` path during implementation — the catch-all `[[...slug]].js` resolves it via the components registry, so it may live under `src/components/layouts/`.

## Testing

Manual acceptance (dev server, real tRPC backend):

- **Keyboard nav:** tab through `/get-a-piece` and `ReachOutBlock`, every input has a visible focus indicator.
- **Fallback:** `/get-a-piece?piece=does-not-exist` → form still submits, no broken image icon.
- **Skeleton:** throttle network, load `/get-a-piece?piece=whispers` → skeleton visible before artwork block.
- **Retry:** stop Supabase / disconnect network, click Send, see a "Try again" button, reconnect, retry succeeds.
- **Artwork nav:** `/gallery/whispers` → "Back to gallery" returns to `/gallery`; next/prev cycle through `first-contact`, `on-the-horizon`.
- **Form parity:** both forms require terms acceptance, both say "within 2 working days", both have the same input style and disabled state.
- **Mobile:** sanity-check the forms at 375px width — no cramped inputs, submit button stays reachable.

Automated: no changes to tRPC / db packages, so existing `packages/db` tests continue to apply. No new tests unless a non-trivial shared helper emerges (`formatPrice` probably doesn't need its own test file — one-liner returning `new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n)`, which gives `€1,200` format).

## Risk

Low across the board.

- LocaleSwitcher removal is the most user-visible change, but it was non-functional anyway.
- PostLayout edits are the highest-risk item — the component is shared, and changing its structure could affect other pages that use `PostLayout`. Mitigation: verify via grep which pages use it; the back/next controls should be opt-in via frontmatter or gated on `type === 'gallery'`.

## Rollout

Single branch (fresh `feat/ux-polish-2026-04-19` or a continuation on `feat/ux-polish-2026-04-15` if still open). Four scoped commits as listed. One PR to `main`. Netlify deploy preview for visual review before merge.
