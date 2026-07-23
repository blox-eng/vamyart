import type { CertificateSnapshot } from "@vamy/db";

export function certificateImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/artwork-images/${imagePath}`;
}

// How the PDF ultimately reached the user — lets callers tailor their toast.
// "downloaded": saved directly (desktop). "shared": native share sheet (iOS).
// "opened": opened in a new tab for the user to save manually (iOS fallback).
export type PdfDelivery = "downloaded" | "shared" | "opened";

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iP(hone|ad|od)/.test(navigator.userAgent) ||
    // iPadOS 13+ masquerades as macOS but is a touch device.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export async function downloadCertificatePdf(
  snapshot: CertificateSnapshot,
  imageUrl: string | null,
  fileName: string,
): Promise<PdfDelivery> {
  const { pdf } = await import("@react-pdf/renderer");
  const { CertificateDoc } = await import("../../components/certificate/CertificatePdf");
  const blob = await pdf(CertificateDoc({ snapshot, imageUrl })).toBlob();

  // iOS Safari ignores the <a download> attribute and would navigate the current
  // tab to the blob (destroying the studio SPA). Prefer the native share sheet
  // there — it gives "Save to Files" / AirDrop / Messages.
  const file = new File([blob], fileName, { type: "application/pdf" });
  const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
  if (typeof nav.canShare === "function" && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      // User dismissed the sheet — done, don't fall through to a second prompt.
      if ((e as DOMException)?.name === "AbortError") return "shared";
      // Any other failure: fall through to the link fallback below.
    }
  }

  const url = URL.createObjectURL(blob);
  const canDownload = "download" in HTMLAnchorElement.prototype && !isIOS();
  const a = document.createElement("a");
  a.href = url;
  if (canDownload) {
    a.download = fileName;
  } else {
    a.target = "_blank";
    a.rel = "noopener";
  }
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke late: revoking synchronously can cancel the download / new-tab load
  // before the browser has read the blob.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return canDownload ? "downloaded" : "opened";
}
