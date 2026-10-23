// Browser-only canvas helpers for the Critique page. Analysis runs on a small
// copy of the photo: palette and maps don't need more than ~640px.
import { applyGains, lightnessAndChroma, valueLevels } from "@vamy/palette";

export type Pixels = { data: Uint8ClampedArray; width: number; height: number };

const ANALYSIS_EDGE = 640;

export async function loadPixels(source: Blob | string): Promise<Pixels> {
  let bitmap: ImageBitmap;
  if (typeof source === "string") {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = source;
    await img.decode();
    bitmap = await createImageBitmap(img);
  } else {
    bitmap = await createImageBitmap(source, { imageOrientation: "from-image" });
  }
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  return { data: ctx.getImageData(0, 0, width, height).data, width, height };
}

export function withWhiteBalance(px: Pixels, gains: [number, number, number] | null): Pixels {
  return gains ? { ...px, data: applyGains(px.data, gains) } : px;
}

function paint(canvas: HTMLCanvasElement, px: Pixels, shade: (i: number) => [number, number, number]) {
  canvas.width = px.width;
  canvas.height = px.height;
  const ctx = canvas.getContext("2d")!;
  const out = ctx.createImageData(px.width, px.height);
  for (let i = 0; i < px.width * px.height; i++) {
    out.data.set([...shade(i), 255], i * 4);
  }
  ctx.putImageData(out, 0, 0);
}

// Greyscale by perceptual lightness, or banded into a 3/5-value notan.
export function drawValueStudy(canvas: HTMLCanvasElement, px: Pixels, levels: number | null) {
  const { lightness } = lightnessAndChroma(px.data);
  const bands = levels ? valueLevels(lightness, levels) : null;
  paint(canvas, px, (i) => {
    const v = bands ? Math.round((bands[i] / (levels! - 1)) * 255) : Math.round(lightness[i] * 255);
    return [v, v, v];
  });
}

// Chroma heatmap: grey where colour is muted, deepening to warm red where it is most saturated.
const CHROMA_FULL = 0.25;
export function drawChromaMap(canvas: HTMLCanvasElement, px: Pixels) {
  const { chroma } = lightnessAndChroma(px.data);
  paint(canvas, px, (i) => {
    const t = Math.min(1, chroma[i] / CHROMA_FULL);
    return [Math.round(235 - 40 * t), Math.round(235 - 200 * t), Math.round(235 - 190 * t)];
  });
}
