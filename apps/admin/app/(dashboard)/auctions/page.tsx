"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow, format } from "date-fns";

export default function AuctionsPage() {
  const { data: auctionList, refetch } = trpc.auctions.list.useQuery();
  const { data: artworkList } = trpc.artworks.list.useQuery();
  const { data: productList } = trpc.products.listAll.useQuery();

  const closeAuction = trpc.auctions.close.useMutation({ onSuccess: () => refetch() });
  const openAuction = trpc.auctions.open.useMutation({
    onSuccess: () => { refetch(); setForm(null); },
  });

  const [form, setForm] = useState<{
    artworkId: string;
    productVariantId: string;
    minBid: string;
    minIncrement: string;
    deadline: string;
  } | null>(null);

  const [expandedAuction, setExpandedAuction] = useState<string | null>(null);
  const [confirmClose, setConfirmClose] = useState<string | null>(null);

  // Artworks that don't already have an active auction
  const activeArtworkIds = new Set(
    auctionList?.filter((a) => a.status === "active").map((a) => a.artworkId) ?? []
  );
  const availableArtworks = artworkList?.filter((a) => !activeArtworkIds.has(a.id)) ?? [];

  // Products grouped by artworkId for quick lookup
  const productsByArtwork = (productList ?? []).reduce<Record<string, any[]>>((acc, p) => {
    if (!p.artworkId) return acc;
    (acc[p.artworkId] ??= []).push(p);
    return acc;
  }, {});

  function handleOpen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    openAuction.mutate({
      artworkId: form.artworkId,
      productVariantId: form.productVariantId || undefined,
      minBid: Number(form.minBid),
      minIncrement: Number(form.minIncrement),
      deadline: new Date(form.deadline).toISOString(),
    });
  }

  function handleClose(id: string) {
    if (confirmClose === id) {
      closeAuction.mutate({ id });
      setConfirmClose(null);
    } else {
      setConfirmClose(id);
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-light">Auctions</h1>
        {!form && (
          <button
            onClick={() =>
              setForm({
                artworkId: availableArtworks[0]?.id ?? "",
                productVariantId: "",
                minBid: "500",
                minIncrement: "50",
                deadline: "",
              })
            }
            disabled={availableArtworks.length === 0}
            className="text-sm bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            New auction
          </button>
        )}
      </div>

      {/* New auction form */}
      {form && (
        <form onSubmit={handleOpen} className="bg-white border rounded-lg p-6 mb-8 space-y-4">
          <h2 className="font-medium text-sm">Open new auction</h2>

          {/* Artwork selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Artwork</label>
            <select
              className="w-full border px-3 py-2 rounded text-sm bg-white"
              value={form.artworkId}
              onChange={(e) => setForm({ ...form, artworkId: e.target.value, productVariantId: "" })}
              required
            >
              <option value="" disabled>Select an artwork…</option>
              {availableArtworks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                  {a.year ? ` (${a.year})` : ""}
                  {a.medium ? ` — ${a.medium}` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Variant selector — flattens all variants for the chosen artwork */}
          {form.artworkId && productsByArtwork[form.artworkId]?.length > 0 && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">
                Item being auctioned <span className="text-gray-400">(optional)</span>
              </label>
              <select
                className="w-full border px-3 py-2 rounded text-sm bg-white"
                value={form.productVariantId}
                onChange={(e) => setForm({ ...form, productVariantId: e.target.value })}
              >
                <option value="">— unspecified</option>
                {productsByArtwork[form.artworkId].map((p: any) =>
                  p.variants.map((v: any) => (
                    <option key={v.id} value={v.id}>
                      {p.name} — {v.name} (€{Number(v.price).toLocaleString()}, stock {v.stockQuantity})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min bid (€)</label>
              <input
                type="number"
                min="1"
                className="w-full border px-3 py-2 rounded text-sm"
                value={form.minBid}
                onChange={(e) => setForm({ ...form, minBid: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Min increment (€)</label>
              <input
                type="number"
                min="1"
                className="w-full border px-3 py-2 rounded text-sm"
                value={form.minIncrement}
                onChange={(e) => setForm({ ...form, minIncrement: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Deadline</label>
              <input
                type="datetime-local"
                className="w-full border px-3 py-2 rounded text-sm"
                value={form.deadline}
                onChange={(e) => setForm({ ...form, deadline: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setForm(null)}
              className="text-sm border px-4 py-2 rounded"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={openAuction.isPending || !form.artworkId}
              className="text-sm bg-black text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {openAuction.isPending ? "Opening…" : "Open auction"}
            </button>
          </div>
          {openAuction.error && (
            <p className="text-sm text-red-600">{openAuction.error.message}</p>
          )}
        </form>
      )}

      {/* Auction list */}
      <div className="space-y-3">
        {auctionList?.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-12">No auctions yet.</p>
        )}

        {auctionList?.map((a) => {
          const isExpanded = expandedAuction === a.id;
          const products = productsByArtwork[a.artworkId] ?? [];

          return (
            <div key={a.id} className="bg-white border rounded-lg overflow-hidden">
              {/* Auction row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Artwork name + status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-sm">
                      {a.artwork?.title ?? a.artworkId.slice(0, 8)}
                    </p>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-medium ${
                        a.status === "active"
                          ? "bg-green-100 text-green-800"
                          : a.status === "closed"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                  {a.artwork && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[a.artwork.medium, a.artwork.dimensions, a.artwork.year]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  )}
                  {a.productVariant && (
                    <p className="text-xs text-blue-600 mt-0.5">
                      {a.productVariant.name} · €{Number(a.productVariant.price).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Bid info */}
                <div className="text-right shrink-0">
                  <p className="text-sm font-medium">
                    {a.currentBid
                      ? `€${Number(a.currentBid).toLocaleString()}`
                      : `€${Number(a.minBid).toLocaleString()} min`}
                  </p>
                  <p className="text-xs text-gray-400">
                    {a.bidCount} bid{a.bidCount !== 1 ? "s" : ""}
                  </p>
                </div>

                {/* Deadline */}
                <div className="text-right shrink-0 w-32">
                  <p className="text-xs text-gray-600">
                    {formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                  </p>
                  <p className="text-xs text-gray-400">
                    {format(new Date(a.deadline), "d MMM yyyy HH:mm")}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpandedAuction(isExpanded ? null : a.id)}
                    className="text-xs border px-3 py-1 rounded hover:bg-gray-50"
                  >
                    {isExpanded ? "Hide" : "Details"}
                  </button>
                  {a.status === "active" && (
                    <>
                      <button
                        onClick={() => handleClose(a.id)}
                        disabled={closeAuction.isPending}
                        className={`text-xs px-3 py-1 rounded disabled:opacity-50 ${
                          confirmClose === a.id
                            ? "bg-red-600 text-white"
                            : "border text-red-500 hover:bg-red-50"
                        }`}
                      >
                        {confirmClose === a.id ? "Confirm close" : "Close"}
                      </button>
                      {confirmClose === a.id && (
                        <button
                          onClick={() => setConfirmClose(null)}
                          className="text-xs border px-2 py-1 rounded"
                        >
                          Cancel
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* Expanded: bids + products */}
              {isExpanded && (
                <div className="border-t px-5 py-4 space-y-5 bg-gray-50">
                  {/* Related products */}
                  {products.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                        Products
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {products.map((p: any) => (
                          <div
                            key={p.id}
                            className="bg-white border rounded px-3 py-2 text-xs flex items-center gap-2"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                p.active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-500"
                              }`}
                            >
                              {p.productType}
                            </span>
                            <span>{p.name}</span>
                            <span className="text-gray-400">
                              {p.variants.length}v
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bids */}
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                      Bids ({a.bids?.length ?? 0})
                    </p>
                    {(a.bids?.length ?? 0) === 0 ? (
                      <p className="text-xs text-gray-400">No bids yet.</p>
                    ) : (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="text-left text-gray-400 border-b">
                            <th className="pb-1 pr-4 font-normal">Bidder</th>
                            <th className="pb-1 pr-4 font-normal">Amount</th>
                            <th className="pb-1 font-normal">Placed</th>
                          </tr>
                        </thead>
                        <tbody>
                          {a.bids?.map((b: any, i: number) => (
                            <tr key={b.id} className="border-b last:border-0">
                              <td className="py-1.5 pr-4">
                                <span className="font-medium">{b.bidderName}</span>
                                <a
                                  href={`mailto:${b.bidderEmail}`}
                                  className="ml-2 text-blue-500 hover:underline"
                                >
                                  {b.bidderEmail}
                                </a>
                                {i === 0 && (
                                  <span className="ml-2 text-green-600 font-medium">
                                    · leading
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 pr-4 font-medium">
                                €{Number(b.amount).toLocaleString()}
                              </td>
                              <td className="py-1.5 text-gray-400">
                                {formatDistanceToNow(new Date(b.createdAt), { addSuffix: true })}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
