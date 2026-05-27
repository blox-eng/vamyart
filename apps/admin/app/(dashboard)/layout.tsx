"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, Truck, Megaphone, LogOut, Menu, X, Users } from "lucide-react";
import { createClient } from "../../lib/supabase/client";
import { ToastProvider, useToast } from "@/components/ui/toast";
import React, { useEffect, useRef, useState } from "react";

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
  { href: "/people",    label: "People",         icon: Users },
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLElement>(null);

  // Focus into the drawer when it opens.
  useEffect(() => { if (drawerOpen) drawerRef.current?.focus(); }, [drawerOpen]);

  // Lock body scroll while drawer is open.
  useEffect(() => {
    document.body.classList.toggle("overflow-hidden", drawerOpen);
    return () => document.body.classList.remove("overflow-hidden");
  }, [drawerOpen]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setDrawerOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const SidebarBody = (
    <>
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
            className={`flex items-center gap-3 px-3 py-3 rounded text-sm transition-colors ${
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
          className="flex items-center gap-3 px-3 py-3 rounded text-sm text-gray-600 hover:bg-gray-100 w-full transition-colors"
        >
          <LogOut size={16} aria-hidden />
          Sign out
        </button>
      </div>
    </>
  );

  return (
    <ToastProvider>
      <WelcomeToast />
      <div className="flex h-screen bg-gray-50">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex w-56 bg-white border-r flex-col shrink-0">
          {SidebarBody}
        </aside>

        {/* Mobile drawer + backdrop */}
        {drawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
        )}
        <aside
          ref={drawerRef}
          tabIndex={-1}
          inert={!drawerOpen ? true : undefined}
          className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r flex flex-col shrink-0 transition-transform duration-200 lg:hidden ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
          aria-hidden={!drawerOpen}
        >
          <button
            onClick={() => setDrawerOpen(false)}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-700"
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
          {SidebarBody}
        </aside>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Mobile top bar */}
          <header className="lg:hidden sticky top-0 z-30 flex items-center gap-3 bg-white border-b px-4 h-14 shrink-0">
            <button
              onClick={() => setDrawerOpen(true)}
              className="p-2 -ml-2 text-gray-600 hover:text-black"
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <img src="/vamy-black.png" alt="vamy" className="h-5 w-auto" />
            <span className="text-xs font-light tracking-widest text-gray-500">studio</span>
          </header>
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}
