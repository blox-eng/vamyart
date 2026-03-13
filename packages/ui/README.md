# @vamy/ui

Shared shadcn/ui component primitives. Used by `apps/admin` primarily; the website uses its own Tailwind-based components.

## Adding a component

```bash
# From repo root:
pnpm --filter @vamy/ui dlx shadcn@latest add <component>
```

Components land in `src/components/ui/`. Export from `src/index.ts`.

## Canvas components (future)

Three.js / React Three Fiber components will live in `src/components/canvas/`. Always use `dynamic(() => import(...), { ssr: false })` when consuming them.
