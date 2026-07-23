import type { CertificateSnapshot } from "@vamy/db";

export function certificateImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/artwork-images/${imagePath}`;
}

export async function downloadCertificatePdf(
  snapshot: CertificateSnapshot,
  imageUrl: string | null,
  fileName: string,
): Promise<void> {
  const { pdf } = await import("@react-pdf/renderer");
  const { CertificateDoc } = await import("../../components/certificate/CertificatePdf");
  const blob = await pdf(CertificateDoc({ snapshot, imageUrl })).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
