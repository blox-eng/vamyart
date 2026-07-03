// Client-side downscale for studio uploads. Camera/phone exports are often
// 4000+px / 10+ MB; the site never displays above 1600px, so we cap the long
// edge and re-encode before the signed direct-to-Storage upload. Netlify then
// never has to fetch + resize a giant source on a cold transform.

const DEFAULT_MAX_EDGE = 2560; // 1600px display + retina headroom
const DEFAULT_QUALITY = 0.85;

export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge: number
): { width: number; height: number; resized: boolean } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height, resized: false };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
    resized: true,
  };
}

// Browser-only. Returns a resized Blob, or the original File when no resize is
// needed / possible. Preserves the source MIME type so the result stays within
// the jpeg|png|webp allowlist enforced client- and server-side.
export async function resizeImageForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY
): Promise<Blob> {
  // Honor EXIF orientation: phone photos carry a rotation flag that canvas
  // re-encoding would otherwise drop, flipping the image sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height, resized } = computeTargetDimensions(
      bitmap.width,
      bitmap.height,
      maxEdge
    );
    if (!resized) return file;

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, quality)
    );
    return blob ?? file;
  } finally {
    bitmap.close();
  }
}
