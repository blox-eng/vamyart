# Link Preview + Template Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the generic Stackbit template previews that unfurl when `vamy.art/` is shared in chat, repair template-placeholder metadata on `/terms` and `/about`, enrich OG + Twitter card tags site-wide, and delete unused template content/public assets.

**Architecture:** One new helper (`src/lib/ogRotation.ts`) does deterministic per-URL rotation across existing artwork JPGs. `src/utils/seo-utils.js` gets the full `og:*` + `twitter:*` tag set and wires rotation into its precedence chain. All other changes are surgical edits to markdown frontmatter, one TSX file, one JSON config, one image rename, and batched deletions of unreferenced files.

**Tech Stack:** Next.js 15 Pages Router · Stackbit-style markdown content · TypeScript · no test suite on website (verification = typecheck + build + manual HTML `<head>` inspection).

**Branch:** `feat/ux-polish-2026-04-19` — this extends PR #3.

---

## File Structure

**New file (1):**
- `apps/website/src/lib/ogRotation.ts` — exports `pickOgImage(urlPath): string`.

**Modified files (7):**
- `apps/website/src/utils/seo-utils.js` — emit full OG/Twitter tag set, wire rotation into `seoGenerateOgImage`.
- `apps/website/content/data/site.json` — `titleSuffix` branding.
- `apps/website/content/pages/index.md` — hero fallback image, badge copy, card body copy, remove explicit `seo.socialImage`.
- `apps/website/content/pages/gallery/index.md` — `metaDescription` copy, remove `seo.socialImage`.
- `apps/website/content/pages/terms.md` — full metadata repair + body email fix.
- `apps/website/src/pages/about.tsx` — OG/Twitter `<Head>` tags + copy change.
- `apps/website/content/pages/gallery/first-contact.md` — update featuredImage + socialImage after rename.

**Renamed file (1):**
- `apps/website/public/images/first Contact_5807.jpg` → `apps/website/public/images/first-contact.jpg`.

**Deleted files (~30):**
- `apps/website/content/data/person{2,3,4,5,6}.json`.
- ~25 unreferenced images under `apps/website/public/images/` (see Task 10).

---

## Task 1: OG rotation helper

**Files:**
- Create: `apps/website/src/lib/ogRotation.ts`

- [ ] **Step 1: Write the helper**

```ts
// apps/website/src/lib/ogRotation.ts
const OG_POOL = [
    '/images/whispers.jpg',
    '/images/first-contact.jpg',
    '/images/on-the-horizon.jpg',
] as const;

export function pickOgImage(urlPath: string): string {
    if (!urlPath) return OG_POOL[0];
    let h = 0;
    for (let i = 0; i < urlPath.length; i++) {
        h = ((h << 5) - h + urlPath.charCodeAt(i)) | 0;
    }
    return OG_POOL[Math.abs(h) % OG_POOL.length];
}
```

- [ ] **Step 2: Verify tsc**

Run: `pnpm -C apps/website exec tsc --noEmit`
Expected: no new TS errors (baseline is 50 pre-existing — count should be unchanged).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/ogRotation.ts
git commit -m "feat(seo): deterministic per-URL OG image rotation helper

Picks from whispers / first-contact / on-the-horizon JPGs based on
djb2-style hash of the URL path. Pages share the same OG image on
repeat shares but differ across URLs, so the generic template hero
stops being the only unfurl users see.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 2: Enrich `seo-utils.js` with full OG + Twitter tag set

**Files:**
- Modify: `apps/website/src/utils/seo-utils.js`

- [ ] **Step 1: Replace the file**

Full contents after edit:

