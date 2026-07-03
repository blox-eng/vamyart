# CDN Image Cache + LCP Preload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the first paint of gallery images fast by caching Storage objects for a year and preloading/prioritizing the above-the-fold image.

**Architecture:** Two independent fixes. (1) Uploads set `Cache-Control: max-age=31536000` so the Netlify Image CDN stops re-fetching + re-transforming 12 MB originals hourly; a one-time script backfills existing objects. (2) The above-the-fold image on the homepage and gallery-detail pages gets `loading=eager` + `fetchpriority=high` and a matching `<link rel=preload as=image>`, built from a single helper so the preload `imagesrcset`/`imagesizes` match the rendered `<img>` exactly (no double-download).

**Tech Stack:** Next.js 15 (Pages Router), React 19, Netlify Image CDN (`/.netlify/images`), Supabase Storage (`@supabase/supabase-js`), Vitest (node env).

## Global Constraints

- Design doc: `docs/plans/2026-07-03-cdn-image-cache-design.md` (source of truth).
- Cache header value is exactly `31536000` (one year, seconds). supabase-js emits `max-age=31536000`; the literal `immutable` token is NOT achievable via its `cacheControl` option and is not required.
- Safety invariant: long caching is safe ONLY because Storage keys are content-addressed UUIDs never overwritten by users (`createUploadUrl` mints a fresh `crypto.randomUUID()`; uploads use `upsert:false`). The backfill script's in-place `upsert:true` is the one controlled exception.
- Preload `imagesrcset`/`imagesizes` MUST equal the rendered `<img>`'s `srcSet`/`sizes` for the same URL, or the browser double-downloads. Always build both from the shared helper.
- Vitest runs in `environment: "node"` — no jsdom/RTL. Only pure functions get unit tests. Component/upload changes are verified by build + `curl`/Lighthouse.
- Image optimization is production-only: `netlifyImage`/`netlifyImageSrcSet` no-op unless `NODE_ENV=production && !stackbitPreview`. The preload helper mirrors this (returns `null` off-production).
- Deferred (do NOT build): pre-warming transforms; source resize to a web-master. Record both as TODOs in Task 8.
- Work happens on branch `perf/cdn-cache-images`.

---

### Task 1: `buildHeroPreload` helper (TDD)

The one automated test in this plan. Guards the double-download invariant.

**Files:**
- Modify: `apps/website/src/utils/netlify-image.ts` (append helper after `netlifyImageSrcSet`)
- Test: `apps/website/src/utils/netlify-image.test.ts` (append a `describe` block; extend the import)

**Interfaces:**
- Consumes: `netlifyImage`, `netlifyImageSrcSet`, `DEFAULT_WIDTHS` (existing, same file).
- Produces: `buildHeroPreload(src: string, opts: { sizes: string; widths?: number[] }): HeroPreload | null` where `type HeroPreload = { href: string; imageSrcSet: string; imageSizes: string }`. Consumed by Tasks 3 and 4.

- [ ] **Step 1: Write the failing tests**

Append to `apps/website/src/utils/netlify-image.test.ts`. First extend the existing import line to include `buildHeroPreload`:

```ts
import { buildHeroPreload, buildNetlifyImageUrl, netlifyImage, netlifyImageSrcSet } from "./netlify-image";
```

Then append this block at the end of the file:

```ts
describe("buildHeroPreload", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("imageSrcSet matches netlifyImageSrcSet exactly (guards double-download)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    const src = "https://x.co/a.jpg";
    const pre = buildHeroPreload(src, { sizes: "100vw" });
    expect(pre).not.toBeNull();
    expect(pre!.imageSrcSet).toBe(netlifyImageSrcSet(src));
    expect(pre!.href).toBe(netlifyImage(src, { width: 1600 }));
    expect(pre!.imageSizes).toBe("100vw");
  });

  it("returns null outside production (mirrors the optimization gate)", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(buildHeroPreload("https://x.co/a.jpg", { sizes: "100vw" })).toBeNull();
  });

  it("returns null for a non-transformable src even in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(buildHeroPreload("/logo.svg", { sizes: "100vw" })).toBeNull();
  });

  it("respects custom widths for both srcset and href", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    const src = "/a.jpg";
    const pre = buildHeroPreload(src, { sizes: "50vw", widths: [400, 800] });
    expect(pre!.imageSrcSet).toBe(netlifyImageSrcSet(src, [400, 800]));
    expect(pre!.href).toBe(netlifyImage(src, { width: 800 }));
    expect(pre!.imageSizes).toBe("50vw");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/website && pnpm test -- netlify-image`
