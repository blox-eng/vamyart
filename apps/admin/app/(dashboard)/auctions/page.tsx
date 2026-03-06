"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";

export default function AuctionsPage() {
  const { data: auctionList, refetch } = trpc.auctions.list.useQuery();
  const closeAuction = trpc.auctions.close.useMutation({ onSuccess: () => refetch() });
  const openAuction = trpc.auctions.open.useMutation({ onSuccess: () => { refetch(); setForm(null); } });

  const [form, setForm] = useState<{
    artworkId: string;
    minBid: string;
    minIncrement: string;
    deadline: string;
  } | null>(null);

  function handleOpen(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form) return;
    openAuction.mutate({
      artworkId: form.artworkId,
      minBid: Number(form.minBid),
      minIncrement: Number(form.minIncrement),
      deadline: new Date(form.deadline).toISOString(),
    });
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-light">Auctions</h1>
        {!form && (
          <button
            onClick={() =>
              setForm({ artworkId: "", minBid: "500", minIncrement: "50", deadline: "" })
            }
            className="text-sm bg-black text-white px-4 py-2 rounded hover:bg-gray-800 transition-colors"
          >
            New auction
          </button>
        )}
      </div>

      {form && (
        <form
          onSubmit={handleOpen}
          className="bg-white border rounded-lg p-6 mb-8 space-y-4"
        >
          <h2 className="font-medium text-sm">Open new auction</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Artwork ID (UUID)</label>
              <input
                className="w-full border px-3 py-2 rounded text-sm font-mono"
                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                value={form.artworkId}
                onChange={(e) => setForm({ ...form, artworkId: e.target.value })}
                required
                pattern="[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"
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
              disabled={openAuction.isPending}
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

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Artwork</th>
              <th className="px-4 py-3">Current bid</th>
              <th className="px-4 py-3">Bids</th>
              <th className="px-4 py-3">Deadline</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {auctionList?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No auctions yet.
                </td>
              </tr>
            )}
            {auctionList?.map((a) => (
              <tr key={a.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {a.artwork?.slug ?? a.artworkId.slice(0, 8)}
                </td>
                <td className="px-4 py-3">
                  {a.currentBid
                    ? `€${Number(a.currentBid).toLocaleString()}`
                    : `€${Number(a.minBid).toLocaleString()} min`}
                </td>
                <td className="px-4 py-3">{a.bidCount}</td>
                <td className="px-4 py-3 text-gray-600">
                  {formatDistanceToNow(new Date(a.deadline), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      a.status === "active"
                        ? "bg-green-100 text-green-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {a.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {a.status === "active" && (
                    <button
                      onClick={() => closeAuction.mutate({ id: a.id })}
                      disabled={closeAuction.isPending}
                      className="text-xs text-red-600 hover:underline disabled:opacity-50"
                    >
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
