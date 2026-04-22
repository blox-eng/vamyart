# Maeve Studio Admin Rebrand Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the admin panel from a generic "admin" tool to "Maeve Studio" — matching the main site's Cormorant Garamond + Inter typography, replacing generic labels with artist-natural language, and polishing the login page.

**Architecture:** Pure cosmetic changes across 5 files in `apps/admin`. No backend, routing, auth, or functional UI changes. No new npm dependencies — fonts loaded via Google Fonts CDN, same as the main website.

**Tech Stack:** Next.js 15 App Router, Tailwind CSS, Google Fonts (Cormorant Garamond + Inter)

---

## File map

- Modify: `apps/admin/app/globals.css` — add Google Fonts import
- Modify: `apps/admin/tailwind.config.ts` — extend fontFamily
- Modify: `apps/admin/app/layout.tsx` — title metadata + font class on body
- Modify: `apps/admin/app/(dashboard)/layout.tsx` — sidebar label, nav labels, welcome toast
- Modify: `apps/admin/app/login/page.tsx` — heading, button copy, card style

---

### Task 1: Typography — fonts + Tailwind config

**Files:**
- Modify: `apps/admin/app/globals.css`
- Modify: `apps/admin/tailwind.config.ts`
- Modify: `apps/admin/app/layout.tsx`

- [ ] **Step 1: Add Google Fonts import to globals.css**

Replace the entire contents of `apps/admin/app/globals.css` with:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@400;500;700&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  h1 {
    font-family: 'Cormorant Garamond', serif;
  }
}
```

- [ ] **Step 2: Extend Tailwind fontFamily**

Replace the entire contents of `apps/admin/tailwind.config.ts` with:

```ts
import type { Config } from "tailwindcss";

export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Cormorant Garamond', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
```

- [ ] **Step 3: Apply font class to body and update title**

Replace the entire contents of `apps/admin/app/layout.tsx` with:

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "Maeve Studio",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4: Build to verify no errors**

Run from repo root:
```bash
pnpm --filter @vamy/admin build 2>&1 | tail -10
```
Expected: build completes, no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/app/globals.css apps/admin/tailwind.config.ts apps/admin/app/layout.tsx
git commit -m "feat(admin): add Cormorant Garamond + Inter fonts, rename title to Maeve Studio"
```

---

### Task 2: Sidebar — label + nav renames + welcome toast

**Files:**
- Modify: `apps/admin/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update the dashboard layout**

Replace the entire contents of `apps/admin/app/(dashboard)/layout.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, LogOut } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { ToastProvider, useToast } from "@/components/ui/toast";
import React from "react";

function WelcomeToast() {
  const toast = useToast();
  React.useEffect(() => {
    if (sessionStorage.getItem("vamy-admin-just-logged-in")) {
      sessionStorage.removeItem("vamy-admin-just-logged-in");
      toast("welcome back, Maeve", "success");
    }
  }, [toast]);
  return null;
}

const navItems = [
  { href: "/auctions",  label: "Auctions",      icon: LayoutGrid },
  { href: "/orders",    label: "Sales",          icon: ShoppingBag },
  { href: "/artworks",  label: "Pieces",         icon: ImageIcon },
  { href: "/inquiries", label: "Messages",       icon: Mail },
  { href: "/shipping",  label: "Shipping",       icon: Truck },
  { href: "/banners",   label: "Announcements",  icon: Megaphone },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <ToastProvider>
      <WelcomeToast />
      <div className="flex h-screen bg-gray-50">
        <aside className="w-56 bg-white border-r flex flex-col shrink-0">
          <div className="p-6 border-b">
            <div className="flex items-center gap-3">
              <img src="/vamy-black.png" alt="vamy" className="h-6 w-auto" />
              <span className="text-sm font-light tracking-widest text-gray-500">studio</span>
            </div>
          </div>
          <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                  pathname.startsWith(href)
                    ? "bg-black text-white"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
              >
                <Icon size={16} aria-hidden />
                {label}
              </Link>
            ))}
          </nav>
          <div className="p-3 border-t">
            <button
              onClick={handleSignOut}
              className="flex items-center gap-3 px-3 py-2 rounded text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
            >
              <LogOut size={16} aria-hidden />
              Sign out
            </button>
          </div>
        </aside>
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </ToastProvider>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @vamy/admin build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add "apps/admin/app/(dashboard)/layout.tsx"
git commit -m "feat(admin): rename nav labels to artist language, sidebar label to studio"
```

---

### Task 3: Login page — heading, button, card style

**Files:**
- Modify: `apps/admin/app/login/page.tsx`

- [ ] **Step 1: Update the login page**

Replace the entire contents of `apps/admin/app/login/page.tsx` with:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../lib/supabase/client";

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
      sessionStorage.setItem("vamy-admin-just-logged-in", "1");
      router.push("/auctions");
      router.refresh();
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-10 border w-full max-w-sm">
        <h1 className="font-serif text-3xl font-light mb-8 text-center tracking-wide">
          Maeve Studio
        </h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="w-full border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-black"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-3 text-sm tracking-wide disabled:opacity-50 hover:bg-gray-800 transition-colors"
          >
            {loading ? "Entering…" : "Enter studio"}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build to verify**

```bash
pnpm --filter @vamy/admin build 2>&1 | tail -10
```
Expected: clean build.

- [ ] **Step 3: Commit and push**

```bash
git add apps/admin/app/login/page.tsx
git commit -m "feat(admin): restyle login page — Maeve Studio heading, flat card, Enter studio button"
git push origin main
```
