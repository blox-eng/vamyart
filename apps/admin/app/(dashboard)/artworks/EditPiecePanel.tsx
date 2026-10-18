"use client";

import React, { useEffect, useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { revalidatePaths } from "@/lib/revalidate";
import { pieceRevalidatePaths } from "@/lib/revalidate-paths";
import { seoHints } from "@/lib/seo-hints";

type Artwork = {
  id: string; slug: string; title: string; year: number | null;
  medium: string | null; dimensions: string | null; status: string;
  excerpt: string | null; description: string | null;
  seoTitle: string | null; seoDescription: string | null;
  published: boolean;
  collectionIds?: string[];
};

export function EditPiecePanel({ artwork, primaryImageAlt, onChanged, onDeleted }: {
  artwork: Artwork; primaryImageAlt: string | null | undefined; onChanged: () => void; onDeleted: () => void;
}) {
  const toast = useToast();
  const { data: collectionList } = trpc.collections.list.useQuery();
  const collectionSlugs = (collectionList ?? []).map((c) => c.slug);
  const [form, setForm] = useState(artwork);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Reset only when another piece is picked: a refetch after a collection toggle must not wipe unsaved edits.
  useEffect(() => { setForm(artwork); setConfirmDelete(false); }, [artwork.id]);

  const update = trpc.artworks.update.useMutation({
    onSuccess: async () => {
      await revalidatePaths(pieceRevalidatePaths(form.slug, collectionSlugs));
      toast("Piece updated", "success");
      onChanged();
    },
    onError: (e) => toast(e.message || "Failed to update", "error"),
  });
  const del = trpc.artworks.delete.useMutation({
    onSuccess: async () => {
      await revalidatePaths(pieceRevalidatePaths(form.slug, collectionSlugs));
      toast("Piece deleted", "success");
      onDeleted();
    },
    onError: (e) => toast(e.message || "Failed to delete", "error"),
  });

  const membership = trpc.collections.setMembership.useMutation({
    onSuccess: async (_data, vars) => {
      const slug = collectionList?.find((c) => c.id === vars.collectionId)?.slug;
      await revalidatePaths(pieceRevalidatePaths(artwork.slug, slug ? [slug] : []));
      toast(vars.member ? "Added to collection" : "Removed from collection", "success");
      onChanged();
    },
    onError: (e, vars) => {
      setToggling(({ [vars.collectionId]: _, ...rest }) => rest);
      toast(e.message || "Failed to update collections", "error");
    },
  });
  const memberOf = new Set(artwork.collectionIds ?? []);
  // Optimistic chip state per collection, held until the refetched piece carries the change.
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const collectionIdsKey = (artwork.collectionIds ?? []).join();
  useEffect(() => setToggling({}), [collectionIdsKey, artwork.id]);

  const hints = seoHints({ altText: primaryImageAlt, seoDescription: form.seoDescription, excerpt: form.excerpt, dimensions: form.dimensions });

  return (
    <div className="bg-field border rounded-lg p-6 space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-ink">Edit piece</p>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${artwork.published ? "bg-accent-wash text-accent" : "bg-wall text-muted"}`}>
            {artwork.published ? "Published" : "Draft"}
          </span>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div className="flex-1 min-w-[12rem]">
          <label className="block text-xs text-muted mb-1">Title</label>
          <input className="border px-2 py-1 rounded text-sm w-full" value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Year</label>
          <input className="border px-2 py-1 rounded text-sm w-24" value={form.year ?? ""}
            onChange={(e) => setForm({ ...form, year: e.target.value ? Number(e.target.value) : null })} inputMode="numeric" />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Status</label>
          <select className="border px-2 py-1 rounded text-sm bg-field" value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}>
            <option value="available">available</option>
            <option value="bidding">bidding</option>
            <option value="sold">sold</option>
          </select>
        </div>
      </div>
      <div className="flex gap-3 flex-wrap">
        <div>
          <label className="block text-xs text-muted mb-1">Medium</label>
          <input className="border px-2 py-1 rounded text-sm w-56" value={form.medium ?? ""}
            onChange={(e) => setForm({ ...form, medium: e.target.value })} />
        </div>
        <div>
          <label className="block text-xs text-muted mb-1">Dimensions</label>
          <input className="border px-2 py-1 rounded text-sm w-40" value={form.dimensions ?? ""}
            onChange={(e) => setForm({ ...form, dimensions: e.target.value })} />
        </div>
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Excerpt</label>
        <input className="border px-2 py-1 rounded text-sm w-full max-w-md" value={form.excerpt ?? ""}
          onChange={(e) => setForm({ ...form, excerpt: e.target.value })} />
      </div>
      <div>
        <label className="block text-xs text-muted mb-1">Description</label>
        <textarea className="border px-2 py-1 rounded text-sm w-full max-w-md" rows={4} value={form.description ?? ""}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      {collectionList && collectionList.length > 0 && (
        <div>
          <p id="piece-collections-label" className="block text-xs text-muted mb-1">Collections</p>
          <div role="group" aria-labelledby="piece-collections-label" className="flex gap-2 flex-wrap">
            {collectionList.map((c) => {
              const member = toggling[c.id] ?? memberOf.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-pressed={member}
                  aria-busy={c.id in toggling}
                  disabled={c.id in toggling}
                  onClick={() => {
                    setToggling((t) => ({ ...t, [c.id]: !member }));
                    membership.mutate({ collectionId: c.id, artworkId: artwork.id, member: !member });
                  }}
                  className={`text-xs px-3 min-h-10 rounded-xs border transition-colors disabled:opacity-60 ${member ? "bg-accent-wash text-accent border-accent" : "text-muted hover:bg-hover"}`}
                >
                  {member && <span aria-hidden className="mr-1">✓</span>}
                  {c.title.trim()}
                  {!c.published && <span className="ml-1">(draft)</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input type="checkbox" checked={form.published}
          onChange={(e) => setForm({ ...form, published: e.target.checked })} />
        Published (visible on the public gallery)
      </label>
      <details className="text-xs text-muted">
        <summary className="cursor-pointer">SEO (optional)</summary>
        <div className="mt-2 space-y-2">
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO title"
            value={form.seoTitle ?? ""} onChange={(e) => setForm({ ...form, seoTitle: e.target.value })} />
          <input className="border px-2 py-1 rounded text-sm w-full max-w-md" placeholder="SEO description"
            value={form.seoDescription ?? ""} onChange={(e) => setForm({ ...form, seoDescription: e.target.value })} />
        </div>
      </details>
      {hints.length > 0 && (
        <ul className="text-xs text-muted space-y-1">
          {hints.map((h) => <li key={h}>{h}</li>)}
        </ul>
      )}
      <div className="flex gap-2">
        <button
          onClick={() => update.mutate({
            id: artwork.id, title: form.title, year: form.year, medium: form.medium,
            dimensions: form.dimensions, status: form.status as "available" | "bidding" | "sold",
            excerpt: form.excerpt, description: form.description,
            seoTitle: form.seoTitle, seoDescription: form.seoDescription, published: form.published,
          })}
          disabled={update.isPending}
          className="text-sm bg-ink text-paper px-4 py-1.5 rounded disabled:opacity-50">
          {update.isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => (confirmDelete ? del.mutate({ id: artwork.id }) : setConfirmDelete(true))}
          disabled={del.isPending}
          className={`text-sm px-4 py-1.5 rounded disabled:opacity-50 ${confirmDelete ? "bg-neg text-paper" : "border text-neg hover:bg-neg/10"}`}>
          {confirmDelete ? "Confirm delete" : "Delete piece"}
        </button>
        {confirmDelete && <button onClick={() => setConfirmDelete(false)} className="text-sm border px-4 py-1.5 rounded">Cancel</button>}
      </div>
    </div>
  );
}