```js
import { pickOgImage } from '../lib/ogRotation';

const SITE_NAME = 'Maeve Vamy';

export function seoGenerateMetaTags(page, site) {
    let pageMetaTags = {};

    if (site.defaultMetaTags?.length) {
        site.defaultMetaTags.forEach((metaTag) => {
            pageMetaTags[metaTag.property] = metaTag.content;
        });
    }

    const seoTitle = seoGenerateTitle(page, site);
    const metaDescription = seoGenerateMetaDescription(page, site);
    const ogImage = seoGenerateOgImage(page, site);
    const ogUrl = seoGenerateOgUrl(page, site);
    const ogType = page.__metadata?.modelName === 'PostLayout' ? 'article' : 'website';
    const ogImageAlt = seoGenerateOgImageAlt(page);

    pageMetaTags = {
        ...pageMetaTags,
        ...(seoTitle && { 'og:title': seoTitle }),
        ...(metaDescription && { 'og:description': metaDescription }),
        'og:type': ogType,
        'og:site_name': SITE_NAME,
        ...(ogUrl && { 'og:url': ogUrl }),
        ...(ogImage && { 'og:image': ogImage }),
        ...(ogImage && { 'og:image:alt': ogImageAlt }),
        ...(ogImage && { 'og:image:width': '1200' }),
        ...(ogImage && { 'og:image:height': '630' }),
        'twitter:card': 'summary_large_image',
        ...(seoTitle && { 'twitter:title': seoTitle }),
        ...(metaDescription && { 'twitter:description': metaDescription }),
        ...(ogImage && { 'twitter:image': ogImage }),
    };

    if (page.seo?.metaTags?.length) {
        page.seo?.metaTags.forEach((metaTag) => {
            pageMetaTags[metaTag.property] = metaTag.content;
        });
    }

    let metaTags = [];
    Object.keys(pageMetaTags).forEach((key) => {
        if (pageMetaTags[key] !== null && pageMetaTags[key] !== undefined) {
            metaTags.push({
                property: key,
                content: pageMetaTags[key],
                format: key.startsWith('og') ? 'property' : 'name'
            });
        }
    });

    return metaTags;
}

export function seoGenerateTitle(page, site) {
    let title = page.seo?.metaTitle ? page.seo?.metaTitle : page.title;
    if (site.titleSuffix && page.seo?.addTitleSuffix !== false) {
        title = `${title} - ${site.titleSuffix}`;
    }
    return title;
}

export function seoGenerateMetaDescription(page, site) {
    let metaDescription = null;
    // Gallery posts use the excerpt as the default meta description
    if (page.__metadata?.modelName === 'PostLayout') {
        metaDescription = page.excerpt;
    }
    // page metaDescription field overrides all others
    if (page.seo?.metaDescription) {
        metaDescription = page.seo?.metaDescription;
    }
    return metaDescription;
}

export function seoGenerateOgImage(page, site) {
    let ogImage = null;

    // 1. Gallery posts use the featuredImage as the default og:image
    if (page.__metadata?.modelName === 'PostLayout' && page.featuredImage?.url) {
        ogImage = page.featuredImage.url;
    }

    // 2. Non-PostLayout pages without explicit socialImage get a per-URL rotated artwork
    if (!ogImage) {
        const urlPath = page.__metadata?.urlPath;
        if (urlPath) {
            ogImage = pickOgImage(urlPath);
        }
    }

    // 3. Fall back to site default (final safety net)
    if (!ogImage && site.defaultSocialImage) {
        ogImage = site.defaultSocialImage;
    }

    // 4. page socialImage field overrides all others
    if (page.seo?.socialImage) {
        ogImage = page.seo.socialImage;
    }

    // Resolve to absolute URL when Netlify provides the domain
    const domainUrl = site.env?.URL ? site.env.URL : null;
    if (ogImage && domainUrl) {
        return domainUrl + ogImage;
    }
    return ogImage;
}

function seoGenerateOgUrl(page, site) {
    const domainUrl = site.env?.URL ? site.env.URL : null;
    const urlPath = page.__metadata?.urlPath;
    if (!domainUrl || !urlPath) return null;
    return domainUrl + urlPath;
}

function seoGenerateOgImageAlt(page) {
    if (page.__metadata?.modelName === 'PostLayout' && page.featuredImage?.altText) {
        return page.featuredImage.altText;
    }
    return 'Fine art by Maeve Vamy';
}
```

