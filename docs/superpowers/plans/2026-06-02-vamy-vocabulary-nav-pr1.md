# Vamy Vocabulary Nav — PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reframe vamy.art's header navigation and footer newsletter pitch to use the studio's own vocabulary, in the lowercase serif voice already established by the `/letters/welcome` and `/letters/farewell` pages.

**Architecture:** Pure frontend, content-driven. Three surfaces change: `header.json` (labels), `Header/index.tsx` (typography for nav links), and `Footer/index.tsx` `NewsletterSignup` (copy). No new routes, no DB, no admin. URLs remain stable. The `/letters` archive link and the conditional `quiet` nav item are deferred to PR 2 and PR 3 respectively — see Out-of-scope section.

**Tech Stack:** Next.js 15 Pages Router, React 19, Tailwind (font-serif → Cormorant Garamond), JSON content config.

**Spec:** [`docs/superpowers/specs/2026-06-02-vamy-vocabulary-navigation-design.md`](../specs/2026-06-02-vamy-vocabulary-navigation-design.md)

## Note on testing

The website repo has no component-test harness, and the changes in this PR are purely visual/content. Verification is:

1. `pnpm turbo build --filter=@vamy/website` succeeds (typecheck + Next build).
2. `pnpm --filter=@vamy/website dev` and visit `/`, `/gallery`, `/about`, `/get-a-piece`, and `/letters/welcome` — verify the nav renders the new labels in lowercase serif on every page.
3. Footer renders the new newsletter copy on every page.
4. Mobile menu (under 1024px) renders the same new labels.
5. Subscribe form still works end-to-end (paste a `+alias` email, verify Buttondown confirmation arrives).

No new unit tests are warranted. If a future task extracts logic worth testing, add the test then.

## Out-of-scope for this PR (deferred)

- **`/letters` archive route** → deferred to PR 2 (depends on Buttondown archive integration).
- **Conditional `quiet` nav item when gallery is empty** → deferred. Requires threading `wallState` through the layout system. The Studio Quiet design (separate spec) already handles the on-page empty state without it. Revisit after PR 1 ships.
- **`/about` content rewrite + `studioNote` admin field** → deferred to PR 3 (the admin-bearing PR). Label changes from `ABOUT` to `in the studio` in this PR; page body stays as-is.

## Vocabulary (approved by Maeve 2026-06-02)

| Position | Old label | New label | URL |
|---|---|---|---|
| Primary | `ABOUT` | `in the studio` | `/about` (unchanged) |
| Primary | `GALLERY` | `on the wall` | `/gallery` (unchanged) |
| Button | `GET A PIECE` | `write to maeve` | `/get-a-piece` (unchanged) |

Footer signup headline `First dibs` → `the letter`. Body copy rewritten in the letters voice.

---

### Task 1: Update header labels in `header.json`

**Files:**
- Modify: `apps/website/content/data/header.json`

- [ ] **Step 1: Edit `header.json`**

Open `apps/website/content/data/header.json` and replace the file contents with:

```json
{
    "logo": {
        "url": "/images/vamy-black-sm.png",
        "altText": "Logo dark",
        "styles": {
            "self": {
                "margin": [
                    "mr-3"
                ]
            }
        },
        "type": "ImageBlock"
    },
    "primaryLinks": [
        {
            "label": "on the wall",
            "altText": "On the wall — the gallery",
            "url": "/gallery",
            "icon": "arrowRight",
            "iconPosition": "right",
            "style": "secondary",
            "type": "Link"
        },
        {
            "label": "in the studio",
            "altText": "In the studio — about the artist",
            "url": "/about",
            "icon": "arrowRight",
            "iconPosition": "right",
            "style": "secondary",
            "type": "Link"
        }
    ],
    "secondaryLinks": [
        {
            "label": "write to maeve",
            "url": "/get-a-piece",
            "icon": "arrowRight",
            "iconPosition": "right",
            "style": "primary",
            "type": "Button",
            "altText": "Write to Maeve"
        }
    ],
    "variant": "logo-left-primary-nav-right",
    "colors": "bg-light-fg-dark",
    "type": "Header"
}
```

The only changes from the previous file: three `label` strings (`on the wall`, `in the studio`, `write to maeve`), and three `altText` strings updated to match. URLs, ordering, types, styles, and variant are unchanged.

- [ ] **Step 2: Build to verify config still parses**

Run from repo root:
```bash
pnpm turbo build --filter=@vamy/website
```

Expected: build succeeds. No TypeScript errors. The site generates as before.

- [ ] **Step 3: Visual smoke test of labels**

Run:
```bash
pnpm --filter=@vamy/website dev
```

