"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

export default function CollectionsPage() {
  const toast = useToast();
  const { data: collectionList, refetch, isLoading: collectionsLoading } = trpc.collections.list.useQuery();
  const create = trpc.collections.create.useMutation({
    onSuccess: () => { refetch(); toast("collection created", "success"); },
    onError: () => toast("failed to create collection", "error"),
  });
  const update = trpc.collections.update.useMutation({
    onSuccess: () => { refetch(); toast("collection updated", "success"); },
    onError: () => toast("failed to update collection", "error"),
  });
  const setFeatured = trpc.collections.setFeatured.useMutation({
    onSuccess: () => { refetch(); toast("collection featured", "success"); },
    onError: () => toast("failed to feature collection", "error"),
  });
  const del = trpc.collections.delete.useMutation({
    onSuccess: () => { refetch(); toast("collection deleted", "success"); },
    onError: () => toast("failed to delete collection", "error"),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSlug, setEditSlug] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeoTitle, setEditSeoTitle] = useState("");
  const [editSeoDescription, setEditSeoDescription] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");

  function startEdit(c: NonNullable<typeof collectionList>[0]) {
    setEditId(c.id);
    setEditTitle(c.title);
    setEditSlug(c.slug);
    setEditDescription(c.description ?? "");
    setEditSeoTitle(c.seoTitle ?? "");
    setEditSeoDescription(c.seoDescription ?? "");
  }

  async function togglePublished(c: NonNullable<typeof collectionList>[0]) {
    try {
      await update.mutateAsync({ id: c.id, published: !c.published });
    } catch {
      // error toast fires from onError callback
    }
  }

  async function toggleFeatured(c: NonNullable<typeof collectionList>[0]) {
    try {
      await setFeatured.mutateAsync({ id: c.id, featured: !c.featured });
    } catch {
      // error toast fires from onError callback
    }
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      await update.mutateAsync({
        id: editId,
        title: editTitle,
        slug: editSlug,
        description: editDescription || null,
        seoTitle: editSeoTitle || null,
        seoDescription: editSeoDescription || null,
      });
      setEditId(null);
    } catch {
      // error toast fires from onError callback
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await del.mutateAsync({ id });
      setConfirmDelete(null);
    } catch {
      setConfirmDelete(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ title: newTitle });
    setNewTitle("");
  }

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Collections</h1>

      {collectionsLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="space-y-3 mb-10">
          {(collectionList ?? []).map((c) =>
            editId === c.id ? (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Slug" value={editSlug} onChange={e => setEditSlug(e.target.value)} />
                <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="Description" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="SEO title" value={editSeoTitle} onChange={e => setEditSeoTitle(e.target.value)} />
                <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="SEO description" value={editSeoDescription} onChange={e => setEditSeoDescription(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-black text-white px-4 py-2 rounded text-sm">Save</button>
                  <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={c.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    onClick={() => toggleFeatured(c)}
                    className={`px-3 py-2 rounded text-xs font-medium ${c.featured ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {c.featured ? "★ Featured" : "☆ Feature"}
                  </button>
                  <button
                    onClick={() => togglePublished(c)}
                    className={`px-3 py-2 rounded text-xs font-medium ${c.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {c.published ? "Published" : "Draft"}
                  </button>
                  <button onClick={() => startEdit(c)} className="border px-3 py-2 rounded text-xs">Edit</button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className={`px-3 py-2 rounded text-xs ${confirmDelete === c.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                  >
                    {confirmDelete === c.id ? "Confirm" : "Delete"}
                  </button>
                </div>
              </div>
            )
          )}
          {(collectionList ?? []).length === 0 && <p className="text-sm text-gray-400">No collections yet.</p>}
        </div>
      )}

      <h2 className="text-lg font-light mb-4">Create collection</h2>
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Collection title" value={newTitle} onChange={e => setNewTitle(e.target.value)} required />
        <button type="submit" disabled={create.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {create.isPending ? "Creating…" : "Create collection"}
        </button>
      </form>
    </div>
  );
}
