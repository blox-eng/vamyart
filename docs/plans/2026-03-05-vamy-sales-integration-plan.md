# vamy.art Sales & Bidding Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restructure vamy.art into a Turborepo monorepo, add a full bidding system, self-serve print/merch checkout, and an artist admin panel — all on top of Next.js 15 + tRPC + Drizzle + Supabase.

**Architecture:** Two Next.js 15 apps (`apps/website`, `apps/admin`) sharing `packages/ui` (shadcn/ui), `packages/db` (Drizzle schema + tRPC routers), and `packages/i18n` (next-intl messages). Supabase provides PostgreSQL, Auth, and Realtime. Stripe handles checkout. Resend handles email.

**Tech Stack:** Next.js 15, React 19, tRPC v11, Drizzle ORM, Supabase (postgres + auth + realtime), Stripe, Resend, Buttondown, next-intl, shadcn/ui, Tailwind CSS, Turborepo, pnpm workspaces, Vitest, Netlify.

**Design doc:** `docs/plans/2026-03-05-vamy-sales-integration-design.md`

**Key constraint:** The existing website uses **Pages Router** (`src/pages/`). We keep it. New API routes live in `app/api/` (App Router). Next.js 15 supports both simultaneously. Do not migrate the content system.

---

## Task 1: Monorepo Root Bootstrap

**Files:**
- Create: `turbo.json`
- Create: `pnpm-workspace.yaml`
- Create: `package.json` (root)
- Create: `.nvmrc`
- Modify: `.gitignore` (add monorepo ignores)

**Step 1: Install Turborepo globally (if not present)**

```bash
pnpm add -g turbo
turbo --version  # should print 2.x
```

**Step 2: Create root `package.json`**

```json
{
  "name": "vamy",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "test": "turbo test",
    "format": "prettier --write \"**/*.{ts,tsx,md}\""
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "prettier": "^3.3.2",
    "typescript": "^5.6.2"
  },
  "packageManager": "pnpm@10.28.1",
  "engines": {
    "node": ">=20"
  }
}
```

**Step 3: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

**Step 4: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

**Step 5: Create `.nvmrc`**

```
23
```

**Step 6: Add monorepo entries to `.gitignore`**

Append to existing `.gitignore`:
```
# Turborepo
.turbo

# pnpm
node_modules/
```

**Step 7: Commit**

```bash
git add turbo.json pnpm-workspace.yaml package.json .nvmrc .gitignore
git commit -m "chore: add turborepo monorepo root config"
```

---

## Task 2: Migrate Website to `apps/website`

**Files:**
- Move: all existing root files → `apps/website/`
- Create: `apps/website/package.json` (updated)
- Create: `apps/website/netlify.toml`

**Step 1: Create directory structure**

```bash
mkdir -p apps/website apps/admin packages/ui packages/db packages/i18n
```

**Step 2: Move existing website files**

```bash
git mv src apps/website/src
git mv content apps/website/content
git mv public apps/website/public
git mv next.config.js apps/website/next.config.js
git mv tailwind.config.js apps/website/tailwind.config.js 2>/dev/null || true
git mv postcss.config.js apps/website/postcss.config.js 2>/dev/null || true
git mv tsconfig.json apps/website/tsconfig.json
git mv stackbit.config.ts apps/website/stackbit.config.ts 2>/dev/null || true
```

**Step 3: Create `apps/website/package.json`**

```json
{
  "name": "@vamy/website",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3000",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@vamy/db": "workspace:*",
    "@vamy/i18n": "workspace:*",
    "@vamy/ui": "workspace:*",
    "@algolia/autocomplete-js": "^1.17.1",
    "@algolia/autocomplete-theme-classic": "^1.17.1",
    "algoliasearch": "^4.24.0",
    "classnames": "^2.5.1",
    "dayjs": "^1.11.11",
    "front-matter": "^4.0.2",
    "glob": "^10.4.2",
    "markdown-to-jsx": "^7.7.3",
    "marked": "^14.1.2",
    "next": "15.3.8",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "swiper": "^11.1.4",
    "tailwindcss": "^3.4.3"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.1",
    "@types/glob": "^8.1.0",
    "autoprefixer": "^10.4.19",
    "typescript": "^5.6.2",
    "vitest": "^2.0.0"
  }
}
```

**Step 4: Create `apps/website/netlify.toml`**

```toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/website"
  publish = ".next"
```

**Step 5: Delete old root `package.json` entries that are now in `apps/website`**

Remove the old `netlify.toml` at root (it's been replaced):
```bash
git rm netlify.toml
```

**Step 6: Install dependencies from monorepo root**

```bash
cd /path/to/monorepo/root
pnpm install
```

**Step 7: Verify website still builds**

```bash
pnpm turbo build --filter=@vamy/website
```

Expected: same build output as before, `.next` in `apps/website/.next`.

**Step 8: Commit**

```bash
git add -A
git commit -m "chore: migrate website to apps/website monorepo structure"
```

---

## Task 3: `packages/ui` — Shared Component Library

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/index.ts`
- Create: `packages/ui/src/components/button.tsx`
- Create: `packages/ui/src/components/input.tsx`
- Create: `packages/ui/src/components/badge.tsx`
- Create: `packages/ui/src/components/canvas-wrapper.tsx`

**Step 1: Create `packages/ui/package.json`**

```json
{
  "name": "@vamy/ui",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "lint": "tsc --noEmit"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.5.2",
    "lucide-react": "^0.454.0"
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "typescript": "^5.6.2"
  }
}
```

**Step 2: Create `packages/ui/src/lib/utils.ts`**

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

**Step 3: Create `packages/ui/src/components/button.tsx`**

Standard shadcn/ui Button component. Run:
```bash
# From apps/website or apps/admin, after shadcn init (Task 23)
# For now, create a minimal version:
```

```typescript
import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90",
        outline: "border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
);
Button.displayName = "Button";

export { Button, buttonVariants };
```

**Step 4: Create `packages/ui/src/components/canvas-wrapper.tsx`**

Placeholder for future Three.js/React Three Fiber integration. Uses dynamic import to avoid SSR.

```typescript
"use client";
// Future Three.js canvas components go here.
// Always use Next.js dynamic import with { ssr: false } for any @react-three/fiber components:
//
// const Scene = dynamic(() => import('./my-scene'), { ssr: false })
//
// Future deps to add when needed:
//   three, @react-three/fiber, @react-three/drei
//
// This file is a placeholder. Delete and replace with actual canvas components.

