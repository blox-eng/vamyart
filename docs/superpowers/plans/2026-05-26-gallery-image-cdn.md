# Gallery Image CDN Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve resized, format-optimized, CDN-cached images on the public website by routing image URLs through Netlify Image CDN, with a responsive `srcset` and a CSS-only CLS fix on gallery cards.

**Architecture:** A pure URL-building helper (`buildNetlifyImageUrl`) plus an environment-gated wrapper (`netlifyImage` / `netlifyImageSrcSet`) rewrite image URLs to `/.netlify/images?url=…&w=…&q=…`. The helpers are wired into the two `<img>` render points (`LazyImage`, `ImageBlock`). Optimization is a no-op in `next dev`, Vitest, and the Stackbit visual editor so those environments keep working. Supabase's domain is allowlisted in `netlify.toml`. Gallery cards get a fixed aspect ratio to reserve layout space.

**Tech Stack:** Next.js 15 (Pages Router), TypeScript, Netlify Image CDN, Vitest 2 (already a devDep of `apps/website`), Tailwind.

---

## File Structure

- `apps/website/src/utils/netlify-image.ts` (new) — pure helper + gated wrappers. Single responsibility: build optimized image URLs.
- `apps/website/src/utils/netlify-image.test.ts` (new) — Vitest unit tests for the helper.
- `apps/website/vitest.config.ts` (new) — minimal Vitest config for the website app.
- `apps/website/package.json` (modify) — add `test` script.
- `apps/website/src/components/atoms/LazyImage.tsx` (modify) — emit optimized `src` + `srcSet`/`sizes`.
- `apps/website/src/components/blocks/ImageBlock/index.tsx` (modify) — emit optimized `src` + `srcSet`.
- `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx` (modify) — aspect-ratio CLS fix + `sizes` on card thumbnails.
- `apps/website/netlify.toml` (modify) — allowlist Supabase domain for remote images.

---

## Task 1: Add Vitest to the website app

**Files:**
- Create: `apps/website/vitest.config.ts`
- Modify: `apps/website/package.json` (scripts block)

- [ ] **Step 1: Create the Vitest config**

Create `apps/website/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 2: Add the `test` script**

In `apps/website/package.json`, add `"test": "vitest run"` to the `scripts` object (so `turbo test` picks it up, matching `packages/db`). Resulting scripts block:

```json
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run"
  },
```

- [ ] **Step 3: Verify Vitest runs (no tests yet)**

Run: `cd apps/website && pnpm test`
Expected: Vitest starts and reports "No test files found" (exit code may be non-zero; that's fine — the next task adds tests).

- [ ] **Step 4: Commit**

```bash
git add apps/website/vitest.config.ts apps/website/package.json
git commit -m "chore(website): add vitest config + test script"
```

---

## Task 2: The `netlify-image` helper (TDD)

**Files:**
- Create: `apps/website/src/utils/netlify-image.ts`
- Test: `apps/website/src/utils/netlify-image.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `apps/website/src/utils/netlify-image.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildNetlifyImageUrl, netlifyImage, netlifyImageSrcSet } from "./netlify-image";

describe("buildNetlifyImageUrl", () => {
  it("builds a URL with encoded source, width, and default quality 75", () => {
    expect(buildNetlifyImageUrl("https://x.co/a.jpg", { width: 400 })).toBe(
      "/.netlify/images?url=https%3A%2F%2Fx.co%2Fa.jpg&w=400&q=75"
    );
  });

  it("respects a custom quality", () => {
    expect(buildNetlifyImageUrl("/local.jpg", { width: 800, quality: 60 })).toBe(
      "/.netlify/images?url=%2Flocal.jpg&w=800&q=60"
    );
  });

  it("adds h and fit only when height is given", () => {
    expect(buildNetlifyImageUrl("/a.jpg", { width: 400, height: 500, fit: "cover" })).toBe(
      "/.netlify/images?url=%2Fa.jpg&w=400&h=500&fit=cover&q=75"
    );
  });

  it("passes through falsy, data:, .svg, and already-optimized sources", () => {
    expect(buildNetlifyImageUrl("", { width: 400 })).toBe("");
    expect(buildNetlifyImageUrl("data:image/png;base64,AAAA", { width: 400 })).toBe("data:image/png;base64,AAAA");
    expect(buildNetlifyImageUrl("/images/img-placeholder.svg", { width: 400 })).toBe("/images/img-placeholder.svg");
    expect(buildNetlifyImageUrl("/.netlify/images?url=%2Fa.jpg&w=400", { width: 800 })).toBe("/.netlify/images?url=%2Fa.jpg&w=400");
  });

  it("ignores query/hash when checking the .svg extension", () => {
    expect(buildNetlifyImageUrl("/a.svg?v=2", { width: 400 })).toBe("/a.svg?v=2");
  });
});

describe("runtime gate", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("netlifyImage no-ops outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/a.jpg");
  });

  it("netlifyImage no-ops in Stackbit preview", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "true");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/a.jpg");
  });

  it("netlifyImage optimizes in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImage("/a.jpg", { width: 400 })).toBe("/.netlify/images?url=%2Fa.jpg&w=400&q=75");
  });

  it("netlifyImageSrcSet formats '<url> <w>w' entries in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("stackbitPreview", "");
    expect(netlifyImageSrcSet("/a.jpg", [400, 800])).toBe(
      "/.netlify/images?url=%2Fa.jpg&w=400&q=75 400w, /.netlify/images?url=%2Fa.jpg&w=800&q=75 800w"
    );
  });

  it("netlifyImageSrcSet returns empty string outside production", () => {
    vi.stubEnv("NODE_ENV", "development");
    expect(netlifyImageSrcSet("/a.jpg", [400, 800])).toBe("");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/website && pnpm test`
