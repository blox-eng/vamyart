"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";

export default function OrdersPage() {
  const { data: orderList, refetch } = trpc.orders.list.useQuery();
  const markShipped = trpc.orders.markShipped.useMutation({ onSuccess: () => refetch() });
  const [trackingInputs, setTrackingInputs] = useState<Record<string, string>>({});

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Orders</h1>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Buyer</th>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Placed</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Tracking</th>
            </tr>
          </thead>
          <tbody>
            {orderList?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No orders yet.
                </td>
              </tr>
            )}
            {orderList?.map((o) => (
              <tr key={o.id} className="border-b last:border-0 hover:bg-gray-50 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{o.buyerName}</p>
                  <a
                    href={`mailto:${o.buyerEmail}?subject=Your vamy order`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {o.buyerEmail}
                  </a>
                  {o.shippingAddress && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                      {typeof o.shippingAddress === "string"
                        ? o.shippingAddress
                        : JSON.stringify(o.shippingAddress, null, 2)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {o.variantId ? (
                    <span className="font-mono text-xs">{o.variantId.slice(0, 8)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  €{(Number(o.totalAmount) / 100).toLocaleString()}
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      o.status === "shipped"
                        ? "bg-green-100 text-green-800"
                        : o.status === "paid"
                        ? "bg-blue-100 text-blue-800"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {o.status === "paid" && (
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        placeholder="Tracking #"
                        value={trackingInputs[o.id] ?? ""}
                        onChange={(e) =>
                          setTrackingInputs((prev) => ({ ...prev, [o.id]: e.target.value }))
                        }
                        className="border px-2 py-1 rounded text-xs w-28"
                      />
                      <button
                        onClick={() =>
                          markShipped.mutate({
                            id: o.id,
                            trackingNumber: trackingInputs[o.id],
                          })
                        }
                        disabled={markShipped.isPending}
                        className="text-xs bg-black text-white px-2 py-1 rounded disabled:opacity-50"
                      >
                        Ship
                      </button>
                    </div>
                  )}
                  {o.trackingNumber && (
                    <p className="text-xs text-gray-500 mt-1">{o.trackingNumber}</p>
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
