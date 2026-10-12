// Client-side prep for studio uploads. Camera/phone exports are often
// 4000+px / 10+ MB; the site never displays above 1600px, so we cap the long
// edge and re-encode before the signed direct-to-Storage upload. Netlify then
// never has to fetch + resize a giant source on a cold transform.
// Photos of a canvas shot on white are also trimmed to the painting (white
// margin and drop shadow dropped) so it sits edge to edge on the site.

import { findContentBox, scaleContentBox, type ContentBox } from "@vamy/db/content-box";

const DEFAULT_MAX_EDGE = 2560; // 1600px display + retina headroom
const DEFAULT_QUALITY = 0.85;
const DETECT_EDGE = 800;

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

// Source rectangle to draw and the output size, or null when the original file
// can be uploaded as is (no trim, already within the cap).
export function planOutput(
  width: number,
  height: number,
  crop: ContentBox | null,
  maxEdge: number
): { source: ContentBox; width: number; height: number } | null {
  const source = crop ?? { left: 0, top: 0, width, height };
  const target = computeTargetDimensions(source.width, source.height, maxEdge);
  if (!crop && !target.resized) return null;
  return { source, width: target.width, height: target.height };
}

export function toGrayscale(rgba: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const p = i * 4;
    gray[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
  }
  return gray;
}

function detectCrop(bitmap: ImageBitmap): ContentBox | null {
  const { width, height } = computeTargetDimensions(bitmap.width, bitmap.height, DETECT_EDGE);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(bitmap, 0, 0, width, height);
  const gray = toGrayscale(ctx.getImageData(0, 0, width, height).data);
  const box = findContentBox(gray, width, height);
  return box && scaleContentBox(box, width, height, bitmap.width, bitmap.height);
}

// Browser-only. Returns the trimmed/resized Blob (or the original File when
// nothing needs changing / re-encoding fails) plus the pixel size of the
// returned image. Preserves the source MIME type so the result stays within
// the jpeg|png|webp allowlist enforced client- and server-side.
export async function resizeImageForUpload(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY
): Promise<{ blob: Blob; width: number; height: number }> {
  // Honor EXIF orientation: phone photos carry a rotation flag that canvas
  // re-encoding would otherwise drop, flipping the image sideways.
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const original = { blob: file, width: bitmap.width, height: bitmap.height };
  try {
    const plan = planOutput(bitmap.width, bitmap.height, detectCrop(bitmap), maxEdge);
    if (!plan) return original;

    const canvas = document.createElement("canvas");
    canvas.width = plan.width;
    canvas.height = plan.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return original;
    const { source } = plan;
    ctx.drawImage(bitmap, source.left, source.top, source.width, source.height, 0, 0, plan.width, plan.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, file.type, quality)
    );
    if (!blob) return original;
    return { blob, width: plan.width, height: plan.height };
  } finally {
    bitmap.close();
  }
}