Expected: FAIL — `Failed to resolve import "./netlify-image"`.

- [ ] **Step 3: Implement the helper**

Create `apps/website/src/utils/netlify-image.ts`:

```ts
export type NetlifyImageOpts = {
    width: number;
    height?: number;
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill';
};

const DEFAULT_WIDTHS = [400, 800, 1200, 1600];

// SVGs don't raster-transform, data URIs are inline, and an already-rewritten URL
// must not be double-wrapped. The placeholder fallback is an SVG, so it falls here too.
function isTransformable(src: string): boolean {
    if (!src) return false;
    if (src.startsWith('data:')) return false;
    if (src.startsWith('/.netlify/images')) return false;
    const pathOnly = src.split(/[?#]/)[0];
    if (pathOnly.toLowerCase().endsWith('.svg')) return false;
    return true;
}

// Pure: always builds the URL (or passes through). No environment checks — unit-tested directly.
export function buildNetlifyImageUrl(src: string, opts: NetlifyImageOpts): string {
    if (!isTransformable(src)) return src;
    const { width, height, quality = 75, fit = 'cover' } = opts;
    const parts = [`url=${encodeURIComponent(src)}`, `w=${width}`];
    if (height != null) {
        parts.push(`h=${height}`, `fit=${fit}`);
    }
    parts.push(`q=${quality}`);
    return `/.netlify/images?${parts.join('&')}`;
}

// Optimize only on Netlify (production builds) and never inside the Stackbit visual editor,
// where rewriting `src` would break inline-edit field mapping. `next dev` and Vitest no-op.
// `process.env.stackbitPreview` is the build-inlined alias of STACKBIT_PREVIEW (see next.config.js).
function optimizationEnabled(): boolean {
    return process.env.NODE_ENV === 'production' && !process.env.stackbitPreview;
}

export function netlifyImage(src: string, opts: NetlifyImageOpts): string {
    if (!optimizationEnabled()) return src;
    return buildNetlifyImageUrl(src, opts);
}

export function netlifyImageSrcSet(
    src: string,
    widths: number[] = DEFAULT_WIDTHS,
    opts: Omit<NetlifyImageOpts, 'width'> = {}
): string {
    if (!optimizationEnabled() || !isTransformable(src)) return '';
    return widths.map((w) => `${buildNetlifyImageUrl(src, { ...opts, width: w })} ${w}w`).join(', ');
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/website && pnpm test`
Expected: PASS — all tests in `netlify-image.test.ts` green.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/utils/netlify-image.ts apps/website/src/utils/netlify-image.test.ts
git commit -m "feat(website): add Netlify Image CDN URL helper"
```

---

## Task 3: Wire the helper into `LazyImage`

**Files:**
- Modify: `apps/website/src/components/atoms/LazyImage.tsx`

- [ ] **Step 1: Add `widths`/`sizes` props and emit optimized src + srcSet**

In `apps/website/src/components/atoms/LazyImage.tsx`:

1. Add the import at the top (after the `classNames` import):

```ts
import { netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';
```

2. Add `widths` and `sizes` to the `LazyImageProps` type:

```ts
type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
    imgClassName?: string;
    loading?: 'lazy' | 'eager';
    widths?: number[];
    sizes?: string;
    onLoad?: () => void;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'onLoad'>;
```

3. Destructure the new props in the function signature, with defaults:

```ts
export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', widths = [400, 800, 1200, 1600], sizes = '100vw', onLoad, ...rest }: LazyImageProps) {
```

4. Replace the `const resolvedSrc = errored ? FALLBACK_SRC : src;` line with:

```ts
    const resolvedSrc = errored ? FALLBACK_SRC : src;
    const optimizedSrc = netlifyImage(resolvedSrc, { width: widths[widths.length - 1] });
    const srcSet = netlifyImageSrcSet(resolvedSrc, widths) || undefined;
```

5. Update the `<img>` element to use the optimized values:

```tsx
            <img
                ref={imgRef}
                src={optimizedSrc}
                srcSet={srcSet}
                sizes={srcSet ? sizes : undefined}
                alt={alt}
                loading={loading}
                onLoad={() => { setLoaded(true); onLoad?.(); }}
                onError={() => { if (!errored) setErrored(true); }}
                className={classNames(
                    'w-full h-full transition-opacity duration-300',
                    loaded ? 'opacity-100' : 'opacity-0',
                    imgClassName,
                )}
            />
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/website && pnpm exec tsc --noEmit`
Expected: No new errors in `LazyImage.tsx`. (Pre-existing errors elsewhere, if any, are unrelated — confirm none mention `LazyImage.tsx`.)

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/atoms/LazyImage.tsx
git commit -m "feat(website): emit optimized src/srcSet from LazyImage"
```

---

## Task 4: Wire the helper into `ImageBlock`

**Files:**
- Modify: `apps/website/src/components/blocks/ImageBlock/index.tsx`

- [ ] **Step 1: Optimize the `url` and add `srcSet`**

In `apps/website/src/components/blocks/ImageBlock/index.tsx`:

1. Add the import after the existing imports:

```ts
import { netlifyImage, netlifyImageSrcSet } from '../../../utils/netlify-image';
```

2. Just before the `return (`, compute the optimized values:

```ts
    const optimizedUrl = netlifyImage(url, { width: 1600 });
    const srcSet = netlifyImageSrcSet(url) || undefined;
```

3. Replace the `<img ... />` line with:

```tsx
            <img
                id={elementId}
                className={imgClassName}
                src={optimizedUrl}
                srcSet={srcSet}
                sizes={srcSet ? '100vw' : undefined}
                alt={altText}
            />
```

(The Stackbit `#@src` annotation still maps to the original field — in the visual editor `optimizationEnabled()` is false, so `optimizedUrl === url`.)

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/website && pnpm exec tsc --noEmit`
Expected: No new errors mentioning `ImageBlock/index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blocks/ImageBlock/index.tsx
git commit -m "feat(website): emit optimized src/srcSet from ImageBlock"
```

---

## Task 5: Allowlist Supabase in `netlify.toml`

**Files:**
- Modify: `apps/website/netlify.toml`

- [ ] **Step 1: Append the `[images]` block**

Add to the end of `apps/website/netlify.toml`:

```toml

[images]
  remote_images = ["https://ytgbohzmipyfrezsctbl\\.supabase\\.co/.*"]
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/netlify.toml
git commit -m "chore(website): allowlist Supabase for Netlify Image CDN"
```

---

## Task 6: CLS fix + `sizes` on gallery cards

**Files:**
- Modify: `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`

Gallery cards use the default `col` flex direction. The thumbnail wrapper has no reserved
height, so the card grows when the image loads (CLS). Give col-layout thumbnails a fixed
aspect ratio and pass a `sizes` hint matching the grid (up to ~3 columns).

- [ ] **Step 1: Add aspect-ratio class + sizes to the card `LazyImage`**

In `apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx`, replace the
`<LazyImage ... />` block (currently lines 52–61) with:

```tsx
                    <LazyImage
                        src={post.featuredImage.url}
                        alt={post.featuredImage.altText || post.title || ''}
                        sizes="(min-width: 640px) 33vw, 100vw"
                        className={classNames({
                            'xs:w-[50%] xs:shrink-0': hasBigThumbnail && (flexDirection === 'row' || flexDirection === 'row-reversed'),
                            'xs:w-[28.4%] xs:shrink-0': !hasBigThumbnail && (flexDirection === 'row' || flexDirection === 'row-reversed'),
                            'aspect-[4/5]': flexDirection === 'col' || flexDirection === 'col-reverse'
                        })}
                        imgClassName="w-full h-full object-cover"
                        {...(hasAnnotations && { 'data-sb-field-path': 'featuredImage' })}
                    />
```

- [ ] **Step 2: Verify it typechecks**

Run: `cd apps/website && pnpm exec tsc --noEmit`
Expected: No new errors mentioning `PostFeedItem/index.tsx`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/sections/PostFeedSection/PostFeedItem/index.tsx
git commit -m "fix(website): reserve gallery card image space to prevent CLS"
```

---

## Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the website unit tests**

Run: `cd apps/website && pnpm test`
Expected: PASS — `netlify-image.test.ts` green.

- [ ] **Step 2: Production build (proves the optimization path compiles and pages still render)**

Run: `cd /home/blox-master/business/vamy/website/vamy.art && pnpm turbo build --filter=@vamy/website`
Expected: Build succeeds. `/gallery` and `/gallery/[slug]` prerender without errors.

- [ ] **Step 3: Confirm no stray uncommitted changes**

Run: `git status --short`
Expected: clean (everything committed in prior tasks).

---

## Self-Review Notes

- **Spec coverage:** helper (Task 2) ✓; `LazyImage` wiring (Task 3) ✓; `ImageBlock` wiring (Task 4) ✓; `netlify.toml` allowlist (Task 5) ✓; CLS card fix (Task 6) ✓; Vitest tests (Tasks 1–2) ✓; dev/Stackbit/SVG/data no-op (Task 2 gate + tests) ✓.
- **Out of scope (per spec):** upload pipeline, admin thumbnails, detail-page hero CLS, storing image dimensions.
- **Type consistency:** `buildNetlifyImageUrl`, `netlifyImage`, `netlifyImageSrcSet`, `NetlifyImageOpts` names are identical across the helper, tests, and both component call sites.
