import type { Recipe } from "./types";

// Kept free of culori and spectral.js: the website bundles this file.

const STEPS = 9;
const TOUCH_SHARE = 0.12;
const PALE_LUMINANCE = 0.6;

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// Catmull-Rom through the points, with control points kept inside the box.
function smoothClosed(pts: number[][], width: number, height: number): string {
  const n = pts.length;
  const x = (v: number) => Math.min(width, Math.max(0, v)).toFixed(1);
  const y = (v: number) => Math.min(height, Math.max(0, v)).toFixed(1);
  let d = `M${x(pts[0][0])} ${y(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((o) => pts[(i + o + n) % n]);
    d += `C${x(p1[0] + (p2[0] - p0[0]) / 6)} ${y(p1[1] + (p2[1] - p0[1]) / 6)} `;
    d += `${x(p2[0] - (p3[0] - p1[0]) / 6)} ${y(p2[1] - (p3[1] - p1[1]) / 6)} ${x(p2[0])} ${y(p2[1])}`;
  }
  return d + "Z";
}

// A palette-knife smear sized by r: a thin dragged tail and a full rounded
// body where the knife lifted. Seeded so a swatch always gets the same smear.
export function splashShape(seed: string, r: number): { width: number; height: number; d: string } {
  let state = hash(seed) || 1;
  const random = () => ((state = Math.imul(state ^ (state >>> 13), 0x5bd1e995) >>> 0) % 10_000) / 10_000;
  const width = 2.4 * r;
  const height = 1.3 * r;
  const mid = height / 2;
  const top: number[][] = [];
  const bottom: number[][] = [];
  for (let i = 0; i <= STEPS; i++) {
    const t = i / STEPS;
    const x = 0.04 * width + t * 0.86 * width;
    const half = mid * (0.22 + 0.78 * t ** 0.55) * (0.9 + 0.1 * random());
    top.push([x, mid - half * (0.95 + 0.05 * random())]);
    bottom.push([x, mid + half * (0.9 + 0.1 * random())]);
  }
  let pts = [...top, [0.97 * width, mid - 0.12 * height], [0.99 * width, mid + 0.06 * height], ...bottom.reverse()];
  if (random() < 0.5) pts = pts.map(([x, y]) => [width - x, y]);
  return { width, height, d: smoothClosed(pts, width, height) };
}

// Pale colours vanish on the white gallery wall and need a hairline edge.
export function isPale(hex: string): boolean {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > PALE_LUMINANCE;
}

// "3 parts Titanium White, 1 part Yellow Ochre and a touch of Ivory Black".
export function recipeText(recipe: Recipe): string {
  const [first, ...rest] = recipe.parts;
  if (!first) return "";
  if (rest.length === 0) return `${first.name}, straight from the tube`;
  const total = recipe.parts.reduce((sum, p) => sum + p.parts, 0);
  const bits = recipe.parts.map((p, i) =>
    i > 0 && p.parts / total <= TOUCH_SHARE ? `a touch of ${p.name}` : `${p.parts} ${p.parts === 1 ? "part" : "parts"} ${p.name}`
  );
  return `${bits.slice(0, -1).join(", ")} and ${bits[bits.length - 1]}`;
}
