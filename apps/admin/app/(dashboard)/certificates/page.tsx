"use client";

import React from "react";
import Link from "next/link";
import { trpc } from "../../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { SkeletonTable } from "@/components/ui/skeleton";
import { downloadCertificatePdf, certificateImageUrl } from "../../../lib/certificate/render";
import type { CertificateSnapshot } from "@vamy/db";

export default function CertificatesPage() {
  const toast = useToast();
  const { data, isLoading } = trpc.certificates.list.useQuery();

  async function reDownload(row: NonNullable<typeof data>[number]) {
    try {
      const delivery = await downloadCertificatePdf(
        row.fieldsSnapshot as CertificateSnapshot,
        certificateImageUrl(row.imagePath),
        `${row.certNumber}.pdf`,
      );
      if (delivery === "opened") {
        toast(`${row.certNumber} opened in a new tab — tap Share to save it`, "success");
      }
    } catch (e) {
      toast((e as Error).message || "Could not rebuild PDF", "error");
    }
  }

  if (isLoading) return <SkeletonTable rows={6} cols={7} />;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-light tracking-wide">Certificates</h1>
        <Link href="/certificates/settings" className="text-sm underline">Template settings</Link>
      </div>

      {!data?.length ? (
        <p className="text-sm text-gray-500">No certificates issued yet. Issue one from a piece on the Pieces page.</p>
      ) : (
        <>
          {/* Desktop: table */}
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2">Number</th>
                  <th>Piece</th>
                  <th>Kind</th>
                  <th>Edition</th>
                  <th>Collector</th>
                  <th>Issued</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => {
                  const snap = row.fieldsSnapshot as CertificateSnapshot;
                  return (
                    <tr key={row.id} className="border-b">
                      <td className="py-2 font-medium">{row.certNumber}</td>
                      <td>{snap.title}</td>
                      <td>{row.kind}</td>
                      <td>{snap.editionLabel ?? "—"}</td>
                      <td>{row.buyerName ?? "—"}</td>
                      <td>{snap.issuedDateText}</td>
                      <td className="text-right">
                        <button className="underline" onClick={() => reDownload(row)}>Re-download</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: cards */}
          <div className="space-y-3 lg:hidden">
            {data.map((row) => {
              const snap = row.fieldsSnapshot as CertificateSnapshot;
              return (
                <div key={row.id} className="rounded-lg border p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{row.certNumber}</span>
                    <span className="text-xs text-gray-500">{snap.issuedDateText}</span>
                  </div>
                  <p className="mt-1 text-sm">{snap.title}</p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {row.kind}
                    {snap.editionLabel ? ` · ${snap.editionLabel}` : ""}
                    {row.buyerName ? ` · ${row.buyerName}` : ""}
                  </p>
                  <button
                    className="mt-3 w-full rounded border py-3 text-sm"
                    onClick={() => reDownload(row)}
                  >
                    Re-download
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
