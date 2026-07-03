# SEO Presence + Load Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sitemap, robots, canonicals, `lang`, and auto-derived JSON-LD so vamy.art is fully crawlable and rich-result eligible — driven by the studio SEO fields Maeve already fills — then a measure-gated unused-JS trim.

**Architecture:** Next.js 15 hybrid (Pages Router site + `app/` for API/metadata routes). Head tags use `next/head` via a shared generator (`utils/seo-utils.js`). Crawl files use App Router metadata routes (`app/sitemap.ts`, `app/robots.ts`). Gallery data comes from `serverTrpc` (`appRouter.createCaller`). No DB schema changes.

**Tech Stack:** Next.js 15, React 19, tRPC (`@vamy/db`), Vitest, Tailwind.

## Global Constraints

- **No DB schema changes and no new admin fields.** SEO is driven by existing `artworks.seoTitle` / `seoDescription` (+ derived from title/year/medium/dimensions/primary image).
- **Brand name is `Maeve Vamy`** (matches `seo-utils.js` `SITE_NAME` and existing heads). Artist `Person.name` in JSON-LD = `Maeve Vamy`.
- **`trailingSlash: true`** — every canonical URL must be normalized to the trailing-slash form the page is actually served at (root stays `/`).
- **Domain resolution:** prefer `site.env?.URL`, fall back to `process.env.NEXT_PUBLIC_SITE_URL`. Never emit a canonical/sitemap entry with a relative or empty host.
- **Graceful DB failure:** any build/revalidate-time `serverTrpc` call must `try/catch` and degrade (sitemap returns static routes; never throw a 500). Mirror the existing pattern in `gallery/[slug].js` `getStaticPaths`.
- **One push per PR** (protects Netlify preview credits). PR A = Tasks 1–3. PR B = Task 4 (only if it measures well).
- Vitest is the test runner (see `apps/website/src/utils/netlify-image.test.ts`). Run with `pnpm --filter @vamy/website test`.

## File Structure

- `apps/website/src/utils/seo-utils.js` — MODIFY: add `seoGenerateCanonicalUrl(page, site)` + exported `resolveSiteUrl(site)` + `normalizeTrailingSlash(path)`.
- `apps/website/src/utils/seo-utils.test.js` — CREATE: unit tests for the URL helpers.
- `apps/website/src/pages/_document.tsx` — MODIFY: `lang="en"` on `<Html>`.
- `apps/website/src/pages/[[...slug]].js` — MODIFY: emit canonical + home JSON-LD.
- `apps/website/src/pages/gallery/[slug].js` — MODIFY: map `artwork.year` into page props; emit canonical + VisualArtwork + BreadcrumbList JSON-LD.
- `apps/website/src/pages/about.tsx` — MODIFY: canonical + Person JSON-LD.
- `apps/website/src/pages/get-a-piece.tsx` — MODIFY: canonical.
- `apps/website/app/robots.ts` — CREATE.
- `apps/website/app/sitemap.ts` — CREATE.
- `apps/website/src/components/atoms/JsonLd.tsx` — CREATE.
- `apps/website/src/utils/structured-data.js` — CREATE: builders (`buildArtworkJsonLd`, `buildBreadcrumbJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd`).
- `apps/website/src/utils/structured-data.test.js` — CREATE: builder unit tests.

---

### Task 1: Canonical URLs + `lang` attribute

**Files:**
- Modify: `apps/website/src/utils/seo-utils.js`
- Create: `apps/website/src/utils/seo-utils.test.js`
- Modify: `apps/website/src/pages/_document.tsx`
- Modify: `apps/website/src/pages/[[...slug]].js`, `apps/website/src/pages/gallery/[slug].js`, `apps/website/src/pages/about.tsx`, `apps/website/src/pages/get-a-piece.tsx`

**Interfaces:**
- Produces: `resolveSiteUrl(site) -> string | null`, `normalizeTrailingSlash(path) -> string`, `seoGenerateCanonicalUrl(page, site) -> string | null` (exported from `seo-utils.js`). Task 2 reuses `resolveSiteUrl` and `normalizeTrailingSlash`.

- [ ] **Step 1: Write failing tests for the URL helpers**

Create `apps/website/src/utils/seo-utils.test.js`:

```js
import { describe, expect, it } from 'vitest';
import { normalizeTrailingSlash, resolveSiteUrl, seoGenerateCanonicalUrl } from './seo-utils';

describe('normalizeTrailingSlash', () => {
  it('keeps root as "/"', () => expect(normalizeTrailingSlash('/')).toBe('/'));
  it('adds a trailing slash', () => expect(normalizeTrailingSlash('/gallery/never')).toBe('/gallery/never/'));
  it('collapses a duplicate trailing slash', () => expect(normalizeTrailingSlash('/about//')).toBe('/about/'));
  it('leaves an already-normalized path', () => expect(normalizeTrailingSlash('/about/')).toBe('/about/'));
});

describe('resolveSiteUrl', () => {
  it('prefers site.env.URL', () => expect(resolveSiteUrl({ env: { URL: 'https://a.co' } })).toBe('https://a.co'));
  it('strips a trailing slash from the base', () => expect(resolveSiteUrl({ env: { URL: 'https://a.co/' } })).toBe('https://a.co'));
  it('returns null when no host is available', () => expect(resolveSiteUrl({})).toBe(null));
});

describe('seoGenerateCanonicalUrl', () => {
  it('joins base + normalized urlPath', () => {
    const page = { __metadata: { urlPath: '/gallery/never' } };
    expect(seoGenerateCanonicalUrl(page, { env: { URL: 'https://a.co' } })).toBe('https://a.co/gallery/never/');
  });
  it('returns null without a host', () => {
    expect(seoGenerateCanonicalUrl({ __metadata: { urlPath: '/about' } }, {})).toBe(null);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vamy/website test -- seo-utils`
Expected: FAIL — helpers not exported.

- [ ] **Step 3: Implement the helpers in `seo-utils.js`**

Add near the top (after the `SITE_NAME` const) and export:

```js
export function resolveSiteUrl(site) {
    const raw = site?.env?.URL || process.env.NEXT_PUBLIC_SITE_URL || null;
    return raw ? raw.replace(/\/+$/, '') : null;
}

export function normalizeTrailingSlash(path) {
    if (!path || path === '/') return '/';
    return '/' + path.replace(/^\/+/, '').replace(/\/+$/, '') + '/';
}

export function seoGenerateCanonicalUrl(page, site) {
    const base = resolveSiteUrl(site);
    const urlPath = page?.__metadata?.urlPath;
    if (!base || !urlPath) return null;
    return base + normalizeTrailingSlash(urlPath);
}
```