export {};
```

**Step 5: Create `packages/ui/src/index.ts`**

```typescript
export * from "./components/button";
export * from "./lib/utils";
// Add more exports as components are added
```

**Step 6: Create `packages/ui/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules"]
}
```

**Step 7: Commit**

```bash
git add packages/ui
git commit -m "feat: add packages/ui shared component library with shadcn/ui primitives"
```

---

## Task 4: `packages/i18n` — Shared i18n

**Files:**
- Create: `packages/i18n/package.json`
- Create: `packages/i18n/src/index.ts`
- Create: `packages/i18n/messages/en.json`
- Create: `packages/i18n/messages/de.json`
- Create: `packages/i18n/messages/bg.json`

**Step 1: Create `packages/i18n/package.json`**

```json
{
  "name": "@vamy/i18n",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts",
    "./messages/*": "./messages/*"
  },
  "devDependencies": {
    "typescript": "^5.6.2"
  }
}
```

**Step 2: Create `packages/i18n/src/index.ts`**

```typescript
export const locales = ["en", "de", "bg"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";

export const localeNames: Record<Locale, string> = {
  en: "English",
  de: "Deutsch",
  bg: "Български",
};
```

**Step 3: Create `packages/i18n/messages/en.json`**

```json
{
  "nav": {
    "gallery": "Gallery",
    "about": "About",
    "contact": "Get a Piece",
    "language": "Language"
  },
  "footer": {
    "newsletter": {
      "title": "Stay in the loop",
      "description": "New works, exhibitions, and studio updates.",
      "placeholder": "your@email.com",
      "submit": "Subscribe",
      "success": "You're on the list.",
      "error": "Something went wrong. Try again."
    }
  },
  "inquiry": {
    "success": "Thank you. We'll be in touch soon.",
    "error": "Something went wrong. Please try again."
  },
  "bid": {
    "currentBid": "Current bid",
    "noBids": "No bids yet",
    "minBid": "Minimum bid",
    "endsIn": "Ends in",
    "ended": "Auction ended",
    "placeBid": "Place a Bid",
    "yourName": "Your name",
    "yourEmail": "Your email",
    "yourBid": "Your bid (€)",
    "submit": "Submit bid",
    "success": "Your bid has been placed.",
    "outbid": "Your bid is too low. Current bid is {current}.",
    "error": "Something went wrong. Please try again."
  },
  "product": {
    "inStock": "In stock",
    "outOfStock": "Out of stock",
    "buy": "Buy print",
    "selectVariant": "Select size & paper",
    "price": "€{price}"
  }
}
```

**Step 4: Create `packages/i18n/messages/de.json`**

```json
{
  "nav": {
    "gallery": "Galerie",
    "about": "Über mich",
    "contact": "Ein Werk erwerben",
    "language": "Sprache"
  },
  "footer": {
    "newsletter": {
      "title": "Bleib auf dem Laufenden",
      "description": "Neue Werke, Ausstellungen und Studio-Updates.",
      "placeholder": "deine@email.de",
      "submit": "Abonnieren",
      "success": "Du stehst auf der Liste.",
      "error": "Etwas ist schiefgelaufen. Bitte erneut versuchen."
    }
  },
  "inquiry": {
    "success": "Vielen Dank. Wir melden uns bald.",
    "error": "Etwas ist schiefgelaufen. Bitte erneut versuchen."
  },
  "bid": {
    "currentBid": "Aktuelles Gebot",
    "noBids": "Noch keine Gebote",
    "minBid": "Mindestgebot",
    "endsIn": "Endet in",
    "ended": "Auktion beendet",
    "placeBid": "Gebot abgeben",
    "yourName": "Dein Name",
    "yourEmail": "Deine E-Mail",
    "yourBid": "Dein Gebot (€)",
    "submit": "Gebot einreichen",
    "success": "Dein Gebot wurde eingereicht.",
    "outbid": "Dein Gebot ist zu niedrig. Aktuelles Gebot: {current}.",
    "error": "Etwas ist schiefgelaufen. Bitte erneut versuchen."
  },
  "product": {
    "inStock": "Auf Lager",
    "outOfStock": "Nicht verfügbar",
    "buy": "Druck kaufen",
    "selectVariant": "Größe & Papier wählen",
    "price": "€{price}"
  }
}
```

**Step 5: Create `packages/i18n/messages/bg.json`**

```json
{
  "nav": {
    "gallery": "Галерия",
    "about": "За мен",
    "contact": "Вземи картина",
    "language": "Език"
  },
  "footer": {
    "newsletter": {
      "title": "Бъди в крак",
      "description": "Нови творби, изложби и новини от ателието.",
      "placeholder": "твоя@имейл.bg",
      "submit": "Абонирай се",
      "success": "Вече си в списъка.",
      "error": "Нещо се обърка. Опитай отново."
    }
  },
  "inquiry": {
    "success": "Благодаря. Ще се свържем скоро.",
    "error": "Нещо се обърка. Опитай отново."
  },
  "bid": {
    "currentBid": "Текуща оферта",
    "noBids": "Все още няма оферти",
    "minBid": "Минимална оферта",
    "endsIn": "Приключва след",
    "ended": "Търгът приключи",
    "placeBid": "Направи оферта",
    "yourName": "Твоето име",
    "yourEmail": "Твоят имейл",
    "yourBid": "Твоята оферта (€)",
    "submit": "Изпрати офертата",
    "success": "Офертата ти беше приета.",
    "outbid": "Офертата ти е прекалено ниска. Текуща: {current}.",
    "error": "Нещо се обърка. Опитай отново."
  },
  "product": {
    "inStock": "На склад",
    "outOfStock": "Изчерпано",
    "buy": "Купи принт",
    "selectVariant": "Избери размер и хартия",
    "price": "€{price}"
  }
}
```

**Step 6: Commit**

```bash
git add packages/i18n
git commit -m "feat: add packages/i18n with EN/DE/BG message files"
```

---

## Task 5: `packages/db` — Drizzle Schema

**Files:**
- Create: `packages/db/package.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/db/drizzle.config.ts`
- Create: `packages/db/src/schema.ts`
- Create: `packages/db/src/client.ts`

**Step 1: Create `packages/db/package.json`**

```json
{
  "name": "@vamy/db",
  "version": "0.1.0",
  "private": true,
  "main": "./src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "migrate": "drizzle-kit migrate",
    "generate": "drizzle-kit generate",
    "studio": "drizzle-kit studio",
    "test": "vitest run"
  },
  "dependencies": {
    "drizzle-orm": "^0.40.0",
    "@supabase/supabase-js": "^2.49.0"
  },
  "devDependencies": {
    "drizzle-kit": "^0.30.0",
    "typescript": "^5.6.2",
    "vitest": "^2.0.0",
    "dotenv": "^16.0.0"
  }
}
```

**Step 2: Create `packages/db/src/schema.ts`**

This is the single source of truth for all DB tables.

```typescript
import {
  pgTable,
  uuid,
  text,
  numeric,
  integer,
  boolean,
  timestamp,
  jsonb,
  inet,
} from "drizzle-orm/pg-core";

