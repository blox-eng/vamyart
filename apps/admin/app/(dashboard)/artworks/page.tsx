"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";

export default function ArtworksPage() {
  const { data: productList, refetch } = trpc.products.listAll.useQuery();
  const createVariant = trpc.products.createVariant.useMutation({ onSuccess: () => refetch() });
  const updateStock = trpc.products.updateVariantStock.useMutation({ onSuccess: () => refetch() });

  const [expandedProduct, setExpandedProduct] = useState<string | null>(null);
  const [newVariantForm, setNewVariantForm] = useState<{
    productId: string;
    name: string;
    price: string;
    stock: string;
  } | null>(null);

  function handleAddVariant(e: React.FormEvent) {
    e.preventDefault();
    if (!newVariantForm) return;
    createVariant.mutate({
      productId: newVariantForm.productId,
      name: newVariantForm.name,
      price: Number(newVariantForm.price),
      stockQuantity: Number(newVariantForm.stock),
    });
    setNewVariantForm(null);
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Artworks &amp; Products</h1>

      <div className="space-y-4">
        {productList?.length === 0 && (
          <p className="text-gray-400 text-sm text-center py-8">No products yet.</p>
        )}
        {productList?.map((p) => (
          <div key={p.id} className="bg-white border rounded-lg overflow-hidden">
            <button
              onClick={() =>
                setExpandedProduct(expandedProduct === p.id ? null : p.id)
              }
              className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50 transition-colors"
            >
              <div>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {p.artwork?.slug ?? p.artworkId?.slice(0, 8)} · {p.variants.length} variant
                  {p.variants.length !== 1 ? "s" : ""}
                </p>
              </div>
              <span className="text-gray-400 text-sm">
                {expandedProduct === p.id ? "▲" : "▼"}
              </span>
            </button>

            {expandedProduct === p.id && (
              <div className="border-t px-6 py-4">
                <table className="w-full text-sm mb-4">
                  <thead>
                    <tr className="text-left text-xs text-gray-500 uppercase tracking-wide border-b">
                      <th className="pb-2 pr-4">Variant</th>
                      <th className="pb-2 pr-4">Price</th>
                      <th className="pb-2 pr-4">Stock</th>
                      <th className="pb-2">Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.variants.map((v) => (
                      <tr key={v.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{v.name}</td>
                        <td className="py-2 pr-4">€{Number(v.price).toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <input
                            type="number"
                            min="0"
                            defaultValue={v.stockQuantity}
                            className="border px-2 py-1 rounded text-xs w-16"
                            onBlur={(e) => {
                              const qty = Number(e.target.value);
                              if (qty !== v.stockQuantity) {
                                updateStock.mutate({ id: v.id, stockQuantity: qty });
                              }
                            }}
                          />
                        </td>
                        <td className="py-2">
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
                      </tr>
                    ))}
                  </tbody>
                </table>

                {newVariantForm?.productId === p.id ? (
                  <form onSubmit={handleAddVariant} className="flex gap-2 items-end mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Name</label>
                      <input
                        className="border px-2 py-1 rounded text-xs"
                        placeholder='e.g. "A3 print"'
                        value={newVariantForm.name}
                        onChange={(e) =>
                          setNewVariantForm({ ...newVariantForm, name: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Price (€)</label>
                      <input
                        type="number"
                        min="1"
                        className="border px-2 py-1 rounded text-xs w-20"
                        value={newVariantForm.price}
                        onChange={(e) =>
                          setNewVariantForm({ ...newVariantForm, price: e.target.value })
                        }
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
                        onChange={(e) =>
                          setNewVariantForm({ ...newVariantForm, stock: e.target.value })
                        }
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="text-xs bg-black text-white px-3 py-1 rounded"
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
                      setNewVariantForm({
                        productId: p.id,
                        name: "",
                        price: "150",
                        stock: "1",
                      })
                    }
                    className="text-xs text-gray-600 hover:underline"
                  >
                    + Add variant
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