Expected: FAIL — `buildHeroPreload is not a function` (or an import/type error).

- [ ] **Step 3: Implement the helper**

Append to `apps/website/src/utils/netlify-image.ts` (after `netlifyImageSrcSet`):

```ts
export type HeroPreload = {
    href: string;
    imageSrcSet: string;
    imageSizes: string;
};

// Builds the <link rel="preload" as="image"> attributes for an above-the-fold
// image. imageSrcSet/imageSizes MUST match the rendered <img>'s srcSet/sizes for
// the same URL, or the browser fetches a second candidate. Returns null when
// there is nothing cacheable to preload (dev/preview, or a non-transformable
// src) — mirroring the production gate in netlifyImage/netlifyImageSrcSet.
export function buildHeroPreload(
    src: string,
    opts: { sizes: string; widths?: number[] }
): HeroPreload | null {
    const widths = opts.widths ?? DEFAULT_WIDTHS;
    const imageSrcSet = netlifyImageSrcSet(src, widths);
    if (!imageSrcSet) return null;
    return {
        href: netlifyImage(src, { width: widths[widths.length - 1] }),
        imageSrcSet,
        imageSizes: opts.sizes,
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/website && pnpm test -- netlify-image`
Expected: PASS (all existing + 4 new tests).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/utils/netlify-image.ts apps/website/src/utils/netlify-image.test.ts
git commit -m "feat(website): buildHeroPreload helper for LCP image preload"
```

---

### Task 2: `priority` prop on `ImageBlock`

The homepage hero renders through `ImageBlock` (plain `<img>`, no priority). Add an opt-in.

**Files:**
- Modify: `apps/website/src/components/blocks/ImageBlock/index.tsx`

**Interfaces:**
- Produces: `ImageBlock` accepts a boolean `priority` prop. `priority` → `loading="eager"` + `fetchPriority="high"`. When `priority` is false/absent, behavior is unchanged (uses the existing `loading` prop, no `fetchPriority`). Consumed by Task 3 (homepage sets `media.priority = true`).

- [ ] **Step 1: Add the `priority` prop to the destructure**

In `ImageBlock`, change the props destructure line:

```tsx
const { elementId, className, imageClassName, url, altText = '', sizes = '100vw', loading, styles = {} } = props;
```

to:

```tsx
const { elementId, className, imageClassName, url, altText = '', sizes = '100vw', loading, priority = false, styles = {} } = props;
```

- [ ] **Step 2: Apply priority to the `<img>`**

Change the `<img>`'s `loading` attribute and add `fetchPriority`:

```tsx
            <img
                id={elementId}
                className={imgClassName}
                src={optimizedUrl}
                srcSet={srcSet}
                sizes={srcSet ? sizes : undefined}
                alt={altText}
                loading={priority ? 'eager' : loading}
                fetchPriority={priority ? 'high' : undefined}
            />
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd apps/website && pnpm build`
Expected: build succeeds (no TypeScript/JSX errors). Existing images unaffected because `priority` defaults to `false`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/blocks/ImageBlock/index.tsx
git commit -m "feat(website): ImageBlock priority prop (eager + fetchpriority=high)"
```

---

### Task 3: Homepage hero — priority + preload

Wire the already-known featured-artwork URL into `priority` and a preload link. Set the flag where the URL is already injected — don't make components sniff their index.

**Files:**
- Modify: `apps/website/src/pages/[[...slug]].js` (getStaticProps homepage block + `Page` `<Head>`)

**Interfaces:**
- Consumes: `buildHeroPreload` (Task 1), `ImageBlock` `priority` prop (Task 2).

