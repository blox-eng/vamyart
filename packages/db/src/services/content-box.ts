// Finds the painting inside a photo of a canvas shot on white with a soft drop
// shadow. The canvas edge is a sharp luminance step; the shadow is a smooth
// gradient, so from each side we skip the white, then take the outermost strong
// step as the edge and settle inward past any blurred/halo pixels.
// Pure and dependency-free: runs in the studio (browser) and in node scripts.

export type ContentBox = { left: number; top: number; width: number; height: number };

const MIN_SIDE = 16;
const CORNER_FRACTION = 0.03;
const MIN_BACKGROUND = 200;
const MAX_CORNER_SPREAD = 30;
const BACKGROUND_TOLERANCE = 10;
const EDGE_BAND = 0.12;
const MIN_STEP = 12;
const SETTLE_TOLERANCE = 4;
const MAX_SETTLE = 0.015;
const MAX_SIDE_SHIFT = 0.4;
const MIN_AREA = 0.2;

function patchMean(gray: ArrayLike<number>, width: number, x0: number, y0: number, size: number): number {
  let sum = 0;
  for (let y = y0; y < y0 + size; y++) {
    for (let x = x0; x < x0 + size; x++) sum += gray[y * width + x];
  }
  return sum / (size * size);
}

function columnProfile(gray: ArrayLike<number>, width: number, height: number): Float64Array {
  const y0 = Math.floor(height * 0.2);
  const y1 = Math.max(y0 + 1, Math.ceil(height * 0.8));
  const out = new Float64Array(width);
  for (let x = 0; x < width; x++) {
    let sum = 0;
    for (let y = y0; y < y1; y++) sum += gray[y * width + x];
    out[x] = sum / (y1 - y0);
  }
  return out;
}

function rowProfile(gray: ArrayLike<number>, width: number, height: number): Float64Array {
  const x0 = Math.floor(width * 0.2);
  const x1 = Math.max(x0 + 1, Math.ceil(width * 0.8));
  const out = new Float64Array(height);
  for (let y = 0; y < height; y++) {
    let sum = 0;
    for (let x = x0; x < x1; x++) sum += gray[y * width + x];
    out[y] = sum / (x1 - x0);
  }
  return out;
}

// Number of samples to drop from the start of `profile` (walking inward), or
// null when no clear canvas edge is found.
function edgeOffset(profile: ArrayLike<number>, background: number): number | null {
  const n = profile.length;
  let start = 0;
  while (start < n && profile[start] >= background - BACKGROUND_TOLERANCE) start++;
  if (start === 0) return 0;
  if (start > n * MAX_SIDE_SHIFT) return null;

  const end = Math.min(n - 1, start + Math.ceil(n * EDGE_BAND));
  let maxStep = 0;
  for (let i = start; i <= end; i++) maxStep = Math.max(maxStep, Math.abs(profile[i] - profile[i - 1]));
  if (maxStep < MIN_STEP) return null;

  let edge = start;
  while (Math.abs(profile[edge] - profile[edge - 1]) < Math.max(MIN_STEP, maxStep / 2)) edge++;

  const settleLimit = Math.min(n - 3, edge + Math.ceil(n * MAX_SETTLE));
  let settled = edge;
  while (
    settled < settleLimit &&
    (Math.abs(profile[settled + 1] - profile[settled]) > SETTLE_TOLERANCE ||
      Math.abs(profile[settled + 2] - profile[settled + 1]) > SETTLE_TOLERANCE)
  ) {
    settled++;
  }
  return settled;
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

  const cols = columnProfile(gray, width, height);
  const rows = rowProfile(gray, width, height);
  const left = edgeOffset(cols, background);
  const right = edgeOffset(Array.from(cols).reverse(), background);
  const top = edgeOffset(rows, background);
  const bottom = edgeOffset(Array.from(rows).reverse(), background);
  if (left === null || right === null || top === null || bottom === null) return null;

  if (Math.max(left, right) > width * MAX_SIDE_SHIFT) return null;
  if (Math.max(top, bottom) > height * MAX_SIDE_SHIFT) return null;
  const boxWidth = width - left - right;
  const boxHeight = height - top - bottom;
  if (boxWidth <= 0 || boxHeight <= 0) return null;
  if (boxWidth * boxHeight < width * height * MIN_AREA) return null;
  if (boxWidth === width && boxHeight === height) return null;

  return { left, top, width: boxWidth, height: boxHeight };
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
