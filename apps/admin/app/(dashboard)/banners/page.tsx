"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

export default function BannersPage() {
  const toast = useToast();
  const { data: bannerList, refetch, isLoading: bannersLoading } = trpc.banners.list.useQuery();
  const create = trpc.banners.create.useMutation({
    onSuccess: () => { refetch(); toast("banner created", "success"); },
    onError: () => toast("failed to create banner", "error"),
  });
  const update = trpc.banners.update.useMutation({
    onSuccess: () => { refetch(); toast("banner updated", "success"); },
    onError: () => toast("failed to update banner", "error"),
  });
  const del = trpc.banners.delete.useMutation({
    onSuccess: () => { refetch(); toast("banner deleted", "success"); },
    onError: () => toast("failed to delete banner", "error"),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editScope, setEditScope] = useState<"global" | "page">("global");
  const [editSlug, setEditSlug] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const [newText, setNewText] = useState("");
  const [newScope, setNewScope] = useState<"global" | "page">("global");
  const [newSlug, setNewSlug] = useState("");

  function startEdit(b: NonNullable<typeof bannerList>[0]) {
    setEditId(b.id);
    setEditText(b.text);
    setEditScope(b.scope as "global" | "page");
    setEditSlug(b.pageSlug ?? "");
  }

  async function toggleActive(b: NonNullable<typeof bannerList>[0]) {
    try {
      await update.mutateAsync({ id: b.id, isActive: !b.isActive });
    } catch {
      // error toast fires from onError callback
    }
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      await update.mutateAsync({
        id: editId,
        text: editText,
        scope: editScope,
        pageSlug: editScope === "page" ? editSlug : null,
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
    await create.mutateAsync({
      text: newText,
      scope: newScope,
      pageSlug: newScope === "page" ? newSlug : null,
    });
    setNewText(""); setNewScope("global"); setNewSlug("");
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Announcement Banners</h1>

      {bannersLoading ? (
        <SkeletonTable rows={4} cols={4} />
      ) : (
        <div className="space-y-3 mb-10">
          {(bannerList ?? []).map((b) =>
            editId === b.id ? (
              <div key={b.id} className="border rounded-lg p-4 space-y-3">
                <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} value={editText} onChange={e => setEditText(e.target.value)} />
                <select className="w-full border px-3 py-2 rounded text-sm" value={editScope} onChange={e => setEditScope(e.target.value as "global" | "page")}>
                  <option value="global">Global (all pages)</option>
                  <option value="page">Specific page</option>
                </select>
                {editScope === "page" && (
                  <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Page slug (e.g. gallery)" value={editSlug} onChange={e => setEditSlug(e.target.value)} />
                )}
                <div className="flex gap-2">
                  <button onClick={saveEdit} className="bg-black text-white px-4 py-2 rounded text-sm">Save</button>
                  <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={b.id} className="border rounded-lg p-4 flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{b.text}</p>
                  <p className="text-xs text-gray-400">{b.scope === "global" ? "All pages" : `Page: /${b.pageSlug}`}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => toggleActive(b)}
                    className={`px-3 py-1 rounded text-xs font-medium ${b.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
                  >
                    {b.isActive ? "Live" : "Off"}
                  </button>
                  <button onClick={() => startEdit(b)} className="border px-3 py-1 rounded text-xs">Edit</button>
                  <button
                    onClick={() => handleDelete(b.id)}
                    className={`px-3 py-1 rounded text-xs ${confirmDelete === b.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                  >
                    {confirmDelete === b.id ? "Confirm" : "Delete"}
                  </button>
                </div>
              </div>
            )
          )}
          {(bannerList ?? []).length === 0 && <p className="text-sm text-gray-400">No banners yet.</p>}
        </div>
      )}

      <h2 className="text-lg font-light mb-4">Create banner</h2>
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <textarea className="w-full border px-3 py-2 rounded text-sm" rows={2} placeholder="Banner text" value={newText} onChange={e => setNewText(e.target.value)} required />
        <select className="w-full border px-3 py-2 rounded text-sm" value={newScope} onChange={e => setNewScope(e.target.value as "global" | "page")}>
          <option value="global">Global (all pages)</option>
          <option value="page">Specific page</option>
        </select>
        {newScope === "page" && (
          <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Page slug (e.g. gallery)" value={newSlug} onChange={e => setNewSlug(e.target.value)} required />
        )}
        <button type="submit" disabled={create.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {create.isPending ? "Creating…" : "Create banner"}
        </button>
      </form>
    </div>
  );
}
