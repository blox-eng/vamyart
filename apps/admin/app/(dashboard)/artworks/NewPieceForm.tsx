"use client";

import React, { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { revalidatePaths } from "@/lib/revalidate";

const EMPTY = {
  title: "", year: "", medium: "", dimensions: "", excerpt: "", description: "",
  seoTitle: "", seoDescription: "", status: "available" as "available" | "bidding" | "sold",
  published: false,
};

export function NewPieceForm({ onCreated }: { onCreated: (id: string) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });

  const create = trpc.artworks.create.useMutation({
    onSuccess: async (a) => {
      await revalidatePaths(["/gallery", `/gallery/${a.slug}`]);
      toast("Piece created", "success");
      setOpen(false);
      setForm({ ...EMPTY });
      onCreated(a.id);
    },
    onError: (e) => toast(e.message || "Failed to create piece", "error"),
  });

  const previewSlug = form.title
    .normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/['‘’ʼ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm bg-black text-white px-4 py-2 rounded mb-8">
        + New piece
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate({
          title: form.title,
          year: form.year ? Number(form.year) : null,
          medium: form.medium || null,
          dimensions: form.dimensions || null,
          excerpt: form.excerpt || null,
          description: form.description || null,
          seoTitle: form.seoTitle || null,
          seoDescription: form.seoDescription || null,
          status: form.status,
          published: form.published,
        });
      }}
      className="bg-white border rounded-lg p-6 space-y-3 mb-8"
    >
      <p className="text-sm font-medium text-gray-700">New piece</p>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Title</label>
        <input className="border px-2 py-1 rounded text-sm w-full max-w-md" value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        {form.title && <p className="text-xs text-gray-400 mt-1">URL: /gallery/{previewSlug || "…"}</p>}
      </div>
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <input className="border px-2 py-1 rounded text-sm w-24" value={form.year}
            onChange={(e) => setForm({ ...form, year: e.target.value })} inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Medium</label>
          <input className="border px-2 py-1 rounded text-sm w-56" value={form.medium}
            onChange={(e) => setForm({ ...form, medium: e.target.value })} placeholder="Oil on canvas" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dimensions</label>
          <input className="border px-2 py-1 rounded text-sm w-40" value={form.dimensions}
            onChange={(e) => setForm({ ...form, dimensions: e.target.value })} placeholder="90 × 70 cm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="border px-2 py-1 rounded text-sm bg-white" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as typeof form.status })}>
            <option value="available">available</option>
            <option value="bidding">bidding</option>
            <option value="sold">sold</option>
          </select>
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Excerpt (gallery card + SEO fallback)</label>
        <input className="border px-2 py-1 rounded text-sm w-full max-w-md" value={form.excerpt}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description (story)</label>
        <textarea className="border px-2 py-1 rounded text-sm w-full max-w-md" rows={4} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        Published (visible on the public gallery). Tip: add images first, then publish.
      </label>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">SEO (optional)</summary>
        <div className="mt-2 space-y-2">
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO title (defaults to title)"
            value={form.seoTitle} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO description (defaults to excerpt)"
            value={form.seoDescription} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
        </div>
      </details>
      <div className="flex gap-2">
        <button type="submit" disabled={create.isPending}
          className="text-sm bg-black text-white px-4 py-1.5 rounded disabled:opacity-50">
          {create.isPending ? "Creating…" : "Create piece"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm border px-4 py-1.5 rounded">Cancel</button>
      </div>
    </form>
  );
}