Precedence change from before: `seo.socialImage` now wins last (was already last). featuredImage comes before defaultSocialImage. Rotation inserted between featuredImage and defaultSocialImage.

- [ ] **Step 2: Typecheck**

Run: `pnpm -C apps/website exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Build and inspect HTML head**

```bash
pnpm turbo build --filter=@vamy/website
head -200 apps/website/.next/server/pages/index.html | grep -E '<meta (property|name)='
```

Expected: `<meta property="og:title">`, `og:description`, `og:type="website"`, `og:site_name="Maeve Vamy"`, `og:image` pointing at one of the three artwork JPGs, `og:image:alt`, `og:image:width="1200"`, `og:image:height="630"`, `twitter:card="summary_large_image"`, `twitter:title`, `twitter:description`, `twitter:image`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/utils/seo-utils.js
git commit -m "feat(seo): full OG + Twitter card tag set, rotation fallback

seoGenerateMetaTags now emits og:description, og:type, og:site_name,
og:url, og:image:alt/width/height, plus the Twitter summary_large_image
card. seoGenerateOgImage consults pickOgImage() for non-artwork pages
with no explicit socialImage so /, /about, /gallery, /get-a-piece,
/terms, /privacy each unfurl with a different Maeve Vamy artwork
instead of the generic template hero.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Site-level titleSuffix branding

**Files:**
- Modify: `apps/website/content/data/site.json`

- [ ] **Step 1: Edit**

Change `"titleSuffix": "Fine Art"` → `"titleSuffix": "Maeve Vamy"`.

After edit the file reads:

```json
{
    "favicon": "/images/favicon.svg",
    "footer": "content/data/footer.json",
    "titleSuffix": "Maeve Vamy",
    "defaultSocialImage": "/images/main-hero.jpg",
    "type": "Config",
    "header": "content/data/header.json"
}
```

- [ ] **Step 2: Build and verify**

```bash
pnpm turbo build --filter=@vamy/website
grep '<title>' apps/website/.next/server/pages/gallery.html
```

Expected: `<title>Gallery - Maeve Vamy</title>` (no longer "Gallery - Fine Art").

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/data/site.json
git commit -m "fix(seo): brand titleSuffix as 'Maeve Vamy'

Pages unfurl as '<page> - Maeve Vamy' instead of '<page> - Fine Art'.
Addresses the generic-unfurl complaint on the root URL and every
other Seo.addTitleSuffix: true page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Homepage hero fallback, badge, and card copy

**Files:**
- Modify: `apps/website/content/pages/index.md`

- [ ] **Step 1: Edit the homepage frontmatter and card body**

Three changes in `index.md`:

(a) Line 32 — hero `media.url`:

```diff
-      url: /images/gray-painting-placeholder-no-frame-hang-square-vamy.png
+      url: /images/whispers.jpg
```

(b) Line 37 — hero `badge.label`:

```diff
-      label: Original oil paintings
+      label: Original fine art
```

(c) Line 65 — first "The Work" card body (Oil / On Canvas):

```diff
-          Oil painting doesn't apologize for its mess, or its refusal
+          Fine art doesn't apologize for its mess, or its refusal
```

(d) Line 210 — remove the explicit `seo.socialImage` line so rotation applies:

```diff
-  socialImage: /images/main-hero.jpg
```

After (d) the `seo` block reads:

```yaml
seo:
  metaTitle: Vamy - Fine Arts
  metaDescription: Welcome to the world of Maeve Vamy
  type: Seo
  addTitleSuffix: false
