"use client";

import { useState, useMemo } from "react";
import { trpc } from "../../../lib/trpc";

type VariantDraft = {
  name: string;
  price: string;
  stock: string;
  available: boolean;
};

type ProductDraft = {
  name: string;
  description: string;
  active: boolean;
};

type NewVariantForm = { productId: string; name: string; price: string; stock: string };
type NewProductForm = { artworkId: string; productType: string; name: string; description: string };

export default function ArtworksPage() {
  const { data: productList, refetch } = trpc.products.listAll.useQuery();
  const { data: shippingMethodsList } = trpc.shippingMethods.list.useQuery();
  const updateShipping = trpc.products.updateShippingMethod.useMutation({ onSuccess: () => refetch() });

  const updateVariant = trpc.products.updateVariant.useMutation({ onSuccess: () => refetch() });
  const deleteVariant = trpc.products.deleteVariant.useMutation({ onSuccess: () => refetch() });
  const createVariant = trpc.products.createVariant.useMutation({ onSuccess: () => refetch() });
  const updateProduct = trpc.products.updateProduct.useMutation({ onSuccess: () => refetch() });
  const deleteProduct = trpc.products.deleteProduct.useMutation({ onSuccess: () => refetch() });
  const createProduct = trpc.products.createProduct.useMutation({ onSuccess: () => refetch() });

  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<Record<string, VariantDraft>>({});
  const [editingProduct, setEditingProduct] = useState<Record<string, ProductDraft>>({});
  const [newVariantForm, setNewVariantForm] = useState<NewVariantForm | null>(null);
  const [newProductForm, setNewProductForm] = useState<NewProductForm | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const artworkEntries = useMemo(() => {
    const map = new Map<string, { artwork: any; products: any[] }>();
    for (const p of productList ?? []) {
      const key = p.artworkId ?? "none";
      if (!map.has(key)) map.set(key, { artwork: p.artwork, products: [] });
      map.get(key)!.products.push(p);
    }
    return [...map.entries()];
  }, [productList]);

  const selectedKey = selectedArtworkId ?? artworkEntries[0]?.[0] ?? null;
  const selectedEntry = artworkEntries.find(([k]) => k === selectedKey);
  const selected = selectedEntry?.[1];

  // ── Variant editing ──────────────────────────────────────────────────────────

  function startEditVariant(v: any) {
    setEditingVariant((prev) => ({
      ...prev,
      [v.id]: {
        name: v.name,
        price: String(Number(v.price)),
        stock: String(v.stockQuantity),
        available: v.available,
      },
    }));
  }

  function cancelEditVariant(id: string) {
    setEditingVariant((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function saveVariant(id: string) {
    const d = editingVariant[id];
    if (!d) return;
    updateVariant.mutate(
      { id, name: d.name, price: Number(d.price), stockQuantity: Number(d.stock), available: d.available },
      { onSuccess: () => cancelEditVariant(id) }
    );
  }

  function handleDeleteVariant(id: string) {
    if (confirmDelete === id) {
      deleteVariant.mutate({ id });
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  // ── Product editing ──────────────────────────────────────────────────────────

  function startEditProduct(p: any) {
    setEditingProduct((prev) => ({
      ...prev,
      [p.id]: { name: p.name, description: p.description ?? "", active: p.active },
    }));
  }

  function cancelEditProduct(id: string) {
    setEditingProduct((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function saveProduct(id: string) {
    const d = editingProduct[id];
    if (!d) return;
    updateProduct.mutate(
      { id, name: d.name, description: d.description || undefined, active: d.active },
      { onSuccess: () => cancelEditProduct(id) }
    );
  }

  function handleDeleteProduct(id: string) {
    if (confirmDelete === id) {
      deleteProduct.mutate({ id });
      setConfirmDelete(null);
    } else {
      setConfirmDelete(id);
    }
  }

  // ── New variant ──────────────────────────────────────────────────────────────

  function submitNewVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!newVariantForm) return;
    createVariant.mutate(
      {
        productId: newVariantForm.productId,
        name: newVariantForm.name,
        price: Number(newVariantForm.price),
        stockQuantity: Number(newVariantForm.stock),
      },
      { onSuccess: () => setNewVariantForm(null) }
    );
  }

  // ── New product ──────────────────────────────────────────────────────────────

  function submitNewProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!newProductForm) return;
    createProduct.mutate(
      {
        artworkId: newProductForm.artworkId,
        productType: newProductForm.productType,
        name: newProductForm.name,
        description: newProductForm.description || undefined,
      },
      { onSuccess: () => setNewProductForm(null) }
    );
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Artworks &amp; Products</h1>

      {/* Artwork dropdown */}
      {artworkEntries.length > 0 && (
        <div className="mb-8">
          <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">
            Select artwork
          </label>
          <select
            value={selectedKey ?? ""}
            onChange={(e) => {
              setSelectedArtworkId(e.target.value);
              setNewVariantForm(null);
              setNewProductForm(null);
              setConfirmDelete(null);
            }}
            className="border rounded-lg px-4 py-2 text-sm bg-white shadow-sm focus:outline-none focus:ring-1 focus:ring-black"
          >
            {artworkEntries.map(([key, { artwork }]) => (
              <option key={key} value={key}>
                {artwork?.title ?? artwork?.slug ?? key.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      )}

      {artworkEntries.length === 0 && (
        <p className="text-gray-400 text-sm text-center py-12">No artworks or products yet.</p>
      )}

      {/* Products */}
      <div className="space-y-6">
        {selected?.products.map((p) => {
          const pe = editingProduct[p.id];
          return (
            <div key={p.id} className="bg-white border rounded-lg overflow-hidden">
              {/* Product header */}
              <div className="px-6 py-4 border-b bg-gray-50">
                {pe ? (
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0 space-y-2">
                      <input
                        className="border rounded px-2 py-1 text-sm w-full max-w-sm"
                        value={pe.name}
                        onChange={(e) =>
                          setEditingProduct((prev) => ({
                            ...prev,
                            [p.id]: { ...pe, name: e.target.value },
                          }))
                        }
                        placeholder="Product name"
                      />
                      <input
                        className="border rounded px-2 py-1 text-xs w-full max-w-sm text-gray-500"
                        value={pe.description}
                        onChange={(e) =>
                          setEditingProduct((prev) => ({
                            ...prev,
                            [p.id]: { ...pe, description: e.target.value },
                          }))
                        }
                        placeholder="Description (optional)"
                      />
                      <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={pe.active}
                          onChange={(e) =>
                            setEditingProduct((prev) => ({
                              ...prev,
                              [p.id]: { ...pe, active: e.target.checked },
                            }))
                          }
                        />
                        Active (visible on site)
                      </label>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <button
                        onClick={() => saveProduct(p.id)}
                        disabled={updateProduct.isPending}
                        className="text-xs bg-black text-white px-3 py-1 rounded disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => cancelEditProduct(p.id)}
                        className="text-xs border px-3 py-1 rounded"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{p.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}
                        {!p.active && (
                          <span className="ml-2 text-orange-500 font-medium">· hidden</span>
                        )}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">Shipping:</span>
                        <select
                          className="text-xs border rounded px-2 py-1"
                          value={p.shippingMethodId ?? ""}
                          onChange={async (e) => {
                            await updateShipping.mutateAsync({
                              productId: p.id,
                              shippingMethodId: e.target.value || null,
                            });
                          }}
                        >
                          <option value="">— use default —</option>
                          {(shippingMethodsList ?? []).map((sm) => (
                            <option key={sm.id} value={sm.id}>{sm.name} ({sm.type})</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => startEditProduct(p)}
                        className="text-xs border px-3 py-1 rounded hover:bg-gray-100"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        disabled={deleteProduct.isPending}
                        className={`text-xs px-3 py-1 rounded disabled:opacity-50 ${
                          confirmDelete === p.id
                            ? "bg-red-600 text-white"
                            : "border text-red-500 hover:bg-red-50"
                        }`}
                      >
                        {confirmDelete === p.id ? "Confirm delete" : "Delete"}
                      </button>
                      {confirmDelete === p.id && (
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="text-xs border px-3 py-1 rounded"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Variants table */}
              <div className="px-6 py-4">
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                      <th className="pb-2 pr-3">Variant</th>
                      <th className="pb-2 pr-3">Price</th>
                      <th className="pb-2 pr-3">Stock</th>
                      <th className="pb-2 pr-3">Available</th>
                      <th className="pb-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map((v: any) => {
                      const ve = editingVariant[v.id];
                      if (ve) {
                        return (
                          <tr key={v.id} className="border-b last:border-0 bg-blue-50">
                            <td className="py-2 pr-3">
                              <input
                                className="border rounded px-2 py-1 text-xs w-32"
                                value={ve.name}
                                onChange={(e) =>
                                  setEditingVariant((prev) => ({
                                    ...prev,
                                    [v.id]: { ...ve, name: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <div className="flex items-center gap-1">
                                <span className="text-xs text-gray-400">€</span>
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  className="border rounded px-2 py-1 text-xs w-20"
                                  value={ve.price}
                                  onChange={(e) =>
                                    setEditingVariant((prev) => ({
                                      ...prev,
                                      [v.id]: { ...ve, price: e.target.value },
                                    }))
                                  }
                                />
                              </div>
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="number"
                                min="0"
                                className="border rounded px-2 py-1 text-xs w-16"
                                value={ve.stock}
                                onChange={(e) =>
                                  setEditingVariant((prev) => ({
                                    ...prev,
                                    [v.id]: { ...ve, stock: e.target.value },
                                  }))
                                }
                              />
                            </td>
                            <td className="py-2 pr-3">
                              <input
                                type="checkbox"
                                checked={ve.available}
                                onChange={(e) =>
                                  setEditingVariant((prev) => ({
                                    ...prev,
                                    [v.id]: { ...ve, available: e.target.checked },
                                  }))
                                }
                                className="cursor-pointer"
                              />
                            </td>
                            <td className="py-2">
                              <div className="flex gap-1">
                                <button
                                  onClick={() => saveVariant(v.id)}
                                  disabled={updateVariant.isPending}
                                  className="text-xs bg-black text-white px-2 py-1 rounded disabled:opacity-50"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => cancelEditVariant(v.id)}
                                  className="text-xs border px-2 py-1 rounded"
                                >
                                  ✕
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={v.id} className="border-b last:border-0 hover:bg-gray-50 group">
                          <td className="py-2 pr-3">{v.name}</td>
                          <td className="py-2 pr-3">€{Number(v.price).toLocaleString()}</td>
                          <td className="py-2 pr-3">{v.stockQuantity}</td>
                          <td className="py-2 pr-3">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                v.available
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-500"
                              }`}
                            >
                              {v.available ? "yes" : "no"}
                            </span>
                          </td>
                          <td className="py-2">
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={() => startEditVariant(v)}
                                className="text-xs border px-2 py-1 rounded hover:bg-gray-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteVariant(v.id)}
                                disabled={deleteVariant.isPending}
                                className={`text-xs px-2 py-1 rounded disabled:opacity-50 ${
                                  confirmDelete === v.id
                                    ? "bg-red-600 text-white"
                                    : "border text-red-500 hover:bg-red-50"
                                }`}
                              >
                                {confirmDelete === v.id ? "Confirm" : "Delete"}
                              </button>
                              {confirmDelete === v.id && (
                                <button
                                  onClick={() => setConfirmDelete(null)}
                                  className="text-xs border px-2 py-1 rounded"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Add variant form */}
                {newVariantForm?.productId === p.id ? (
                  <form onSubmit={submitNewVariant} className="flex gap-2 items-end mt-2 flex-wrap">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        className="border px-2 py-1 rounded text-xs"
                        placeholder='e.g. "A3 print"'
                        value={newVariantForm.name}
                        onChange={(e) => setNewVariantForm({ ...newVariantForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price (€)</label>
                      <input
                        type="number"
                        min="1"
                        step="0.01"
                        className="border px-2 py-1 rounded text-xs w-24"
                        value={newVariantForm.price}
                        onChange={(e) => setNewVariantForm({ ...newVariantForm, price: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Stock</label>
                      <input
                        type="number"
                        min="0"
                        className="border px-2 py-1 rounded text-xs w-16"
                        value={newVariantForm.stock}
                        onChange={(e) => setNewVariantForm({ ...newVariantForm, stock: e.target.value })}
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={createVariant.isPending}
                      className="text-xs bg-black text-white px-3 py-1 rounded disabled:opacity-50"
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewVariantForm(null)}
                      className="text-xs border px-3 py-1 rounded"
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <button
                    onClick={() =>
                      setNewVariantForm({ productId: p.id, name: "", price: "150", stock: "1" })
                    }
                    className="text-xs text-gray-600 hover:underline"
                  >
                    + Add variant
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add product */}
      {selectedKey && selectedKey !== "none" && (
        <div className="mt-6">
          {newProductForm?.artworkId === selectedKey ? (
            <form
              onSubmit={submitNewProduct}
              className="bg-white border rounded-lg p-6 space-y-3"
            >
              <p className="text-sm font-medium text-gray-700 mb-3">New product</p>
              <div className="flex gap-3 flex-wrap">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Type</label>
                  <select
                    className="border px-2 py-1 rounded text-xs bg-white"
                    value={newProductForm.productType}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, productType: e.target.value })
                    }
                  >
                    <option value="print">Print</option>
                    <option value="original">Original</option>
                    <option value="tote">Tote</option>
                    <option value="sticker">Sticker</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Name</label>
                  <input
                    className="border px-2 py-1 rounded text-xs w-56"
                    placeholder='e.g. "Whispers — Giclée Print"'
                    value={newProductForm.name}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, name: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Description</label>
                  <input
                    className="border px-2 py-1 rounded text-xs w-56"
                    placeholder="Optional"
                    value={newProductForm.description}
                    onChange={(e) =>
                      setNewProductForm({ ...newProductForm, description: e.target.value })
                    }
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={createProduct.isPending}
                  className="text-xs bg-black text-white px-3 py-1.5 rounded disabled:opacity-50"
                >
                  Create product
                </button>
                <button
                  type="button"
                  onClick={() => setNewProductForm(null)}
                  className="text-xs border px-3 py-1.5 rounded"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() =>
                setNewProductForm({
                  artworkId: selectedKey,
                  productType: "print",
                  name: "",
                  description: "",
                })
              }
              className="text-sm border border-dashed border-gray-300 rounded-lg px-6 py-3 text-gray-500 hover:border-gray-400 hover:text-gray-700 w-full transition-colors"
            >
              + Add product to this artwork
            </button>
          )}
        </div>
      )}
    </div>
  );
}