// ─── Artworks ────────────────────────────────────────────────────────────────
export const artworks = pgTable("artworks", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  year: integer("year"),
  medium: text("medium"),
  dimensions: text("dimensions"),
  status: text("status").notNull().default("available"), // available | bidding | sold
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Products ─────────────────────────────────────────────────────────────────
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").references(() => artworks.id),
  productType: text("product_type").notNull(), // print | tote | sticker | ...
  name: text("name").notNull(),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Product Variants ─────────────────────────────────────────────────────────
export const productVariants = pgTable("product_variants", {
  id: uuid("id").primaryKey().defaultRandom(),
  productId: uuid("product_id").notNull().references(() => products.id),
  name: text("name").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  available: boolean("available").notNull().default(true),
  attributes: jsonb("attributes"), // { size, paper } | { colour, material } etc.
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Orders ───────────────────────────────────────────────────────────────────
export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  productVariantId: uuid("product_variant_id").notNull().references(() => productVariants.id),
  buyerName: text("buyer_name").notNull(),
  buyerEmail: text("buyer_email").notNull(),
  shippingAddress: jsonb("shipping_address").notNull(),
  amountPaid: numeric("amount_paid", { precision: 10, scale: 2 }).notNull(),
  stripeSessionId: text("stripe_session_id").notNull().unique(),
  status: text("status").notNull().default("paid"), // paid | shipped | cancelled
  trackingNumber: text("tracking_number"),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Auctions ─────────────────────────────────────────────────────────────────
export const auctions = pgTable("auctions", {
  id: uuid("id").primaryKey().defaultRandom(),
  artworkId: uuid("artwork_id").notNull().references(() => artworks.id).unique(),
  minBid: numeric("min_bid", { precision: 10, scale: 2 }).notNull(),
  minIncrement: numeric("min_increment", { precision: 10, scale: 2 }).notNull().default("100"),
  currentBid: numeric("current_bid", { precision: 10, scale: 2 }),
  bidCount: integer("bid_count").notNull().default(0),
  deadline: timestamp("deadline", { withTimezone: true }).notNull(),
  status: text("status").notNull().default("active"), // active | closed | cancelled
  winnerBidId: uuid("winner_bid_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Bids ─────────────────────────────────────────────────────────────────────
export const bids = pgTable("bids", {
  id: uuid("id").primaryKey().defaultRandom(),
  auctionId: uuid("auction_id").notNull().references(() => auctions.id),
  bidderName: text("bidder_name").notNull(),
  bidderEmail: text("bidder_email").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  ipAddress: inet("ip_address"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// ─── Inquiries ────────────────────────────────────────────────────────────────
export const inquiries = pgTable("inquiries", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  pieceInterest: text("piece_interest").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  handledAt: timestamp("handled_at", { withTimezone: true }),
});

// ─── Newsletter Subscribers ───────────────────────────────────────────────────
export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  subscribedAt: timestamp("subscribed_at", { withTimezone: true }).defaultNow().notNull(),
});
```

**Step 3: Create `packages/db/src/client.ts`**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// This runs server-side only. Never import in browser code.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const client = postgres(connectionString, { prepare: false });
export const db = drizzle(client, { schema });
```

Note: `postgres` (the driver) needs to be added: `pnpm add postgres --filter @vamy/db`

**Step 4: Create `packages/db/drizzle.config.ts`**

```typescript
import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";
dotenv.config({ path: "../../.env.local" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

**Step 5: Create `packages/db/src/index.ts`**

```typescript
export * from "./schema";
export * from "./client";
```

**Step 6: Create `.env.local` at monorepo root (never commit)**

```bash
cat >> .gitignore << 'EOF'
.env.local
.env*.local
EOF
```

Add to `.env.local`:
```
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon-key]
SUPABASE_SERVICE_ROLE_KEY=[service-role-key]
```

**Step 7: Generate and run first migration**

```bash
cd packages/db
pnpm add postgres
pnpm generate
pnpm migrate
```

Expected: migration files in `packages/db/migrations/`, tables created in Supabase.

**Step 8: Commit**

```bash
git add packages/db .gitignore
git commit -m "feat: add packages/db with Drizzle schema and migrations"
```

---

## Task 6: `packages/db` — tRPC Server + Inquiries + Newsletter Routers

**Files:**
- Create: `packages/db/src/trpc/index.ts`
- Create: `packages/db/src/trpc/context.ts`
- Create: `packages/db/src/trpc/routers/inquiries.ts`
- Create: `packages/db/src/trpc/routers/newsletter.ts`
- Create: `packages/db/src/trpc/root.ts`
- Create: `packages/db/src/trpc/routers/inquiries.test.ts`

**Step 1: Install tRPC in `packages/db`**

```bash
pnpm add @trpc/server zod resend --filter @vamy/db
```

**Step 2: Create `packages/db/src/trpc/context.ts`**

```typescript
import { db } from "../client";

export async function createContext() {
  return { db };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
```

**Step 3: Create `packages/db/src/trpc/index.ts`**

```typescript
import { initTRPC } from "@trpc/server";
import { type Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
```

**Step 4: Write failing test for inquiry creation**

Create `packages/db/src/trpc/routers/inquiries.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { createCaller } from "../root";

// Mock the DB and email
vi.mock("../../client", () => ({
  db: {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    }),
  },
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: vi.fn().mockResolvedValue({ id: "test-id" }),
    },
  })),
}));

describe("inquiries.create", () => {
  it("rejects missing required fields", async () => {
    const caller = createCaller({ db: {} as never });
    await expect(
      caller.inquiries.create({
        name: "",
        email: "not-an-email",
        pieceInterest: "",
      })
    ).rejects.toThrow();
  });

  it("accepts valid inquiry", async () => {
    const caller = createCaller({ db: {} as never });
    await expect(
      caller.inquiries.create({
        name: "Test Collector",
        email: "collector@example.com",
        pieceInterest: "Untitled No. 3",
        message: "I am very interested.",
      })
    ).resolves.toMatchObject({ success: true });
  });
});
```

**Step 5: Run test — expect FAIL**

```bash
cd packages/db && pnpm test
```

Expected: FAIL — "inquiries router not found"

**Step 6: Create `packages/db/src/trpc/routers/inquiries.ts`**

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { inquiries } from "../../schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const inquiriesRouter = router({
  create: publicProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        pieceInterest: z.string().min(1),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db.insert(inquiries).values(input);

      // Notify artist
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: `New inquiry: ${input.pieceInterest}`,
        html: `
          <p><strong>${input.name}</strong> (${input.email}) is interested in <em>${input.pieceInterest}</em>.</p>
          ${input.message ? `<p>${input.message}</p>` : ""}
        `,
      });

      // Auto-reply to collector
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: input.email,
        subject: "We received your inquiry",
        html: `<p>Hi ${input.name}, thank you for reaching out. We'll be in touch soon.</p>`,
      });

      return { success: true };
    }),

  list: publicProcedure.query(async () => {
    return db.query.inquiries.findMany({
      orderBy: (inquiries, { desc }) => [desc(inquiries.createdAt)],
    });
  }),

  markHandled: publicProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const { eq } = await import("drizzle-orm");
      await db
        .update(inquiries)
        .set({ handledAt: new Date() })
        .where(eq(inquiries.id, input.id));
      return { success: true };
    }),
});
```

**Step 7: Create `packages/db/src/trpc/routers/newsletter.ts`**

```typescript
import { z } from "zod";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { newsletterSubscribers } from "../../schema";

export const newsletterRouter = router({
  subscribe: publicProcedure
    .input(z.object({ email: z.string().email() }))
    .mutation(async ({ input }) => {
      // Store locally
      await db
        .insert(newsletterSubscribers)
        .values({ email: input.email })
        .onConflictDoNothing();

      // Sync to Buttondown
      await fetch("https://api.buttondown.email/v1/subscribers", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.BUTTONDOWN_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email_address: input.email }),
      });

      return { success: true };
    }),
});
```

**Step 8: Create `packages/db/src/trpc/root.ts`**

```typescript
import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";
import { createContext } from "./context";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
```

**Step 9: Run tests — expect PASS**

```bash
cd packages/db && pnpm test
```

Expected: PASS

**Step 10: Commit**

```bash
git add packages/db/src/trpc
git commit -m "feat: add tRPC server with inquiries and newsletter routers"
```

---

## Task 7: `packages/db` — Auctions + Bids Routers

**Files:**
- Create: `packages/db/src/trpc/routers/auctions.ts`
- Create: `packages/db/src/trpc/routers/bids.ts`
- Create: `packages/db/src/trpc/routers/bids.test.ts`
- Modify: `packages/db/src/trpc/root.ts`

**Step 1: Write failing bid validation tests**

Create `packages/db/src/trpc/routers/bids.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// The core validation logic — extractable for testing without DB
function validateBid({
  amount,
  currentBid,
  minBid,
  minIncrement,
  deadline,
}: {
  amount: number;
  currentBid: number | null;
  minBid: number;
  minIncrement: number;
  deadline: Date;
}): { valid: true } | { valid: false; reason: string } {
  if (new Date() > deadline) {
    return { valid: false, reason: "Auction has ended" };
  }

  const floor = currentBid !== null
    ? currentBid + minIncrement
    : minBid;

  if (amount < floor) {
    return { valid: false, reason: `Bid must be at least €${floor}` };
  }

  return { valid: true };
}

