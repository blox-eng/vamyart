"use client";

import { trpc } from "../../../lib/trpc";
import { formatDistanceToNow } from "date-fns";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";

export default function InquiriesPage() {
  const toast = useToast();
  const { data: inquiryList, refetch, isLoading: inquiriesLoading } = trpc.inquiries.list.useQuery();
  const markHandled = trpc.inquiries.markHandled.useMutation({
    onSuccess: () => { refetch(); toast("inquiry marked handled", "success"); },
    onError: () => toast("failed to update inquiry", "error"),
  });

  return (
    <div className="p-4 sm:p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-light mb-8">Messages</h1>

      {inquiriesLoading ? (
        <SkeletonTable rows={5} cols={5} />
      ) : (
      <>
      <div className="hidden lg:block bg-field border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-paper text-left text-xs uppercase tracking-wide text-muted">
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
                <td colSpan={6} className="px-4 py-8 text-center text-faint text-sm">
                  No inquiries yet.
                </td>
              </tr>
            )}
            {inquiryList?.map((inq) => (
              <tr key={inq.id} className="border-b last:border-0 hover:bg-hover align-top">
                <td className="px-4 py-3">
                  <p className="font-medium">{inq.name}</p>
                  <a
                    href={`mailto:${inq.email}?subject=Re: ${inq.pieceInterest}&body=Hi ${inq.name},%0A%0A`}
                    className="text-xs text-accent hover:underline"
                  >
                    {inq.email}
                  </a>
                </td>
                <td className="px-4 py-3 text-muted">{inq.pieceInterest}</td>
                <td className="px-4 py-3 text-muted max-w-xs">
                  <p className="line-clamp-2">{inq.message ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                  {formatDistanceToNow(new Date(inq.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-1 rounded text-xs font-medium ${
                      inq.handledAt
                        ? "bg-wall text-muted"
                        : "bg-warn/10 text-warn"
                    }`}
                  >
                    {inq.handledAt ? "handled" : "open"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {!inq.handledAt && (
                    <button
                      onClick={() => markHandled.mutate({ id: inq.id })}
                      disabled={markHandled.isPending}
                      className="text-xs text-muted hover:underline disabled:opacity-50"
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

      {/* Mobile cards */}
      <div className="lg:hidden space-y-3">
        {inquiryList?.length === 0 && (
          <p className="text-center text-faint text-sm py-8">No inquiries yet.</p>
        )}
        {inquiryList?.map((inq) => (
          <div key={inq.id} className="bg-field border rounded-lg p-4 space-y-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{inq.name}</p>
                <a
                  href={`mailto:${inq.email}?subject=Re: ${inq.pieceInterest}&body=Hi ${inq.name},%0A%0A`}
                  className="text-xs text-accent hover:underline break-all"
                >
                  {inq.email}
                </a>
              </div>
              <span
                className={`shrink-0 px-2 py-1 rounded text-xs font-medium ${
                  inq.handledAt ? "bg-wall text-muted" : "bg-warn/10 text-warn"
                }`}
              >
                {inq.handledAt ? "handled" : "open"}
              </span>
            </div>
            <p className="text-xs text-muted">Piece: <span className="text-ink">{inq.pieceInterest}</span></p>
            <p className="text-muted">{inq.message ?? "—"}</p>
            <p className="text-xs text-faint">
              {formatDistanceToNow(new Date(inq.createdAt), { addSuffix: true })}
            </p>
            {!inq.handledAt && (
              <button
                onClick={() => markHandled.mutate({ id: inq.id })}
                disabled={markHandled.isPending}
                className="text-xs border px-3 py-2 rounded text-ink hover:bg-hover disabled:opacity-50"
              >
                Mark handled
              </button>
            )}
          </div>
        ))}
      </div>
      </>
      )}
    </div>
  );
}
