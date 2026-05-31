# Newsletter Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship two static Next.js pages — `/letters/welcome` and `/letters/farewell` — that replace Buttondown's default post-confirmation and post-unsubscribe screens with studio-voice moments.

**Architecture:** Two self-contained Pages Router files. No DB, no API, no shared site chrome. Pure JSX + Tailwind + CSS animations. Hardcoded copy.

**Tech Stack:** Next.js 15 (Pages Router), React 19, Tailwind, Cormorant Garamond serif (already in the design system).

**Spec:** [`docs/superpowers/specs/2026-05-31-newsletter-landing-pages-design.md`](../specs/2026-05-31-newsletter-landing-pages-design.md)

## Note on testing

The website repo has no component-test harness (RTL, jsdom, etc.) — only Node-environment Vitest for utilities. These two pages are purely static visual surfaces with no logic. Setting up RTL just for these would be ceremony.

Verification instead is:

1. `pnpm turbo build --filter=@vamy/website` succeeds (typecheck + Next build).
2. `pnpm dev` and visit both routes — verify staggered fade animation, no header/footer chrome, correct copy.
3. View source on each page in the browser, verify `<meta name="robots" content="noindex">` is present.

If, while building, you notice anything that *would* benefit from a unit test (e.g. you extract a helper), add it. Don't manufacture tests for what's there.

---

### Task 1: Create `welcome.tsx`

**Files:**
- Create: `apps/website/src/pages/letters/welcome.tsx`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p apps/website/src/pages/letters
```

- [ ] **Step 2: Write the page**

`apps/website/src/pages/letters/welcome.tsx`:

```tsx
import Head from 'next/head';
import Link from 'next/link';

const TEASER = "Next letter goes out when the paint is dry. You'll see it first.";