describe("bid validation", () => {
  const future = new Date(Date.now() + 1000 * 60 * 60); // 1 hour from now
  const past = new Date(Date.now() - 1000);

  it("rejects bid after deadline", () => {
    const result = validateBid({
      amount: 5000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: past,
    });
    expect(result.valid).toBe(false);
    expect((result as { valid: false; reason: string }).reason).toMatch(/ended/i);
  });

  it("rejects first bid below min_bid", () => {
    const result = validateBid({
      amount: 3000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts first bid at min_bid", () => {
    const result = validateBid({
      amount: 4000,
      currentBid: null,
      minBid: 4000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(true);
  });

  it("rejects bid not exceeding current + increment", () => {
    const result = validateBid({
      amount: 4050,
      currentBid: 4000,
      minBid: 3000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(false);
  });

  it("accepts bid exceeding current + increment", () => {
    const result = validateBid({
      amount: 4100,
      currentBid: 4000,
      minBid: 3000,
      minIncrement: 100,
      deadline: future,
    });
    expect(result.valid).toBe(true);
  });
});
```

**Step 2: Run — expect FAIL**

```bash
cd packages/db && pnpm test
```

Expected: FAIL — `validateBid is not defined`

**Step 3: Create `packages/db/src/trpc/routers/bids.ts`**

```typescript
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { bids, auctions } from "../../schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export function validateBid({
  amount,
  currentBid,
  minBid,
  minIncrement,
  deadline,
}: {
  amount: number;
  currentBid: number | null;
  minBid: number;
  minIncrement: number;
  deadline: Date;
}): { valid: true } | { valid: false; reason: string } {
  if (new Date() > deadline) {
    return { valid: false, reason: "Auction has ended" };
  }
  const floor = currentBid !== null ? currentBid + minIncrement : minBid;
  if (amount < floor) {
    return { valid: false, reason: `Bid must be at least €${floor}` };
  }
  return { valid: true };
}

export const bidsRouter = router({
  place: publicProcedure
    .input(
      z.object({
        auctionId: z.string().uuid(),
        bidderName: z.string().min(1),
        bidderEmail: z.string().email(),
        amount: z.number().positive(),
        ipAddress: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const auction = await db.query.auctions.findFirst({
        where: eq(auctions.id, input.auctionId),
      });

      if (!auction || auction.status !== "active") {
        throw new Error("Auction not found or not active");
      }

      const validation = validateBid({
        amount: input.amount,
        currentBid: auction.currentBid ? Number(auction.currentBid) : null,
        minBid: Number(auction.minBid),
        minIncrement: Number(auction.minIncrement),
        deadline: auction.deadline,
      });

      if (!validation.valid) {
        throw new Error(validation.reason);
      }

      // Get previous highest bidder before inserting
      const previousTopBid = await db.query.bids.findFirst({
        where: eq(bids.auctionId, input.auctionId),
        orderBy: [desc(bids.amount)],
      });

      // Atomic update
      const [newBid] = await db.transaction(async (tx) => {
        const inserted = await tx
          .insert(bids)
          .values({
            auctionId: input.auctionId,
            bidderName: input.bidderName,
            bidderEmail: input.bidderEmail,
            amount: String(input.amount),
            ipAddress: input.ipAddress,
          })
          .returning();

        await tx
          .update(auctions)
          .set({
            currentBid: String(input.amount),
            bidCount: auction.bidCount + 1,
            updatedAt: new Date(),
          })
          .where(eq(auctions.id, input.auctionId));

        return inserted;
      });

      // Email: outbid alert to previous highest bidder
      if (
        previousTopBid &&
        previousTopBid.bidderEmail !== input.bidderEmail
      ) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: previousTopBid.bidderEmail,
          subject: "You've been outbid",
          html: `<p>Your bid has been surpassed. Current bid is now €${input.amount}. <a href="${process.env.NEXT_PUBLIC_SITE_URL}/get-a-piece">Place a new bid</a>.</p>`,
        });
      }

      // Email: notify artist
      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL!,
        to: process.env.RESEND_ARTIST_EMAIL!,
        subject: `New bid: €${input.amount}`,
        html: `<p><strong>${input.bidderName}</strong> bid €${input.amount}. Total bids: ${auction.bidCount + 1}.</p>`,
      });

      return { success: true, bidId: newBid.id };
    }),

  listByAuction: publicProcedure
    .input(z.object({ auctionId: z.string().uuid() }))
    .query(async ({ input }) => {
      return db.query.bids.findMany({
        where: eq(bids.auctionId, input.auctionId),
        orderBy: [desc(bids.amount)],
      });
    }),
});
```

**Step 4: Create `packages/db/src/trpc/routers/auctions.ts`**

```typescript
import { z } from "zod";
import { eq } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { auctions, artworks } from "../../schema";

export const auctionsRouter = router({
  getByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: eq(artworks.slug, input.slug),
      });
      if (!artwork) return null;

      return db.query.auctions.findFirst({
        where: eq(auctions.artworkId, artwork.id),
      });
    }),

  list: publicProcedure.query(async () => {
    return db.query.auctions.findMany({
      with: { artwork: true },
      orderBy: (auctions, { desc }) => [desc(auctions.createdAt)],
    });
  }),

  open: publicProcedure
    .input(
      z.object({
        artworkId: z.string().uuid(),
        minBid: z.number().positive(),
        minIncrement: z.number().positive().default(100),
        deadline: z.string().datetime(),
      })
    )
    .mutation(async ({ input }) => {
      const [auction] = await db
        .insert(auctions)
        .values({
          artworkId: input.artworkId,
          minBid: String(input.minBid),
          minIncrement: String(input.minIncrement),
          deadline: new Date(input.deadline),
        })
        .returning();

      await db
        .update(artworks)
        .set({ status: "bidding", updatedAt: new Date() })
        .where(eq(artworks.id, input.artworkId));

      return auction;
    }),

  close: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        winnerBidId: z.string().uuid().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(auctions)
        .set({
          status: "closed",
          winnerBidId: input.winnerBidId,
          updatedAt: new Date(),
        })
        .where(eq(auctions.id, input.id));
      return { success: true };
    }),
});
```

**Step 5: Update `packages/db/src/trpc/root.ts`**

```typescript
import { router } from "./index";
import { inquiriesRouter } from "./routers/inquiries";
import { newsletterRouter } from "./routers/newsletter";
import { auctionsRouter } from "./routers/auctions";
import { bidsRouter } from "./routers/bids";
import { createContext } from "./context";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
});

export type AppRouter = typeof appRouter;
export const createCaller = appRouter.createCaller;
```

**Step 6: Run tests — expect PASS**

```bash
cd packages/db && pnpm test
```

Expected: all bid validation tests PASS

**Step 7: Commit**

```bash
git add packages/db/src/trpc/routers
git commit -m "feat: add auctions and bids tRPC routers with bid validation"
```

---

## Task 8: `packages/db` — Products, Checkout, Orders Routers

**Files:**
- Create: `packages/db/src/trpc/routers/products.ts`
- Create: `packages/db/src/trpc/routers/checkout.ts`
- Create: `packages/db/src/trpc/routers/orders.ts`
- Modify: `packages/db/src/trpc/root.ts`

**Step 1: Install Stripe in `packages/db`**

```bash
pnpm add stripe --filter @vamy/db
```

Add to `.env.local`:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Step 2: Create `packages/db/src/trpc/routers/products.ts`**

```typescript
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { products, productVariants, artworks } from "../../schema";

export const productsRouter = router({
  listByArtworkSlug: publicProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ input }) => {
      const artwork = await db.query.artworks.findFirst({
        where: eq(artworks.slug, input.slug),
      });
      if (!artwork) return [];

      return db.query.products.findMany({
        where: and(
          eq(products.artworkId, artwork.id),
          eq(products.active, true)
        ),
        with: {
          variants: {
            where: eq(productVariants.available, true),
          },
        },
      });
    }),

  // Admin: full product management
  listAll: publicProcedure.query(async () => {
    return db.query.products.findMany({
      with: { variants: true, artwork: true },
      orderBy: (products, { desc }) => [desc(products.createdAt)],
    });
  }),

  createVariant: publicProcedure
    .input(
      z.object({
        productId: z.string().uuid(),
        name: z.string().min(1),
        price: z.number().positive(),
        stockQuantity: z.number().int().min(0),
        attributes: z.record(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [variant] = await db
        .insert(productVariants)
        .values({
          productId: input.productId,
          name: input.name,
          price: String(input.price),
          stockQuantity: input.stockQuantity,
          attributes: input.attributes,
        })
        .returning();
      return variant;
    }),

  updateVariantStock: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        stockQuantity: z.number().int().min(0),
        available: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(productVariants)
        .set({
          stockQuantity: input.stockQuantity,
          ...(input.available !== undefined && { available: input.available }),
          updatedAt: new Date(),
        })
        .where(eq(productVariants.id, input.id));
      return { success: true };
    }),
});
```

**Step 3: Create `packages/db/src/trpc/routers/checkout.ts`**

```typescript
import { z } from "zod";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { productVariants, products, artworks } from "../../schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export const checkoutRouter = router({
  createSession: publicProcedure
    .input(z.object({ variantId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const variant = await db.query.productVariants.findFirst({
        where: eq(productVariants.id, input.variantId),
        with: {
          product: {
            with: { artwork: true },
          },
        },
      });

      if (!variant) throw new Error("Variant not found");
      if (!variant.available || variant.stockQuantity <= 0) {
        throw new Error("Out of stock");
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              product_data: {
                name: `${variant.product.name} — ${variant.name}`,
                metadata: { variantId: variant.id },
              },
              unit_amount: Math.round(Number(variant.price) * 100),
            },
            quantity: 1,
          },
        ],
        shipping_address_collection: {
          allowed_countries: ["DE", "AT", "CH", "GB", "US", "BG", "FR", "NL", "BE"],
        },
        metadata: { variantId: variant.id },
        success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/order/success?session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}`,
      });

      return { url: session.url! };
    }),
});
```

