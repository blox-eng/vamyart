"use client";

import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";

export default function InquiriesPage() {
  const { data: inquiryList, refetch } = trpc.inquiries.list.useQuery();
  const markHandled = trpc.inquiries.markHandled.useMutation({ onSuccess: () => refetch() });

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Inquiries</h1>

      <div className="bg-white border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Piece</th>
              <th className="px-4 py-3">Message</th>
              <th className="px-4 py-3">Received</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody>
            {inquiryList?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                  No inquiries yet.
                </td>
              </tr>
            )}
            {inquiryList?.map((inq) => (
              <tr key={inq.id} className="border-b last:border-0 hover:bg-gray-50 align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{inq.name}</p>
                  <a
                    href={`mailto:${inq.email}?subject=Re: ${inq.pieceInterest}&body=Hi ${inq.name},%0A%0A`}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    {inq.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-gray-600">{inq.pieceInterest}</td>
                <td className="px-4 py-3 text-gray-500 max-w-xs">
                  <p className="line-clamp-2">{inq.message ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(inq.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      inq.handled
                        ? "bg-gray-100 text-gray-500"
                        : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {inq.handled ? "handled" : "open"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!inq.handled && (
                    <button
                      onClick={() => markHandled.mutate({ id: inq.id })}
                      disabled={markHandled.isPending}
                      className="text-xs text-gray-600 hover:underline disabled:opacity-50"
                    >
                      Mark handled
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