export default function Welcome() {
    return (
        <>
            <Head>
                <title>You're in — vamy</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6 py-24">
                <div className="max-w-[520px] w-full text-center font-serif">
                    <h1
                        className="text-4xl font-light mb-12 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 200ms forwards' }}
                    >
                        You&rsquo;re in.
                    </h1>

                    <p
                        className="text-lg leading-relaxed text-gray-700 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 1000ms forwards' }}
                    >
                        {TEASER}
                    </p>

                    <p
                        className="text-base text-gray-600 mb-2 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 1800ms forwards' }}
                    >
                        &mdash; Maeve
                    </p>

                    <p
                        className="text-sm text-gray-500 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 2400ms forwards' }}
                    >
                        vamy.art
                    </p>

                    <div
                        className="flex flex-col gap-3 text-sm text-gray-500 opacity-0"
                        style={{ animation: 'letters-fade-in 1200ms ease-out 3200ms forwards' }}
                    >
                        <Link href="/gallery" className="hover:text-gray-900 transition-colors">
                            &rarr; see the gallery
                        </Link>
                        <Link href="/" className="hover:text-gray-900 transition-colors">
                            &rarr; back to vamy.art
                        </Link>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes letters-fade-in {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `}</style>
            </main>
        </>
    );
}
```

- [ ] **Step 3: Build the website to verify typecheck + Next compile**

Run from repo root:
```bash
pnpm turbo build --filter=@vamy/website
```

Expected: build succeeds. No TypeScript errors. Build output mentions `/letters/welcome` as a static page.

- [ ] **Step 4: Visual smoke test**

Run:
```bash
pnpm --filter=@vamy/website dev
```

Open `http://localhost:3000/letters/welcome` and verify:
- White page, no site header, no site footer.
- Lines appear one at a time from top to bottom, ~600–800ms apart.
- Each line slides up 8px as it fades in.
- The two `→` links at the bottom appear last.
- View source: `<meta name="robots" content="noindex"/>` is present.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/pages/letters/welcome.tsx
git commit -m "feat(letters): add /letters/welcome post-confirmation page"
```

---

### Task 2: Create `farewell.tsx`

**Files:**
- Create: `apps/website/src/pages/letters/farewell.tsx`

- [ ] **Step 1: Write the page**

`apps/website/src/pages/letters/farewell.tsx`:

```tsx
import Head from 'next/head';
import Link from 'next/link';

export default function Farewell() {
    return (
        <>
            <Head>
                <title>Farewell — vamy</title>
                <meta name="robots" content="noindex" />
            </Head>

            <main className="min-h-screen bg-white text-gray-900 flex items-center justify-center px-6 py-24">
                <div className="max-w-[520px] w-full text-center font-serif">
                    <h1
                        className="text-4xl font-light mb-12 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms ease-out 200ms forwards' }}
                    >
                        The door&rsquo;s closed.
                    </h1>

                    <p
                        className="text-lg leading-relaxed text-gray-700 mb-8 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms ease-out 1000ms forwards' }}
                    >
                        You won&rsquo;t hear from the studio again. No hard feelings &mdash;
                        the work keeps happening either way.
                    </p>

                    <p
                        className="text-base text-gray-600 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms ease-out 1800ms forwards' }}
                    >
                        If it was an accident, you can sign back up at vamy.art.
                    </p>

                    <p
                        className="text-base text-gray-600 mb-16 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms ease-out 2600ms forwards' }}
                    >
                        &mdash; Maeve
                    </p>

                    <div
                        className="text-sm text-gray-500 opacity-0"
                        style={{ animation: 'letters-fade-dim 1600ms ease-out 3400ms forwards' }}
                    >
                        <Link href="/" className="hover:text-gray-900 transition-colors">
                            &rarr; back to vamy.art
                        </Link>
                    </div>
                </div>

                <style jsx>{`
                    @keyframes letters-fade-dim {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 0.55; transform: translateY(0); }
                    }
                `}</style>
            </main>
        </>
    );
}
```

Note: the keyframe ends at `opacity: 0.55` (the "settle to dim" effect from the design). All elements settle to the same dimmed state.

- [ ] **Step 2: Build the website to verify typecheck + Next compile**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: build succeeds, `/letters/farewell` listed as a static page in the output.

- [ ] **Step 3: Visual smoke test**

In `pnpm --filter=@vamy/website dev`, open `http://localhost:3000/letters/farewell` and verify:
- Lines appear one at a time, fading to a *dimmed* state (~55% opacity), not fully visible.
- No header, no footer.
- One `→ back to vamy.art` link at the bottom.
- View source: `<meta name="robots" content="noindex"/>` is present.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/pages/letters/farewell.tsx
git commit -m "feat(letters): add /letters/farewell post-unsubscribe page"
```

---

### Task 3: Update Buttondown redirect URLs

This is a dashboard-config task, not code. Do it after the pages ship to production.

- [ ] **Step 1: Verify pages are live on production**

Open `https://vamy.art/letters/welcome` and `https://vamy.art/letters/farewell` in incognito. Both should render correctly.

- [ ] **Step 2: Set Buttondown confirmation redirect URL**

Buttondown dashboard → Settings → Subscribing → "Where should subscribers be redirected after confirming their subscription?"

Set to: `https://vamy.art/letters/welcome`

- [ ] **Step 3: Set Buttondown unsubscribe redirect URL**

Same dashboard section → "Where should subscribers be redirected after unsubscribing?"

Set to: `https://vamy.art/letters/farewell`

- [ ] **Step 4: End-to-end smoke test**

Sign up on `vamy.art` with a `+alias` email (e.g. `martin+letterstest@yankovs.com`):

1. Submit footer form.
2. Open confirmation email.
3. Click confirm link.
4. Verify browser lands on `/letters/welcome` and the fade animation plays.
5. Click an unsubscribe link from the welcome or confirmation email.
6. Verify browser lands on `/letters/farewell` and the dim-settle animation plays.
7. Clean up: delete the test subscriber in Buttondown.

---

## Done criteria

- [ ] Both pages live on production at the expected URLs.
- [ ] Both pages render with no site chrome.
- [ ] Both fade animations work in Chrome and Safari.
- [ ] Both pages have `noindex` meta.
- [ ] Buttondown dashboard wired to both URLs.
- [ ] End-to-end signup → confirm → unsubscribe flow lands on the right pages.
