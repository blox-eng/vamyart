"use client";

import React, { useEffect, useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { revalidatePaths } from "@/lib/revalidate";

type Artwork = {
  id: string; slug: string; title: string; year: number | null;
  medium: string | null; dimensions: string | null; status: string;
  excerpt: string | null; description: string | null;
  seoTitle: string | null; seoDescription: string | null;
  featured: boolean; published: boolean;
};

export function EditPiecePanel({ artwork, onChanged, onDeleted }: { artwork: Artwork; onChanged: () => void; onDeleted: () => void; }) {
  const toast = useToast();
  const [form, setForm] = useState(artwork);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setForm(artwork); setConfirmDelete(false); }, [artwork]);

  const update = trpc.artworks.update.useMutation({
    onSuccess: async () => {
      await revalidatePaths(["/", "/gallery", `/gallery/${form.slug}`]);
      toast("Piece updated", "success");
      onChanged();
    },
    onError: (e) => toast(e.message || "Failed to update", "error"),
  });
  const setFeatured = trpc.artworks.setFeatured.useMutation({
    onSuccess: async () => { await revalidatePaths(["/", "/gallery"]); toast("Featured updated", "success"); onChanged(); },
    onError: () => toast("Failed to update featured", "error"),
  });
  const del = trpc.artworks.delete.useMutation({
    onSuccess: async () => {
      await revalidatePaths(["/", "/gallery", `/gallery/${form.slug}`]);
      toast("Piece deleted", "success");
      onDeleted();
    },
    onError: (e) => toast(e.message || "Failed to delete", "error"),
  });

  return (
    <div className="bg-white border rounded-lg p-6 space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Edit piece</p>
        <div className="flex gap-2">
          <button onClick={() => setFeatured.mutate({ id: artwork.id, featured: !artwork.featured })}
            disabled={setFeatured.isPending}
            className={`text-xs px-2 py-0.5 rounded disabled:opacity-50 ${artwork.featured ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}>
            {artwork.featured ? "★ Featured" : "Feature"}
          </button>
          <span className={`text-xs px-2 py-0.5 rounded ${artwork.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
            {artwork.published ? "Published" : "Draft"}
          </span>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[12rem]">
          <label className="block text-xs text-gray-500 mb-1">Title</label>
          <input className="border px-2 py-1 rounded text-sm w-full" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Year</label>
          <input className="border px-2 py-1 rounded text-sm w-24" value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Status</label>
          <select className="border px-2 py-1 rounded text-sm bg-white" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="available">available</option>
            <option value="bidding">bidding</option>
            <option value="sold">sold</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Medium</label>
          <input className="border px-2 py-1 rounded text-sm w-56" value={form.medium ?? ""}
            onChange={(e) => setForm({ ...form, medium: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Dimensions</label>
          <input className="border px-2 py-1 rounded text-sm w-40" value={form.dimensions ?? ""}
            onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Excerpt</label>
        <input className="border px-2 py-1 rounded text-sm w-full max-w-md" value={form.excerpt ?? ""}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Description</label>
        <textarea className="border px-2 py-1 rounded text-sm w-full max-w-md" rows={4} value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
        <input type="checkbox" checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        Published (visible on the public gallery)
      </label>
      <details className="text-xs text-gray-500">
        <summary className="cursor-pointer">SEO (optional)</summary>
        <div className="mt-2 space-y-2">
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO title"
            value={form.seoTitle ?? ""} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO description"
            value={form.seoDescription ?? ""} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
        </div>
      </details>
      <div className="flex gap-2">
        <button
          onClick={() => update.mutate({
            id: artwork.id, title: form.title, year: form.year, medium: form.medium,
            dimensions: form.dimensions, status: form.status as "available" | "bidding" | "sold",
            excerpt: form.excerpt, description: form.description,
            seoTitle: form.seoTitle, seoDescription: form.seoDescription, published: form.published,
          })}
          disabled={update.isPending}
          className="text-sm bg-black text-white px-4 py-1.5 rounded disabled:opacity-50">
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => (confirmDelete ? del.mutate({ id: artwork.id }) : setConfirmDelete(true))}
          disabled={del.isPending}
          className={`text-sm px-4 py-1.5 rounded disabled:opacity-50 ${confirmDelete ? "bg-red-600 text-white" : "border text-red-500 hover:bg-red-50"}`}>
          {confirmDelete ? "Confirm delete" : "Delete piece"}
        </button>
        {confirmDelete && <button onClick={() => setConfirmDelete(false)} className="text-sm border px-4 py-1.5 rounded">Cancel</button>}
      </div>
    </div>
  );
}
