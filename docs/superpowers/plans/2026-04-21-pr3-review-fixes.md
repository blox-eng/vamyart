# PR #3 Review Fixes — Ready for Merge

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the 7 must-fix findings from the PR #3 code review (plus a VAT-copy correction) so the branch is ready to merge into `main`.

**Architecture:** Surgical edits on `feat/ux-polish-2026-04-19`. No refactors, no new abstractions. Each task is a single-file change with a matching commit; all changes land as one follow-up push on the existing PR.

**Tech Stack:** Next.js 15 (Pages + App Router hybrid), React 19, tRPC v11, Drizzle, Resend, Stripe, Tailwind, TypeScript.

---

## Pre-flight

Run once before starting:

```bash
cd /home/blox-master/business/vamy/website/vamy.art
git status                    # must show branch feat/ux-polish-2026-04-19, clean worktree
git rev-parse --abbrev-ref HEAD   # must print feat/ux-polish-2026-04-19
pnpm install --frozen-lockfile    # ensures workspace deps are in place
```

Record the starting SHA for the final review dispatch:

```bash
BASE_SHA=$(git rev-parse HEAD)
echo $BASE_SHA > /tmp/pr3-base-sha
```

---

## File Change Map

| File | What changes | Task |
|---|---|---|
| `apps/website/src/components/atoms/LazyImage.tsx` | Reset `loaded`/`errored` on `src` change via `useEffect` | 1 |
| `apps/website/src/utils/seo-utils.js` | Skip `domainUrl` prefix when `ogImage` is already absolute | 2 |
| `apps/website/src/utils/static-props-resolvers.js` | Filter unpublished posts out of gallery prev/next resolver | 3 |
| `apps/website/src/pages/get-a-piece.tsx` | Retry button terms-gate + `checkValidity()` on submit | 4 |
| `apps/website/src/components/blocks/ReachOutBlock/index.tsx` | Retry button terms-gate + `checkValidity()` on submit | 5 |
| `apps/website/src/components/blocks/ProductSelector/index.tsx` | Render error state instead of `return null` on fetch error | 6 |
| `apps/website/app/api/webhooks/stripe/route.ts` | Wrap artist notification email in its own try/catch | 7 |
| `apps/website/content/pages/terms.md` | Drop "not VAT registered" note; state prices exclude VAT + local taxes apply | 8 |

Order is chosen smallest-blast-radius first. Each task is independent — no type or import cross-refs.

---

### Task 1: Reset LazyImage state when `src` prop changes

**Files:**
- Modify: `apps/website/src/components/atoms/LazyImage.tsx:15-33`

- [ ] **Step 1: Open the file and locate the component body**

Current body of the component:

```tsx
export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', onLoad, ...rest }: LazyImageProps) {
    const [loaded, setLoaded] = React.useState(false);
    const [errored, setErrored] = React.useState(false);
    const resolvedSrc = errored ? FALLBACK_SRC : src;

    return (
        <div className={classNames('relative bg-gray-100 overflow-hidden', className)} {...rest}>
            <img
                src={resolvedSrc}
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
        </div>
    );
}
```

- [ ] **Step 2: Add the reset effect**

Insert this block immediately after the `useState` calls (between lines 17 and 18), so `loaded`/`errored` clear whenever `src` changes:

```tsx
    React.useEffect(() => {
        setLoaded(false);
        setErrored(false);
    }, [src]);
```

The final component body reads:

```tsx
export default function LazyImage({ src, alt, className, imgClassName, loading = 'lazy', onLoad, ...rest }: LazyImageProps) {
    const [loaded, setLoaded] = React.useState(false);
    const [errored, setErrored] = React.useState(false);

    React.useEffect(() => {
        setLoaded(false);
        setErrored(false);
    }, [src]);

    const resolvedSrc = errored ? FALLBACK_SRC : src;

    return (
        <div className={classNames('relative bg-gray-100 overflow-hidden', className)} {...rest}>
            <img
                src={resolvedSrc}
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
        </div>
    );
}
```

