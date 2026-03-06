"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, ShoppingBag, ImageIcon, Mail, LogOut } from "lucide-react";
import { createClient } from "../../lib/supabase/client";

const navItems = [
  { href: "/auctions", label: "Auctions", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: ShoppingBag },
  { href: "/artworks", label: "Artworks", icon: ImageIcon },
  { href: "/inquiries", label: "Inquiries", icon: Mail },
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
    <div className="flex h-screen bg-gray-50">
      <aside className="w-56 bg-white border-r flex flex-col shrink-0">
        <div className="p-6 border-b">
          <span className="text-lg font-light tracking-wide">vamy admin</span>
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
  );
}
