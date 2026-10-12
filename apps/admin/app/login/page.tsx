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
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="bg-field p-10 border w-full max-w-sm">
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
            className="w-full border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="w-full border px-4 py-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent"
          />
          {error && <p className="text-sm text-neg">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-ink text-paper py-3 text-sm tracking-wide disabled:opacity-50 hover:bg-ink/90 transition-colors"
          >
            {loading ? "Entering…" : "Enter studio"}
          </button>
        </form>
      </div>
    </div>
  );
}
