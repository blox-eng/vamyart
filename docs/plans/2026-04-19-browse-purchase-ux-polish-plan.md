# Browse + Purchase UX Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish browse + purchase surfaces on `apps/website` without adding new routes, services, or subscriptions.

**Architecture:** Scope is localized to existing components and content frontmatter. One shared helper added (`formatPrice`). No schema / tRPC / infra changes. Four logical commits, one PR.

**Tech Stack:** Next.js 15 (Pages Router), React 19, Tailwind v3, tRPC v11, content-driven pages via `[[...slug]].js`.

**Design doc:** `docs/plans/2026-04-19-browse-purchase-ux-polish-design.md`

**Branch:** `feat/ux-polish-2026-04-19` (already created, spec committed)

**Testing strategy:** The website has Vitest installed but no config and no existing test files — introducing unit-test scaffolding just for this polish pass is YAGNI. Verification is:
1. `pnpm tsc --noEmit` in `apps/website` after each task (catches type regressions)
2. `pnpm build --filter=@vamy/website` once at the end (catches build regressions)
3. Manual acceptance in `pnpm dev` against the real Supabase dev data (each task lists what to click / observe)

---

## File Map

**Create:**
- `apps/website/src/lib/formatPrice.ts`

**Modify:**
- `apps/website/src/components/sections/Header/index.tsx` (stop mounting LocaleSwitcher)
- `apps/website/src/pages/get-a-piece.tsx` (focus rings, image fallback, skeleton, error retry, `formatPrice`)
- `apps/website/src/components/blocks/ReachOutBlock/index.tsx` (focus rings, terms checkbox, input styling, copy, disabled opacity, error retry)
- `apps/website/src/components/layouts/PostLayout/index.tsx` (back-to-gallery link, pieceId, next/prev if source data is wired)
- `apps/website/src/utils/static-props-resolvers.js` or equivalent (augment gallery post data with `prev`/`next` neighbors)
- `apps/website/content/pages/gallery/index.md` (metaDescription)
- `apps/website/content/pages/gallery/whispers.md` (CTA label)
- `apps/website/content/pages/gallery/first-contact.md` (CTA label)
- `apps/website/content/pages/gallery/on-the-horizon.md` (CTA label)

---

### Task 1: Shared price formatter

**Files:**
- Create: `apps/website/src/lib/formatPrice.ts`

- [ ] **Step 1: Create the helper**

```ts
// apps/website/src/lib/formatPrice.ts

/**
 * Format a numeric EUR price for display.
 * Example: formatPrice(1200) → "€1,200"
 * Returns null when the input is not a finite number, so callers can choose
 * their own fallback copy ("price on request", etc).
 */
export function formatPrice(value: number | string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') return null;
    const n = typeof value === 'string' ? Number(value) : value;
    if (!Number.isFinite(n)) return null;
    return new Intl.NumberFormat('en-IE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(n);
}
```

- [ ] **Step 2: Verify typecheck**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors introduced (pre-existing errors in `local-content.ts` / `map-styles-to-class-names.ts` / `stackbit.config.ts` are acceptable per prior audit — do not attempt to fix them in this plan).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/formatPrice.ts
git commit -m "feat(website): add shared formatPrice EUR helper"
```

---

### Task 2: Use formatPrice in `/get-a-piece` and `PostLayout`

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx` (line ~32)
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx` (line ~73)

- [ ] **Step 1: Update `get-a-piece.tsx`**

Replace at the top of `GetAPiece` body (around line 32):

```tsx
// BEFORE
const price = variant?.price ? `€${Number(variant.price).toLocaleString()}` : null;

// AFTER
import { formatPrice } from '../lib/formatPrice';
// ...
const price = formatPrice(variant?.price);
```

Place the `import { formatPrice }` next to the existing `ARTWORKS` / `trpc` imports near the top of the file.

- [ ] **Step 2: Update `PostLayout/index.tsx`**

Replace at line 73:

```tsx
// BEFORE
{price && (
    <div><dt className="sr-only">Price</dt><dd>€{Number(price).toLocaleString()}</dd></div>
)}