- [ ] **Step 3: Typecheck the website app**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0 with no errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/atoms/LazyImage.tsx
git commit -m "fix(LazyImage): reset loaded/errored state when src prop changes"
```

---

### Task 2: Guard absolute ogImage URLs in SEO helper

**Files:**
- Modify: `apps/website/src/utils/seo-utils.js:105-111`

- [ ] **Step 1: Locate the `seoGenerateOgImage` tail**

Current block (lines 105-111):

```javascript
    // Resolve to absolute URL when Netlify provides the domain
    const domainUrl = site.env?.URL ? site.env.URL : null;
    if (ogImage && domainUrl) {
        return domainUrl + ogImage;
    }
    return ogImage;
}
```

- [ ] **Step 2: Add absolute-URL short-circuit**

Replace the block with:

```javascript
    // Resolve to absolute URL when Netlify provides the domain.
    // If the image is already absolute (e.g. Supabase-hosted featuredImage), return as-is.
    if (ogImage && /^https?:\/\//i.test(ogImage)) {
        return ogImage;
    }
    const domainUrl = site.env?.URL ? site.env.URL : null;
    if (ogImage && domainUrl) {
        return domainUrl + ogImage;
    }
    return ogImage;
}
```

- [ ] **Step 3: Sanity-check there are no other callers that re-prefix**

Run: `grep -rn "seoGenerateOgImage\b" apps/website/src`
Expected: only the internal call inside `seoGenerateMetaTags` (same file) — no external usage to revisit.

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/utils/seo-utils.js
git commit -m "fix(seo): skip domain prefix when og:image is already absolute"
```

---

### Task 3: Filter unpublished posts out of gallery prev/next

**Files:**
- Modify: `apps/website/src/utils/static-props-resolvers.js:42-56`

- [ ] **Step 1: Locate the `PostLayout` resolver**

Current resolver (lines 42-56):

```javascript
    PostLayout: (props, data, debugContext) => {
        const resolved = resolveReferences(props, ['author', 'category'], data.objects, debugContext);
        const urlPath = resolved.__metadata?.urlPath;
        if (typeof urlPath === 'string' && urlPath.startsWith('/gallery/')) {
            const galleryPosts = getAllPostsSorted(data.objects).filter(
                (p) => typeof p.__metadata?.urlPath === 'string' && p.__metadata.urlPath.startsWith('/gallery/')
            );
            const idx = galleryPosts.findIndex((p) => p.__metadata?.urlPath === urlPath);
            const prev = idx > 0 ? galleryPosts[idx - 1] : null;
            const next = idx >= 0 && idx < galleryPosts.length - 1 ? galleryPosts[idx + 1] : null;
            resolved.prevPost = prev ? { title: prev.title, urlPath: prev.__metadata.urlPath } : null;
            resolved.nextPost = next ? { title: next.title, urlPath: next.__metadata.urlPath } : null;
        }
        return resolved;
    },
```

- [ ] **Step 2: Add the `isPublished` filter on the gallery post list**

Replace the resolver with:

```javascript
    PostLayout: (props, data, debugContext) => {
        const resolved = resolveReferences(props, ['author', 'category'], data.objects, debugContext);
        const urlPath = resolved.__metadata?.urlPath;
        if (typeof urlPath === 'string' && urlPath.startsWith('/gallery/')) {
            let galleryPosts = getAllPostsSorted(data.objects).filter(
                (p) => typeof p.__metadata?.urlPath === 'string' && p.__metadata.urlPath.startsWith('/gallery/')
            );
            if (!process.env.stackbitPreview) {
                galleryPosts = galleryPosts.filter(isPublished);
            }
            const idx = galleryPosts.findIndex((p) => p.__metadata?.urlPath === urlPath);
            const prev = idx > 0 ? galleryPosts[idx - 1] : null;
            const next = idx >= 0 && idx < galleryPosts.length - 1 ? galleryPosts[idx + 1] : null;
            resolved.prevPost = prev ? { title: prev.title, urlPath: prev.__metadata.urlPath } : null;
            resolved.nextPost = next ? { title: next.title, urlPath: next.__metadata.urlPath } : null;
        }
        return resolved;
    },
```

Note: `isPublished` is already imported at the top of this file (line 8) — no import change needed.

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/utils/static-props-resolvers.js
git commit -m "fix(resolvers): filter unpublished posts from gallery prev/next"
```

---

### Task 4: Harden inquiry form — retry terms-gate + HTML5 validity on get-a-piece

**Files:**
- Modify: `apps/website/src/pages/get-a-piece.tsx:52-61` and `apps/website/src/pages/get-a-piece.tsx:258-267`

- [ ] **Step 1: Tighten `handleSubmit` to enforce native validity**

Current handler (lines 52-61):

```tsx
    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setStatus('idle');
        try {
            await createInquiry.mutateAsync({ name, email, pieceInterest: piece, message: message || undefined });
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }
```

Replace with:

```tsx
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
        setStatus('idle');
        try {
            await createInquiry.mutateAsync({ name, email, pieceInterest: piece, message: message || undefined });
            setStatus('success');
        } catch {
            setStatus('error');
        }
    }
```

- [ ] **Step 2: Gate the retry button on `terms`**

Current retry button (lines 257-268):

```tsx
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

Replace with (only the `disabled` attr changes):

