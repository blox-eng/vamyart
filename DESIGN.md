# vamy.art Design System

**Read this before making any visual or UI decision**, in either app. Every colour, type, space, radius and motion value is defined here and lives as a token in `packages/ui/src/styles/tokens.css`. Don't deviate without agreeing it first. In review, flag anything that breaks these rules.

**Positioning: a quiet gallery for one painter's work.** The paintings are muted seascapes: bone skies, aubergine-black land, and one thin streak of sea-glass green in the water. The interface borrows that palette and then gets out of the way. When a choice is ambiguous, pick the more restrained option.

The rules are adapted from the Blox design system (`blox-eng/blox` → `blox-web/packages/ui/DESIGN.md`). Blox's rules carry over; its palette, mono type and instrument density do not.

---

## 0. The six rules

1. **The work is the only colour.** The UI is near-monochrome paper and ink. Colour belongs to the paintings and photographs. If you're reaching for a colour, the answer is almost always a neutral.
2. **Sea glass is the only accent.** It's used rarely and only where it carries meaning: the primary action, active/selected, focus, text selection, and an occasional hairline. Scarcity is the point.
3. **Cardless.** No boxed widgets, drop shadows or rounded containers around groups. Structure comes from whitespace, hairlines, small labels and alignment. The artwork is the only "object" on the page.
4. **Status is never hue alone.** Pair it with a glyph and a label (`● Sold`, `▲ Low stock`). Normal is neutral, not green.
5. **Warm, never pure.** No `#000`, no `#FFF`. Every neutral shares the paper/ink undertone so the UI reads as one material.
6. **One motion system.** Same curve everywhere, slow enough to read as calm, never bouncy. Reduced-motion users get instant state changes.

---

## 1. Colour

Tokens are CSS custom properties. Use them through Tailwind (`bg-[var(--bg)]` or theme aliases) and never as raw hex or `gray-*` / `black` / `white` utilities.

| Token | Light | Dark | Job |
|---|---|---|---|
| `--bg` | `#F4F0E9` bone paper | `#151214` night ink | page ground |
| `--field` | `#FBF9F5` | `#1E1A1D` | input/field fill, sheet surface |
| `--wall` | `#E9E4DC` | `#1A1618` | ground behind artwork and photographs |
| `--text` | `#1F1A1E` aubergine ink | `#ECE6DF` | body, headings |
| `--muted` | `#5E565B` | `#ADA4A8` | secondary text, **small labels** |
| `--faint` | `#8A8186` | `#7F767B` | placeholders, disabled, icons only (see contrast) |
| `--hair` / `--hair-soft` | ink @ 12% / 6% | bone @ 10% / 5% | rules, row separators |
| `--hover-wash` | ink @ 3.5% | bone @ 4% | hover on controls; never accent |
| `--accent` | `#4A655E` sea glass | `#9AB2A9` | the single accent |
| `--accent-wash` | accent @ 10% | accent @ 10% | active/selected only |
| `--on-accent` | `#F4F0E9` | `#151214` | text on an accent fill |
| `--warn` | `#80601F` | `#C9A15A` | attention (low stock, unpaid) |
| `--neg` | `#97473A` | `#D07A63` | sold, failed, destructive |

**Contrast (WCAG 2.2, verified):** text 15:1, muted 6.3:1 light / 7.7:1 dark, accent 5.6:1 / 8.3:1, warn 5.1:1 / 7.7:1, neg 5.6:1 / 5.9:1. All pass AA for body text. **`--faint` is 3.3:1 on light, so it fails AA for small text.** Use it only for placeholders, disabled controls, icons and decorative glyphs, never for a label someone has to read.