// AFTER (add import at top)
import { formatPrice } from '../../../lib/formatPrice';
// ...
{price && formatPrice(price) && (
    <div><dt className="sr-only">Price</dt><dd>{formatPrice(price)}</dd></div>
)}
```

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/get-a-piece?piece=whispers` → aside shows `Original — €X,XXX` format.
- Load `/gallery/whispers` → metadata strip shows `€X,XXX` (no decimals, locale-formatted).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "refactor(website): use formatPrice helper in artwork + inquiry pages"
```

---

### Task 3: Focus-visible rings on all form inputs

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx`
- Modify: `apps/website/src/components/blocks/ReachOutBlock/index.tsx`

All inputs currently use `focus:outline-none focus:border-black` (or `focus:border-gray-600`) which removes the OS focus ring. Replace with a visible focus-visible ring.

- [ ] **Step 1: Update `get-a-piece.tsx` input classes**

Every input / textarea / select in that file uses this suffix:
`focus:outline-none focus:border-black transition-colors`

Replace with:
`focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-black transition-colors`

Inputs to update:
- `inq-name` (around line 150)
- `inq-email` (around line 163)
- `inq-piece` select (around line 181; merge into the existing conditional className chain — the `bg-gray-50 …` disabled branch keeps its own rules)
- `inq-message` textarea (around line 210)

The terms checkbox also needs a visible focus state — add `focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2` to its className (around line 221).

- [ ] **Step 2: Update `ReachOutBlock/index.tsx` input classes**

Every input / textarea / select in that file uses this suffix:
`focus:outline-none focus:border-gray-600`

Replace with:
`focus:outline-none focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 focus:border-gray-600`

Inputs to update:
- Name input (around line 57)
- Email input (around line 67)
- Interest select (around line 80)
- Message textarea (around line 99)

- [ ] **Step 3: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/get-a-piece` → press Tab from the URL bar, walk through every field. Each field shows a visible black ring on focus.
- Load `/` and scroll to the Reach Out form → same Tab walk, same visible ring.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx apps/website/src/components/blocks/ReachOutBlock/index.tsx
git commit -m "fix(a11y): restore visible focus rings on inquiry form inputs"
```

---

### Task 4: Image fallback on `/get-a-piece` aside

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx` (the `<img>` around line 77)

- [ ] **Step 1: Add onError fallback**

Replace the existing `<img>` block (around line 77):

```tsx
// BEFORE
<img
    src={`/images/${artwork.slug}.jpg`}
    alt={artwork.title}
    className="w-full aspect-[3/4] object-cover rounded-sm mb-6 shadow-sm"
/>

// AFTER
<img
    src={`/images/${artwork.slug}.jpg`}
    alt={artwork.title}
    className="w-full aspect-[3/4] object-cover rounded-sm mb-6 shadow-sm bg-gray-50"
    onError={(e) => {
        const t = e.currentTarget;
        if (t.src.endsWith('/images/img-placeholder.svg')) return;
        t.src = '/images/img-placeholder.svg';
    }}
/>
```

The guard prevents an infinite loop if the placeholder itself is missing.

- [ ] **Step 2: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/get-a-piece?piece=whispers` → real image appears.
- Load `/get-a-piece?piece=does-not-exist` → tRPC returns no artwork, aside falls back to the "Interested in owning a piece?" block (existing branch). Expected: no broken image, because `artwork` is null.
- Temporarily rename `apps/website/public/images/whispers.jpg` to `whispers.jpg.bak`, reload `/get-a-piece?piece=whispers` → placeholder image shows instead of broken icon. Rename back.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(website): fall back to placeholder when artwork image missing"
```

---

### Task 5: Loading skeleton on `/get-a-piece`

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx` (the aside, around lines 74–99)

- [ ] **Step 1: Detect loading state and render a skeleton**

The tRPC query already exposes `isLoading`. Destructure it:

```tsx
// BEFORE (around line 22)
const { data: product } = trpc.products.getByArtworkSlug.useQuery(
    { slug: pieceSlug },
    { enabled: !!pieceSlug, staleTime: Infinity, retry: false }
);

// AFTER
const { data: product, isLoading: isProductLoading } = trpc.products.getByArtworkSlug.useQuery(
    { slug: pieceSlug },
    { enabled: !!pieceSlug, staleTime: Infinity, retry: false }
);
```

