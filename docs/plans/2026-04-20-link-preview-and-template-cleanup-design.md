# Link Preview + Template Cleanup — Design

**Date:** 2026-04-20
**Branch:** `feat/ux-polish-2026-04-19` (extends PR #3)

## Goal

Fix template leftovers visible in three places:

1. **Chat unfurls** of `vamy.art/` show the original Stackbit pill-capsule hero instead of Maeve's artwork.
2. **On-page metadata** — `/terms` ships literal Stackbit placeholder copy (`metaTitle: "Landing Page"`, `metaDescription: "Write here your new page's description…"`), a stray `altText: "Dope design preview"` media block, and a `WE HAVE SOME TERMS` badge.
3. **Content and public assets** — 5 unused "Person" JSONs with Lorem Ipsum bios, ~25 unreferenced template images (ex-customer logos, avatars, abstract/hero SVGs, `AI_Generated_Image_*`, `placeholder-video.mp4`, 5 placeholder paintings).

Fix all three in the same PR. No new services, no bespoke per-page OG compositing — reuse existing artwork assets for OG rotation.

## Changes

### 1. Site-level metadata (`content/data/site.json`)

- `titleSuffix: "Fine Art"` → `"Maeve Vamy"`. Every page now unfurls as *"Gallery — Maeve Vamy"* rather than *"Gallery - Fine Art"*.
- `defaultSocialImage` stays set (used as ultimate fallback) but rotation helper takes precedence for pages without an explicit `seo.socialImage`.

### 2. OG / Twitter enrichment (`src/utils/seo-utils.js`)

Today `seoGenerateMetaTags` emits only `og:title` + `og:image`. Add:

- `og:description` — from `metaDescription`.
- `og:url` — `${domainUrl}${urlPath}` when available.
- `og:type` — `"article"` for `modelName === 'PostLayout'`, `"website"` otherwise.
- `og:site_name` — `"Maeve Vamy"`.
- `og:image:alt` — from featuredImage `altText` or page title.
- `og:image:width: 1200`, `og:image:height: 630`.
- `twitter:card: "summary_large_image"`.
- `twitter:title`, `twitter:description`, `twitter:image` — mirror OG values.

Page-level `seo.metaTags` still override.

### 3. Deterministic OG rotation (`src/lib/ogRotation.ts`)

New helper:

```ts
const OG_POOL = [
  '/images/whispers.jpg',
  '/images/first-contact.jpg',
  '/images/on-the-horizon.jpg',
];

export function pickOgImage(urlPath: string): string {
  let h = 0;
  for (let i = 0; i < urlPath.length; i++) {
    h = ((h << 5) - h + urlPath.charCodeAt(i)) | 0;
  }
  return OG_POOL[Math.abs(h) % OG_POOL.length];
}
```

Wired into `seoGenerateOgImage` precedence chain:

1. page-level `seo.socialImage` (wins if set)
2. PostLayout `featuredImage.url` (wins for artwork pages)
3. `pickOgImage(urlPath)` (new — per-URL stable rotation across `OG_POOL`)
4. `site.defaultSocialImage` (kept as floor)

Artwork detail pages are unaffected — they always hit step 2.

### 4. Root page (`content/pages/index.md`)

- Hero `media.url`: `/images/gray-painting-placeholder-no-frame-hang-square-vamy.png` → `/images/whispers.jpg`. Only matters on cold-DB builds where `[[...slug]].js` can't inject the real featured artwork; prevents the pre-DB state from looking placeholder-y.
- Hero `badge.label`: `"Original oil paintings"` → `"Original fine art"`.
- Remove the explicit `seo.socialImage: /images/main-hero.jpg` line so rotation takes over.

### 5. Gallery index (`content/pages/gallery/index.md`)

- `metaDescription`: `"Original oil paintings by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones."` → `"Original fine art by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones."`

### 6. Terms page (`content/pages/terms.md`)

- `seo.metaTitle`: `"Landing Page"` → `"Terms & Conditions — Maeve Vamy"`.
- `seo.metaDescription`: `"Write here your new page's description…"` → `"Terms of sale, shipping, returns, and EU consumer rights for Мейв Вами ЕООД."`
- `seo.addTitleSuffix`: `true` → `false` (metaTitle already carries brand).
- Remove the `media` block entirely (no URL, just `altText: "Dope design preview"`).
- Remove the `WE HAVE SOME TERMS` badge.
- Body: `**Email:** swoosh\@vamy.art` → `**Email:** maeve@vamy.art`.

### 7. About page (`src/pages/about.tsx`)

Hardcoded JSX, bypasses `seo-utils`. Replace the ad-hoc `<Head>` with:

```tsx
<Head>
  <title>About — Maeve Vamy</title>
  <meta name="description" content="Bulgarian fine artist working between realism and abstraction, painting from her studio in Stara Zagora." />
  <meta property="og:title" content="About — Maeve Vamy" />
  <meta property="og:description" content="Bulgarian fine artist working between realism and abstraction, painting from her studio in Stara Zagora." />
  <meta property="og:image" content="/images/on-the-horizon.jpg" />
  <meta property="og:type" content="profile" />
  <meta property="og:site_name" content="Maeve Vamy" />
  <meta name="twitter:card" content="summary_large_image" />
</Head>
```

Body copy: `"Bulgarian oil painter"` → `"Bulgarian fine artist"` (2 occurrences — description line 10 and body paragraph line 25).

### 8. Oil → Fine art copy sweep (`content/pages/index.md`)

Per user direction ("change the tagline everywhere"):

- Line 65 body prose on the "Oil / On Canvas" card:
  `"Oil painting doesn't apologize for its mess, or its refusal to be rushed. …"` →
  `"Fine art doesn't apologize for its mess, or its refusal to be rushed. …"`

Card title `"Oil / On Canvas"` stays — it's the medium label, not a tagline.

### 9. File rename

`public/images/first Contact_5807.jpg` (space + underscore + trailing digits = template slop and breaks raw-URL shares) → `public/images/first-contact.jpg`.

Update the only reference: `content/pages/gallery/first-contact.md` frontmatter `featuredImage.url` + `seo.socialImage`.

### 10. Deletions

Before deleting each file, grep the whole `apps/website` tree (including `src`, `content`, `sources`, `netlify.toml`, `package.json`). If the only matches are the file itself or `sources/local/presets/*` (Stackbit CMS-only presets, invisible to users), delete.

**Content:**
- `content/data/person2.json` through `person6.json`.

**Public images (expected to pass the grep — confirm each):**
- Ex-customer logos: `contenful-logo.svg`, `empathy-logo.svg`, `rangle-logo.svg`, `sanity-logo.svg`, `takeda-logo.svg`, `telus-logo.svg`, `vise-logo.svg`, `wellster-logo.svg`.
- Template avatars: `avatar1.svg` through `avatar6.svg`.
- Template art: `abstract-background.svg`, `abstract-feature1.svg`, `abstract-feature2.svg`, `abstract-feature3.svg`, `background-grid.svg`, `hero.svg`, `hero2.svg`, `hero3.svg`, `main-hero.svg`.
- Stale brand assets: `logo-white.svg`, `logo-dark.svg`, `favicon-default.svg`.
- Template placeholders: `person-placeholder-light.png`, `placeholder-video.mp4`, `about-placeholder.jpg`.
- AI-gen orphans: the 4 `AI_Generated_Image_2025-05-26_*.jpg` files.
- Gray painting placeholders (all 5 variants) once the homepage hero fallback switches to `whispers.jpg`.

**Keep** (still referenced or still useful):
- `main-hero.jpg` (kept as `defaultSocialImage` floor).
- `whispers.jpg`, `first-contact.jpg` (renamed), `on-the-horizon.jpg`.
- `img-placeholder.svg`, `img-placeholder-dark.png` (image-load fallback).
- `favicon.svg`.
- `vamy-black.png`, `vamy-black.svg`, `vamy-black-sm.png`, `vamy-black-sm.svg`, `vamy-white-sm.png` (logo variants used in header/footer).

If a grep turns up any keep-case we didn't anticipate, skip that deletion and note it in the plan output.

## Non-goals

- Bespoke 1200×630 OG composites per page (rotation is sufficient).
- `sources/local/presets/*` cleanup — Stackbit CMS-only, zero user surface.
- `/order/success` OG tags — not user-shareable URL.
- Image optimization (webp/avif, responsive sizes) — separate concern.
- Any new logo work or favicon changes — current SVG favicon is fine.

## Testing

- `pnpm turbo typecheck` — no new TS errors (baseline is 50 pre-existing).
- `pnpm turbo build --filter=@vamy/website` — succeeds, all 13 static pages generated.
- Manual: open built `apps/website/.next/server/pages/index.html`, confirm full `og:*` + `twitter:*` tag set present and values come from rotation.
- Manual: same check on `/terms`, `/about`, `/gallery`, `/gallery/whispers`.
- Manual: share deploy preview `/` in Slack — unfurl shows an artwork, not template pills. Repeat for `/terms` and `/about`.
- Manual: load `/terms` in browser, view source, confirm no `"Landing Page"` / `"Write here your new page's description"` / `"Dope design preview"` / `"WE HAVE SOME TERMS"` / `"swoosh@vamy.art"`.
- `ls apps/website/public/images | wc -l` before and after — should drop by ~30 files.