**Rules**
- The accent appears **only** on: the primary action, active/selected state, focus rings, text selection, and the occasional signature hairline. More than a few accent elements on one screen means it's overused.
- **Alpha ramp, not new colours.** Express states as the accent at 100% (action) and 10% (selected wash).
- **Sold** = `--neg` dot + the word "Sold". The red dot on gallery cards (#37) is this token.
- **Never** introduce blue/indigo/purple primaries, saturated greens, or neon status colours.
- **Temporary exception:** the public site uses a white `--bg` until artwork photos are cut out of their white studio backgrounds (cut-out editor, #40); then it returns to bone paper.
- **Themes:** the studio follows the OS preference. The public site pins `data-theme="light"` (paper) until a dark gallery is deliberately designed. Photography pages may use `--wall` as their ground.

---

## 2. Typography

Two families, both self-hosted with `next/font` (never a render-blocking `@import`):

- **Cormorant Garamond**: display and headings. Weights 300 / 400, plus italic. This is the artist's voice; the Blox ban on fashion serifs doesn't apply here.
- **Inter**: UI, body, forms, data. Weights **400 / 500 / 600 only** (no 700). Build hierarchy from weight and colour first, size second.

**Rules**
- **Numbers that change or align** (prices, quantities, dates in tables, edition numbers) use `font-variant-numeric: tabular-nums` (`tabular-nums` in Tailwind).
- **Micro-labels** (section labels, table headers, field labels in the studio): Inter 500, 11–12px, uppercase, tracked `0.08–0.12em`, `--muted`. Generous tracking reads as confidence.
- **Display sizes** get slight negative tracking (`-0.01em` to `-0.02em`). Body never does.
- **Scale** (ranks, not every size):
  - public hero 56–72 / 300 serif
  - page title 36–44 / 400 serif
  - studio page title 24 / 500 Inter
  - body 16 (site) / 14 (studio)
  - micro-label 11
- Line length for prose: 60–72ch (`max-w-prose`).
- Typographic ellipsis `…` and real quotes `“ ”`, never `...` or `"`.

---

## 3. Spacing & layout

- **Base 4px.** Scale: `4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96 · 128`.
- **Proximity groups.** More space around a group than within it; that replaces borders.
- **Cardless structure.** Separate regions with a micro-label, a `--hair` rule and vertical space. Use `--hair-soft` row separators only where data needs alignment (tables, lists).
- **Elevation**, only for things that float (popover, menu, sheet, dialog, toast): `box-shadow: 0 0 0 1px var(--hair), 0 8px 24px -12px rgb(0 0 0 / 0.18)`. Nothing that sits in the page flow gets a shadow.

**Public site**
- Generous: sections are separated by 96–128px on desktop and 64px on mobile.
- Containers: full-bleed for hero and featured work; `1200px` for grids; `prose` for text.
- Images sit on the page or on `--wall` with no frame, border or rounded corners. **Never crop artwork** in gallery or detail views (`object-contain`). Covers that are intentionally cropped (collection 3:2 crop) are the only exception.
- 16px minimum side gutter on mobile; no horizontal scroll.

**Studio**
- **One page container everywhere:** `max-w-[1120px] mx-auto px-4 sm:px-8 py-8`, always centered. Forms inside it may narrow to `max-w-xl`, still aligned to the container's left edge.
- **One page header:** title (24/500) + optional one-line subtitle in `--muted` + primary action right-aligned, `mb-8`.
- Put "what needs me" top-left (new messages, unpaid orders), then the lists.

---

## 4. Radius

```
--radius-art: 0px    artwork, photographs, image tiles, rules, tables: the work is never rounded
--radius-xs:  2px    chips, tags, status pills
--radius-sm:  4px    buttons, inputs, selects
--radius-md:  8px    popovers, menus, toasts
--radius-lg: 12px    sheets, dialogs, command palette (studio only)
```

- The public site is square, like a frame edge: `0` for images and buttons, `--radius-xs` for chips. Pill shapes are allowed only for circular things (avatars, dots, radio).
- The studio uses the scale above. The contrast between 0px work and 4px controls separates "look" from "touch".
- **Never** `rounded-full` on rectangles, and never over 12px.

---

## 5. Motion

| Token | Value | Use |
|---|---|---|
| `--ease` | `cubic-bezier(0.22, 1, 0.36, 1)` | every transition: ease-out, no overshoot |
| `--dur-micro` | 120ms | hover, press, colour |
| `--dur-standard` | 180ms | state changes, toggles, list items |
| `--dur-deliberate` | 240ms | sheets, dialogs, page content entering |
| `--dur-reveal` | 600ms | public site only: image fade/rise on scroll and load |

- **No instant state changes and no bounce.** Use the same curve everywhere; inconsistent motion kills a premium feel faster than slow motion does.
- **Enter:** opacity 0→1 plus translate 4–8px. **Exit:** faster than enter (~0.75×). **Reorder:** animate position (FLIP), never jump.
- **Images** fade in from `--wall` once loaded. No spinners over artwork.
- `prefers-reduced-motion`: the tokens drop to 0ms. Anything driven by JS (scroll reveals, carousels) must check the media query too.

---

## 6. Interaction

- **Hover = reveal, not fill.** A link or row "wakes up": the title gets an underline (1px, offset 4px), `→` slides 2px, secondary text moves from muted to text. Nothing structural moves; no layout shift, no border swap.
- On image tiles, hover may lift the caption into view or brighten it. **Don't scale or zoom the artwork** on hover.
- **Active/selected** gets `--accent-wash`. Hover never uses the accent.
- **Primary action:** an `--accent` fill with `--on-accent` text, **one per view**. Secondary is a text-colour outline or a plain text link. Destructive is `--neg` text, filled only in the confirm step.
- **Focus rings** and **text selection** use the accent (set globally in `tokens.css`).
- Targets are at least 40px tall on touch.

---

## 7. States (every screen, both apps)

Every data view handles **loading, empty, error and success**, and they must look different from each other:

- **Loading:** a skeleton that **matches the final layout** (a grid skeleton for grids, rows for tables), drawn in `--hair-soft` blocks with a slow shimmer. Reserve space so nothing jumps when data lands. No full-page spinners.
- **Empty:** one sentence explaining what will appear here, plus the next action ("No pieces yet. Add your first piece").
- **Error:** says what failed in plain words, with a **Retry** button. An error must never look like an empty list.
- **Mutations:**
  - Show pending state **on the item acted on**, never the whole list.
  - Every mutation has `onError` → toast with the reason.
  - Reversible actions (toggle, reorder, hide, delete-to-trash) are optimistic, with an **Undo** toast instead of a confirm step.
  - Irreversible actions (permanent delete, refund, sending email) get an explicit confirm naming the thing.
- **Toasts:** bottom-centre on mobile, bottom-right on desktop. They enter and exit with motion, hold about 4s, and stay while hovered.
- **Uploads:** per-file progress → "Optimising…" (the client-side downscale) → done. Drag-and-drop is supported everywhere a file can be added.

---

## 8. Voice & copy

- **Public site:** Maeve speaks in first person, quietly, in lowercase for navigation and small actions ("on the wall", "in the studio", "write to maeve"). Headings are sentence case. **No ALL CAPS** except tracked micro-labels.
- **Studio:** sentence case everywhere. Buttons are verbs ("Save piece", "Publish"). Toasts are past-tense facts ("Piece saved", "Collection published"). Errors say what happened and what to do next.
- Use "piece" for an artwork everywhere a person reads it; "artwork" stays in code.
- Never hardcode a person's name in UI copy. Read it from the session or settings.
- Alt text describes the work itself (subject, medium, mood), never "image" or template filler.

---

## 9. Anti-patterns (flag in review)

- Raw `gray-*`, `black`, `white`, or hex values in components instead of tokens.
- Any accent outside §1's list; more than one primary action per view.
- Bordered + shadowed "cards" in page flow; uniform N-card grids of stats.
- Rounded or zoomed artwork; cropped artwork in gallery or detail views.
- Full-row background on hover; layout shift on hover.
- Instant state changes, bounce/overshoot easing, ad-hoc durations.
- Skeletons that don't match the final layout; errors that look empty; one pending flag freezing a whole list.
- Two-step "Delete → Confirm" for something that could be undone.
- ALL CAPS buttons, `...` instead of `…`, mixed casing in toasts.
- `font-weight: 700`; a render-blocking font `@import`; `system-ui` as the visible face.
- Status communicated by colour alone.

---

## 10. Review checklist

Before opening a UI PR:

- [ ] Only tokens, no raw colours
- [ ] Light **and** dark checked (studio)
- [ ] Loading / empty / error states present and layout-matched
- [ ] Every mutation has per-item pending + `onError`
- [ ] Motion uses the duration/ease tokens; checked with reduced motion on
- [ ] Keyboard: focus visible, tab order sane, Esc closes overlays
- [ ] 375px mobile: no horizontal scroll, 16px gutters, 40px targets
- [ ] Copy follows §8