Open `http://localhost:3000/` and verify:
- Header shows `on the wall · in the studio` as the primary nav (still uppercase at this point — typography styling comes in Task 2).
- The button shows `write to maeve`.
- Clicking `on the wall` lands on `/gallery`.
- Clicking `in the studio` lands on `/about`.
- Clicking `write to maeve` lands on `/get-a-piece`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/data/header.json
git commit -m "feat(nav): rename header labels to studio vocabulary"
```

---

### Task 2: Lowercase serif styling for header nav

**Files:**
- Modify: `apps/website/src/components/sections/Header/index.tsx`

The current `<Action>` atom renders nav labels in the site's default sans-serif with uppercase tracking (per the existing CSS for `sb-component-link-secondary`). The vocabulary-as-nav move requires lowercase serif to match the letters pages' voice. This is achieved by adding Tailwind classes on the wrapping `<li>` and stripping any uppercase transform.

- [ ] **Step 1: Identify where nav link classes are applied**

In `apps/website/src/components/sections/Header/index.tsx`, lines 302–319 (the `ListOfLinks` component, primary-link branch), the current classes on `<Action>` are:

```tsx
className={classNames('whitespace-nowrap', inMobileMenu ? 'w-full' : 'text-sm', {
    'justify-start py-3': inMobileMenu && link.__metadata.modelName === 'Link'
})}
```

The mobile and desktop renderings of primary links both pass through this code path. We add new classes that force lowercase and apply the serif font.

- [ ] **Step 2: Apply lowercase serif classes**

Replace the existing className expression on the `<Action>` inside `ListOfLinks` (around line 311) with:

```tsx
className={classNames(
    'whitespace-nowrap',
    'normal-case',
    'tracking-normal',
    'font-serif',
    inMobileMenu ? 'w-full text-lg' : 'text-base',
    {
        'justify-start py-3': inMobileMenu && link.__metadata.modelName === 'Link'
    }
)}
```

Notes:
- `normal-case` overrides any inherited `uppercase` from the link atom's CSS.
- `tracking-normal` overrides the wide letter-spacing typical of small caps nav.
- `font-serif` switches to Cormorant Garamond (already configured in `tailwind.config.js`).
- Desktop size bumps from `text-sm` to `text-base` because serifs at 14px read thin.
- Mobile size bumps to `text-lg` for legibility in the slide-out menu.

The secondary-link button (`write to maeve`) keeps its existing styling — it's a CTA, not body voice, and the contrast between sans button and serif nav reinforces hierarchy.

- [ ] **Step 3: Build to verify typecheck**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: succeeds. No TypeScript errors.

- [ ] **Step 4: Visual smoke test of typography**

```bash
pnpm --filter=@vamy/website dev
```

Open `http://localhost:3000/` and verify on desktop (≥1024px wide):
- `on the wall` and `in the studio` render in lowercase, serif (Cormorant Garamond), at `text-base` (16px).
- No letter-spacing — letters sit close together.
- `write to maeve` button is unchanged (still sans-serif uppercase per its existing styling).

Resize the browser below 1024px to trigger the mobile menu. Open the menu via the hamburger icon. Verify:
- Primary links inside the menu also render in lowercase serif at `text-lg`.
- Button label below the primary links is unchanged.

Click each link to confirm routing still works.

- [ ] **Step 5: Verify the change applies to every page**

In `pnpm dev`, visit each of: `/`, `/gallery`, `/about`, `/get-a-piece`, `/letters/welcome`, `/letters/farewell`. The header should render identically across all of them.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/sections/Header/index.tsx
git commit -m "feat(nav): switch primary nav to lowercase serif voice"
```

---

### Task 3: Rewrite footer newsletter signup copy

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx`

Current footer signup (lines 126–153 of `Footer/index.tsx`) has a sans-serif uppercase headline `First dibs` with body copy `New work lands here first. 24 hours before anywhere else.` The form mechanic is correct — only the surrounding copy changes.

- [ ] **Step 1: Edit the headline and body**

In `apps/website/src/components/sections/Footer/index.tsx`, locate the `NewsletterSignup` component. Replace the `<h2>` and `<p>` at lines 128–129:

Current:
```tsx
<h2 className="uppercase text-base tracking-wide mb-2">First dibs</h2>
<p className="text-sm mb-4">New work lands here first. 24 hours before anywhere else.</p>
```

Replace with:
```tsx
<h2 className="font-serif text-2xl mb-3">the letter</h2>
<p className="text-sm leading-relaxed mb-5 max-w-sm">
    Sometimes from the studio. About paint, mostly. About what&rsquo;s on the wall, sometimes. About what&rsquo;s gone, occasionally.
</p>
```

Notes:
- Headline shifts from sans uppercase to serif lowercase to match the new nav voice.
- Body copy is rewritten in the letters voice — no promise of frequency, no benefit list.
- `&rsquo;` for the apostrophes (matches the pattern in `welcome.tsx` and `farewell.tsx`).
- Increased `mb-` spacing and `leading-relaxed` give the copy room to breathe.
- `max-w-sm` keeps the line length readable on wide footers.

- [ ] **Step 2: Update the success-state copy to match the voice**

In the same component, replace the success message at line 131:

Current:
```tsx
<p className="text-sm text-green-600">Check your inbox to confirm.</p>
```

Replace with:
```tsx
<p className="text-sm font-serif italic">Check your inbox.</p>
```