```tsx
                                        {status === 'error' && (
                                            <div className="text-sm text-red-600 bg-red-50 px-4 py-3 flex items-center justify-between gap-4">
                                                <span>Something went wrong — please try again.</span>
                                                <button
                                                    type="submit"
                                                    disabled={createInquiry.isPending || !terms}
                                                    className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                                                >
                                                    Try again
                                                </button>
                                            </div>
                                        )}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0. (Note: the `e` parameter is narrowed to `React.FormEvent<HTMLFormElement>` so `e.currentTarget.checkValidity()` is typed.)

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/get-a-piece.tsx
git commit -m "fix(get-a-piece): enforce native validity + terms gate on retry"
```

---

### Task 5: Harden ReachOutBlock — retry terms-gate + HTML5 validity

**Files:**
- Modify: `apps/website/src/components/blocks/ReachOutBlock/index.tsx:33-60`

- [ ] **Step 1: Tighten `handleSubmit` and gate the retry button on `terms`**

Current relevant region (lines 33-61):

```tsx
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
```

Replace with (two surgical edits):

```tsx
    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const form = e.currentTarget;
        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }
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
                        disabled={createInquiry.isPending || !terms}
                        className="text-red-700 underline underline-offset-2 hover:no-underline disabled:opacity-50"
                    >
                        Try again
                    </button>
                </div>
            )}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/blocks/ReachOutBlock/index.tsx
git commit -m "fix(ReachOutBlock): enforce native validity + terms gate on retry"
```

---

### Task 6: Surface product-fetch errors instead of hiding the selector

**Files:**
- Modify: `apps/website/src/components/blocks/ProductSelector/index.tsx:10-25`

- [ ] **Step 1: Destructure `error` from the query**

Current useQuery call (line 10):

```tsx
    const { data: productList, isLoading: productsLoading } = trpc.products.listByArtworkSlug.useQuery({ slug: artworkSlug }, { retry: false });
```

Replace with:

```tsx
    const productsQuery = trpc.products.listByArtworkSlug.useQuery({ slug: artworkSlug }, { retry: false });
    const { data: productList, isLoading: productsLoading, isError: productsError } = productsQuery;
```

- [ ] **Step 2: Render a distinct error state**

Current "no data" shortcut (line 24):

```tsx
    if (!productList || productList.length === 0) return null;
```

Replace with:

```tsx
    if (productsError) {
        return (
            <div className="border border-black p-6 mt-4">
                <h3 className="text-xs uppercase tracking-widest mb-2">Available pieces</h3>
                <p className="text-sm text-gray-600 mb-3">We couldn&rsquo;t load availability right now.</p>
                <button
                    type="button"
                    onClick={() => productsQuery.refetch()}
                    className="text-sm underline underline-offset-2 hover:no-underline"
                >
                    Try again
                </button>
                <p className="text-xs text-gray-500 mt-3">
                    Or{' '}
                    <a href="/get-a-piece" className="underline hover:no-underline">send an inquiry</a>
                    {' '}and Maeve will follow up personally.
                </p>
            </div>
        );
    }
    if (!productList || productList.length === 0) return null;
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector/index.tsx
git commit -m "fix(ProductSelector): show error state with retry instead of hiding"
```

---

### Task 7: Isolate artist notification email failures

**Files:**
- Modify: `apps/website/app/api/webhooks/stripe/route.ts:92-102`

- [ ] **Step 1: Wrap the artist email send in try/catch**

Current region (lines 92-102):

```typescript
    const formattedAddress = [address?.line1, address?.line2, address?.city, address?.state, address?.postal_code, address?.country]
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');

    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_ARTIST_EMAIL!,
      subject: "New order received",
      html: `<p>New order from ${escapeHtml(customer?.name ?? "")} (${escapeHtml(customer?.email ?? "")}). Ship to: ${formattedAddress}.</p>`,
    });
```

Replace with:

```typescript
    const formattedAddress = [address?.line1, address?.line2, address?.city, address?.state, address?.postal_code, address?.country]
      .filter(Boolean)
      .map(escapeHtml)
      .join(', ');

    try {
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: "New order received",
        html: `<p>New order from ${escapeHtml(customer?.name ?? "")} (${escapeHtml(customer?.email ?? "")}). Ship to: ${formattedAddress}.</p>`,
      });
    } catch (err) {
      console.error("[stripe-webhook] artist notification email failed", { orderId: inserted.id, err });
    }
```