In the aside JSX, add the skeleton branch as a third conditional (between the `artwork` branch and the default "Interested…" branch):

```tsx
// STRUCTURE (in aside, around line 75)
<aside className="lg:col-span-2 mb-12 lg:mb-0">
    {pieceSlug && isProductLoading ? (
        <div className="mb-10 animate-pulse" aria-busy="true" aria-label="Loading artwork details">
            <div className="w-full aspect-[3/4] bg-gray-100 rounded-sm mb-6" />
            <div className="h-5 w-2/3 bg-gray-100 rounded mb-2" />
            <div className="h-3 w-1/3 bg-gray-100 rounded mb-1" />
            <div className="h-3 w-1/4 bg-gray-100 rounded mb-4" />
        </div>
    ) : artwork ? (
        // existing artwork block (image + title + medium + dimensions + price)
    ) : (
        // existing "Interested in owning a piece?" block
    )}

    <div className="space-y-6">
        {/* existing STEPS block — unchanged */}
    </div>
</aside>
```

Keep the existing two branches intact — only wrap them with the new skeleton branch.

- [ ] **Step 2: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Chrome DevTools → Network → throttling "Slow 3G".
- Hard reload `/get-a-piece?piece=whispers` → skeleton is visible during the fetch, then swaps to the real artwork block.
- Load `/get-a-piece` (no `?piece=`) → skeleton never shows, default "Interested…" copy appears directly.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "feat(website): add loading skeleton for artwork fetch on /get-a-piece"
```

---

### Task 6: Stop mounting the fake LocaleSwitcher

**Files:**
- Modify: `apps/website/src/components/sections/Header/index.tsx` (around lines 103–105)

The `LocaleSwitcher` component flips `localStorage` but has no effect on site content because next-intl isn't wired on the website yet (`next-intl` is a dep, but no middleware/provider exists here). Mounting it signals functionality that doesn't exist. Leave the component defined, stop rendering it.

- [ ] **Step 1: Remove the mount in `HeaderLogoLeftPrimaryLeft`**

Find (around line 103):

```tsx
<div className={classNames('hidden lg:flex lg:items-center', secondaryLinks.length === 0 && 'ml-auto')}>
    <LocaleSwitcher />
</div>
```

Delete this `<div>` entirely.

- [ ] **Step 2: Grep for other mount sites**

Run: `grep -n LocaleSwitcher apps/website/src/components/sections/Header/index.tsx`

If any other header variant (`HeaderLogoCenteredPrimaryCentered`, etc.) mounts it, remove those too. At time of audit, only `HeaderLogoLeftPrimaryLeft` mounted it — but verify.

- [ ] **Step 3: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/` desktop view → header no longer shows `EN / DE / BG` chips.
- Resize to mobile → menu opens without the locale switcher too (it was desktop-only already).
- No console errors from the unused component definition (it's still defined, just not mounted — that's fine).

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/sections/Header/index.tsx
git commit -m "chore(header): hide non-functional LocaleSwitcher until next-intl ships"
```

---

### Task 7: ReachOutBlock form coherence with `/get-a-piece`

**Files:**
- Modify: `apps/website/src/components/blocks/ReachOutBlock/index.tsx`

Five sub-fixes, all in one file:

1. Add terms checkbox (required) — for parity + GDPR.
2. Unify input styling: `border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 transition-colors`. (Focus-visible ring was added in Task 3; this task aligns the rest: border color `200` not `300`, bigger padding, rounded corners, transition-colors.)
3. Align reply-time copy: "within 2 working days" in the success state (currently "usually within 2 days").
4. Align disabled button opacity: `disabled:opacity-50` (matches ReachOutBlock today; change `/get-a-piece` submit from `opacity-40` to `opacity-50` in this same task for consistency).
5. Add error retry button (re-submits on click; only surfaces when mutation errored).

- [ ] **Step 1: Replace the full ReachOutBlock component**

```tsx
import * as React from 'react';
import { trpc } from '../../../lib/trpc';
import { ARTWORKS, COMMISSION_OPTION, OTHER_OPTION } from '../../../lib/artworks';