```

- [ ] **Step 2: Also update metaTitle and metaDescription while we're here**

The current metaTitle `Vamy - Fine Arts` still says "Fine Arts" and the description is weak. Update:

```diff
-  metaTitle: Vamy - Fine Arts
-  metaDescription: Welcome to the world of Maeve Vamy
+  metaTitle: Maeve Vamy — Original Fine Art
+  metaDescription: Original fine art by Maeve Vamy. Muted seascapes, abstract figurations, and surreal studies in oil on canvas from her studio in Stara Zagora, Bulgaria.
```

- [ ] **Step 3: Build and inspect root unfurl metadata**

```bash
pnpm turbo build --filter=@vamy/website
grep -E 'og:title|og:description|og:image[^:]' apps/website/.next/server/pages/index.html
```

Expected:
- `og:title` → `Maeve Vamy — Original Fine Art`
- `og:description` → the new sentence
- `og:image` → `/images/whispers.jpg` (from rotation; root's hash will land on one of the three — if not whispers, any artwork is acceptable)

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/pages/index.md
git commit -m "fix(home): real artwork hero fallback, fine art tagline, sharper SEO

Cold-DB builds now fall back to whispers.jpg instead of the gray
painting placeholder. Hero badge reads 'Original fine art' so the
homepage tagline matches the same copy used in /gallery meta. The
explicit socialImage override is removed so the new per-URL OG
rotation picks an artwork. metaTitle + metaDescription upgraded from
'Welcome to the world of...' to a real positioning sentence.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Gallery index metadata

**Files:**
- Modify: `apps/website/content/pages/gallery/index.md`

- [ ] **Step 1: Edit frontmatter**

Two changes at lines 12–13:

```diff
-  metaDescription: 'Original oil paintings by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.'
-  socialImage: /images/img-placeholder.svg
+  metaDescription: 'Original fine art by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.'
```

(Delete the `socialImage` line entirely. That pointed at a gray SVG placeholder, so `/gallery` was unfurling as a gray rectangle. Removing the line lets the rotation helper pick a real artwork.)

After edit the `seo` block reads:

```yaml
seo:
  metaTitle: Gallery - Maeve Vamy
  metaDescription: 'Original fine art by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.'
  type: Seo
```

- [ ] **Step 2: Build and verify**

```bash
pnpm turbo build --filter=@vamy/website
grep -E 'og:image[^:]|og:description' apps/website/.next/server/pages/gallery.html
```

Expected: `og:image` is one of the three artwork JPGs (not `img-placeholder.svg`), description contains `"Original fine art"`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/pages/gallery/index.md
git commit -m "fix(gallery): fine art tagline and remove placeholder socialImage

Removes the /images/img-placeholder.svg socialImage override that
made the /gallery unfurl render as a gray SVG rectangle. Rotation
now picks a real artwork. Copy aligned with home tagline.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: Terms page — repair template metadata and placeholder email

**Files:**
- Modify: `apps/website/content/pages/terms.md`

- [ ] **Step 1: Edit the `seo` block (lines 252–258)**

```diff
 seo:
   type: Seo
-  metaTitle: Landing Page
-  metaDescription: Write here your new page's description including most relevant keywords.
-  addTitleSuffix: true
-  socialImage: /images/main-hero.jpg
+  metaTitle: Terms & Conditions — Maeve Vamy
+  metaDescription: Terms of sale, shipping, returns, and EU consumer rights for Мейв Вами ЕООД.
+  addTitleSuffix: false
   metaTags: []
```

- [ ] **Step 2: Remove the `media` block and the `WE HAVE SOME TERMS` badge (lines 238–244)**

Find and delete this whole block:

```yaml
    media:
      type: ImageBlock
      altText: Dope design preview
    badge:
      type: Badge
      label: WE HAVE SOME TERMS
      color: text-primary