Rationale (capture in commit body): the buyer receipt above is already wrapped; the artist email was the remaining unguarded path. Either failure must not throw, or Stripe will retry the webhook and the buyer will get duplicate receipts (order insert is idempotent via `onConflictDoNothing` on `stripe_session_id`, but Resend sends are not).

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @vamy/website typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/website/app/api/webhooks/stripe/route.ts
git commit -m "fix(stripe-webhook): isolate artist notification email failures

The buyer receipt was already wrapped in try/catch; the artist-notification
email was not. If Resend throws on the artist send, Stripe retries the
webhook, which triggers a duplicate buyer receipt (order insert is
idempotent via onConflictDoNothing, but email send is not)."
```

---

### Task 8: Correct VAT copy in Terms

**Files:**
- Modify: `apps/website/content/pages/terms.md:52`

- [ ] **Step 1: Confirm the current line**

Line 52 currently reads:

```
      *   Price in EUR (prices do not include VAT; Мейв Вами ЕООД is not VAT registered)
```

- [ ] **Step 2: Replace with customer-facing language**

Replace that single bullet with:

```
      *   Price in EUR (prices do not include VAT; applicable VAT, duties and taxes are determined by the customer&rsquo;s location and are the buyer&rsquo;s responsibility)
```

- [ ] **Step 3: Verify no other page mentions "not VAT registered" or "ЕООД is not VAT"**

Run: `grep -rniE "not vat registered|is not vat" apps/website/content apps/website/src packages`
Expected: no matches.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/pages/terms.md
git commit -m "docs(terms): drop VAT-registration detail; state buyer tax responsibility"
```

---

## Cross-cutting verification

After all 8 commits land, run the full suite once:

- [ ] **Step A: Typecheck both apps**

```bash
pnpm --filter @vamy/website typecheck
pnpm --filter @vamy/admin typecheck
```

Expected: both exit 0.

- [ ] **Step B: Run the DB package test suite**

```bash
pnpm --filter @vamy/db test
```

Expected: 29/29 passing (unchanged — none of these fixes touch `packages/db`).

- [ ] **Step C: Production build of the website**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: build exits 0. Any new TypeScript error surfaced here (e.g. from the `FormEvent<HTMLFormElement>` narrowing in Tasks 4–5) must be fixed before moving on.

- [ ] **Step D: Smoke-test in dev**

```bash
pnpm --filter @vamy/website dev
```

Then in a browser (or via Playwright if automating):

1. Visit `/get-a-piece?piece=whispers` — confirm the left-panel preview renders, the terms checkbox gates both primary submit AND the "Try again" button that appears after a failed submission.
2. Submit with an empty name field — confirm the browser shows the native validity popup instead of firing tRPC.
3. Visit `/` then a gallery piece — confirm the preview OG tag (view source, `og:image`) uses the absolute Supabase URL (no `https://vamy.art/https://...` double-prefix).
4. Navigate between two gallery pieces — confirm prev/next work and no draft piece leaks in.

- [ ] **Step E: Dispatch final code review**

```bash
HEAD_SHA=$(git rev-parse HEAD)
BASE_SHA=$(cat /tmp/pr3-base-sha)
echo "Review range: $BASE_SHA..$HEAD_SHA"
```

Dispatch the `superpowers:code-reviewer` subagent with:
- WHAT_WAS_IMPLEMENTED: "PR #3 review fixes (7 code findings + VAT copy correction)"
- PLAN_OR_REQUIREMENTS: this file (`docs/superpowers/plans/2026-04-21-pr3-review-fixes.md`)
- BASE_SHA / HEAD_SHA: from above
- DESCRIPTION: "Follow-up commits addressing CodeRabbit + internal review on PR #3"

Proceed to merge only when the reviewer returns no Critical or Important issues.

- [ ] **Step F: Push**

```bash
git push origin feat/ux-polish-2026-04-19
```

Then re-request CodeRabbit review in the PR (comment `@coderabbitai review`) and wait for the green check before merging.

---

## Out of scope (explicitly deferred)

These came up in the review but are not blockers for this PR:

- **BidWidget skeleton on auctionless artworks** — cosmetic; de-chrome in a follow-up.
- **`disabled:opacity-60 → 50` in ProductSelector** — cosmetic consistency.
- **Stackbit `data-sb-field-path` forwarding to inner `<img>`** — visual-editor ergonomics; structural change, own PR.
- **Hardcoded `og:image:width=1200, og:image:height=630`** — drop or calibrate per-asset in a dedicated follow-up.
- **`markShipped` idempotency** — second-click resends email; guard in its own PR.
- **Stripe live-key cutover** — user-owned manual step (copy `sk_live_*`/`pk_live_*` from dashboard, create live webhook, rotate Netlify env vars on `vamy-website`).
- **Secret rotation** — rotate `sb_secret_*`, `re_*`, `whsec_*` after merge.
