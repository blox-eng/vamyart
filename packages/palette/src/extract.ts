import { deltaE, linearToSrgb, oklab, srgbToLinear, toHex } from "./color";

export type ExtractedSwatch = { hex: string; area: number; accent: boolean };

const MAX_SAMPLES = 40_000;
const ITERATIONS = 20;
const MERGE_DELTA_E = 3;
// The accent: the most saturated sliver of the canvas. If no cluster carries
// its chroma, k-means has averaged it away and it gets a swatch of its own.
const ACCENT_SHARE = 0.015;
const ACCENT_MIN_SAMPLES = 20;
const ACCENT_MIN_CHROMA = 0.04;
const ACCENT_CHROMA_GAP = 0.02;

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Sample = { lab: [number, number, number]; rgb: [number, number, number] };

function sample(rgba: Uint8ClampedArray): Sample[] {
  const pixels = rgba.length / 4;
  const stride = Math.max(1, Math.floor(pixels / MAX_SAMPLES));
  const out: Sample[] = [];
  for (let i = 0; i < pixels; i += stride) {
    const p = i * 4;
    if (rgba[p + 3] < 128) continue;
    const rgb: [number, number, number] = [rgba[p], rgba[p + 1], rgba[p + 2]];
    out.push({ lab: oklab(...rgb), rgb });
  }
  return out;
}

function dist2(a: number[], b: number[]): number {
  return (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
}

function seedCentroids(samples: Sample[], k: number, random: () => number): number[][] {
  const centroids = [samples[Math.floor(random() * samples.length)].lab.slice()];
  const nearest = samples.map((s) => dist2(s.lab, centroids[0]));
  while (centroids.length < k) {
    const total = nearest.reduce((a, b) => a + b, 0);
    if (total === 0) break;
    let pick = random() * total;
    let idx = 0;
    while (pick > nearest[idx]) pick -= nearest[idx++];
    const c = samples[idx].lab.slice();
    centroids.push(c);
    samples.forEach((s, i) => (nearest[i] = Math.min(nearest[i], dist2(s.lab, c))));
  }
  return centroids;
}

function nearest(lab: number[], centroids: number[][]): number {
  let best = 0;
  for (let c = 1; c < centroids.length; c++) if (dist2(lab, centroids[c]) < dist2(lab, centroids[best])) best = c;
  return best;
}

const chroma = (lab: number[]) => Math.hypot(lab[1], lab[2]);

function accentCentroid(samples: Sample[], centroids: number[][]): number[] | null {
  const count = Math.max(ACCENT_MIN_SAMPLES, Math.floor(samples.length * ACCENT_SHARE));
  const top = samples.slice().sort((a, b) => chroma(b.lab) - chroma(a.lab)).slice(0, count);
  const mean = [0, 1, 2].map((j) => top.reduce((sum, s) => sum + s.lab[j], 0) / top.length);
  const clusterChroma = Math.max(...centroids.map(chroma));
  return chroma(mean) > ACCENT_MIN_CHROMA && chroma(mean) > clusterChroma + ACCENT_CHROMA_GAP ? mean : null;
}

// k-means++ in OKLab. Each swatch reports the real sampled colour closest to
// its cluster centre, so the palette only contains colours present in the work.
export function extractPalette(rgba: Uint8ClampedArray, { k = 6, keepAccent = true } = {}): ExtractedSwatch[] {
  const samples = sample(rgba);
  if (samples.length === 0) return [];
  const centroids = seedCentroids(samples, k, mulberry32(1));
  const assign = new Int32Array(samples.length);

  for (let iter = 0; iter < ITERATIONS; iter++) {
    let moved = false;
    samples.forEach((s, i) => {
      const best = nearest(s.lab, centroids);
      if (assign[i] !== best) moved = true;
      assign[i] = best;
    });
    const sums = centroids.map(() => [0, 0, 0, 0]);
    samples.forEach((s, i) => {
      const acc = sums[assign[i]];
      acc[0] += s.lab[0]; acc[1] += s.lab[1]; acc[2] += s.lab[2]; acc[3]++;
    });
    sums.forEach((acc, c) => {
      if (acc[3]) centroids[c] = [acc[0] / acc[3], acc[1] / acc[3], acc[2] / acc[3]];
    });
    if (!moved && iter > 0) break;
  }

  const accent = keepAccent ? accentCentroid(samples, centroids) : null;
  if (accent) {
    centroids.push(accent);
    samples.forEach((s, i) => (assign[i] = nearest(s.lab, centroids)));
  }

  const clusters = centroids.map((centroid, c) => ({
    centroid, accent: accent !== null && c === centroids.length - 1, count: 0, rep: null as Sample | null, repDist: Infinity,
  }));
  samples.forEach((s, i) => {
    const cl = clusters[assign[i]];
    cl.count++;
    const d = dist2(s.lab, cl.centroid);
    if (d < cl.repDist) { cl.rep = s; cl.repDist = d; }
  });

  const swatches = clusters
    .filter((cl) => cl.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((cl) => ({ hex: toHex(...cl.rep!.rgb), area: cl.count / samples.length, accent: cl.accent }));

  const merged: ExtractedSwatch[] = [];
  for (const s of swatches) {
    const twin = !s.accent && merged.find((m) => !m.accent && deltaE(m.hex, s.hex) < MERGE_DELTA_E);
    if (twin) twin.area += s.area;
    else merged.push({ ...s });
  }
  return merged;
}

// Per-channel gains (linear light) that turn the tapped reference neutral grey
// while keeping its brightness — corrects a phone photo's colour cast.
export function whiteBalanceGains([r, g, b]: [number, number, number]): [number, number, number] {
  const lin = [r, g, b].map(srgbToLinear);
  const grey = (lin[0] + lin[1] + lin[2]) / 3;
  return lin.map((c) => (c > 0 ? grey / c : 1)) as [number, number, number];
}

export function applyGains(rgba: Uint8ClampedArray, gains: [number, number, number]): Uint8ClampedArray {
  const luts = gains.map((g) => Uint8ClampedArray.from({ length: 256 }, (_, v) => linearToSrgb(srgbToLinear(v) * g)));
  const out = new Uint8ClampedArray(rgba.length);
  for (let p = 0; p < rgba.length; p += 4) {
    out[p] = luts[0][rgba[p]];
    out[p + 1] = luts[1][rgba[p + 1]];
    out[p + 2] = luts[2][rgba[p + 2]];
    out[p + 3] = rgba[p + 3];
  }
  return out;
}

// OKLCh lightness and chroma per pixel, for the value study and chroma map.
export function lightnessAndChroma(rgba: Uint8ClampedArray): { lightness: Float32Array; chroma: Float32Array } {
  const n = rgba.length / 4;
  const lightness = new Float32Array(n);
  const chroma = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const [L, a, b] = oklab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    lightness[i] = L;
    chroma[i] = Math.hypot(a, b);
  }
  return { lightness, chroma };
}

export function valueLevels(lightness: ArrayLike<number>, levels: number): number[] {
  return Array.from(lightness, (l) => Math.min(levels - 1, Math.floor(l * levels)));
}
