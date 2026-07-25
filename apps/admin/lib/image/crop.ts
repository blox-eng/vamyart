// Crop a studio cover image to the selected region and downscale to a 3:2 JPEG,
// ready for the signed direct-to-Storage upload. Mirrors resize.ts's canvas
// approach (EXIF-aware bitmap decode, long-edge cap, re-encode).

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

const DEFAULT_MAX_EDGE = 2560; // 1600px display + retina headroom
const DEFAULT_QUALITY = 0.85;

export function computeOutputSize(
  crop: PixelCrop,
  maxEdge: number = DEFAULT_MAX_EDGE
): { width: number; height: number } {
  const longest = Math.max(crop.width, crop.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  return { width: Math.round(crop.width * scale), height: Math.round(crop.height * scale) };
}

// Browser-only. Draws the cropped source region onto a downscaled canvas and
// returns an image/jpeg Blob. Throws if canvas/encoding is unavailable.
export async function getCroppedBlob(file: File, crop: PixelCrop): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  try {
    const { width, height } = computeOutputSize(crop);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(bitmap, crop.x, crop.y, crop.width, crop.height, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", DEFAULT_QUALITY)
    );
    if (!blob) throw new Error("Failed to encode cropped image");
    return blob;
  } finally {
    bitmap.close();
  }
}
