# Self-host fonts via `next/font/google` — Design

**Date:** 2026-07-03
**Issue:** [#23](https://github.com/blox-eng/vamyart/issues/23) — Mobile LCP still ~5.2s after image work; remaining cost is FCP (fonts/JS), not images.
**Scope:** Fonts only. The unused-JS lever (#23 lever 2) is explicitly deferred.

## Goal

Eliminate the render-blocking Google Fonts `@import` chain — the dominant
First Contentful Paint (FCP) cost — by self-hosting Inter + Cormorant Garamond
at build time via `next/font/google`.

## Root cause

`apps/website/src/css/main.css` line 1:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@400;500;700&display=swap');
```

A CSS `@import` is render-blocking and serially discovered. Under Lighthouse
throttling (Slow 4G + 4× CPU) the browser must walk this chain before it can
paint text:

```
fetch main.css → parse → discover @import → connect fonts.googleapis.com
→ fetch Google CSS → discover woff2 URLs → connect fonts.gstatic.com → fetch woff2
```

Two un-preconnected cross-origin hops in series ≈ the measured 3.4 s FCP
(of the 5.2 s LCP). The image path is already optimized (#21/#22); fonts are
the remaining lever.

## Current wiring

- `tailwind.config.js`: `fontFamily.sans = ['Inter', 'sans-serif']`,
  `fontFamily.serif = ['Cormorant Garamond', 'serif']`.
- A Tailwind plugin `addBase` sets `body { font-family: <fontBody> }` and
  `h1..h6,blockquote { font-family: <fontHeadlines> }` on the real elements.
- `font-sans` / `font-serif` utility classes are used throughout components.
- No `_document.tsx`; no `next/font` in use. Fonts come only from the
  `@import` above.

Because the base font-family is applied to `<body>` (and headings), the
`next/font` CSS variables must be in scope at a level that is an ancestor of
all rendered content. CSS custom properties inherit **downward only**.

## Approach

Four small pieces. The key subtlety (found in code review) is **where** the
CSS variables must be defined vs. **where** `next/font` emits its preload links
— they require different placements, so two files reference the fonts.

### The scoping constraint (why not just a wrapper `<div>`)

The Tailwind plugin applies `body { font-family: var(--font-inter) }` (and
headings) to the real `<body>`/`<h*>` elements, and Tailwind preflight applies
the same to `<html>`. CSS custom properties inherit **downward only**. A
`var()` with no in-parens fallback that references an undefined property is
*invalid at computed-value time* — the whole declaration is dropped (the
`, sans-serif` list item does **not** rescue it), so the element falls back to
the browser default serif.

Therefore the variables must be defined at the `<html>` root, not on a
descendant wrapper `<div>`. A wrapper-only approach leaves `<body>` and any
content React-portals to `document.body` (modals, search autocomplete)
rendering in serif.

### 1. `apps/website/src/lib/fonts.ts` (new — single source)

Instantiate both fonts once and export them, so `_document` and `_app` share
one instance (identical generated class names):

```ts
import { Inter, Cormorant_Garamond } from 'next/font/google';

export const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    display: 'swap',
    variable: '--font-inter'
});

export const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['300', '400', '600'],
    style: ['normal', 'italic'],
    display: 'swap',
    variable: '--font-cormorant'
});
```

`next/font` downloads the woff2 into the build and serves them **same-origin**
(`/_next/static/media/*.woff2`), bakes `font-display: swap` into the generated
`@font-face`, and removes any contact with `fonts.googleapis.com` /
`fonts.gstatic.com` (replaces #23 lever 3 — preconnect is moot with no
cross-origin request).

### 2. `apps/website/src/pages/_document.tsx` (new — correct scope)

Apply the variable classes to `<Html>` so the `html`/`body` font-family rules
(and body-portaled content) resolve the variables:

```jsx
import { Html, Head, Main, NextScript } from 'next/document';
import { inter, cormorant } from '../lib/fonts';

export default function Document() {
    return (
        <Html className={`${inter.variable} ${cormorant.variable}`}>
            <Head />
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
```

### 3. `apps/website/src/pages/_app.tsx` (preload trigger)

`next/font` does **not** preload fonts that are referenced only in `_document`
(they are still self-hosted, just not preloaded). Referencing the same shared
instances in the shared `_app` makes it emit `<link rel="preload" as="font">`
on **every** route (replaces #23 lever 1). The wrapper is a `<div>` (not
`<main>` — pages render their own `<main id="main">`, and nested `<main>` is
invalid HTML):

```jsx
import { inter, cormorant } from '../lib/fonts';
// ...
<div className={`${inter.variable} ${cormorant.variable}`}>
    <AnnouncementBanner banner={banner ?? null} />
    <Component {...pageProps} />
</div>
```

Note: FCP itself is fixed purely by removing the render-blocking `@import`
(CSS `@import` is render-blocking; the font download never blocked FCP under
`display: swap`). Preload is polish that shortens the fallback-swap window.

### 4. `apps/website/tailwind.config.js`

Point the families at the CSS variables (keep generic fallbacks):

```js
fontFamily: {
    sans: ['var(--font-inter)', 'sans-serif'],
    serif: ['var(--font-cormorant)', 'serif']
},
```

No change to the `addBase` plugin — it references `theme('fontFamily.sans'|'serif')`
which now resolve to the variables.

### 5. `apps/website/src/css/main.css`

Delete line 1 (the `@import`). Nothing else in the file references Google Fonts.

## Out of scope / deferred

- **Unused JS (~23 KiB, #23 lever 2)** — deferred. Mostly the tRPC/react-query
  client that hydrates on every page for the announcement banner; trimming is
  vague, risky, and low-yield against lab-only numbers. Separate follow-up.
- **Cyrillic subset** — BG (Bulgarian) is a planned locale but not live. Adding
  `cyrillic` now would bloat the exact bytes we're trimming. **When the BG
  locale ships, add `'cyrillic'` to both `subsets` arrays.**

## Risks

- `display: swap` shows fallback text briefly before the webfont paints. This
  is the standard, desired trade for faster FCP, and near-invisible now that
  fonts are same-origin.
- The wrapper `<div>` is normal block flow. Sticky headers and `min-h-screen`
  sections are viewport-relative and unaffected; verify visually in dev before
  committing.
- `next/font` fetches from Google **at build time**. Netlify build has network
  access, so this is fine; the runtime has zero external font dependency.

## Verification

1. `pnpm --filter @vamy/website build` (or `cd apps/website && next build`) succeeds.
2. In the built HTML for `/` and `/gallery/never/`:
   - `<link rel="preload" as="font" ... href="/_next/static/media/*.woff2" crossorigin>` is present.
   - `@import`, `fonts.googleapis.com`, and `fonts.gstatic.com` no longer appear.
3. Visual check in `next dev`: headings render Cormorant, body renders Inter;
   italics render; no layout regression from the wrapper `<div>`.
4. (Optional, human) Re-run headless Lighthouse; expect FCP to drop from ~3.4 s.
