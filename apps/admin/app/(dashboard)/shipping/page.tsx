"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

type MethodType = "free" | "paid" | "custom";

export default function ShippingPage() {
  const toast = useToast();
  const { data: methods, refetch, isLoading: methodsLoading } = trpc.shippingMethods.list.useQuery();
  const create = trpc.shippingMethods.create.useMutation({
    onSuccess: () => { refetch(); toast("shipping method created", "success"); },
  });
  const update = trpc.shippingMethods.update.useMutation({
    onSuccess: () => { refetch(); toast("shipping method updated", "success"); },
  });
  const del = trpc.shippingMethods.delete.useMutation({
    onSuccess: () => { refetch(); toast("shipping method deleted", "success"); },
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDisplay, setEditDisplay] = useState("");
  const [editType, setEditType] = useState<MethodType>("free");
  const [editCost, setEditCost] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState("");

  // New method form state
  const [newName, setNewName] = useState("");
  const [newDisplay, setNewDisplay] = useState("");
  const [newType, setNewType] = useState<MethodType>("free");
  const [newCost, setNewCost] = useState("");
  const [newDefault, setNewDefault] = useState(false);

  function startEdit(m: NonNullable<typeof methods>[0]) {
    setEditId(m.id);
    setEditName(m.name);
    setEditDisplay(m.displayText);
    setEditType(m.type as MethodType);
    setEditCost(m.cost ?? "");
    setError("");
  }

  async function saveEdit() {
    if (!editId) return;
    try {
      await update.mutateAsync({
        id: editId,
        name: editName,
        displayText: editDisplay,
        type: editType,
        cost: editType === "paid" && editCost ? Number(editCost) : undefined,
      });
      setEditId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    }
  }

  async function handleDelete(id: string) {
    if (confirmDelete !== id) { setConfirmDelete(id); return; }
    try {
      await del.mutateAsync({ id });
      setConfirmDelete(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cannot delete");
      setConfirmDelete(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await create.mutateAsync({
        name: newName,
        displayText: newDisplay,
        type: newType,
        cost: newType === "paid" && newCost ? Number(newCost) : undefined,
        isDefault: newDefault,
      });
      setNewName(""); setNewDisplay(""); setNewType("free"); setNewCost(""); setNewDefault(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create");
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-light mb-8">Shipping Methods</h1>
      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      <div className="space-y-3 mb-10">
        {methodsLoading ? (
          <SkeletonTable rows={4} cols={3} />
        ) : (
        <>
        {(methods ?? []).map((m) =>
          editId === m.id ? (
            <div key={m.id} className="border rounded-lg p-4 space-y-3">
              <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Name" value={editName} onChange={e => setEditName(e.target.value)} />
              <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Display text (buyer-facing)" value={editDisplay} onChange={e => setEditDisplay(e.target.value)} />
              <select className="w-full border px-3 py-2 rounded text-sm" value={editType} onChange={e => setEditType(e.target.value as MethodType)}>
                <option value="free">Free</option>
                <option value="custom">Custom (arranged by artist)</option>
                <option value="paid">Paid</option>
              </select>
              {editType === "paid" && (
                <input type="number" className="w-full border px-3 py-2 rounded text-sm" placeholder="Cost (€)" value={editCost} onChange={e => setEditCost(e.target.value)} />
              )}
              <div className="flex gap-2">
                <button onClick={saveEdit} className="bg-black text-white px-4 py-2 rounded text-sm">Save</button>
                <button onClick={() => setEditId(null)} className="border px-4 py-2 rounded text-sm">Cancel</button>
              </div>
            </div>
          ) : (
            <div key={m.id} className="border rounded-lg p-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{m.name} {m.isDefault && <span className="text-xs text-gray-400 ml-1">(default)</span>}</p>
                <p className="text-xs text-gray-500">{m.displayText} · {m.type}{m.type === "paid" && m.cost ? ` · €${m.cost}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => startEdit(m)} className="border px-3 py-1 rounded text-xs">Edit</button>
                <button
                  onClick={() => handleDelete(m.id)}
                  className={`px-3 py-1 rounded text-xs ${confirmDelete === m.id ? "bg-red-600 text-white" : "border text-red-600"}`}
                >
                  {confirmDelete === m.id ? "Confirm" : "Delete"}
                </button>
              </div>
            </div>
          )
        )}
        {(methods ?? []).length === 0 && <p className="text-sm text-gray-400">No shipping methods yet.</p>}
        </>
        )}
      </div>

      <h2 className="text-lg font-light mb-4">Add shipping method</h2>
      <form onSubmit={handleCreate} className="border rounded-lg p-4 space-y-3">
        <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Name (e.g. Express DHL)" value={newName} onChange={e => setNewName(e.target.value)} required />
        <input className="w-full border px-3 py-2 rounded text-sm" placeholder="Display text (buyer-facing)" value={newDisplay} onChange={e => setNewDisplay(e.target.value)} required />
        <select className="w-full border px-3 py-2 rounded text-sm" value={newType} onChange={e => setNewType(e.target.value as MethodType)}>
          <option value="free">Free</option>
          <option value="custom">Custom (arranged by artist)</option>
          <option value="paid">Paid</option>
        </select>
        {newType === "paid" && (
          <input type="number" className="w-full border px-3 py-2 rounded text-sm" placeholder="Cost (€)" value={newCost} onChange={e => setNewCost(e.target.value)} />
        )}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={newDefault} onChange={e => setNewDefault(e.target.checked)} />
          Set as default
        </label>
        <button type="submit" disabled={create.isPending} className="bg-black text-white px-4 py-2 rounded text-sm disabled:opacity-50">
          {create.isPending ? "Adding…" : "Add method"}
        </button>
      </form>
    </div>
  );
}