Note: `seoGenerateOgUrl` may be refactored to reuse `resolveSiteUrl`, but that is optional — do not change its output.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vamy/website test -- seo-utils`
Expected: PASS.

- [ ] **Step 5: Set `lang="en"` in `_document.tsx`**

Change `<Html className={...}>` to `<Html lang="en" className={...}>`.

- [ ] **Step 6: Emit canonical in the two generator-driven pages**

In BOTH `apps/website/src/pages/[[...slug]].js` and `apps/website/src/pages/gallery/[slug].js`:
- add `seoGenerateCanonicalUrl` to the `seo-utils` import.
- compute `const canonicalUrl = seoGenerateCanonicalUrl(page, site);` next to `title`.
- inside `<Head>`, after the `<title>`, add:

```jsx
{canonicalUrl && <link rel="canonical" href={canonicalUrl} />}
```

- [ ] **Step 7: Emit canonical in the two hand-rolled pages**

`about.tsx` and `get-a-piece.tsx` have no `page.__metadata`. Build the canonical inline from the known path. In `about.tsx` `<Head>` add:

```jsx
{(site?.env?.URL || process.env.NEXT_PUBLIC_SITE_URL) && (
  <link rel="canonical" href={`${(site?.env?.URL || process.env.NEXT_PUBLIC_SITE_URL).replace(/\/+$/, '')}/about/`} />
)}
```

In `get-a-piece.tsx` do the same with `/get-a-piece/`.

- [ ] **Step 8: Build + verify**

Run: `pnpm --filter @vamy/website build`
Expected: succeeds. In `.next/server/pages/gallery/*.html` and `about.html`, exactly one `<link rel="canonical">` with a trailing slash; `<html lang="en">` present.

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/utils/seo-utils.js apps/website/src/utils/seo-utils.test.js apps/website/src/pages/_document.tsx apps/website/src/pages/[[...slug]].js apps/website/src/pages/gallery/[slug].js apps/website/src/pages/about.tsx apps/website/src/pages/get-a-piece.tsx
git commit -m "feat(seo): canonical URLs + html lang attribute"
```

---

### Task 2: robots.txt + DB-driven sitemap.xml

**Files:**
- Modify: `packages/db/src/trpc/routers/artworks.ts` (Step 0: add `updatedAt` to `listPublic` return)
- Create: `apps/website/app/robots.ts`
- Create: `apps/website/app/sitemap.ts`

**Interfaces:**
- Consumes: `resolveSiteUrl` from Task 1 (or inline the same `NEXT_PUBLIC_SITE_URL` fallback — App Router files cannot import `page.__metadata`, so use the env var directly).
- Consumes: `serverTrpc = appRouter.createCaller({ userId: null })` and `artworks.listPublic()` (returns published pieces with `slug`; `updatedAt` is added in Step 0).

- [ ] **Step 0: Expose `updatedAt` from `listPublic` (one line)**

`packages/db/src/trpc/routers/artworks.ts` `listPublic` currently omits `updatedAt` from its mapped return. Add `updatedAt: a.updatedAt,` to the returned object (alongside `sortOrder`). Zero-risk additive field; the gallery pages that also call `listPublic` ignore it. This makes sitemap `lastModified` accurate.

- [ ] **Step 1: Create `app/robots.ts`**

```ts
import type { MetadataRoute } from 'next';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vamy.art').replace(/\/+$/, '');

export default function robots(): MetadataRoute.Robots {
    return {
        rules: { userAgent: '*', allow: '/' },
        sitemap: `${SITE_URL}/sitemap.xml`,
        host: SITE_URL,
    };
}
```

- [ ] **Step 2: Create `app/sitemap.ts` with graceful DB fallback**

```ts
import type { MetadataRoute } from 'next';
import { appRouter } from '@vamy/db/trpc';

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://vamy.art').replace(/\/+$/, '');
const serverTrpc = appRouter.createCaller({ userId: null });

export const revalidate = 3600;

const STATIC_ROUTES = ['/', '/about/', '/gallery/', '/get-a-piece/'];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const staticEntries = STATIC_ROUTES.map((path) => ({
        url: `${SITE_URL}${path}`,
        changeFrequency: 'weekly' as const,
        priority: path === '/' ? 1 : 0.7,
    }));

    let galleryEntries: MetadataRoute.Sitemap = [];
    try {
        const pieces = await serverTrpc.artworks.listPublic();
        galleryEntries = pieces.map((a: { slug: string; updatedAt?: string | Date }) => ({
            url: `${SITE_URL}/gallery/${a.slug}/`,
            lastModified: a.updatedAt ? new Date(a.updatedAt) : undefined,
            changeFrequency: 'monthly' as const,
            priority: 0.8,
        }));
    } catch {
        // DB unavailable — return static routes only rather than 500 the sitemap.
    }

    return [...staticEntries, ...galleryEntries];
}
```

`updatedAt` is provided by Step 0.

- [ ] **Step 3: Build + verify the routes render**

Run: `pnpm --filter @vamy/website build`
Then serve/inspect: the build output lists `/sitemap.xml` and `/robots.txt` as generated routes. Confirm `sitemap.xml` contains the static routes and (if DB reachable at build) gallery URLs, each with a trailing slash and absolute host.

- [ ] **Step 4: Commit**

```bash
git add apps/website/app/robots.ts apps/website/app/sitemap.ts
git commit -m "feat(seo): robots.txt + DB-driven sitemap.xml"
```

---

### Task 3: Auto-derived JSON-LD structured data

**Files:**
- Create: `apps/website/src/components/atoms/JsonLd.tsx`
- Create: `apps/website/src/utils/structured-data.js`
- Create: `apps/website/src/utils/structured-data.test.js`
- Modify: `apps/website/src/pages/gallery/[slug].js` (map `year`; emit VisualArtwork + BreadcrumbList)
- Modify: `apps/website/src/pages/[[...slug]].js` (emit WebSite + Person on home)
- Modify: `apps/website/src/pages/about.tsx` (emit Person)

**Interfaces:**
- Consumes: `resolveSiteUrl`, `seoGenerateCanonicalUrl` from Task 1.
- Produces: `buildArtworkJsonLd`, `buildBreadcrumbJsonLd`, `buildWebsiteJsonLd`, `buildPersonJsonLd` from `structured-data.js`; `<JsonLd data={...} />` component.

- [ ] **Step 1: Write failing tests for the builders**

Create `apps/website/src/utils/structured-data.test.js`:

```js
import { describe, expect, it } from 'vitest';
import {
  buildArtworkJsonLd, buildBreadcrumbJsonLd, buildPersonJsonLd, buildWebsiteJsonLd,
} from './structured-data';

const ARTIST = 'Maeve Vamy';

describe('buildArtworkJsonLd', () => {
  it('maps artwork fields to VisualArtwork', () => {
    const out = buildArtworkJsonLd({
      title: 'Never', description: 'A study.', year: 2024, medium: 'Oil on canvas',
      image: 'https://a.co/never.jpg', url: 'https://a.co/gallery/never/',
    });
    expect(out['@type']).toBe('VisualArtwork');
    expect(out.name).toBe('Never');
    expect(out.artMedium).toBe('Oil on canvas');
    expect(out.dateCreated).toBe('2024');
    expect(out.image).toBe('https://a.co/never.jpg');
    expect(out.creator).toEqual({ '@type': 'Person', name: ARTIST });
  });
  it('omits absent optional fields', () => {
    const out = buildArtworkJsonLd({ title: 'X', url: 'https://a.co/gallery/x/' });
    expect(out).not.toHaveProperty('artMedium');
    expect(out).not.toHaveProperty('dateCreated');
    expect(out).not.toHaveProperty('image');
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('builds an ordered Home > Gallery > piece trail', () => {
    const out = buildBreadcrumbJsonLd('https://a.co', [
      { name: 'Gallery', path: '/gallery/' }, { name: 'Never', path: '/gallery/never/' },
    ]);
    expect(out['@type']).toBe('BreadcrumbList');
    expect(out.itemListElement).toHaveLength(3);
    expect(out.itemListElement[0]).toMatchObject({ position: 1, name: 'Home', item: 'https://a.co/' });
    expect(out.itemListElement[2]).toMatchObject({ position: 3, name: 'Never', item: 'https://a.co/gallery/never/' });
  });
});

describe('buildWebsiteJsonLd / buildPersonJsonLd', () => {
  it('WebSite has name + url', () => {
    expect(buildWebsiteJsonLd('https://a.co')).toMatchObject({ '@type': 'WebSite', url: 'https://a.co', name: ARTIST });
  });
  it('Person includes sameAs when provided', () => {
    const out = buildPersonJsonLd('https://a.co', ['https://instagram.com/vamy']);
    expect(out['@type']).toBe('Person');
    expect(out.name).toBe(ARTIST);
    expect(out.sameAs).toEqual(['https://instagram.com/vamy']);
  });
  it('Person omits sameAs when empty', () => {
    expect(buildPersonJsonLd('https://a.co', [])).not.toHaveProperty('sameAs');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @vamy/website test -- structured-data`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `structured-data.js`**

```js
const ARTIST_NAME = 'Maeve Vamy';

export function buildArtworkJsonLd({ title, description, year, medium, image, url }) {
    return {
        '@context': 'https://schema.org',
        '@type': 'VisualArtwork',
        name: title,
        url,
        creator: { '@type': 'Person', name: ARTIST_NAME },
        ...(description ? { description } : {}),
        ...(year ? { dateCreated: String(year) } : {}),
        ...(medium ? { artMedium: medium } : {}),
        ...(image ? { image } : {}),
    };
}

export function buildBreadcrumbJsonLd(base, crumbs) {
    const items = [{ name: 'Home', path: '/' }, ...crumbs];
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: items.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: c.name,
            item: base + (c.path === '/' ? '/' : c.path),
        })),
    };
}

export function buildWebsiteJsonLd(base) {
    return { '@context': 'https://schema.org', '@type': 'WebSite', name: ARTIST_NAME, url: base };
}

export function buildPersonJsonLd(base, sameAs = []) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: ARTIST_NAME,
        url: base,
        jobTitle: 'Fine artist',
        ...(sameAs.length ? { sameAs } : {}),
    };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @vamy/website test -- structured-data`
Expected: PASS.

- [ ] **Step 5: Create the `JsonLd` component**

`apps/website/src/components/atoms/JsonLd.tsx`:

```tsx
import * as React from 'react';

export default function JsonLd({ data }: { data: object | object[] }) {
    return (
        <script
            type="application/ld+json"
            // Stable, server-serialized; not user input.
            dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
        />
    );
}
```

- [ ] **Step 6: Map `year` into gallery page props + emit artwork JSON-LD**

In `gallery/[slug].js` `getStaticProps`, add `year: artwork.year ?? null,` to the `page` object (alongside `medium`/`dimensions`).

In the `Page` component, import `JsonLd`, `buildArtworkJsonLd`, `buildBreadcrumbJsonLd`, and `resolveSiteUrl`. Compute:

```jsx
const base = resolveSiteUrl(site);
const artworkLd = buildArtworkJsonLd({
  title: page.title, description: page.excerpt, year: page.year, medium: page.medium,
  image: page.featuredImage?.url, url: canonicalUrl,
});
const breadcrumbLd = base
  ? buildBreadcrumbJsonLd(base, [{ name: 'Gallery', path: '/gallery/' }, { name: page.title, path: canonicalUrl?.replace(base, '') || '/' }])
  : null;
```

Render inside `<Head>` (after the meta tags):

```jsx
<JsonLd data={artworkLd} />
{breadcrumbLd && <JsonLd data={breadcrumbLd} />}
```

- [ ] **Step 7: Emit WebSite + Person on the homepage**

In `[[...slug]].js` `Page`, detect the home page via `page.__metadata?.urlPath === '/'`. When home and `base` is available, render `<JsonLd data={buildWebsiteJsonLd(base)} />` and `<JsonLd data={buildPersonJsonLd(base, socialLinks)} />` inside `<Head>`. Derive `socialLinks` from `site.header`/`site.footer` social entries if present, else `[]` (check `site.json` shape; default to `[]` — do not invent URLs).

- [ ] **Step 8: Emit Person on the about page**

In `about.tsx` `<Head>`, add `<JsonLd data={buildPersonJsonLd(base, [])} />` where `base = (site?.env?.URL || process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '')` (guard on non-empty).

- [ ] **Step 9: Build + validate**

Run: `pnpm --filter @vamy/website build`
Expected: succeeds. In built HTML: gallery pages carry a `VisualArtwork` + `BreadcrumbList` script; home carries `WebSite` + `Person`; about carries `Person`. Paste each into Google Rich Results Test — all valid, zero errors.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/components/atoms/JsonLd.tsx apps/website/src/utils/structured-data.js apps/website/src/utils/structured-data.test.js apps/website/src/pages/gallery/[slug].js apps/website/src/pages/[[...slug]].js apps/website/src/pages/about.tsx
git commit -m "feat(seo): auto-derived JSON-LD (VisualArtwork, Person, WebSite, breadcrumbs)"
```

**→ PR A ends here (Tasks 1–3). Push once, open PR, verify CI + a preview Rich Results check.**

---

### Task 4 (GATED, separate PR): trim per-page tRPC/react-query hydration

**Only proceed if a before/after Lighthouse shows a real win.** This is the deferred #23 lever 2. The tRPC provider + `banners.getActive` query hydrate on every page solely for the announcement banner.

**Files:**
- Modify: `apps/website/src/pages/_app.tsx`

- [ ] **Step 1: Baseline measure**

Run production Lighthouse (mobile) on `/` and a gallery page; record TBT + total JS transfer.

- [ ] **Step 2: Defer banner hydration**

Gate the banner query behind an idle/after-interactive trigger (e.g. only enable the query after mount via `useState(false)` → `useEffect` flip, so it never blocks hydration), OR fetch the banner server-side and pass via props so the client query is removed. Keep the tRPC provider only if other client queries need it (`get-a-piece` inquiry mutation does — so the provider stays; only the banner query changes).

- [ ] **Step 3: Re-measure**

Re-run Lighthouse. **Gate:** if TBT/JS improvement is not clearly real (≳5-point TBT or a visible bundle drop), REVERT and close Task 4 as "measured, no win." Otherwise keep.

- [ ] **Step 4: Commit + PR B (only if kept)**

```bash
git add apps/website/src/pages/_app.tsx
git commit -m "perf(js): defer announcement-banner hydration off the critical path"
```

## Self-Review notes

- Spec coverage: sitemap ✅ (T2), robots ✅ (T2), canonical ✅ (T1), lang ✅ (T1), JSON-LD VisualArtwork/Person/WebSite/Breadcrumb ✅ (T3), studio fields flow ✅ (already wired; T1/T3 read the same `page.seo`), JS trim ✅ (T4 gated).
- Type consistency: `resolveSiteUrl`/`normalizeTrailingSlash`/`seoGenerateCanonicalUrl` defined in T1, reused verbatim in T3. Builders defined in T3 with matching test signatures.
- Risk guards: sitemap `try/catch`; canonical host-guarded; JSON-LD validated against Rich Results before merge.