- [ ] **Step 1: In getStaticProps, mark the hero media priority + expose preload data**

In the `if (urlPath === '/')` block, inside `if (heroSection?.media)`, after the two existing assignments, add two lines:

```js
                if (heroSection?.media) {
                    heroSection.media.url = featured.primaryImage.url;
                    heroSection.media.altText = featured.primaryImage.altText || `${featured.title} by Maeve Vamy`;
                    heroSection.media.priority = true;
                    props.page.heroPreload = { url: featured.primaryImage.url, sizes: heroSection.media.sizes ?? '100vw' };
                }
```

- [ ] **Step 2: Import the helper**

Add to the imports at the top of `apps/website/src/pages/[[...slug]].js`:

```js
import { buildHeroPreload } from '../utils/netlify-image';
```

- [ ] **Step 3: Render the preload link in `Page`'s `<Head>`**

In the `Page` component, compute the preload just before `return (`:

```js
    const heroPreload = page.heroPreload ? buildHeroPreload(page.heroPreload.url, { sizes: page.heroPreload.sizes }) : null;
```

Then inside `<Head>`, after the `<meta name="viewport" ... />` line, add:

```jsx
                {heroPreload && (
                    <link
                        rel="preload"
                        as="image"
                        href={heroPreload.href}
                        imageSrcSet={heroPreload.imageSrcSet}
                        imageSizes={heroPreload.imageSizes}
                        fetchPriority="high"
                    />
                )}
```

- [ ] **Step 4: Verify the build and the emitted HTML**

