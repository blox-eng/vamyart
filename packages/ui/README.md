# @vamy/ui

The design-system layer shared by `apps/website` and `apps/admin`. Rules: [`DESIGN.md`](../../DESIGN.md).

- `@vamy/ui/tokens.css` — colour, radius and motion tokens (CSS custom properties, light + dark). Import once per app, before the app's own CSS.
- `@vamy/ui/tailwind-preset` — maps Tailwind utilities onto the tokens (`bg-paper`, `text-ink`, `text-muted`, `border-hair`, `bg-accent`, `rounded`, `duration-standard`, …). Add it as `presets: [preset]` in each app's Tailwind config.
- `cn()` — class-name merge helper.

Shared React components get added here when a second caller needs them, built on the tokens.

## Canvas components (future)

Three.js / React Three Fiber components will live in `src/components/canvas/`. Always use `dynamic(() => import(...), { ssr: false })` when consuming them.