**Step 4: Create `packages/db/src/trpc/routers/orders.ts`**

```typescript
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, publicProcedure } from "../index";
import { db } from "../../client";
import { orders, productVariants } from "../../schema";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const ordersRouter = router({
  list: publicProcedure.query(async () => {
    return db.query.orders.findMany({
      with: { productVariant: { with: { product: true } } },
      orderBy: [desc(orders.createdAt)],
    });
  }),

  markShipped: publicProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        trackingNumber: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const [order] = await db
        .update(orders)
        .set({
          status: "shipped",
          trackingNumber: input.trackingNumber,
          shippedAt: new Date(),
        })
        .where(eq(orders.id, input.id))
        .returning();

      // Optional: send shipping confirmation
      if (input.trackingNumber) {
        await resend.emails.send({
          from: process.env.RESEND_FROM_EMAIL!,
          to: order.buyerEmail,
          subject: "Your order has shipped",
          html: `<p>Hi ${order.buyerName}, your order is on its way! Tracking: ${input.trackingNumber}</p>`,
        });
      }

      return { success: true };
    }),
});
```

**Step 5: Update `packages/db/src/trpc/root.ts`**

Add the new routers to `appRouter`:

```typescript
import { productsRouter } from "./routers/products";
import { checkoutRouter } from "./routers/checkout";
import { ordersRouter } from "./routers/orders";

export const appRouter = router({
  inquiries: inquiriesRouter,
  newsletter: newsletterRouter,
  auctions: auctionsRouter,
  bids: bidsRouter,
  products: productsRouter,
  checkout: checkoutRouter,
  orders: ordersRouter,
});
```

**Step 6: Commit**

```bash
git add packages/db/src/trpc
git commit -m "feat: add products, checkout, and orders tRPC routers"
```

---

## Task 9: Website — tRPC Client + API Route

**Files:**
- Create: `apps/website/app/api/trpc/[trpc]/route.ts`
- Create: `apps/website/app/api/webhooks/stripe/route.ts`
- Create: `apps/website/src/lib/trpc.ts`

**Step 1: Install tRPC client in website**

```bash
pnpm add @trpc/server @trpc/client @trpc/react-query @tanstack/react-query --filter @vamy/website
```

**Step 2: Create `apps/website/app/api/trpc/[trpc]/route.ts`**

```typescript
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { appRouter } from "@vamy/db/trpc";
import { createContext } from "@vamy/db/trpc/context";

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext,
  });

export { handler as GET, handler as POST };
```

Note: update `packages/db` exports to expose `trpc` and `trpc/context`.

**Step 3: Update `packages/db/package.json` exports**

```json
{
  "exports": {
    ".": "./src/index.ts",
    "./trpc": "./src/trpc/root.ts",
    "./trpc/context": "./src/trpc/context.ts"
  }
}
```

**Step 4: Create `apps/website/app/api/webhooks/stripe/route.ts`**

```typescript
import { NextRequest } from "next/server";
import Stripe from "stripe";
import { db } from "@vamy/db";
import { orders, productVariants } from "@vamy/db";
import { eq, sql } from "drizzle-orm";
import { Resend } from "resend";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const resend = new Resend(process.env.RESEND_API_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Webhook signature invalid", { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const variantId = session.metadata?.variantId;
    if (!variantId) return new Response("Missing variantId", { status: 400 });

    const address = session.shipping_details?.address;
    const customer = session.customer_details;

    await db.transaction(async (tx) => {
      await tx.insert(orders).values({
        productVariantId: variantId,
        buyerName: customer?.name ?? "Unknown",
        buyerEmail: customer?.email ?? "",
        shippingAddress: address ?? {},
        amountPaid: String((session.amount_total ?? 0) / 100),
        stripeSessionId: session.id,
        status: "paid",
      });

      await tx
        .update(productVariants)
        .set({ stockQuantity: sql`${productVariants.stockQuantity} - 1` })
        .where(eq(productVariants.id, variantId));
    });

    // Confirmation email to buyer
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: customer?.email ?? "",
      subject: "Order confirmed",
      html: `<p>Thank you for your order! We'll ship it soon.</p>`,
    });

    // Notify artist
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      to: process.env.RESEND_ARTIST_EMAIL!,
      subject: "New order received",
      html: `<p>New order from ${customer?.name} (${customer?.email}). Ship to: ${JSON.stringify(address)}.</p>`,
    });
  }

  return new Response(null, { status: 200 });
}
```

**Step 5: Create `apps/website/src/lib/trpc.ts`**

```typescript
import { createTRPCReact } from "@trpc/react-query";
import type { AppRouter } from "@vamy/db/trpc";

export const trpc = createTRPCReact<AppRouter>();
```

**Step 6: Commit**

```bash
git add apps/website/app apps/website/src/lib/trpc.ts
git commit -m "feat: add tRPC API route and Stripe webhook handler to website"
```

---

## Task 10: Website — Remove HubSpot, Wire FormBlock to tRPC

**Files:**
- Modify: `apps/website/src/components/blocks/FormBlock/index.tsx`

**Step 1: Read the current file**

File: `apps/website/src/components/blocks/FormBlock/index.tsx`

Current lines 1–43 contain HubSpot config and `submitToHubSpot` function. Delete all of it.

**Step 2: Replace with tRPC-based implementation**

```typescript
import * as React from 'react';
import classNames from 'classnames';

import { getComponent } from '../../components-registry';
import { mapStylesToClassNames as mapStyles } from '../../../utils/map-styles-to-class-names';
import SubmitButtonFormControl from './SubmitButtonFormControl';
import { trpc } from '../../../lib/trpc';