Run: `cd apps/website && pnpm build && pnpm start &` then `sleep 3 && curl -s http://localhost:3000/ | grep -i 'rel="preload"'`
Expected: one `<link rel="preload" as="image" ... imagesrcset="/.netlify/images?...">` line for the featured artwork. Stop the server afterward (`kill %1`).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/[[...slug]].js
git commit -m "feat(website): preload + prioritize homepage hero image"
```

---

### Task 4: Gallery-detail hero — preload link

`PostLayout` already renders the detail hero with `loading="eager" fetchPriority="high"` (lines 42-51), so only the preload link is missing. Its `LazyImage` uses `sizes="(min-width: 1024px) 50vw, 100vw"` and default widths — the preload must match.

**Files:**
- Modify: `apps/website/src/pages/gallery/[slug].js` (`Page` `<Head>`)

**Interfaces:**
- Consumes: `buildHeroPreload` (Task 1).

- [ ] **Step 1: Import the helper**

Add to the imports at the top of `apps/website/src/pages/gallery/[slug].js`:

```js
import { buildHeroPreload } from '../../utils/netlify-image';
```

- [ ] **Step 2: Compute the preload in `Page`**

Just before `return (` in the `Page` component:

```js
  const heroPreload = page.featuredImage?.url
    ? buildHeroPreload(page.featuredImage.url, { sizes: '(min-width: 1024px) 50vw, 100vw' })
    : null;
```

- [ ] **Step 3: Render the link in `<Head>`**

Inside `<Head>`, after the `<meta name="viewport" ... />` line, add:

```jsx
        {heroPreload && (
          <link
            rel="preload"
            as="image"
            href={heroPreload.href}
            imageSrcSet={heroPreload.imageSrcSet}
            imageSizes={heroPreload.imageSizes}
            fetchPriority="high"
          />
        )}
```

- [ ] **Step 4: Verify the emitted HTML**

Run (reuse a running `pnpm start`, or rebuild): `curl -s http://localhost:3000/gallery/<some-published-slug>/ | grep -i 'rel="preload"'`
Expected: one preload link whose `imagesizes` is `(min-width: 1024px) 50vw, 100vw` and whose `imagesrcset` points at `/.netlify/images`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/gallery/[slug].js
git commit -m "feat(website): preload gallery-detail hero image"
```

---

### Task 5: Gallery grid — first image priority

The grid LCP is the first thumbnail. Thread `priority` to `PostFeedItem` and mark index 0.

**Files:**
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`
- Modify: `apps/website/src/components/sections/PostFeedSection/index.tsx` (4 `PostFeedItem` call sites)

**Interfaces:**
- Consumes: `LazyImage` `loading`/`fetchPriority` props (existing).
- Produces: `PostFeedItem` accepts a boolean `priority` prop → the thumbnail `LazyImage` gets `loading="eager"` + `fetchPriority="high"`. Default `false` keeps lazy loading.

- [ ] **Step 1: Add `priority` to `PostFeedItem`'s props destructure**

In `PostFeedItem`, add `priority = false` to the destructured props:

```tsx
    const {
        post,
        showThumbnail,
        showExcerpt,
        showDate,
        showAuthor,
        hasSectionTitle,
        hasBigThumbnail,
        hoverEffect = 'move-up',
        sectionColors,
        hasAnnotations,
        priority = false
    } = props;
```

- [ ] **Step 2: Pass priority to the thumbnail `LazyImage`**

In the `hasThumbnail && (...)` block, add `loading`/`fetchPriority` to the `<LazyImage>`:

```tsx
                    <LazyImage
                        src={post.featuredImage.url}
                        alt={post.featuredImage.altText || post.title || ''}
                        sizes="(min-width: 640px) 33vw, 100vw"
                        loading={priority ? 'eager' : 'lazy'}
                        fetchPriority={priority ? 'high' : undefined}
                        className={classNames({
                            'xs:w-[50%] xs:shrink-0': hasBigThumbnail && (flexDirection === 'row' || flexDirection === 'row-reversed'),
                            'xs:w-[28.4%] xs:shrink-0': !hasBigThumbnail && (flexDirection === 'row' || flexDirection === 'row-reversed'),
                            'aspect-[4/5]': flexDirection === 'col' || flexDirection === 'col-reverse'
                        })}
                        imgClassName="w-full h-full object-cover"
                        {...(hasAnnotations && { 'data-sb-field-path': 'featuredImage' })}
                    />
```

- [ ] **Step 3: Pass `priority={index === 0}` at all four call sites**

In `apps/website/src/components/sections/PostFeedSection/index.tsx` there are four `posts.map((post, index) => <PostFeedItem ... />)` blocks (the layout variants). In EACH `<PostFeedItem>` element, add the prop:

```tsx
                <PostFeedItem
                    ...existing props...
                    priority={index === 0}
                />
```

Verify you covered all four: `grep -n "PostFeedItem" apps/website/src/components/sections/PostFeedSection/index.tsx` should show the import plus four JSX usages, each now with `priority={index === 0}`.

- [ ] **Step 4: Verify the build**

Run: `cd apps/website && pnpm build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx apps/website/src/components/sections/PostFeedSection/index.tsx
git commit -m "feat(website): eager-load the first gallery-grid thumbnail (LCP)"
```

---

### Task 6: Long-lived cache header on new uploads

**Files:**
- Modify: `apps/admin/app/(dashboard)/artworks/page.tsx` (the `uploadToSignedUrl` call)

**Interfaces:**
- Consumes: `@supabase/supabase-js` `uploadToSignedUrl(path, token, file, options)` — `options.cacheControl` (seconds string).

- [ ] **Step 1: Add `cacheControl` to the upload options**

Change:

```tsx
      const { error } = await supabase.storage
        .from("artwork-images")
        .uploadToSignedUrl(path, token, file, { contentType });
```

to:

```tsx
      const { error } = await supabase.storage
        .from("artwork-images")
        // One-year cache: the Netlify Image CDN inherits this, so cold transforms
        // of the source stop recurring hourly. Safe because storage keys are
        // content-addressed UUIDs (createUploadUrl mints a fresh one; upsert:false).
        .uploadToSignedUrl(path, token, file, { contentType, cacheControl: "31536000" });
```

- [ ] **Step 2: Verify the admin build compiles**

Run: `cd apps/admin && pnpm build`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/app/(dashboard)/artworks/page.tsx"
git commit -m "feat(admin): upload artwork images with 1-year Cache-Control"
```

- [ ] **Step 4: Manual verification (after this branch is deployed to the studio)**

Upload a new image in the studio, then:
`curl -s -D - -o /dev/null "https://ytgbohzmipyfrezsctbl.supabase.co/storage/v1/object/public/artwork-images/<slug>/<new-uuid>.jpg" | grep -i cache-control`
Expected: `cache-control: max-age=31536000` (was `max-age=3600`).

---

### Task 7: Backfill existing objects' cache header

Existing objects still carry `max-age=3600`. Re-upload each in place with the long header. Idempotent, `--dry-run` supported.

**Files:**
- Create: `apps/website/scripts/backfill-image-cache-control.mjs`

**Interfaces:**
- Consumes: `@supabase/supabase-js` (resolved from `apps/website/node_modules`); env `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (present in `apps/website/.env.local`).

- [ ] **Step 1: Write the script**

Create `apps/website/scripts/backfill-image-cache-control.mjs`:

```js
#!/usr/bin/env node
// One-time backfill: re-apply a long Cache-Control (max-age=31536000) to every
// object already in the artwork-images bucket. Existing objects were uploaded
// with the Supabase default (max-age=3600), which the Netlify Image CDN inherits
// — so cold transforms recur hourly. Re-uploading in place (same key, upsert:true)
// with the long cacheControl fixes it without changing any public URL.
//
// Run once, from apps/website:
//   node --env-file=.env.local scripts/backfill-image-cache-control.mjs [--dry-run]
import { createClient } from "@supabase/supabase-js";

const BUCKET = "artwork-images";
const CACHE_CONTROL = "31536000";
const DRY_RUN = process.argv.includes("--dry-run");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const supabase = createClient(url, key);

// Storage keys are `<artwork-slug>/<uuid>.<ext>`. list("") returns folders as
// entries with a null `id`; recurse one level into each folder.
async function listAllPaths() {
  const paths = [];
  const { data: roots, error } = await supabase.storage.from(BUCKET).list("", { limit: 1000 });
  if (error) throw error;
  for (const entry of roots) {
    if (entry.id === null) {
      const { data: files, error: e2 } = await supabase.storage.from(BUCKET).list(entry.name, { limit: 1000 });
      if (e2) throw e2;
      for (const f of files) if (f.id !== null) paths.push(`${entry.name}/${f.name}`);
    } else {
      paths.push(entry.name);
    }
  }
  return paths;
}

async function main() {
  const paths = await listAllPaths();
  console.log(`Found ${paths.length} object(s) in ${BUCKET}.${DRY_RUN ? " (dry run)" : ""}`);
  let updated = 0;
  for (const path of paths) {
    if (DRY_RUN) { console.log(`would update: ${path}`); continue; }
    const { data: blob, error: dErr } = await supabase.storage.from(BUCKET).download(path);
    if (dErr) { console.error(`download failed ${path}: ${dErr.message}`); continue; }
    const contentType = blob.type || "application/octet-stream";
    const buffer = Buffer.from(await blob.arrayBuffer());
    const { error: uErr } = await supabase.storage.from(BUCKET).upload(path, buffer, {
      upsert: true,
      cacheControl: CACHE_CONTROL,
      contentType,
    });
    if (uErr) { console.error(`upload failed ${path}: ${uErr.message}`); continue; }
    updated++;
    console.log(`updated: ${path} -> max-age=${CACHE_CONTROL} (${contentType})`);
  }
  console.log(`Done. ${DRY_RUN ? "(dry run, no writes)" : `${updated}/${paths.length} updated.`}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
```

- [ ] **Step 2: Dry-run to confirm it lists objects**

Run: `cd apps/website && node --env-file=.env.local scripts/backfill-image-cache-control.mjs --dry-run`
Expected: `Found N object(s)...` followed by `would update: <slug>/<uuid>.jpg` lines, and `Done. (dry run, no writes)`.

- [ ] **Step 3: Real run**

Run: `cd apps/website && node --env-file=.env.local scripts/backfill-image-cache-control.mjs`
Expected: `updated: ...` per object, ending `Done. N/N updated.`

- [ ] **Step 4: Verify the header changed on an existing object**

Run: `curl -s -D - -o /dev/null "https://ytgbohzmipyfrezsctbl.supabase.co/storage/v1/object/public/artwork-images/never/587af6a5-3a3d-4c47-98a8-0b3eb05763ee.jpg" | grep -i cache-control`
Expected: `cache-control: max-age=31536000`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/scripts/backfill-image-cache-control.mjs
git commit -m "chore(website): one-time backfill script for image Cache-Control"
```

---

### Task 8: Post-deploy verification + record deferred TODOs

**Files:**
- Modify or create: `TODOS.md` (repo root) — record the two deferred items.

- [ ] **Step 1: Record the deferred follow-ups**

Append to `TODOS.md` (create it if absent):

```markdown
## Image performance (from 2026-07-03 CDN cache work — GH vamyart#21)

- [ ] Pre-warm Netlify Image CDN transforms after upload/publish so the first
      visitor after a change never eats the one-time ~2s cold transform.
      Deferred: low traffic, infrequent uploads. Needs an admin->website warming path.
- [ ] Resize source images to a web-master (~2560px, <1 MB) at upload. Biggest
      remaining cold-transform + Netlify-transform-cost reduction. Deferred:
      web-master-only is acceptable, full-res originals not required.
```

- [ ] **Step 2: Commit**

```bash
git add TODOS.md
git commit -m "docs: record deferred image-perf follow-ups (pre-warm, source resize)"
```

- [ ] **Step 3: Post-deploy verification (after merge + Netlify deploy + backfill run)**

Run each and confirm:

1. Transform now cached a year:
   `curl -s -D - -o /dev/null -H "Accept: image/webp" "https://vamy.art/.netlify/images?url=$(python3 -c "import urllib.parse;print(urllib.parse.quote('https://ytgbohzmipyfrezsctbl.supabase.co/storage/v1/object/public/artwork-images/never/587af6a5-3a3d-4c47-98a8-0b3eb05763ee.jpg',safe=''))")&w=1600&q=75" | grep -i 'cache-control'`
   Expected: `max-age=31536000`.

2. Homepage preload present:
   `curl -s https://vamy.art/ | grep -i 'rel="preload"'`
   Expected: one `as="image"` preload for the featured artwork.

3. Gallery-detail preload present:
   `curl -s https://vamy.art/gallery/<published-slug>/ | grep -i 'rel="preload"'`
   Expected: one `as="image"` preload with `imagesizes="(min-width: 1024px) 50vw, 100vw"`.

4. LCP improved: run Lighthouse (mobile) on `/` and a gallery piece; confirm the LCP element is the hero image and LCP time dropped versus the pre-change baseline.

- [ ] **Step 4: Verify the bust-on-publish Todoist task**

In the studio, unpublish then re-publish a piece; confirm the change reflects on `vamy.art` within one revalidation cycle (existing ISR — no code in this plan). This closes the sibling Todoist task noted on GH vamyart#21.

---

## Self-Review

**Spec coverage:**
- Long-lived cache on uploads → Task 6. Backfill → Task 7. ✅
- LCP preload + priority (homepage + gallery detail) → Tasks 2, 3, 4; grid first-image → Task 5. ✅
- `buildHeroPreload` single source of truth + srcset-match test (A1) → Task 1. ✅
- No `immutable` token (A2) → Global Constraints + Task 6 value `31536000`. ✅
- Production gate mirrored (A3) → Task 1 (`buildHeroPreload` returns null off-prod) + test. ✅
- Page cache-busting already handled → Task 8 Step 4 (verify only). ✅
- Deferred pre-warm + source resize → Task 8 TODOs. ✅

**Placeholder scan:** No TBD/TODO-in-code/"add error handling" — every code step shows complete code. ✅

**Type consistency:** `buildHeroPreload(src, { sizes, widths? }) -> HeroPreload | null` defined in Task 1; consumed with matching shape in Tasks 3 and 4. `priority` boolean added to `ImageBlock` (Task 2) and `PostFeedItem` (Task 5), both defaulting `false`. `cacheControl: "31536000"` string consistent across Tasks 6 and 7. ✅
