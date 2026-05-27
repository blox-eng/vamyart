"use client";

import { useState } from "react";
import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

type ShipDraft = { carrier: "DHL" | "GLS" | "UPS" | "Econt" | "Other"; trackingNumber: string; note: string };

// Render a shipping address as readable lines. Returns null for empty/absent
// addresses (e.g. the `{}` guest checkout default) so nothing is shown.
function formatAddress(addr: unknown): string | null {
  if (!addr) return null;
  if (typeof addr === "string") return addr.trim() || null;
  if (typeof addr !== "object") return null;
  const a = addr as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : v != null ? String(v) : "");
  const lines = [
    str(a.name),
    str(a.line1),
    str(a.line2),
    [str(a.postalCode ?? a.zip), str(a.city)].filter(Boolean).join(" "),
    str(a.state),
    str(a.country),
  ].filter(Boolean);
  return lines.length ? lines.join("\n") : null;
}

export default function OrdersPage() {
  const toast = useToast();
  const { data: orderList, refetch, isLoading: ordersLoading } = trpc.orders.list.useQuery();
  const markShipped = trpc.orders.markShipped.useMutation({
    onSuccess: () => { refetch(); toast("tracking email sent", "success"); },
    onError: (e) => toast(e.message || "failed to send tracking", "error"),
  });
  const [drafts, setDrafts] = useState<Record<string, ShipDraft>>({});

  function getDraft(orderId: string): ShipDraft {
    return drafts[orderId] ?? { carrier: "DHL", trackingNumber: "", note: "" };
  }
  function setDraft(orderId: string, patch: Partial<ShipDraft>) {
    setDrafts((prev) => ({ ...prev, [orderId]: { ...getDraft(orderId), ...patch } }));
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Sales</h1>

      {ordersLoading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
      <>
      <div className="hidden lg:block bg-white border rounded-lg overflow-hidden">
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
                  {formatAddress(o.shippingAddress) && (
                    <p className="text-xs text-gray-500 mt-1 whitespace-pre-line">
                      {formatAddress(o.shippingAddress)}
                    </p>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  <p>{o.productVariant?.name ?? "—"}</p>
                  {o.productVariant?.product?.name && (
                    <p className="text-xs text-gray-400">{o.productVariant.product.name}</p>
                  )}
                </td>
                <td className="px-4 py-3">
                  €{Number(o.amountPaid).toLocaleString()}
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
                    <div className="flex flex-col gap-2 max-w-xs">
                      <div className="flex gap-2 items-center">
                        <select
                          value={getDraft(o.id).carrier}
                          onChange={(e) => setDraft(o.id, { carrier: e.target.value as ShipDraft["carrier"] })}
                          className="border px-2 py-1 rounded text-xs bg-white"
                        >
                          <option value="DHL">DHL</option>
                          <option value="GLS">GLS</option>
                          <option value="UPS">UPS</option>
                          <option value="Econt">Econt</option>
                          <option value="Other">Other</option>
                        </select>
                        <input
                          type="text"
                          placeholder="Tracking #"
                          value={getDraft(o.id).trackingNumber}
                          onChange={(e) => setDraft(o.id, { trackingNumber: e.target.value })}
                          className="border px-2 py-1 rounded text-xs flex-1 min-w-0"
                        />
                      </div>
                      <textarea
                        placeholder="Optional note to buyer"
                        value={getDraft(o.id).note}
                        onChange={(e) => setDraft(o.id, { note: e.target.value })}
                        rows={2}
                        className="border px-2 py-1 rounded text-xs resize-none"
                      />
                      <button
                        onClick={() => {
                          const d = getDraft(o.id);
                          if (!d.trackingNumber) return;
                          markShipped.mutate({
                            id: o.id,
                            carrier: d.carrier,
                            trackingNumber: d.trackingNumber,
                            note: d.note || undefined,
                          });
                        }}
                        disabled={markShipped.isPending || !getDraft(o.id).trackingNumber}
                        className="text-xs bg-black text-white px-3 py-1.5 rounded disabled:opacity-50"
                      >
                        {markShipped.isPending ? "Sending…" : "Mark shipped & send tracking"}
                      </button>
                    </div>
                  )}
                  {o.status === "shipped" && o.trackingNumber && (
                    <div className="flex flex-col">
                      <p className="text-xs text-gray-500">
                        {o.trackingCarrier ? `${o.trackingCarrier} · ` : ""}
                        {o.trackingNumber}
                      </p>
                      <span className="text-xs text-gray-400 mt-0.5">Tracking sent ✓</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {orderList?.length === 0 && (
          <p className="text-center text-gray-400 text-sm py-8">No orders yet.</p>
        )}
        {orderList?.map((o) => (
          <div key={o.id} className="bg-white border rounded-lg p-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{o.buyerName}</p>
                <a
                  href={`mailto:${o.buyerEmail}?subject=Your vamy order`}
                  className="text-xs text-blue-600 hover:underline break-all"
                >
                  {o.buyerEmail}
                </a>
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
                  o.status === "shipped"
                    ? "bg-green-100 text-green-800"
                    : o.status === "paid"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {o.status}
              </span>
            </div>
            {formatAddress(o.shippingAddress) && (
              <p className="text-xs text-gray-500 whitespace-pre-line">
                {formatAddress(o.shippingAddress)}
              </p>
            )}
            <div className="flex justify-between text-gray-600">
              <span>{o.productVariant?.name ?? "—"}</span>
              <span className="font-medium text-gray-900">€{Number(o.amountPaid).toLocaleString()}</span>
            </div>
            {o.productVariant?.product?.name && (
              <p className="text-xs text-gray-400 -mt-2">{o.productVariant.product.name}</p>
            )}
            <p className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(o.createdAt), { addSuffix: true })}
            </p>
            <ShipForm
              order={o}
              draft={getDraft(o.id)}
              onPatch={(patch) => setDraft(o.id, patch)}
              onSubmit={() => {
                const d = getDraft(o.id);
                if (!d.trackingNumber) return;
                markShipped.mutate({
                  id: o.id,
                  carrier: d.carrier,
                  trackingNumber: d.trackingNumber,
                  note: d.note || undefined,
                });
              }}
              pending={markShipped.isPending}
            />
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}

function ShipForm({
  order,
  draft,
  onPatch,
  onSubmit,
  pending,
}: {
  order: any;
  draft: ShipDraft;
  onPatch: (patch: Partial<ShipDraft>) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  if (order.status === "shipped" && order.trackingNumber) {
    return (
      <div className="flex flex-col">
        <p className="text-xs text-gray-500">
          {order.trackingCarrier ? `${order.trackingCarrier} · ` : ""}
          {order.trackingNumber}
        </p>
        <span className="text-xs text-gray-400 mt-0.5">Tracking sent ✓</span>
      </div>
    );
  }
  if (order.status !== "paid") return null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2 items-center">
        <select
          value={draft.carrier}
          onChange={(e) => onPatch({ carrier: e.target.value as ShipDraft["carrier"] })}
          className="border px-2 py-1.5 rounded text-xs bg-white"
        >
          <option value="DHL">DHL</option>
          <option value="GLS">GLS</option>
          <option value="UPS">UPS</option>
          <option value="Econt">Econt</option>
          <option value="Other">Other</option>
        </select>
        <input
          type="text"
          placeholder="Tracking #"
          value={draft.trackingNumber}
          onChange={(e) => onPatch({ trackingNumber: e.target.value })}
          className="border px-2 py-1.5 rounded text-xs flex-1 min-w-0"
        />
      </div>
      <textarea
        placeholder="Optional note to buyer"
        value={draft.note}
        onChange={(e) => onPatch({ note: e.target.value })}
        rows={2}
        className="border px-2 py-1.5 rounded text-xs resize-none"
      />
      <button
        onClick={onSubmit}
        disabled={pending || !draft.trackingNumber}
        className="text-xs bg-black text-white px-3 py-2 rounded disabled:opacity-50"
      >
        {pending ? "Sending…" : "Mark shipped & send tracking"}
      </button>
    </div>
  );
}
