"use client";

import { useState, useEffect } from "react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "@vamy/db/trpc";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import { CoverCropModal } from "./CoverCropModal";

type CollectionRow = inferRouterOutputs<AppRouter>["collections"]["list"][number];

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
  const reorder = trpc.collections.reorder.useMutation({
    onSuccess: () => { refetch(); toast("order saved", "success"); },
    onError: () => toast("failed to save order", "error"),
  });

  const [order, setOrder] = useState<string[]>([]);
  useEffect(() => {
    if (collectionList) setOrder(collectionList.map((c) => c.id));
  }, [collectionList]);

  const orderDirty =
    !!collectionList && JSON.stringify(order) !== JSON.stringify(collectionList.map((c) => c.id));

  function moveCollection(index: number, direction: -1 | 1) {
    setOrder((prev) => {
      const next = [...prev];
      const j = index + direction;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

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

  const byId = new Map((collectionList ?? []).map((c) => [c.id, c]));

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Collections</h1>

      {collectionsLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="mb-10">
          {orderDirty && (
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => reorder.mutate({ ids: order })}
                disabled={reorder.isPending}
                className="text-xs bg-black text-white px-3 py-1.5 rounded disabled:opacity-50"
              >
                {reorder.isPending ? "Saving…" : "Save order"}
              </button>
            </div>
          )}
          <div className="space-y-3">
          {order.map((id, index) => {
            const c = byId.get(id);
            if (!c) return null;
            return editId === c.id ? (
              <div key={c.id} className="border rounded-lg p-4 space-y-3">
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Title" value={editTitle} onChange={e => setEditTitle(e.target.value)} />
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Slug" value={editSlug} onChange={e => setEditSlug(e.target.value)} />
                <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="Description" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                <input className="w-full border px-3 py-2 rounded text-sm" placeholder="SEO title" value={editSeoTitle} onChange={e => setEditSeoTitle(e.target.value)} />
                <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="SEO description" value={editSeoDescription} onChange={e => setEditSeoDescription(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={saveEdit} disabled={update.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">Save</button>
                  <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
                </div>

                <CoverImageEditor collection={c} onUpdated={refetch} />
                <CollectionPieces collectionId={c.id} />
              </div>
            ) : (
              <div key={c.id} className="border rounded-lg p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{c.title}</p>
                  <p className="text-xs text-gray-400">/{c.slug}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <button
                    type="button"
                    onClick={() => moveCollection(index, -1)}
                    disabled={index === 0}
                    className="border px-2 py-2 rounded text-xs disabled:opacity-30"
                    title="Move up"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveCollection(index, 1)}
                    disabled={index === order.length - 1}
                    className="border px-2 py-2 rounded text-xs disabled:opacity-30"
                    title="Move down"
                  >
                    ↓
                  </button>
                  <button
                    onClick={() => toggleFeatured(c)}
                    disabled={setFeatured.isPending}
                    className={`px-3 py-2 rounded text-xs font-medium disabled:opacity-50 ${c.featured ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {c.featured ? "★ Featured" : "☆ Feature"}
                  </button>
                  <button
                    onClick={() => togglePublished(c)}
                    disabled={update.isPending}
                    className={`px-3 py-2 rounded text-xs font-medium disabled:opacity-50 ${c.published ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {c.published ? "Published" : "Draft"}
                  </button>
                  <button onClick={() => startEdit(c)} className="border px-3 py-2 rounded text-xs">Edit</button>
                  <button
                    onClick={() => handleDelete(c.id)}
                    disabled={del.isPending}
                    className={`px-3 py-2 rounded text-xs disabled:opacity-50 ${confirmDelete === c.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                  >
                    {confirmDelete === c.id ? "Confirm" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })}
          {order.length === 0 && <p className="text-sm text-gray-400">No collections yet.</p>}
          </div>
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

function CoverImageEditor({ collection, onUpdated }: { collection: CollectionRow; onUpdated: () => void }) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const createCoverUploadUrl = trpc.collections.createCoverUploadUrl.useMutation();
  const updateCover = trpc.collections.update.useMutation({
    onSuccess: () => { onUpdated(); toast("cover image updated", "success"); },
    onError: () => toast("failed to update cover image", "error"),
  });

  function pickFile(file: File) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast("Invalid file type (jpg/png/webp only)", "error");
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      toast("File too large (max 25MB)", "error");
      return;
    }
    setPendingFile(file); // opens the crop modal
  }

  async function uploadCropped(blob: Blob) {
    setPendingFile(null);
    setUploading(true);
    try {
      // Cropped output is always image/jpeg (see lib/image/crop.ts).
      const { path, token } = await createCoverUploadUrl.mutateAsync({
        collectionId: collection.id,
        contentType: "image/jpeg",
      });
      const supabase = createClient();
      const { error } = await supabase.storage
        .from("artwork-images")
        .uploadToSignedUrl(path, token, blob, { contentType: "image/jpeg", cacheControl: "31536000" });
      if (error) throw error;
      await updateCover.mutateAsync({ id: collection.id, coverImagePath: path });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="border-t pt-3">
      <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Cover image (3:2)</label>
      <div className="flex items-center gap-3">
        {collection.coverImagePath ? (
          <img
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/artwork-images/${collection.coverImagePath}`}
            alt="Collection cover"
            className="w-24 h-16 object-cover rounded border"
          />
        ) : (
          <div className="w-24 h-16 rounded border border-dashed flex items-center justify-center text-xs text-gray-400">
            None
          </div>
        )}
        <div className="flex flex-col gap-2">
          <label className="text-xs border px-3 py-2 rounded cursor-pointer hover:bg-gray-100 w-fit">
            <input
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) pickFile(file);
                e.target.value = "";
              }}
            />
            {uploading ? "Uploading…" : "Upload cover"}
          </label>
          {collection.coverImagePath && (
            <button
              type="button"
              onClick={() => updateCover.mutate({ id: collection.id, coverImagePath: null })}
              disabled={updateCover.isPending}
              className="text-xs text-red-600 hover:underline w-fit disabled:opacity-50"
            >
              Clear cover
            </button>
          )}
        </div>
      </div>

      {pendingFile && (
        <CoverCropModal
          file={pendingFile}
          onCancel={() => setPendingFile(null)}
          onCropped={uploadCropped}
        />
      )}
    </div>
  );
}

function CollectionPieces({ collectionId }: { collectionId: string }) {
  const toast = useToast();
  const { data: artworkList, isLoading: artworksLoading } = trpc.artworks.list.useQuery();
  const { data: pieceIds, refetch: refetchPieceIds, isLoading: pieceIdsLoading } = trpc.collections.getPieceIds.useQuery({ collectionId });
  const setPieces = trpc.collections.setPieces.useMutation({
    onSuccess: () => { refetchPieceIds(); toast("pieces updated", "success"); },
    onError: () => toast("failed to update pieces", "error"),
  });

  // Ordered list of assigned artwork ids, kept local until "Save order" is pressed.
  const [ordered, setOrdered] = useState<string[]>([]);

  useEffect(() => {
    if (pieceIds) setOrdered(pieceIds);
  }, [pieceIds]);

  const dirty = JSON.stringify(ordered) !== JSON.stringify(pieceIds ?? []);

  function toggle(artworkId: string) {
    setOrdered((prev) =>
      prev.includes(artworkId) ? prev.filter((id) => id !== artworkId) : [...prev, artworkId]
    );
  }

  function move(index: number, direction: -1 | 1) {
    setOrdered((prev) => {
      const next = [...prev];
      const j = index + direction;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  }

  function save() {
    setPieces.mutate({ collectionId, artworkIds: ordered });
  }

  if (artworksLoading || pieceIdsLoading) {
    return <div className="border-t pt-3 text-xs text-gray-400">Loading pieces…</div>;
  }

  const byId = new Map((artworkList ?? []).map((a) => [a.id, a]));
  const unassigned = (artworkList ?? []).filter((a) => !ordered.includes(a.id));

  return (
    <div className="border-t pt-3">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-xs text-gray-500 uppercase tracking-wide">
          Pieces ({ordered.length})
        </label>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || setPieces.isPending}
          className="text-xs bg-black text-white px-3 py-1.5 rounded disabled:opacity-50"
        >
          {setPieces.isPending ? "Saving…" : "Save order"}
        </button>
      </div>

      {ordered.length > 0 && (
        <ul className="space-y-1 mb-3">
          {ordered.map((id, i) => {
            const a = byId.get(id);
            return (
              <li key={id} className="flex items-center justify-between gap-2 text-sm border rounded px-2 py-1.5 bg-gray-50">
                <span className="truncate">{a?.title ?? id.slice(0, 8)}</span>
                <div className="flex items-center gap-1 shrink-0">
                  <button type="button" onClick={() => move(i, -1)} className="text-xs border px-2 py-1 rounded" title="Move earlier">↑</button>
                  <button type="button" onClick={() => move(i, 1)} className="text-xs border px-2 py-1 rounded" title="Move later">↓</button>
                  <button type="button" onClick={() => toggle(id)} className="text-xs text-red-600 hover:underline px-1">Remove</button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {unassigned.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-1">Add a piece:</p>
          <div className="flex flex-wrap gap-2">
            {unassigned.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
              >
                + {a.title}
              </button>
            ))}
          </div>
        </div>
      )}

      {ordered.length === 0 && unassigned.length === 0 && (
        <p className="text-xs text-gray-400">No pieces available.</p>
      )}
    </div>
  );
}