```

After removal the section's trailing keys go from `actions: [] … media … badge … colors … styles` to `actions: [] … colors … styles` — verify `colors: bg-light-fg-dark` and the `styles:` block still sit directly after `actions: []`.

- [ ] **Step 3: Fix the placeholder email in the body (line 218)**

```diff
-      **Email:** swoosh\@vamy.art
+      **Email:** maeve@vamy.art
```

- [ ] **Step 4: Build and verify**

```bash
pnpm turbo build --filter=@vamy/website
grep -E 'og:title|og:description|<title>' apps/website/.next/server/pages/terms.html
grep -iE 'landing page|write here|dope design|we have some terms|swoosh@vamy' apps/website/.next/server/pages/terms.html || echo "clean"
```

Expected:
- `<title>Terms & Conditions — Maeve Vamy</title>`
- `og:description` → terms sentence
- Second grep prints `clean`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/pages/terms.md
git commit -m "fix(terms): real metadata, remove template cruft, fix email

Replaces 'Landing Page' title and 'Write here your new page's
description' placeholder with real terms metadata. Drops the stray
'Dope design preview' media block and the 'WE HAVE SOME TERMS' badge
that were Stackbit scaffolding. Contact email in body changed from
placeholder swoosh@vamy.art to maeve@vamy.art.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: About page — OG tags and fine-artist copy

**Files:**
- Modify: `apps/website/src/pages/about.tsx`

- [ ] **Step 1: Replace the `<Head>` block (lines 8–11) and body text (line 25)**

New `<Head>`:

```tsx
<Head>
    <title>About — Maeve Vamy</title>
    <meta name="description" content="Bulgarian fine artist working between realism and abstraction, painting from her studio in Stara Zagora." />
    <meta property="og:title" content="About — Maeve Vamy" />
    <meta property="og:description" content="Bulgarian fine artist working between realism and abstraction, painting from her studio in Stara Zagora." />
    <meta property="og:image" content="/images/on-the-horizon.jpg" />
    <meta property="og:image:alt" content="On the Horizon — oil painting by Maeve Vamy" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:type" content="profile" />
    <meta property="og:site_name" content="Maeve Vamy" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="About — Maeve Vamy" />
    <meta name="twitter:description" content="Bulgarian fine artist working between realism and abstraction, painting from her studio in Stara Zagora." />
    <meta name="twitter:image" content="/images/on-the-horizon.jpg" />
</Head>
```

Body paragraph (line 25–28 original):

```diff
-                                        Maeve Vamy is a Bulgarian oil painter. She works between realism and
+                                        Maeve Vamy is a Bulgarian fine artist. She works between realism and
                                         abstraction, painting from direct observation in her studio in Stara
                                         Zagora.
```

- [ ] **Step 2: Typecheck and build**

Run: `pnpm -C apps/website exec tsc --noEmit`
Expected: no new errors.

Run: `pnpm turbo build --filter=@vamy/website`
Expected: success.

- [ ] **Step 3: Inspect `/about` HTML head**

```bash
grep -E 'og:image|og:description|twitter:card|twitter:image' apps/website/.next/server/pages/about.html
```

Expected: all five tags present, image points at `/images/on-the-horizon.jpg`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/about.tsx
git commit -m "fix(about): OG + Twitter card tags, fine artist copy

about.tsx is hardcoded JSX so it bypasses the markdown-driven
seo-utils pipeline. Hand-rolled OG/Twitter tags match the global
output (description, image, site_name, twitter:card). Bio copy
updated from 'Bulgarian oil painter' to 'Bulgarian fine artist' for
tagline consistency.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: Rename `first Contact_5807.jpg` → `first-contact.jpg`

**Files:**
- Rename: `apps/website/public/images/first Contact_5807.jpg` → `apps/website/public/images/first-contact.jpg`
- Modify: `apps/website/content/pages/gallery/first-contact.md`

- [ ] **Step 1: Confirm no other references**

```bash
grep -rln 'first Contact_5807\|first-Contact_5807' apps/website --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json'
```

Expected: only `apps/website/content/pages/gallery/first-contact.md`. If any other file shows up, halt and update this plan step.

- [ ] **Step 2: Rename the image with git**

```bash
git mv "apps/website/public/images/first Contact_5807.jpg" apps/website/public/images/first-contact.jpg
```

- [ ] **Step 3: Edit `first-contact.md` frontmatter**

Lines 10–11 and line 18:

```diff
 featuredImage:
-  url: /images/first Contact_5807.jpg
+  url: /images/first-contact.jpg
   altText: First Contact - Portrait of an astronaut in a helmet, oil on canvas
   type: ImageBlock
 isFeatured: false
 seo:
   metaTitle: First Contact
   metaDescription: First Contact - A painting inspired by humanity's drive to break barriers and chase what seems out of reach.