export default function FormBlock(props) {
    const formRef = React.createRef<HTMLFormElement>();
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [submitStatus, setSubmitStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const { fields = [], elementId, submitButton, className, styles = {}, 'data-sb-field-path': fieldPath } = props;

    const createInquiry = trpc.inquiries.create.useMutation();

    React.useEffect(() => {
        if (typeof window !== 'undefined' && formRef.current) {
            const urlParams = new URLSearchParams(window.location.search);
            const pieceParam = urlParams.get('piece');
            if (pieceParam) {
                const pieceInput = formRef.current.querySelector<HTMLInputElement>('input[name="Piece"]');
                if (pieceInput) pieceInput.value = decodeURIComponent(pieceParam);
            }
        }
    }, [formRef]);

    if (fields.length === 0) return null;

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsSubmitting(true);
        setSubmitStatus('idle');

        const data = new FormData(formRef.current!);

        try {
            await createInquiry.mutateAsync({
                name: String(data.get('name') ?? ''),
                email: String(data.get('email') ?? ''),
                pieceInterest: String(data.get('Piece') ?? ''),
                message: String(data.get('message') ?? '') || undefined,
            });
            setSubmitStatus('success');
            formRef.current?.reset();
        } catch {
            setSubmitStatus('error');
        } finally {
            setIsSubmitting(false);
        }
    }

    return (
        <form
            className={classNames(
                'sb-component',
                'sb-component-block',
                'sb-component-form-block',
                className,
                styles?.self?.margin ? mapStyles({ margin: styles?.self?.margin }) : undefined,
                styles?.self?.padding ? mapStyles({ padding: styles?.self?.padding }) : undefined,
                styles?.self?.borderWidth && styles?.self?.borderWidth !== 0 && styles?.self?.borderStyle !== 'none'
                    ? mapStyles({ borderWidth: styles?.self?.borderWidth, borderStyle: styles?.self?.borderStyle, borderColor: styles?.self?.borderColor ?? 'border-primary' })
                    : undefined,
                styles?.self?.borderRadius ? mapStyles({ borderRadius: styles?.self?.borderRadius }) : undefined
            )}
            name={elementId}
            id={elementId}
            onSubmit={handleSubmit}
            ref={formRef}
            data-sb-field-path={fieldPath}
        >
            {submitStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-md">
                    Thank you for your inquiry. We&apos;ll be in touch soon.
                </div>
            )}
            {submitStatus === 'error' && (
                <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-md">
                    Something went wrong. Please try again.
                </div>
            )}
            <div
                className={classNames('w-full', 'flex', 'flex-wrap', 'gap-8', mapStyles({ justifyContent: styles?.self?.justifyContent ?? 'flex-start' }))}
                {...(fieldPath && { 'data-sb-field-path': '.fields' })}
            >
                {fields.map((field, index) => {
                    const modelName = field.__metadata.modelName;
                    if (!modelName) throw new Error(`form field does not have the 'modelName' property`);
                    const FormControl = getComponent(modelName);
                    if (!FormControl) throw new Error(`no component matching the form field model name: ${modelName}`);
                    return <FormControl key={index} {...field} {...(fieldPath && { 'data-sb-field-path': `.${index}` })} />;
                })}
            </div>
            {submitButton && (
                <div className={classNames('mt-8', 'flex', mapStyles({ justifyContent: styles?.self?.justifyContent ?? 'flex-start' }))}>
                    <SubmitButtonFormControl {...submitButton} disabled={isSubmitting} {...(fieldPath && { 'data-sb-field-path': '.submitButton' })} />
                </div>
            )}
        </form>
    );
}
```

**Step 3: Remove Netlify env vars**

Remove `NEXT_PUBLIC_HUBSPOT_PORTAL_ID` and `NEXT_PUBLIC_HUBSPOT_FORM_GUID` from Netlify dashboard.

**Step 4: Commit**

```bash
git add apps/website/src/components/blocks/FormBlock/index.tsx
git commit -m "feat: replace HubSpot with tRPC inquiry submission in FormBlock"
```

---

## Task 11: Website — Newsletter Signup in Footer

**Files:**
- Modify: `apps/website/src/components/sections/Footer/index.tsx`

**Step 1: Add a `NewsletterSignup` sub-component to Footer**

Add before the `FooterLinksGroup` function at the bottom of `Footer/index.tsx`:

```typescript
function NewsletterSignup() {
    const [email, setEmail] = React.useState('');
    const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
    const subscribe = trpc.newsletter.subscribe.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        try {
            await subscribe.mutateAsync({ email });
            setStatus('success');
            setEmail('');
        } catch {
            setStatus('error');
        }
    }

    return (
        <div className="pb-8">
            <h2 className="uppercase text-base tracking-wide mb-4">Stay in the loop</h2>
            <p className="text-sm mb-4">New works, exhibitions, and studio updates.</p>
            {status === 'success' ? (
                <p className="text-sm text-green-600">You&apos;re on the list.</p>
            ) : (
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <input
                        type="email"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 px-3 py-2 text-sm border border-current rounded"
                    />
                    <button type="submit" disabled={subscribe.isPending} className="px-4 py-2 text-sm border border-current rounded hover:bg-black hover:text-white transition-colors">
                        {subscribe.isPending ? '...' : 'Subscribe'}
                    </button>
                </form>
            )}
            {status === 'error' && <p className="text-sm text-red-600 mt-2">Something went wrong.</p>}
        </div>
    );
}
```

Add `import { trpc } from '../../../lib/trpc';` at the top.

Add `<NewsletterSignup />` inside the grid div alongside `primaryLinks` and `secondaryLinks`.

**Step 2: Commit**

```bash
git add apps/website/src/components/sections/Footer/index.tsx
git commit -m "feat: add newsletter signup to footer via tRPC"
```

---

## Task 12: Website — BidWidget Component

**Files:**
- Create: `apps/website/src/components/blocks/BidWidget/index.tsx`
- Create: `apps/website/src/components/blocks/BidWidget/BidModal.tsx`
- Create: `apps/website/src/components/blocks/BidWidget/Countdown.tsx`

**Step 1: Create `Countdown.tsx`**

```typescript
'use client';
import { useState, useEffect } from 'react';

