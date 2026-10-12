// Finds the painting inside a photo of a canvas shot on white with a soft drop
// shadow. The canvas edge is a sharp luminance step; the shadow is a smooth
// gradient, so from each side we skip the white, then take the outermost strong
// step as the edge and settle inward past any blurred/halo pixels. Everything
// cut must then prove to be backdrop: flat white far from the edge, and near it
// only a shadow (darkening toward the canvas, even along its length). A pale or
// textured sky reaching the canvas edge fails that, and nothing is trimmed.
// A flat painted white border is indistinguishable from the backdrop and is trimmed.
// Pure and dependency-free: runs in the studio (browser) and in node scripts.

export type ContentBox = { left: number; top: number; width: number; height: number };

const MIN_SIDE = 16;
const CORNER_FRACTION = 0.03;
const MIN_BACKGROUND = 200;
const MAX_CORNER_SPREAD = 30;
const BACKGROUND_TOLERANCE = 10;
const EDGE_BAND = 0.12;
const MIN_STEP = 20;
const SETTLE_TOLERANCE = 4;
const MAX_SETTLE = 0.015;
const MAX_SIDE_SHIFT = 0.4;
const MIN_AREA = 0.2;
// Lines this close to the canvas edge may be drop shadow rather than flat white.
const SHADOW_BAND = 0.05;
const MARGIN_TOLERANCE = 4;
const MAX_LINE_STD = 3;
const EDGE_BLUR = 2;
const MONOTONE_TOLERANCE = 2;
// A shadow darker than the backdrop tolerance must keep fading, not plateau.
const MIN_SHADOW_SLOPE = 1;

function patchMean(gray: ArrayLike<number>, width: number, x0: number, y0: number, size: number): number {
  let sum = 0;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) sum += gray[y * width + x];
  }
  return sum / (size * size);
}

// Per-line mean and std. A line is a column (`vertical`) or a row, sampled over
// [from, to) along its length.
type Profile = { mean: Float64Array; std: Float64Array };

function profile(
  gray: ArrayLike<number>,
  width: number,
  height: number,
  vertical: boolean,
  from: number,
  to: number
): Profile {
  const lines = vertical ? width : height;
  const mean = new Float64Array(lines);
  const std = new Float64Array(lines);
  for (let line = 0; line < lines; line++) {
    let sum = 0;
    let sumSq = 0;
    for (let i = from; i < to; i++) {
      const v = vertical ? gray[i * width + line] : gray[line * width + i];
      sum += v;
      sumSq += v * v;
    }
    mean[line] = sum / (to - from);
    std[line] = Math.sqrt(Math.max(0, sumSq / (to - from) - mean[line] * mean[line]));
  }
  return { mean, std };
}

function middle(length: number, inset: number): [number, number] {
  const from = Math.floor(length * inset);
  return [from, Math.max(from + 1, Math.ceil(length * (1 - inset)))];
}

function reversed({ mean, std }: Profile): Profile {
  return { mean: mean.slice().reverse(), std: std.slice().reverse() };
}

// Walking inward from the start of `mean`: `start` where the white ends, `edge`
// at the canvas step, `depth` lines to cut. Null when there is no clear edge.
type Edge = { start: number; edge: number; depth: number };

function findEdge(mean: Float64Array, background: number): Edge | null {
  const n = mean.length;
  let start = 0;
  while (start < n && mean[start] >= background - BACKGROUND_TOLERANCE) start++;
  if (start === 0) return { start: 0, edge: 0, depth: 0 };
  if (start > n * MAX_SIDE_SHIFT) return null;

  const end = Math.min(n - 1, start + Math.ceil(n * EDGE_BAND));
  let maxStep = 0;
  for (let i = start; i <= end; i++) maxStep = Math.max(maxStep, Math.abs(mean[i] - mean[i - 1]));
  if (maxStep < MIN_STEP) return null;

  let edge = start;
  while (Math.abs(mean[edge] - mean[edge - 1]) < Math.max(MIN_STEP, maxStep / 2)) edge++;

  const settleLimit = Math.min(n - 3, edge + Math.ceil(n * MAX_SETTLE));
  let depth = edge;
  while (
    depth < settleLimit &&
    (Math.abs(mean[depth + 1] - mean[depth]) > SETTLE_TOLERANCE ||
      Math.abs(mean[depth + 2] - mean[depth + 1]) > SETTLE_TOLERANCE)
  ) {
    depth++;
  }
  return { start, edge, depth };
}