const INPUT_CLASS =
    'w-full border border-gray-200 px-4 py-3 rounded text-sm focus:outline-none focus:border-black focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2 transition-colors';

export default function ReachOutBlock() {
    const [name, setName] = React.useState('');
    const [email, setEmail] = React.useState('');
    const [interest, setInterest] = React.useState('');
    const [message, setMessage] = React.useState('');
    const [terms, setTerms] = React.useState(false);
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');

    const createInquiry = trpc.inquiries.create.useMutation();

    async function submit() {
        setStatus('idle');
        try {
            await createInquiry.mutateAsync({
                name,
                email,
                pieceInterest: interest || 'General inquiry',
                message: message || undefined,
            });
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        await submit();
    }

    if (status === 'success') {
        return (
            <div className="py-10 text-center">
                <p className="text-lg font-light mb-2">Thank you, {name}.</p>
                <p className="text-gray-500 text-sm">Maeve will get back to you personally — within 2 working days.</p>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            {status === 'error' && (
                <div className="text-sm text-red-600 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
                    <span>Something went wrong. Please try again or email directly.</span>
                    <button
                        type="button"
                        onClick={submit}
                        disabled={createInquiry.isPending}
                        className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                    >
                        Try again
                    </button>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Your name</label>
                    <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Jane Smith"
                        className={INPUT_CLASS}
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Email address</label>
                    <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="jane@example.com"
                        className={INPUT_CLASS}
                    />
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">I'm interested in&hellip;</label>
                <select
                    value={interest}
                    onChange={(e) => setInterest(e.target.value)}
                    className={`${INPUT_CLASS} bg-white`}
                >
                    <option value="">— pick a piece or just say hello</option>
                    {ARTWORKS.map((a) => (
                        <option key={a.slug} value={a.title}>{a.title}</option>
                    ))}
                    <option value={COMMISSION_OPTION.title}>{COMMISSION_OPTION.title}</option>
                    <option value={OTHER_OPTION.title}>{OTHER_OPTION.title}</option>
                </select>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    Message <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <textarea
                    rows={4}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell Maeve what caught your eye, or ask anything you'd like to know."
                    className={`${INPUT_CLASS} resize-none`}
                />
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
                <input
                    type="checkbox"
                    checked={terms}
                    onChange={(e) => setTerms(e.target.checked)}
                    required
                    className="mt-0.5 shrink-0 focus-visible:ring-2 focus-visible:ring-black/60 focus-visible:ring-offset-2"
                />
                <span className="text-sm text-gray-500">
                    I have read and accept the{' '}
                    <a href="/terms" className="underline hover:no-underline" target="_blank" rel="noreferrer">legal terms</a>
                </span>
            </label>

            <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">
                    Maeve replies personally — no bots, no templates.
                </p>
                <button
                    type="submit"
                    disabled={createInquiry.isPending || !terms}
                    className="bg-black text-white text-sm px-6 py-2 hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                    {createInquiry.isPending ? 'Sending…' : 'Send'}
                </button>
            </div>
        </form>
    );
}
```

- [ ] **Step 2: Update `/get-a-piece` disabled opacity for consistency**

In `apps/website/src/pages/get-a-piece.tsx`, find the submit button (around line 238):

```tsx
// BEFORE
className="bg-black text-white px-8 py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"

// AFTER
className="bg-black text-white px-8 py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-50"
```

- [ ] **Step 3: Add retry button to `/get-a-piece` error state**

In `apps/website/src/pages/get-a-piece.tsx`, find the error state (around line 231):

```tsx
// BEFORE
{status === 'error' && (
    <p className="text-sm text-red-600">Something went wrong — please try again.</p>
)}

// AFTER
{status === 'error' && (
    <div className="text-sm text-red-600 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
        <span>Something went wrong — please try again.</span>
        <button
            type="submit"
            disabled={createInquiry.isPending}
            className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
        >
            Try again
        </button>
    </div>
)}
```

(The existing `handleSubmit` re-runs on click because the button is `type="submit"` inside the form.)

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/` and scroll to Reach Out → both forms (home + `/get-a-piece`) look identical: same input padding, rounded corners, focus ring, disabled opacity, terms checkbox.
- Home form: tick terms, submit without name → HTML required-field validation triggers, same as before.
- Force an error (disconnect network), submit, see the red box with "Try again" button. Reconnect, click Try again → submits successfully and shows success state.
- Both success states read "within 2 working days".

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/blocks/ReachOutBlock/index.tsx apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(forms): align ReachOutBlock with /get-a-piece (terms, styling, retry, copy)"
```

---

### Task 8: Fix gallery metaDescription

**Files:**
- Modify: `apps/website/content/pages/gallery/index.md` (line 12)

- [ ] **Step 1: Replace the placeholder description**

```yaml
# BEFORE
seo:
  metaTitle: Gallery - Maeve Vamy
  metaDescription: 'Discover '
  socialImage: /images/img-placeholder.svg

# AFTER
seo:
  metaTitle: Gallery - Maeve Vamy
  metaDescription: 'Original oil paintings by Maeve Vamy — muted seascapes, abstract figurations, and surreal studies in warm, earthy tones.'
  socialImage: /images/img-placeholder.svg
```

- [ ] **Step 2: Verify no build regression**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no errors (content change only).

- [ ] **Step 3: Commit**

```bash
git add apps/website/content/pages/gallery/index.md
git commit -m "fix(gallery): real meta description instead of placeholder"
```

---

### Task 9: Sentence-case artwork inquire CTAs

**Files:**
- Modify: `apps/website/content/pages/gallery/whispers.md` (line 31)
- Modify: `apps/website/content/pages/gallery/first-contact.md`
- Modify: `apps/website/content/pages/gallery/on-the-horizon.md`

- [ ] **Step 1: Update `whispers.md`**

Find in frontmatter:

```yaml
actions:
  - type: Button
    label: INQUIRE ABOUT THE ORIGINAL
```

Replace with:

```yaml
actions:
  - type: Button
    label: Inquire about this piece
```

- [ ] **Step 2: Update `first-contact.md`**

Same replacement. If the label is slightly different (e.g. "INQUIRE TO ACQUIRE") verify with:
`grep -n INQUIRE apps/website/content/pages/gallery/first-contact.md`
Replace whatever the all-caps label is with `Inquire about this piece`.

- [ ] **Step 3: Update `on-the-horizon.md`**

Same replacement, same verification step.

- [ ] **Step 4: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- `/gallery/whispers`, `/gallery/first-contact`, `/gallery/on-the-horizon` → each shows "Inquire about this piece" (sentence case) as the bottom CTA button. Clicking still navigates to `/get-a-piece?piece=<slug>`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/pages/gallery/whispers.md apps/website/content/pages/gallery/first-contact.md apps/website/content/pages/gallery/on-the-horizon.md
git commit -m "fix(gallery): sentence-case inquire CTA labels on artwork pages"
```

---

### Task 10: PostLayout — back-to-gallery link + pieceId

**Files:**
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

Two additions in the right-column header region:

- [ ] **Step 1: Add back-to-gallery link above the title**

At the top of the right-column `<div className="space-y-6">` (around line 61), prepend:

```tsx
<Link
    href="/gallery"
    className="inline-flex items-center gap-1 text-xs uppercase tracking-widest text-gray-400 hover:text-gray-600 transition-colors"
>
    <span aria-hidden="true">←</span> Back to gallery
</Link>
```

`Link` is already imported (line 7).

- [ ] **Step 2: Destructure `pieceId` and render it**

Update the destructure at line 34:

```tsx
// BEFORE
const { title, markdown_content, bottomSections = [], medium, dimensions, price } = page;

// AFTER
const { title, markdown_content, bottomSections = [], medium, dimensions, price, pieceId } = page;
```

Directly below the `<h1>` (around line 62), insert:

```tsx
{pieceId && (
    <p className="text-xs uppercase tracking-widest text-gray-400 -mt-4">
        {pieceId}
    </p>
)}
```

(`-mt-4` pulls it close to the title since the parent `<div>` has `space-y-6` which would otherwise over-space it.)

- [ ] **Step 3: Verify typecheck**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- `/gallery/whispers` → top of right column shows "← Back to gallery" (small, muted); below the title shows `#seascape-w2025` (the pieceId) as tight muted metadata.
- Click "Back to gallery" → lands on `/gallery`.
- Artworks without a `pieceId` in frontmatter show no catalog number line.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "feat(artwork): back-to-gallery link and pieceId catalog number"
```

---

### Task 11: PostLayout — next/prev artwork navigation

**Files:**
- Modify: `apps/website/src/utils/static-props-resolvers.js`
- Modify: `apps/website/src/components/layouts/PostLayout/index.tsx`

The gallery has 3 artworks today. Next/prev lets visitors browse them without bouncing back.

- [ ] **Step 1: Inspect the resolver to find where gallery posts are resolved**

Run: `grep -n PostLayout apps/website/src/utils/static-props-resolvers.js`
Read the relevant block. Identify the resolver that handles `PostLayout` pages (there's typically a function keyed on `modelName === 'PostLayout'`). Note how it accesses `allDocuments` / `allPosts`.

- [ ] **Step 2: Augment the PostLayout resolver with prev/next**

In the PostLayout resolver, before returning the resolved page, compute prev/next:

```js
// Inside the PostLayout resolver for content where __metadata.urlPath starts with /gallery/
const galleryPosts = data.objects
    .filter((o) => o.__metadata?.modelName === 'PostLayout'
                && typeof o.__metadata?.urlPath === 'string'
                && o.__metadata.urlPath.startsWith('/gallery/'))
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')); // newest first

const currentIndex = galleryPosts.findIndex((p) => p.__metadata.urlPath === page.__metadata.urlPath);
const prev = currentIndex > 0 ? galleryPosts[currentIndex - 1] : null;
const next = currentIndex >= 0 && currentIndex < galleryPosts.length - 1 ? galleryPosts[currentIndex + 1] : null;

// Attach minimal data — just what PostLayout needs to render nav links
page.prevPost = prev ? { title: prev.title, urlPath: prev.__metadata.urlPath } : null;
page.nextPost = next ? { title: next.title, urlPath: next.__metadata.urlPath } : null;
```

The exact destructuring (`data.objects` vs `allDocuments`) depends on what the resolver receives — adapt to the signature you see.

- [ ] **Step 3: Render prev/next in PostLayout**

In `apps/website/src/components/layouts/PostLayout/index.tsx`, destructure `prevPost, nextPost` from `page` (around line 34). Insert a nav block after the commerce widgets block (after line 103) but still inside the right column:

```tsx
{(prevPost || nextPost) && (
    <nav aria-label="Artwork navigation" className="flex items-center justify-between pt-8 border-t border-gray-200">
        {prevPost ? (
            <Link
                href={prevPost.urlPath}
                className="group flex flex-col items-start gap-0.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
            >
                <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">← Previous</span>
                <span className="font-light">{prevPost.title}</span>
            </Link>
        ) : <span />}
        {nextPost ? (
            <Link
                href={nextPost.urlPath}
                className="group flex flex-col items-end gap-0.5 text-sm text-gray-500 hover:text-gray-900 transition-colors text-right"
            >
                <span className="text-xs uppercase tracking-widest text-gray-400 group-hover:text-gray-600 transition-colors">Next →</span>
                <span className="font-light">{nextPost.title}</span>
            </Link>
        ) : <span />}
    </nav>
)}
```

- [ ] **Step 4: Verify typecheck**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- `/gallery/whispers` → footer of right column shows "Next → First Contact" (or whatever's next by date desc). No "Previous" if it's the newest.
- `/gallery/first-contact` → shows both Previous and Next.
- `/gallery/on-the-horizon` → shows "← Previous First Contact". No Next if oldest.
- Click Next → navigates correctly.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/utils/static-props-resolvers.js apps/website/src/components/layouts/PostLayout/index.tsx
git commit -m "feat(artwork): prev/next navigation between gallery pieces"
```

---

### Task 12: "The Work" cards — no click affordance

**Files:**
- Modify: `apps/website/src/components/sections/FeaturedItemsSection/FeaturedItem/index.tsx` (verify current state)

The concept cards on home have `actions: []` but might still have hover-elevation or cursor-pointer styling that suggests clickability.

- [ ] **Step 1: Inspect the card component**

Run: `cat apps/website/src/components/sections/FeaturedItemsSection/FeaturedItem/index.tsx`
Look for:
- `cursor-pointer` without a wrapping `<Link>` / `<button>`
- hover elevations (`hover:shadow-*`, `hover:-translate-y-*`) applied unconditionally

- [ ] **Step 2: Scope hover effects to cards that have actions**

If any unconditional hover/cursor style exists on the root card element, wrap it in a conditional:

```tsx
// Example — actual code depends on what's there
const hasActions = Array.isArray(actions) && actions.length > 0;
className={classNames(
    'base-classes-here',
    hasActions && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer transition-transform'
)}
```

If no unconditional hover/cursor exists, this task is a no-op — commit the explored inspection finding as a comment in the plan review and move on (no file change needed).

- [ ] **Step 3: Manual acceptance**

Run: `pnpm --filter @vamy/website dev`
- Load `/` → hover over each of the 4 "The Work" cards. Cursor stays default (no pointer), no elevation on hover. They read as editorial content, not click targets.

- [ ] **Step 4: Commit (only if Step 2 made changes)**

```bash
git add apps/website/src/components/sections/FeaturedItemsSection/FeaturedItem/index.tsx
git commit -m "fix(home): no hover/cursor affordance on non-clickable concept cards"
```

If Step 2 was a no-op, skip this commit — don't create an empty commit.

---

### Task 13: Full build + PR

**Files:** none (verification + publish)

- [ ] **Step 1: Full typecheck across the workspace**

Run: `pnpm --filter @vamy/website exec tsc --noEmit`
Expected: no new errors beyond the pre-existing ones in `local-content.ts` / `map-styles-to-class-names.ts` / `stackbit.config.ts` (these predate this branch — do not fix here).

- [ ] **Step 2: Production build**

Run: `pnpm turbo build --filter=@vamy/website`
Expected: build succeeds, no new warnings beyond pre-existing ones.

- [ ] **Step 3: Push branch**

```bash
git push -u origin feat/ux-polish-2026-04-19
```

- [ ] **Step 4: Open PR**

```bash
gh pr create --title "feat: browse + purchase UX polish (2026-04-19)" --body "$(cat <<'EOF'
## Summary
- Polish the existing browse → inquire flow: focus rings, image fallback, loading skeleton, error retry, shared price formatter
- Align ReachOutBlock with /get-a-piece form (terms checkbox, input styling, copy, disabled opacity)
- Stop mounting fake LocaleSwitcher until next-intl is wired
- Artwork pages get back-to-gallery, prev/next navigation, catalog number (pieceId), sentence-case CTA
- Gallery metaDescription placeholder replaced with real copy

Full audit + rationale in `docs/plans/2026-04-19-browse-purchase-ux-polish-design.md`.

## Test plan
- [ ] Tab through /get-a-piece and ReachOutBlock — visible focus ring on every input
- [ ] /get-a-piece?piece=whispers shows skeleton under slow network, then real image
- [ ] Rename whispers.jpg → broken: placeholder image shows (no broken icon)
- [ ] Force tRPC error on both forms — "Try again" button recovers
- [ ] Header has no LocaleSwitcher
- [ ] /gallery/whispers: Back to gallery link works, #seascape-w2025 catalog number shows, Next → First Contact link works
- [ ] Artwork CTA reads "Inquire about this piece" (sentence case)
- [ ] /gallery meta description is a real sentence

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Verify PR opened**

Confirm the PR URL is returned and Netlify deploy preview starts. Share the URL with the user.

---

## Post-Implementation Checklist

- [ ] All 13 tasks committed
- [ ] Branch pushed to `origin/feat/ux-polish-2026-04-19`
- [ ] PR open with Netlify preview URL
- [ ] No new typecheck or build errors
- [ ] Manual acceptance run through on Netlify preview (not just localhost) before merge
