"use client";

import React, { useEffect, useMemo, useState } from "react";
import { trpc } from "../../lib/trpc";
import { useToast } from "@/components/ui/toast";
import { downloadCertificatePdf, certificateImageUrl } from "../../lib/certificate/render";
import type { CertificateSnapshot } from "@vamy/db";

type Props = {
  open: boolean;
  onClose: () => void;
  artwork: { id: string; title: string; year: number | null; medium: string | null; dimensions: string | null };
  images: Array<{ storagePath: string; isPrimary: boolean }>;
  print?: { productVariantId: string; defaultEditionSize?: number };
};

export function IssueCertificateDialog({ open, onClose, artwork, images, print }: Props) {
  const toast = useToast();
  const isPrint = !!print;

  const [title, setTitle] = useState(artwork.title);
  const [year, setYear] = useState(artwork.year != null ? String(artwork.year) : "");
  const [medium, setMedium] = useState(artwork.medium ?? "");
  const [dimensions, setDimensions] = useState(artwork.dimensions ?? "");
  const [buyerName, setBuyerName] = useState("");
  const [statementOverride, setStatementOverride] = useState("");
  const [editionNumber, setEditionNumber] = useState("");
  const [editionSize, setEditionSize] = useState(print?.defaultEditionSize ? String(print.defaultEditionSize) : "");
  const primary = images.find((i) => i.isPrimary) ?? images[0];
  const [imagePath, setImagePath] = useState<string | undefined>(primary?.storagePath);

  const editions = trpc.certificates.editionsFor.useQuery(
    { productVariantId: print?.productVariantId ?? "" },
    { enabled: isPrint && open },
  );
  const taken = editions.data?.taken ?? [];
  const nextFree = useMemo(() => {
    const size = Number(editionSize) || 0;
    for (let i = 1; i <= size; i++) if (!taken.includes(i)) return i;
    return null;
  }, [taken, editionSize]);

  const issue = trpc.certificates.issue.useMutation();

  // Lock the page behind the modal so touch-scrolling doesn't bleed to the list underneath (iOS).
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  async function handleGenerate() {
    try {
      const row = await issue.mutateAsync({
        artworkId: artwork.id,
        kind: isPrint ? "print" : "original",
        productVariantId: print?.productVariantId,
        editionNumber: isPrint ? Number(editionNumber) : undefined,
        editionSize: isPrint ? Number(editionSize) : undefined,
        buyerName: buyerName.trim() || undefined,
        imagePath,
        title: title.trim(),
        year: year.trim() ? Number(year) : null,
        medium: medium.trim() || null,
        dimensions: dimensions.trim() || null,
        statementOverride: statementOverride.trim() || undefined,
      });
      const snapshot = row.fieldsSnapshot as CertificateSnapshot;
      const delivery = await downloadCertificatePdf(
        snapshot,
        certificateImageUrl(row.imagePath),
        `${row.certNumber}.pdf`,
      );
      toast(
        delivery === "opened"
          ? `Certificate ${row.certNumber} issued — opened in a new tab, tap Share to save it`
          : `Certificate ${row.certNumber} issued`,
        "success",
      );
      onClose();
    } catch (e) {
      toast((e as Error).message || "Could not issue certificate", "error");
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white sm:max-w-lg sm:rounded-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-1 space-y-4 overflow-y-auto p-6">
        <h2 className="text-lg font-light tracking-wide">
          {isPrint ? "Issue edition certificate" : "Issue certificate"}
        </h2>

        <label className="block text-sm">Title
          <input className="mt-1 w-full border rounded px-2 py-1" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">Year
            <input className="mt-1 w-full border rounded px-2 py-1" value={year} onChange={(e) => setYear(e.target.value)} />
          </label>
          <label className="block text-sm">Dimensions
            <input className="mt-1 w-full border rounded px-2 py-1" value={dimensions} onChange={(e) => setDimensions(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">Medium
          <input className="mt-1 w-full border rounded px-2 py-1" value={medium} onChange={(e) => setMedium(e.target.value)} />
        </label>

        {isPrint && (
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-sm">Edition size
              <input className="mt-1 w-full border rounded px-2 py-1" value={editionSize} onChange={(e) => setEditionSize(e.target.value)} placeholder="25" />
            </label>
            <label className="block text-sm">This print is #
              <input className="mt-1 w-full border rounded px-2 py-1" value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)} placeholder={nextFree ? String(nextFree) : ""} />
            </label>
            <p className="col-span-2 text-xs text-gray-500">
              Already issued: {taken.length ? taken.join(", ") : "none"}. {nextFree ? `Next free: ${nextFree}.` : ""}
            </p>
          </div>
        )}

        <label className="block text-sm">Collector name (optional)
          <input className="mt-1 w-full border rounded px-2 py-1" value={buyerName} onChange={(e) => setBuyerName(e.target.value)} />
        </label>

        {images.length > 1 && (
          <div className="text-sm">
            <span className="block mb-1">Photo</span>
            <div className="flex gap-2 flex-wrap">
              {images.map((img) => (
                <button
                  key={img.storagePath}
                  type="button"
                  onClick={() => setImagePath(img.storagePath)}
                  className={`h-16 w-16 rounded overflow-hidden border-2 ${imagePath === img.storagePath ? "border-black" : "border-transparent"}`}
                >
                  <img src={certificateImageUrl(img.storagePath) ?? ""} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="block text-sm">Statement override (optional)
          <textarea className="mt-1 w-full border rounded px-2 py-1" rows={3} value={statementOverride} onChange={(e) => setStatementOverride(e.target.value)} placeholder="Leave blank to use your saved wording." />
        </label>
        </div>

        <div className="flex justify-end gap-2 border-t bg-white px-6 py-4">
          <button className="rounded px-4 py-3 text-sm" onClick={onClose} disabled={issue.isPending}>Cancel</button>
          <button
            className="rounded bg-black px-5 py-3 text-sm text-white disabled:opacity-50"
            onClick={handleGenerate}
            disabled={issue.isPending || !title.trim() || (isPrint && (!editionNumber || !editionSize))}
          >
            {issue.isPending ? "Generating…" : "Generate PDF"}
          </button>
        </div>
      </div>
    </div>
  );
}