// Everything outside the canvas edge must look like backdrop: flat white far
// from the edge; near it only a shadow, even along each line and darkening
// toward the canvas. Line 0 (JPEG border ringing) and the two lines before the
// edge (halo/blur of the canvas edge) are left out; so are the settle lines
// past the edge, which are the edge itself.
function cutIsBackdrop({ mean, std }: Profile, { start, edge }: Edge, background: number): boolean {
  const blurFrom = edge - EDGE_BLUR;
  const shadowFrom = Math.max(1, Math.min(blurFrom, start - Math.ceil(mean.length * SHADOW_BAND)));
  for (let i = 1; i < shadowFrom; i++) {
    if (Math.abs(mean[i] - background) > MARGIN_TOLERANCE || std[i] > MAX_LINE_STD) return false;
  }
  for (let i = shadowFrom; i < blurFrom; i++) {
    if (std[i] > MAX_LINE_STD) return false;
    if (i > shadowFrom && mean[i] > mean[i - 1] + MONOTONE_TOLERANCE) return false;
  }
  const shadowLines = blurFrom - start;
  return shadowLines < 3 || (mean[start] - mean[blurFrom - 1]) / (shadowLines - 1) >= MIN_SHADOW_SLOPE;
}

export function findContentBox(
  gray: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): ContentBox | null {
  if (!Number.isInteger(width) || !Number.isInteger(height)) return null;
  if (width < MIN_SIDE || height < MIN_SIDE || gray.length < width * height) return null;

  const size = Math.max(1, Math.floor(Math.min(width, height) * CORNER_FRACTION));
  const corners = [
    patchMean(gray, width, 0, 0, size),
    patchMean(gray, width, width - size, 0, size),
    patchMean(gray, width, 0, height - size, size),
    patchMean(gray, width, width - size, height - size, size),
  ].sort((a, b) => a - b);
  if (corners[3] - corners[0] > MAX_CORNER_SPREAD) return null;
  const background = (corners[1] + corners[2]) / 2;
  if (background < MIN_BACKGROUND) return null;

  // Pass 1: find the edges from lines sampled over the middle 60%.
  const cols = profile(gray, width, height, true, ...middle(height, 0.2)).mean;
  const rows = profile(gray, width, height, false, ...middle(width, 0.2)).mean;
  const left = findEdge(cols, background);
  const right = findEdge(cols.slice().reverse(), background);
  const top = findEdge(rows, background);
  const bottom = findEdge(rows.slice().reverse(), background);
  if (!left || !right || !top || !bottom) return null;

  if (Math.max(left.depth, right.depth) > width * MAX_SIDE_SHIFT) return null;
  if (Math.max(top.depth, bottom.depth) > height * MAX_SIDE_SHIFT) return null;
  const boxWidth = width - left.depth - right.depth;
  const boxHeight = height - top.depth - bottom.depth;
  if (boxWidth <= 0 || boxHeight <= 0) return null;
  if (boxWidth * boxHeight < width * height * MIN_AREA) return null;
  if (boxWidth === width && boxHeight === height) return null;

  // Pass 2: verify what each side cuts, sampling lines along the canvas only
  // (10% in from its corners) so a shadow line isn't mixed with white beyond it.
  const along = (from: number, length: number): [number, number] => {
    const [a, b] = middle(length, 0.1);
    return [from + a, from + b];
  };
  const sideCols = profile(gray, width, height, true, ...along(top.depth, boxHeight));
  const sideRows = profile(gray, width, height, false, ...along(left.depth, boxWidth));
  const backdrop =
    cutIsBackdrop(sideCols, left, background) &&
    cutIsBackdrop(reversed(sideCols), right, background) &&
    cutIsBackdrop(sideRows, top, background) &&
    cutIsBackdrop(reversed(sideRows), bottom, background);
  if (!backdrop) return null;

  return { left: left.depth, top: top.depth, width: boxWidth, height: boxHeight };
}

// Maps a box found on a downscaled copy back onto the full-size image, rounding
// inward so no background sliver survives the scale-up.
export function scaleContentBox(
  box: ContentBox,
  fromWidth: number,
  fromHeight: number,
  toWidth: number,
  toHeight: number
): ContentBox {
  const sx = toWidth / fromWidth;
  const sy = toHeight / fromHeight;
  const left = Math.min(toWidth - 1, Math.ceil(box.left * sx));
  const top = Math.min(toHeight - 1, Math.ceil(box.top * sy));
  const right = Math.max(left + 1, Math.floor((box.left + box.width) * sx));
  const bottom = Math.max(top + 1, Math.floor((box.top + box.height) * sy));
  return { left, top, width: right - left, height: bottom - top };
}
