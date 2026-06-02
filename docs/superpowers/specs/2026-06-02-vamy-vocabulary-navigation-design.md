# Design: Vocabulary-as-Navigation — vamy.art whole-site reframe

**Date:** 2026-06-02
**Status:** APPROVED — vocabulary confirmed by Maeve 2026-06-02 ("on the wall / in the studio / letters / write to maeve / quiet")
**Mode:** Builder (office-hours session, whole-site lens)
**Supersedes nothing — pairs with:**
- [2026-05-31-newsletter-landing-pages-design.md](./2026-05-31-newsletter-landing-pages-design.md)
- [2026-06-02-studio-quiet-empty-gallery-design.md](./2026-06-02-studio-quiet-empty-gallery-design.md)

## The bigger-picture question (what vamy.art is for)

After scanning the site as a whole and looking at how other contemporary artists handle their personal sites, the strategic call is: **vamy.art is a relational site, not a transactional one.** The success metric is a list of 100–500 people who genuinely want to own a Maeve, not order count. First online order is a proof point; warm subscribers and quality inquiries are the lead indicators.

Most of the infrastructure already supports this. The voice already exists on `/letters/welcome` and `/letters/farewell`. What's missing is **the site presenting itself as a working studio rather than an artist portfolio with an attached shop.**

## Research that informed this

Three contemporary patterns worth borrowing from:

- **Daniel Eatock** ([eatock.com](https://www.eatock.com/)) — `Ongoing` section: recurring practices tracked as columns, not a blog. Visitors return because the threads keep being written.
- **Shantell Martin** ([shantellmartin.art](https://shantellmartin.art/)) — words from her drawing practice (Dance, Party, Love, Speed, Chaos, Strength, Area, Reset) become the navigation itself. Her vocabulary IS the UI.
- **David Hockney** ([hockney.com](https://www.hockney.com/)) — homepage is one current painting at full size, no hero copy. Work organized by medium, not chronology.

Vlad Yashin — the painter named in the brainstorm — doesn't have his own personal site at all. Instagram + Saatchi is his "site." Worth noting: most painters with serious followings let Instagram do the work. The fact that vamy.art exists as owned space is itself a differentiator. The job is to make it earn that ownership.

The chosen move borrows from Shantell Martin: **the studio's own vocabulary becomes the navigation.** Smallest infra change, biggest tonal shift, pairs cleanly with everything else we're building.

## What changes

### Header navigation

`apps/website/content/data/header.json` currently has:

| Position | Label | URL |
|---|---|---|
| Primary | `ABOUT` | `/about` |
| Primary | `GALLERY` | `/gallery` |
| Button | `GET A PIECE` | `/get-a-piece` |

It becomes:

| Position | Label | URL | Notes |
|---|---|---|---|
| Primary | `on the wall` | `/gallery` | URL unchanged for SEO; label shifts |
| Primary | `in the studio` | `/about` | URL stays; page evolves (see below) |
| Primary | `letters` | `/letters` | New: public archive page |
| Primary | `quiet` | `/gallery` | **Conditional:** only renders when public artworks count = 0. Replaces "on the wall" in that state. |
| Button | `write to maeve` | `/get-a-piece` | URL unchanged; label shifts |

**Casing matters.** The current nav is UPPERCASE; the letters voice is lowercase serif. The new nav should be **lowercase, same font family as `font-serif` used in the letters pages**. The shift to lowercase is the visible signal that the site has a single coherent voice now.

### Conditional "quiet" item

When `artworks.listPublic().length === 0`, the header swaps `on the wall` for `quiet`. The destination is the same (`/gallery`), but the label tells the visitor what state the studio is in before they click. Pairs directly with the Studio Quiet empty-gallery design.

This requires the header to know the public-pieces count. Two reasonable implementations:

- **Static at build time:** `getStaticProps` reads `artworks.listPublic().length` and passes a `wallState` prop into the layout. Revalidation cadence already matches gallery.
- **Edge variable:** read the same value at the page level and pass through to a shared Header. Simpler in practice.

YAGNI: don't build a global context for this. One prop down the layout tree is enough.

### `/about` becomes "in the studio"

URL stays `/about` (SEO, link stability). Page content evolves from static bio to a two-section hybrid:

1. **Top:** Maeve's short statement — who she is, what she paints, where she works. The existing bio, rewritten in the letters voice. One screen, no scroll.
2. **Below:** A "now" surface. One or two paragraphs Maeve updates monthly. What's on the easel. What she's reading. What show is coming up. No photo grid, no calendar — just text in serif. Editable from the studio admin via the same `site_settings` table introduced by the empty-gallery design (add a `studioNote` field alongside `nextDropAt`).

This is the lowest-stakes "now" page possible. Maeve can leave it stale for a month without the site looking broken; a fresh paragraph appears as a small reward for returning visitors.

### `/letters` becomes a real public archive

Currently `/letters` is not a route — only `/letters/welcome` and `/letters/farewell` exist. Add:

- `/letters` — index page listing past published letters with title + date + first line. Top of page has a single-field subscribe form (same one as footer, more prominent placement).
- `/letters/[slug]` — individual letter page. Reads like a letter, not a blog post. Same minimal layout as the welcome/farewell pages.

Source of truth: Buttondown's archive API (Maeve's letters already live there). Either pull at build time (revalidate hourly) or proxy through tRPC.

This solves the bigger-picture gap: the voice that's already in production has no public surface area. Subscribers know it; visitors don't. Adding the archive makes the voice *visible to cold visitors* — which is the strongest possible subscription pitch.

### Footer signup pitch is rewritten

Current footer signup is passive ambient. New copy, same form:

> The studio sends a letter sometimes. About paint, mostly. About what's on the wall, sometimes. About what's gone, occasionally.
>
> [email field]  [→ subscribe]

Length and rhythm match the letters voice. Don't promise frequency. Don't list benefits. The pitch IS the voice.

## Premises

1. The studio voice in production (`/letters/welcome`, `/letters/farewell`) is the right voice for the whole site. The rest of the site catches up to it; nothing is reset.
2. URLs stay stable. Labels change, pages evolve, but `/gallery`, `/about`, `/get-a-piece`, `/letters/welcome`, `/letters/farewell` all remain. SEO and inbound links are preserved.
3. Maeve will write *occasionally*. Not weekly. Not on a calendar. The site has to look intentional when she goes quiet (because it does — `quiet` is in the nav).
4. Newsletter conversion is the most important metric. The nav surfaces `letters` as a primary destination instead of a footer afterthought.

## What this is NOT

- **Not a redesign.** The visual system stays (Cormorant Garamond serif, Tailwind, current colors). Only the words and one new page change.
- **Not "Studio Quiet" rolled in.** That spec stands on its own. This builds on top of it: when the wall is bare, the nav item changes to `quiet`, the page renders the Studio Quiet design, and the loop closes.
- **Not vocabulary-creep.** Don't rename `/get-a-piece` to `/write-to-maeve` in the URL bar — labels in the nav are the change. Stable URLs, evolving voice.
- **Not a CMS for letters.** Buttondown already is the CMS. We read from it. We do not duplicate.

## Approaches considered

### Approach A: Just the nav (label swap only)
Change `header.json` labels. Add the `letters` link to a route that just embeds Buttondown's archive iframe. Don't touch `/about` content. Don't add `studioNote`. Ship in a day.
**Rejected because:** the bigger-picture problem isn't the labels alone — it's that the site is presenting itself as a portfolio when it should present as a working studio. Half-measure.

### Approach B: Full vocabulary reframe (CHOSEN)
The nav swap, the conditional `quiet` item, `/about` becomes "in the studio" with a `studioNote` "now" section, `/letters` becomes a real archive, footer copy rewritten. One coherent move. Ships in 2-3 PRs, not one.

### Approach C: Vocabulary + voice-as-content (rejected for now)
Add C plus: rewrite all body copy across the site in letters voice, rewrite hero, etc. Too much risk in one move. Better to ship B, see how it lands with Maeve, then iterate to C if she likes it.

## Recommended approach (B)

Ship in 3 PRs:

1. **Header reframe + footer copy.** Swap labels in `header.json` (lowercase, serif), add `letters` link, add conditional `quiet` rendering. Rewrite footer signup copy. Small, low-risk, high-impact.
2. **`/letters` archive.** New route. Pull from Buttondown archive. Index + per-letter pages.
3. **"In the studio" page evolution.** Rewrite `/about` body in letters voice. Add `studioNote` field to `site_settings` (riding on the Studio Quiet design's same migration). Add admin UI for the studio note. The first time Maeve sets a note, she sees it appear on `/about` within a revalidation cycle.

Each PR is independently valuable. If Maeve hates direction after PR 1, PRs 2 and 3 don't have to ship.

## Backend / admin scope (read before planning)

PRs 1 and 2 are pure website work — no studio admin changes required.

- **PR 1 (header + footer):** purely frontend. Header reads `artworks.listPublic().length` via `getStaticProps` (already happens for `/gallery`). No new tables, no new admin UI.
- **PR 2 (`/letters` archive):** new website routes only. Source is Buttondown's existing API or RSS — no new admin field. Maeve continues writing letters in Buttondown exactly as today.
- **PR 3 ("in the studio" `studioNote`):** **this is where admin work lives.** Adds a `site_settings` table (or extends the one introduced by the Studio Quiet design — same singleton row, additional column `studioNote: text | null`), a public `siteSettings.get()` tRPC procedure, an auth-gated `siteSettings.update()` mutation, and a new "Studio status" panel in `apps/admin` with a textarea + save button. Triggers website revalidation through the existing same-origin auth-gated proxy.

If PR 3's admin scope feels too heavy for the value, valid fallback: make `studioNote` an env var (`STUDIO_NOTE` in `apps/website/.env.local`) for v1. Trade-off: every change requires a redeploy. Acceptable if Maeve updates monthly, not weekly. Re-evaluate after a quarter.

## Open questions

1. **Buttondown archive access:** Does Maeve's plan expose archive HTML or just RSS? Verify before designing PR 2.
2. **"Quiet" appearance:** Should the link literally just read `quiet`, or `the studio's quiet right now`? Short reads more confident; long reads more explicit. Maeve approved `quiet` — leave it short unless visual review pushes back.
3. **`studioNote` vs env var:** if Maeve doesn't actually want to write monthly, PR 3 may not justify the admin work — see fallback in section above.

## Success criteria

- A first-time visitor reads the nav and absorbs the voice without realizing it.
- A returning collector clicks `in the studio` once a month and finds something new at least sometimes.
- Newsletter signups per month increase measurably after PR 2 (the public letters archive ships).
- Empty-gallery state coexists cleanly: when the wall is bare, the nav says `quiet`, the page is the Studio Quiet design, and nothing breaks.
- Lighthouse SEO score doesn't drop. All URLs stable.

## The assignment

Before any code: pull up the current site next to this design doc and **read the new nav out loud, in Maeve's voice.** "On the wall. In the studio. Letters. Write to Maeve." If a single word makes you cringe, replace it. Send Maeve the four labels — just the four words — and ask her which she'd actually say. The vocabulary has to be hers, not designed-for-her. That ten-minute conversation determines whether this whole direction lands or feels forced.

## What I noticed about how you think

- You called out the framework-shaped options the first time around ("you are not being creative even one tiny bit") and named a specific artist (Vlad Yashin) you'd looked at. That's a strong signal — most people would have just picked the least-bad option. Pushing back forced the research that actually got us somewhere.
- You picked the smallest-infra-change option of three (vocabulary nav vs letter-first vs permanent plaques). That's a taste call about velocity over scope, and it's the right one for an artist site with one painter and one developer.
- The "relational" pick over "transactional" was decisive and not the obvious choice given there's a Stripe pipeline already built. That kind of resisting-the-sunk-cost choice tends to produce sites that feel coherent rather than featured.