-  socialImage: /images/first Contact_5807.jpg
+  socialImage: /images/first-contact.jpg
```

- [ ] **Step 4: Build and verify**

```bash
pnpm turbo build --filter=@vamy/website
grep 'first-contact.jpg' apps/website/.next/server/pages/gallery/first-contact.html | head -3
```

Expected: paths contain `/images/first-contact.jpg`, no spaces, no `5807`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/public/images/first-contact.jpg apps/website/content/pages/gallery/first-contact.md
git commit -m "refactor(assets): rename 'first Contact_5807.jpg' to first-contact.jpg

Space in filename breaks raw URL shares without percent-encoding and
is template-slop naming. Only reference was in the artwork's markdown
frontmatter (featuredImage + socialImage) — both updated.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: Delete unused Person JSONs

**Files:**
- Delete: `apps/website/content/data/person2.json`, `person3.json`, `person4.json`, `person5.json`, `person6.json`

- [ ] **Step 1: Grep for references excluding Stackbit presets**

```bash
grep -rln 'person[2-6]\.json\|person[2-6]"' apps/website --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json' | grep -v 'sources/local/presets'
```

Expected: empty output. If anything appears, halt and reassess.

- [ ] **Step 2: Delete**

```bash
git rm apps/website/content/data/person2.json apps/website/content/data/person3.json apps/website/content/data/person4.json apps/website/content/data/person5.json apps/website/content/data/person6.json
```

- [ ] **Step 3: Verify build still succeeds**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: 13 static pages generated, no missing-content errors.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(content): remove Lorem Ipsum template Person JSONs

Only person1.json is referenced by actual pages (as the gallery
post author). person2–6 were Stackbit sample data with placeholder
names (Faizah Chan et al.) and Lorem Ipsum bios. They remain
registered in sources/local/presets as CMS-only presets, which do
not surface to the public site.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: Delete unreferenced template public images

**Files:**
- Delete: ~25 files under `apps/website/public/images/` (grep-verified individually)

- [ ] **Step 1: Run one grep per deletion group**

For each filename in the group, run:

```bash
grep -rln '<FILENAME>' apps/website --include='*.md' --include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx' --include='*.json' --include='*.toml' | grep -v 'sources/local/presets' | grep -v 'public/images/'
```

Treat a match inside `sources/local/presets/*` (Stackbit CMS) or `public/images/` itself as safe to ignore. Any other match → halt on that file, investigate before deleting.

- [ ] **Step 2: Delete Group A — ex-customer logos**

Files: `contenful-logo.svg`, `empathy-logo.svg`, `rangle-logo.svg`, `sanity-logo.svg`, `takeda-logo.svg`, `telus-logo.svg`, `vise-logo.svg`, `wellster-logo.svg`.

Expected grep result for each: empty (or CMS-presets-only).

```bash
git rm apps/website/public/images/contenful-logo.svg \
       apps/website/public/images/empathy-logo.svg \
       apps/website/public/images/rangle-logo.svg \
       apps/website/public/images/sanity-logo.svg \
       apps/website/public/images/takeda-logo.svg \
       apps/website/public/images/telus-logo.svg \
       apps/website/public/images/vise-logo.svg \
       apps/website/public/images/wellster-logo.svg
```

- [ ] **Step 3: Delete Group B — template avatars**

Files: `avatar1.svg` through `avatar6.svg`.

Grep each. Expected: empty (or CMS-presets-only). `person1.json` already uses a real photo or another asset — verify before deleting by reading the file:

```bash
grep -A2 image apps/website/content/data/person1.json
```

If `person1.json` references `avatar1.svg`, skip `avatar1.svg` and keep only `avatar2-6.svg` in the delete list.

```bash
git rm apps/website/public/images/avatar1.svg \
       apps/website/public/images/avatar2.svg \
       apps/website/public/images/avatar3.svg \
       apps/website/public/images/avatar4.svg \
       apps/website/public/images/avatar5.svg \
       apps/website/public/images/avatar6.svg
```

(Adjust the list based on the `person1.json` check above.)

- [ ] **Step 4: Delete Group C — template abstract / hero / icon SVGs**

Files: `abstract-background.svg`, `abstract-feature1.svg`, `abstract-feature2.svg`, `abstract-feature3.svg`, `background-grid.svg`, `hero.svg`, `hero2.svg`, `hero3.svg`, `main-hero.svg`.

**Do not delete** `main-hero.jpg` (it's the `defaultSocialImage` floor).

**Check `icon1.svg–icon4.svg` separately** — `content/pages/index.md` references `icon1.svg–icon4.svg` on the "The Work" cards (lines 86, 98, 123, 144 of `index.md`). These stay.

Grep each deletable one. Expected: empty.

```bash
git rm apps/website/public/images/abstract-background.svg \
       apps/website/public/images/abstract-feature1.svg \
       apps/website/public/images/abstract-feature2.svg \
       apps/website/public/images/abstract-feature3.svg \
       apps/website/public/images/background-grid.svg \
       apps/website/public/images/hero.svg \
       apps/website/public/images/hero2.svg \
       apps/website/public/images/hero3.svg \
       apps/website/public/images/main-hero.svg
```

- [ ] **Step 5: Delete Group D — stale brand + placeholder assets**

Files: `logo-white.svg`, `logo-dark.svg`, `favicon-default.svg`, `person-placeholder-light.png`, `placeholder-video.mp4`, `about-placeholder.jpg`.

Grep each. Expected: empty.

```bash
git rm apps/website/public/images/logo-white.svg \
       apps/website/public/images/logo-dark.svg \
       apps/website/public/images/favicon-default.svg \
       apps/website/public/images/person-placeholder-light.png \
       apps/website/public/images/placeholder-video.mp4 \
       apps/website/public/images/about-placeholder.jpg
```

- [ ] **Step 6: Delete Group E — AI-gen orphans**

Files: the four `AI_Generated_Image_2025-05-26_*.jpg`.

Grep each. Expected: empty.

```bash
git rm "apps/website/public/images/AI_Generated_Image_2025-05-26_485955970004201.jpg" \
       "apps/website/public/images/AI_Generated_Image_2025-05-26_485956076019201.jpg" \
       "apps/website/public/images/AI_Generated_Image_2025-05-26_485956135016201.jpg" \
       "apps/website/public/images/AI_Generated_Image_2025-05-26_485956121003201.jpg"
```

- [ ] **Step 7: Delete Group F — gray painting placeholders**

Files: `gray-painting-placeholder-vamy.png`, `gray-painting-placeholder-no-frame-hang-2-vamy.png`, `gray-painting-placeholder-frame-hang-vamy.png`, `gray-painting-placeholder-no-frame-hang-square-vamy.png`, `gray-painting-placeholder-square-frame-vamy.png`, `gray-painting-placeholder-no-frame-hang-vertical-vamy.png`.

Grep each. After Task 4, no `.md`/`.tsx` should reference any of these. If a reference appears in `content/` or `src/`, halt.

```bash
git rm apps/website/public/images/gray-painting-placeholder-vamy.png \
       apps/website/public/images/gray-painting-placeholder-no-frame-hang-2-vamy.png \
       apps/website/public/images/gray-painting-placeholder-frame-hang-vamy.png \
       apps/website/public/images/gray-painting-placeholder-no-frame-hang-square-vamy.png \
       apps/website/public/images/gray-painting-placeholder-square-frame-vamy.png \
       apps/website/public/images/gray-painting-placeholder-no-frame-hang-vertical-vamy.png
```

- [ ] **Step 8: Build once across all deletions**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: success, 13 static pages.

- [ ] **Step 9: Commit all six groups as one**

```bash
git commit -m "chore(assets): delete ~25 unreferenced template public images

Ex-customer logos (contenful, rangle, takeda, sanity, telus, vise,
wellster, empathy), template avatars, abstract/hero SVGs, stale brand
variants (logo-white/logo-dark/favicon-default), Lorem Ipsum
placeholder images, the AI_Generated_Image orphans, and the
gray-painting placeholders (now unused after home hero fallback swap).
Each file grep-verified to have zero references outside Stackbit
CMS presets.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: Final verification

**Files:**
- No changes — verification only.

- [ ] **Step 1: Clean build**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: success, 13 static pages generated.

- [ ] **Step 2: Typecheck**

```bash
pnpm -C apps/website exec tsc --noEmit 2>&1 | grep -c 'error TS'
```

Expected: `50` (unchanged pre-existing baseline, zero new regressions).

- [ ] **Step 3: Per-page OG smoke test**

```bash
for page in index gallery about get-a-piece terms privacy; do
  echo "=== /$page ==="
  grep -oE '<meta (property|name)="(og|twitter):[^"]+" content="[^"]+"' \
    "apps/website/.next/server/pages/${page}.html" | head -15
done
```

Expected per page:
- All six pages print at minimum `og:title`, `og:description`, `og:type`, `og:site_name`, `og:image`, `og:image:alt`, `og:image:width`, `og:image:height`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`.
- `og:image` values differ across at least three of the six pages (rotation is working).
- No `og:image` contains `main-hero.jpg` from `/` (that page no longer has the explicit `socialImage` override).

- [ ] **Step 4: Template-cruft smoke test**

```bash
grep -rE 'Landing Page|Write here your new page|Dope design preview|WE HAVE SOME TERMS|swoosh@vamy\.art|Lorem Ipsum|Faizah Chan|Original oil paintings' apps/website/.next/server/pages/ apps/website/content/ || echo "clean"
```

Expected: `clean`.

- [ ] **Step 5: Image asset count sanity check**

```bash
ls apps/website/public/images | wc -l
```

Expected: roughly 25–30 fewer files than before (was ~60 at start).

- [ ] **Step 6: Push and confirm Netlify preview**

```bash
git push
```

Wait for Netlify to build the preview URL on PR #3. Once up:

- Paste preview URL root `/` into a Slack DM (test channel / yourself). Confirm unfurl shows an artwork, not pills.
- Repeat for `/terms` and `/about`.
- Confirm card title, description, and image all render as expected.

No commit for this task — pure verification.

---

## Self-Review Summary

**Spec coverage:** Every spec section maps to at least one task.

| Spec section | Task |
|---|---|
| 1. Site-level metadata | Task 3 |
| 2. OG/Twitter enrichment | Task 2 |
| 3. Deterministic rotation | Task 1 + wired in Task 2 |
| 4. Root page | Task 4 |
| 5. Gallery index | Task 5 |
| 6. Terms page | Task 6 |
| 7. About page | Task 7 |
| 8. Copy sweep | Part of Tasks 4 + 7 |
| 9. File rename | Task 8 |
| 10. Deletions | Tasks 9 + 10 |
| Testing | Task 11 |

**Plus two spec-adjacent fixes found during planning:**
- `index.md` metaTitle + metaDescription upgrade (Task 4 Step 2).
- `gallery/index.md` had `socialImage: /images/img-placeholder.svg` (gray SVG) — removed in Task 5.

**Placeholder scan:** No TBDs, no "add error handling", no "similar to Task N". All code blocks concrete.

**Type consistency:** `pickOgImage` signature and call match between Task 1 and Task 2. `OG_POOL` values match the artwork filenames used elsewhere (`whispers.jpg`, `first-contact.jpg` after rename, `on-the-horizon.jpg`). `first-contact.jpg` rename (Task 8) must land before any build that relies on the new name — OG_POOL will resolve regardless (the file path is fine either way), but the content reference in `gallery/first-contact.md` must match on-disk. Task ordering works: rotation helper ships in Task 1, the artwork file gets renamed in Task 8, and the `first-contact.md` frontmatter is updated in the same Task 8 commit.

---

**Plan saved to `docs/plans/2026-04-20-link-preview-and-template-cleanup-plan.md`.**