Notes:
- Drops the verbose verb. The letters voice is short.
- Drops the green color — semantically it's a confirmation, but in the letters voice color shouts. Italic serif carries the success signal quietly.

- [ ] **Step 3: Build to verify typecheck**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: succeeds.

- [ ] **Step 4: Visual smoke test**

```bash
pnpm --filter=@vamy/website dev
```

Scroll to the footer on `http://localhost:3000/` and verify:
- Headline `the letter` renders in serif at `text-2xl` (24px), lowercase.
- Body copy renders in three short clauses with apostrophes (curly, not straight).
- Email input + Subscribe button are visually unchanged.

Test the full subscribe flow with a `+alias` email (e.g. `martin+vocabtest@yankovs.com`):
- Submit the form.
- Verify the success message reads `Check your inbox.` in serif italic.
- Verify a confirmation email arrives from Buttondown.

- [ ] **Step 5: Verify footer appears identically on every page**

Visit `/`, `/gallery`, `/about`, `/get-a-piece` in `pnpm dev` and confirm the footer renders the same.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx
git commit -m "feat(footer): rewrite newsletter signup in studio voice"
```

---

### Task 4: Full-site verification + open PR

**Files:** none (verification + git only)

- [ ] **Step 1: Final build to verify the full change set compiles**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: clean build, no errors.

- [ ] **Step 2: End-to-end visual pass**

Run `pnpm --filter=@vamy/website dev`. Walk every public page and confirm the nav + footer render correctly:

- `http://localhost:3000/` — homepage
- `http://localhost:3000/gallery` — gallery (with current public pieces)
- `http://localhost:3000/about` — about (currently empty content; label change still applies)
- `http://localhost:3000/get-a-piece` — inquiry form (page body unchanged)
- `http://localhost:3000/letters/welcome` — newsletter confirmation page
- `http://localhost:3000/letters/farewell` — newsletter farewell page

On every page, header reads: `on the wall · in the studio` with a `write to maeve` button, all in the correct typography. Footer signup reads `the letter` headline with the new body copy.

- [ ] **Step 3: Mobile check**

Use browser devtools to switch to a mobile viewport (375px width). On the homepage, open the mobile menu. Confirm:
- Primary links render `on the wall` and `in the studio` in lowercase serif at `text-lg`.
- Button renders `write to maeve` (sans, unchanged style).
- Tapping each link navigates correctly.

- [ ] **Step 4: Lighthouse a11y sanity check**

In Chrome DevTools, run Lighthouse on `/` with category "Accessibility" only. Expected: score ≥ 95. The serif/lowercase change should not affect contrast, ARIA, or semantics — but verify.

- [ ] **Step 5: Push branch and open PR**

```bash
git checkout -b feat/vocabulary-nav-pr1
git push -u origin feat/vocabulary-nav-pr1
gh pr create --title "feat: rewrite header + footer in studio voice (vocabulary nav PR 1)" --body "$(cat <<'EOF'
## Summary
- Header labels: `ABOUT / GALLERY / GET A PIECE` → `on the wall / in the studio / write to maeve`
- Header nav typography: lowercase serif (Cormorant Garamond) to match `/letters/*` voice
- Footer newsletter signup: headline + body rewritten in the studio voice; success message tightened

Vocabulary confirmed by Maeve 2026-06-02. URLs unchanged, no DB or admin work. PRs 2 and 3 (letters archive, in-the-studio page) follow separately.

Spec: docs/superpowers/specs/2026-06-02-vamy-vocabulary-navigation-design.md
Plan: docs/superpowers/plans/2026-06-02-vamy-vocabulary-nav-pr1.md

## Test plan
- [ ] Visited every public page (`/`, `/gallery`, `/about`, `/get-a-piece`, `/letters/welcome`, `/letters/farewell`) and confirmed nav + footer render the new copy in lowercase serif
- [ ] Mobile menu (≤1024px) renders new labels at `text-lg` serif
- [ ] Footer newsletter signup form submits and shows the new success message
- [ ] Buttondown confirmation email arrives after subscribe
- [ ] Lighthouse a11y score ≥ 95 on `/`
- [ ] No TypeScript errors; build clean
EOF
)"
```

---

## Done criteria

- [ ] All three labels in the header read the new vocabulary in lowercase serif.
- [ ] Footer newsletter signup uses the new copy and success message.
- [ ] All existing URLs (`/gallery`, `/about`, `/get-a-piece`) still work.
- [ ] Mobile menu shows the new labels with appropriate sizing.
- [ ] Subscribe flow still works end-to-end.
- [ ] PR open, awaiting Netlify preview deploy for final visual review with Maeve before merge.

## After this PR ships

Send the Netlify preview URL to Maeve. Ask her to walk the site for two minutes. If a word still feels wrong in context, swap it before merging to main (one-line change in `header.json`). Then merge.

Once live, PR 2 (`/letters` archive) and PR 3 (in-the-studio + `studioNote` admin field) can be scoped and planned independently.