export function Countdown({ deadline }: { deadline: Date }) {
    const [timeLeft, setTimeLeft] = useState('');

    useEffect(() => {
        function update() {
            const diff = deadline.getTime() - Date.now();
            if (diff <= 0) { setTimeLeft('Ended'); return; }
            const d = Math.floor(diff / 86400000);
            const h = Math.floor((diff % 86400000) / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            const s = Math.floor((diff % 60000) / 1000);
            setTimeLeft(d > 0 ? `${d}d ${h}h ${m}m` : `${h}h ${m}m ${s}s`);
        }
        update();
        const id = setInterval(update, 1000);
        return () => clearInterval(id);
    }, [deadline]);

    return <span>{timeLeft}</span>;
}
```

**Step 2: Create `BidModal.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { trpc } from '../../../lib/trpc';

export function BidModal({
    auctionId,
    currentBid,
    minBid,
    minIncrement,
    onClose,
    onSuccess,
}: {
    auctionId: string;
    currentBid: number | null;
    minBid: number;
    minIncrement: number;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const minAmount = currentBid !== null ? currentBid + minIncrement : minBid;
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [amount, setAmount] = useState(minAmount);
    const [error, setError] = useState('');

    const placeBid = trpc.bids.place.useMutation();

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError('');
        try {
            await placeBid.mutateAsync({ auctionId, bidderName: name, bidderEmail: email, amount });
            onSuccess();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Something went wrong');
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
                <h2 className="text-xl font-medium mb-6">Place a Bid</h2>
                <p className="text-sm text-gray-600 mb-6">Minimum bid: €{minAmount.toLocaleString()}</p>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Your name" value={name} onChange={e => setName(e.target.value)} required />
                    <input className="w-full border px-3 py-2 rounded text-sm" type="email" placeholder="Your email" value={email} onChange={e => setEmail(e.target.value)} required />
                    <input className="w-full border px-3 py-2 rounded text-sm" type="number" min={minAmount} step="50" value={amount} onChange={e => setAmount(Number(e.target.value))} required />
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex gap-3 pt-2">
                        <button type="button" onClick={onClose} className="flex-1 border px-4 py-2 rounded text-sm">Cancel</button>
                        <button type="submit" disabled={placeBid.isPending} className="flex-1 bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                            {placeBid.isPending ? 'Submitting…' : 'Submit bid'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
```

**Step 3: Create `BidWidget/index.tsx`**

```typescript
'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { trpc } from '../../../lib/trpc';
import { Countdown } from './Countdown';
import { BidModal } from './BidModal';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function BidWidget({ artworkSlug }: { artworkSlug: string }) {
    const [showModal, setShowModal] = useState(false);
    const [bidSuccess, setBidSuccess] = useState(false);

    const { data: auction, refetch } = trpc.auctions.getByArtworkSlug.useQuery(
        { slug: artworkSlug },
        { refetchInterval: 30_000 } // 30s polling fallback
    );

    // Supabase Realtime — live bid updates
    useEffect(() => {
        if (!auction?.id) return;
        const channel = supabase
            .channel(`auction-${auction.id}`)
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bids', filter: `auction_id=eq.${auction.id}` }, () => refetch())
            .subscribe();
        return () => { supabase.removeChannel(channel); };
    }, [auction?.id, refetch]);

    if (!auction || auction.status !== 'active') return null;

    const deadline = new Date(auction.deadline);
    const isEnded = deadline < new Date();
    const currentBid = auction.currentBid ? Number(auction.currentBid) : null;

    return (
        <div className="border border-black rounded-lg p-6 mt-8">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                        {currentBid ? 'Current bid' : 'Starting bid'}
                    </p>
                    <p className="text-3xl font-light">
                        €{(currentBid ?? Number(auction.minBid)).toLocaleString()}
                    </p>
                    {auction.bidCount > 0 && (
                        <p className="text-xs text-gray-500 mt-1">{auction.bidCount} bid{auction.bidCount !== 1 ? 's' : ''}</p>
                    )}
                </div>
                <div className="text-right">
                    <p className="text-xs uppercase tracking-widest text-gray-500 mb-1">
                        {isEnded ? 'Ended' : 'Ends in'}
                    </p>
                    <p className="text-lg font-light">
                        {isEnded ? '—' : <Countdown deadline={deadline} />}
                    </p>
                </div>
            </div>
            {!isEnded && !bidSuccess && (
                <button
                    onClick={() => setShowModal(true)}
                    className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors"
                >
                    Place a Bid
                </button>
            )}
            {bidSuccess && (
                <p className="text-center text-sm text-green-700 py-2">Your bid has been placed. Watch your inbox.</p>
            )}
            {showModal && (
                <BidModal
                    auctionId={auction.id}
                    currentBid={currentBid}
                    minBid={Number(auction.minBid)}
                    minIncrement={Number(auction.minIncrement)}
                    onClose={() => setShowModal(false)}
                    onSuccess={() => { setShowModal(false); setBidSuccess(true); refetch(); }}
                />
            )}
        </div>
    );
}
```

**Step 4: Install Supabase JS in website**

```bash
pnpm add @supabase/supabase-js --filter @vamy/website
```

**Step 5: Commit**

```bash
git add apps/website/src/components/blocks/BidWidget
git commit -m "feat: add BidWidget with Supabase Realtime and bid modal"
```

---

## Task 13: Website — Product Variant Selector

**Files:**
- Create: `apps/website/src/components/blocks/ProductSelector/index.tsx`

**Step 1: Create `ProductSelector/index.tsx`**

```typescript
'use client';
import { useState } from 'react';
import { trpc } from '../../../lib/trpc';

export function ProductSelector({ artworkSlug }: { artworkSlug: string }) {
    const [selectedVariantId, setSelectedVariantId] = useState<string | null>(null);
    const [isRedirecting, setIsRedirecting] = useState(false);

    const { data: productList } = trpc.products.listByArtworkSlug.useQuery({ slug: artworkSlug });
    const createSession = trpc.checkout.createSession.useMutation();

    if (!productList || productList.length === 0) return null;

    // Flatten all variants across products
    const variants = productList.flatMap(p =>
        p.variants.map(v => ({ ...v, productName: p.name }))
    );

    if (variants.length === 0) return null;

    async function handleBuy() {
        if (!selectedVariantId) return;
        setIsRedirecting(true);
        try {
            const { url } = await createSession.mutateAsync({ variantId: selectedVariantId });
            window.location.href = url;
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Something went wrong');
            setIsRedirecting(false);
        }
    }

    return (
        <div className="border border-black rounded-lg p-6 mt-4">
            <h3 className="text-xs uppercase tracking-widest mb-4">Available Prints</h3>
            <div className="space-y-2 mb-6">
                {variants.map(v => (
                    <label
                        key={v.id}
                        className={`flex items-center justify-between p-3 border rounded cursor-pointer transition-colors ${selectedVariantId === v.id ? 'border-black bg-gray-50' : 'border-gray-200 hover:border-gray-400'}`}
                    >
                        <div className="flex items-center gap-3">
                            <input
                                type="radio"
                                name="variant"
                                value={v.id}
                                checked={selectedVariantId === v.id}
                                onChange={() => setSelectedVariantId(v.id)}
                                className="sr-only"
                            />
                            <div>
                                <p className="text-sm font-medium">{v.name}</p>
                                <p className="text-xs text-gray-500">{v.productName}</p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-sm">€{Number(v.price).toLocaleString()}</p>
                            <p className={`text-xs ${v.stockQuantity > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {v.stockQuantity > 0 ? 'In stock' : 'Out of stock'}
                            </p>
                        </div>
                    </label>
                ))}
            </div>
            <button
                onClick={handleBuy}
                disabled={!selectedVariantId || isRedirecting}
                className="w-full bg-black text-white py-3 rounded text-sm tracking-wide hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
                {isRedirecting ? 'Redirecting to payment…' : 'Buy'}
            </button>
        </div>
    );
}
```

**Step 2: Commit**

```bash
git add apps/website/src/components/blocks/ProductSelector
git commit -m "feat: add ProductSelector component with Stripe Checkout redirect"
```

---

## Task 14: Website — next-intl i18n Setup

**Files:**
- Modify: `apps/website/next.config.js`
- Create: `apps/website/src/i18n/routing.ts`
- Create: `apps/website/src/i18n/request.ts`
- Modify: `apps/website/src/pages/_app.js`

**Step 1: Install next-intl**

```bash
pnpm add next-intl --filter @vamy/website
```

**Step 2: Update `apps/website/next.config.js`**

```javascript
const createNextIntlPlugin = require('next-intl/plugin');
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** @type {import('next').NextConfig} */
const nextConfig = {
    env: {
        stackbitPreview: process.env.STACKBIT_PREVIEW
    },
    trailingSlash: true,
    reactStrictMode: true,
};

module.exports = withNextIntl(nextConfig);
```

**Step 3: Create `apps/website/src/i18n/routing.ts`**

```typescript
import { defineRouting } from 'next-intl/routing';
import { locales, defaultLocale } from '@vamy/i18n';

export const routing = defineRouting({
    locales,
    defaultLocale,
});
```

**Step 4: Create `apps/website/src/i18n/request.ts`**

```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
    const locale = await requestLocale;
    const messages = (await import(`@vamy/i18n/messages/${locale}.json`)).default;
    return { locale, messages };
});
```

**Step 5: Create locale switcher component in Header**

Add to `apps/website/src/components/sections/Header/index.tsx`:

```typescript
import { useRouter, usePathname } from 'next/navigation';
import { locales, localeNames, type Locale } from '@vamy/i18n';

function LocaleSwitcher({ currentLocale }: { currentLocale: Locale }) {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <select
            value={currentLocale}
            onChange={e => {
                const next = e.target.value;
                // Replace locale prefix in pathname
                const newPath = pathname.replace(`/${currentLocale}`, `/${next}`);
                router.push(newPath);
            }}
            className="text-sm border-none bg-transparent cursor-pointer"
        >
            {locales.map(l => (
                <option key={l} value={l}>{localeNames[l]}</option>
            ))}
        </select>
    );
}
```

**Step 6: Commit**

```bash
git add apps/website/src/i18n apps/website/next.config.js apps/website/src/components/sections/Header
git commit -m "feat: add next-intl i18n with EN/DE/BG locale routing"
```

---

## Task 15: `apps/admin` — Bootstrap

**Files:**
- Create: `apps/admin/package.json`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/next.config.ts`
- Create: `apps/admin/tailwind.config.ts`
- Create: `apps/admin/app/layout.tsx`
- Create: `apps/admin/netlify.toml`

**Step 1: Create `apps/admin/package.json`**

```json
{
  "name": "@vamy/admin",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --port 3001",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@vamy/db": "workspace:*",
    "@vamy/ui": "workspace:*",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@supabase/supabase-js": "^2.49.0",
    "next": "15.3.8",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "tailwindcss": "^3.4.3",
    "lucide-react": "^0.454.0"
  },
  "devDependencies": {
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.1",
    "autoprefixer": "^10.4.19",
    "typescript": "^5.6.2"
  }
}
```

**Step 2: Create `apps/admin/netlify.toml`**

```toml
[build]
  command = "cd ../.. && pnpm install && pnpm turbo build --filter=@vamy/admin"
  publish = ".next"
```

**Step 3: Create `apps/admin/app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "vamy — Admin",
  robots: "noindex, nofollow",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

**Step 4: Commit**

```bash
git add apps/admin
git commit -m "feat: bootstrap apps/admin Next.js app"
```

---

## Task 16: `apps/admin` — Supabase Auth + Login + Middleware

**Files:**
- Create: `apps/admin/app/login/page.tsx`
- Create: `apps/admin/middleware.ts`
- Create: `apps/admin/app/providers.tsx`
- Create: `apps/admin/lib/supabase.ts`

**Step 1: Create `apps/admin/lib/supabase.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

**Step 2: Create `apps/admin/middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (cookies) => cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/auctions", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 3: Create `apps/admin/app/login/page.tsx`**

```typescript
"use client";
import { useState } from "react";
import { createClient } from "../../lib/supabase";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Invalid credentials");
      setLoading(false);
    } else {
      router.push("/auctions");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 rounded-lg shadow-sm w-full max-w-sm">
        <h1 className="text-2xl font-light mb-8 text-center">vamy admin</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full border px-4 py-3 rounded text-sm" />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required className="w-full border px-4 py-3 rounded text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={loading} className="w-full bg-black text-white py-3 rounded text-sm tracking-wide disabled:opacity-50">
            {loading ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

**Step 4: Create the artist user in Supabase**

In Supabase dashboard → Authentication → Users → Add user (email + password). This is the only user ever created.

**Step 5: Commit**

```bash
git add apps/admin
git commit -m "feat: add Supabase Auth login and middleware to admin"
```

---

## Task 17: `apps/admin` — Auctions View

**Files:**
- Create: `apps/admin/app/auctions/page.tsx`
- Create: `apps/admin/app/auctions/NewAuctionForm.tsx`

**Step 1: Create `apps/admin/app/auctions/page.tsx`**

Fetches all auctions with artwork info. Shows table of active + past auctions. Renders `NewAuctionForm` for creating.

```typescript
"use client";
import { trpc } from "../../lib/trpc";
import { NewAuctionForm } from "./NewAuctionForm";
import { formatDistanceToNow } from "date-fns";

export default function AuctionsPage() {
  const { data: auctionList, refetch } = trpc.auctions.list.useQuery();
  const closeAuction = trpc.auctions.close.useMutation({ onSuccess: refetch });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-light">Auctions</h1>
      </div>

      <NewAuctionForm onCreated={refetch} />

      <div className="mt-10">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500 text-xs uppercase tracking-wide">
              <th className="pb-3 pr-4">Artwork</th>
              <th className="pb-3 pr-4">Current bid</th>
              <th className="pb-3 pr-4">Bids</th>
              <th className="pb-3 pr-4">Deadline</th>
              <th className="pb-3 pr-4">Status</th>
              <th className="pb-3"></th>
            </tr>
          </thead>
          <tbody>
            {auctionList?.map(a => (
              <tr key={a.id} className="border-b hover:bg-gray-50">
                <td className="py-4 pr-4 font-medium">{a.artwork?.slug}</td>
                <td className="py-4 pr-4">
                  {a.currentBid ? `€${Number(a.currentBid).toLocaleString()}` : `€${Number(a.minBid).toLocaleString()} min`}
                </td>
                <td className="py-4 pr-4">{a.bidCount}</td>
                <td className="py-4 pr-4 text-gray-600">
                  {formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                </td>
                <td className="py-4 pr-4">
                  <span className={`px-2 py-1 rounded text-xs ${a.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {a.status}
                  </span>
                </td>
                <td className="py-4">
                  {a.status === 'active' && (
                    <button
                      onClick={() => closeAuction.mutate({ id: a.id })}
                      className="text-xs text-red-600 hover:underline"
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 2: Create `NewAuctionForm.tsx`** — form with artwork slug selector, min bid, min increment, deadline. Calls `trpc.auctions.open.useMutation()`. Similar pattern to above components.

**Step 3: Commit**

```bash
git add apps/admin/app/auctions
git commit -m "feat: add admin auctions view with open/close functionality"
```

---

## Task 18: `apps/admin` — Orders View

**Files:**
- Create: `apps/admin/app/orders/page.tsx`

Simple table: buyer name, variant name, shipping address (collapsible), amount, status badge, tracking input, "Mark shipped" button. Calls `trpc.orders.markShipped.useMutation()`.

Follow the exact same pattern as Task 17. Commit after.

```bash
git commit -m "feat: add admin orders fulfillment view"
```

---

## Task 19: `apps/admin` — Artworks & Variants View

**Files:**
- Create: `apps/admin/app/artworks/page.tsx`
- Create: `apps/admin/app/artworks/[id]/page.tsx`

`/artworks` — lists all artworks from `trpc.artworks.list` (add this router). Clicking an artwork navigates to `[id]`.

`/artworks/[id]` — shows artwork specs + lists products + their variants. Buttons to add product, add variant. Each variant row has stock quantity input + available toggle.

Calls `trpc.products.createVariant` and `trpc.products.updateVariantStock`.

```bash
git commit -m "feat: add admin artworks and product variant management"
```

---

## Task 20: `apps/admin` — Inquiries View

**Files:**
- Create: `apps/admin/app/inquiries/page.tsx`

Table: name, email, piece interest, message (truncated), date, handled badge. "Mark handled" button calls `trpc.inquiries.markHandled`. Email column is a `mailto:` link that opens with the inquiry context pre-filled.

```bash
git commit -m "feat: add admin inquiries view"
```

---

## Task 21: Add Plausible Analytics

**Files:**
- Modify: `apps/website/src/components/layouts/DefaultBaseLayout/index.tsx`

**Step 1: Add Plausible script tag**

In the `<head>` of `DefaultBaseLayout`:

```tsx
{process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
  <script
    defer
    data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
    src="https://plausible.yourdomain.com/js/script.js"
  />
)}
```

Replace `plausible.yourdomain.com` with your self-hosted Plausible instance URL.

Add to `.env.local`:
```
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=vamy.art
```

**Step 2: Commit**

```bash
git add apps/website/src/components/layouts/DefaultBaseLayout
git commit -m "feat: add Plausible analytics script to website"
```

---

## Task 22: Final Netlify Setup

**Step 1: Configure Netlify Site 1 (vamy.art) in dashboard**

- Repository: same GitHub repo
- Base directory: `apps/website`
- Build command: *(from netlify.toml)*
- Publish directory: `.next`
- Environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  DATABASE_URL
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  RESEND_ARTIST_EMAIL
  BUTTONDOWN_API_KEY
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  NEXT_PUBLIC_SITE_URL=https://vamy.art
  NEXT_PUBLIC_PLAUSIBLE_DOMAIN=vamy.art
  ```

**Step 2: Configure Netlify Site 2 (admin.vamy.art) in dashboard**

- Repository: same GitHub repo
- Base directory: `apps/admin`
- Build command: *(from netlify.toml)*
- Publish directory: `.next`
- Environment variables:
  ```
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
  DATABASE_URL
  RESEND_API_KEY
  RESEND_FROM_EMAIL
  RESEND_ARTIST_EMAIL
  STRIPE_SECRET_KEY
  ```

**Step 3: Register Stripe webhook**

In Stripe dashboard → Webhooks → Add endpoint:
- URL: `https://vamy.art/api/webhooks/stripe`
- Event: `checkout.session.completed`
- Copy the `STRIPE_WEBHOOK_SECRET` to Netlify env vars

**Step 4: Enable Supabase Realtime**

In Supabase dashboard → Database → Replication → Enable for table `bids`.

**Step 5: Final commit**

```bash
git add .
git commit -m "chore: finalize Netlify configuration and deployment setup"
```

---

## Environment Variables Reference

| Variable | Used by | Where |
|--|--|--|
| `DATABASE_URL` | packages/db | Netlify (both sites) |
| `NEXT_PUBLIC_SUPABASE_URL` | website, admin | Netlify (both) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | website, admin | Netlify (both) |
| `SUPABASE_SERVICE_ROLE_KEY` | admin | Netlify (admin only) |
| `RESEND_API_KEY` | packages/db | Netlify (both) |
| `RESEND_FROM_EMAIL` | packages/db | Netlify (both) |
| `RESEND_ARTIST_EMAIL` | packages/db | Netlify (both) |
| `BUTTONDOWN_API_KEY` | packages/db | Netlify (website) |
| `STRIPE_SECRET_KEY` | packages/db | Netlify (both) |
| `STRIPE_WEBHOOK_SECRET` | website webhook | Netlify (website) |
| `NEXT_PUBLIC_SITE_URL` | packages/db | Netlify (website) |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | website | Netlify (website) |

---

## Future: Three.js / React Three Fiber

When ready to add canvas-based visuals:

```bash
pnpm add three @react-three/fiber @react-three/drei --filter @vamy/website
# or --filter @vamy/ui if sharing canvas components
```

All Three.js components MUST use dynamic import to avoid SSR errors:

```typescript
// In any Next.js page or component:
import dynamic from 'next/dynamic';
const ArtworkCanvas = dynamic(() => import('../components/ArtworkCanvas'), { ssr: false });
```

Canvas components live in `packages/ui/src/components/canvas/` or directly in `apps/website/src/components/canvas/` if website-only.
