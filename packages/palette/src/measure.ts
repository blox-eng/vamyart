import { oklab } from "./color";

// Facts about the picture the model would otherwise have to eyeball, measured
// in OKLab from the white-balanced photo: value structure, where contrast and
// colour concentrate, and colour temperature. Sent to the model as text.

// Places are named on a 3×3 grid; the value map is finer so thin bands such
// as a horizon or tree line don't average away.
const GRID = 3;
export const MAP = 5;
const ROWS = ["top", "middle", "bottom"];
const COLS = ["left", "centre", "right"];
export const PLACES = ROWS.flatMap((r) => COLS.map((c) => (r === "middle" && c === "centre" ? "centre" : `${r} ${c}`)));
const NEUTRAL_CHROMA = 0.03;
// Painters call a grey warm or cool by its faint tint, so temperature counts
// tints well below what reads as colour.
const TINT_CHROMA = 0.006;
// Warmth is the colour's pull towards orange (OKLab hue ~60°).
const WARM_AXIS = [Math.cos(Math.PI / 3), Math.sin(Math.PI / 3)];
const SAME_TEMPERATURE = 0.005;

export type Measurements = {
  value: {
    mean: number;
    low: number;
    high: number;
    shares: [dark: number, mid: number, light: number];
    grid: number[][];
    contrastAt: string;
  };
  chroma: { mean: number; neutralShare: number; strongestAt: string | null };
  temperature: {
    warmShare: number | null;
    warmestAt: string | null;
    coolestAt: string | null;
    lightsVsDarks: "warmer" | "cooler" | "same";
  };
};

const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places;

function percentile(sorted: Float32Array, p: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

// Index of the extreme value among cells that hold pixels; empty cells (tiny or
// mostly transparent images) say nothing about the picture.
function extreme(values: number[], cells: { count: number }[], pick: (a: number, b: number) => boolean): number {
  let best = -1;
  values.forEach((v, i) => {
    if (cells[i].count && (best < 0 || pick(v, values[best]))) best = i;
  });
  return Math.max(0, best);
}

export function measure(rgba: Uint8ClampedArray, width: number): Measurements {
  const pixels = rgba.length / 4;
  const height = pixels / width;
  const L: number[] = [];
  const C: number[] = [];
  const warmth: number[] = [];
  const cells = Array.from({ length: GRID * GRID }, () => ({ sum: 0, sq: 0, chroma: 0, warmth: 0, count: 0 }));
  const map = Array.from({ length: MAP * MAP }, () => ({ sum: 0, count: 0 }));

  for (let i = 0; i < pixels; i++) {
    // Transparent pixels arrive from a canvas as 0,0,0,0; they are not black paint.
    if (rgba[i * 4 + 3] < 128) continue;
    const [l, a, b] = oklab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    const chroma = Math.hypot(a, b);
    const w = a * WARM_AXIS[0] + b * WARM_AXIS[1];
    L.push(l);
    C.push(chroma);
    warmth.push(w);
    const fy = Math.floor(i / width) / height;
    const fx = (i % width) / width;
    const c = cells[Math.min(GRID - 1, Math.floor(fy * GRID)) * GRID + Math.min(GRID - 1, Math.floor(fx * GRID))];
    c.sum += l;
    c.sq += l * l;
    c.chroma += chroma;
    c.warmth += w;
    c.count++;
    const m = map[Math.min(MAP - 1, Math.floor(fy * MAP)) * MAP + Math.min(MAP - 1, Math.floor(fx * MAP))];
    m.sum += l;
    m.count++;
  }

  const n = Math.max(1, L.length);
  const sortedL = Float32Array.from(L).sort();
  const meanL = L.reduce((s, v) => s + v, 0) / n;
  const shares: [number, number, number] = [0, 0, 0];
  for (const l of L) shares[Math.min(2, Math.floor(l * 3))]++;

  const place = (c: number) => PLACES[c];
  const spread = cells.map((c) => (c.count ? c.sq / c.count - (c.sum / c.count) ** 2 : 0));
  const cellChroma = cells.map((c) => (c.count ? c.chroma / c.count : 0));
  const meanChroma = C.reduce((s, v) => s + v, 0) / n;
  const strongest = extreme(cellChroma, cells, (a, b) => a > b);

  let chromatic = 0;
  let tinted = 0;
  let warm = 0;
  let lightWarmth = 0;
  let darkWarmth = 0;
  let lights = 0;
  let darks = 0;
  const darkBelow = percentile(sortedL, 1 / 3);
  const lightAbove = percentile(sortedL, 2 / 3);
  for (let i = 0; i < L.length; i++) {
    if (C[i] >= NEUTRAL_CHROMA) chromatic++;
    if (C[i] >= TINT_CHROMA) {
      tinted++;
      if (warmth[i] > 0) warm++;
    }
    if (L[i] >= lightAbove) { lightWarmth += warmth[i]; lights++; }
    if (L[i] <= darkBelow) { darkWarmth += warmth[i]; darks++; }
  }
  const cellWarmth = cells.map((c) => (c.count ? c.warmth / c.count : 0));
  const warmest = extreme(cellWarmth, cells, (a, b) => a > b);
  const coolest = extreme(cellWarmth, cells, (a, b) => a < b);
  const temperatureVaries = cellWarmth[warmest] - cellWarmth[coolest] > SAME_TEMPERATURE;
  const warmthGap = lightWarmth / Math.max(1, lights) - darkWarmth / Math.max(1, darks);

  return {
    value: {
      mean: round(meanL),
      low: round(percentile(sortedL, 0.05) ?? 0),
      high: round(percentile(sortedL, 0.95) ?? 0),
      shares: shares.map((s) => round(s / n)) as [number, number, number],
      // An empty map cell takes the picture's mean rather than reading as black.
      grid: Array.from({ length: MAP }, (_, r) =>
        Array.from({ length: MAP }, (_, c) => {
          const x = map[r * MAP + c];
          return Math.round(100 * (x.count ? x.sum / x.count : meanL));
        })
      ),
      contrastAt: place(extreme(spread, cells, (a, b) => a > b)),
    },
    chroma: {
      mean: round(meanChroma, 3),
      neutralShare: round(1 - chromatic / n),
      // Only worth naming when one area clearly carries more colour.
      strongestAt: cellChroma[strongest] > 1.5 * meanChroma && cellChroma[strongest] >= NEUTRAL_CHROMA ? place(strongest) : null,
    },
    temperature: {
      warmShare: tinted ? round(warm / tinted) : null,
      warmestAt: tinted && temperatureVaries ? place(warmest) : null,
      coolestAt: tinted && temperatureVaries ? place(coolest) : null,
      lightsVsDarks: warmthGap > SAME_TEMPERATURE ? "warmer" : warmthGap < -SAME_TEMPERATURE ? "cooler" : "same",
    },
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;

export function describeMeasurements(m: Measurements): string {
  const key = m.value.mean > 0.7 ? "high key" : m.value.mean < 0.45 ? "low key" : "mid key";
  const chroma = m.chroma.mean < 0.03 ? "very low" : m.chroma.mean < 0.07 ? "low" : m.chroma.mean < 0.12 ? "moderate" : "high";
  const [dark, mid, light] = m.value.shares;
  return [
    `Value: ${key}; lightness runs ${Math.round(m.value.low * 100)}–${Math.round(m.value.high * 100)} on a 0 (black) to 100 (white) scale. Darks ${pct(dark)}, mid-tones ${pct(mid)}, lights ${pct(light)} of the canvas.`,
    `Value map, mean lightness in a ${MAP}×${MAP} grid, rows top to bottom: ${m.value.grid.map((row) => row.join(" ")).join(" / ")}.`,
    `Strongest value contrast: ${m.value.contrastAt}.`,
    `Chroma: ${chroma}; ${pct(m.chroma.neutralShare)} of the canvas is near-neutral.${m.chroma.strongestAt ? ` Colour concentrates ${m.chroma.strongestAt === "centre" ? "in the centre" : `at the ${m.chroma.strongestAt}`}.` : ""}`,
    m.temperature.warmShare === null
      ? "Temperature: too little colour to call."
      : [
          `Temperature: of the tinted area, ${pct(m.temperature.warmShare)} leans warm and ${pct(1 - m.temperature.warmShare)} cool.`,
          m.temperature.coolestAt && `Coolest area: ${m.temperature.coolestAt}; warmest: ${m.temperature.warmestAt}.`,
          `The lights are ${m.temperature.lightsVsDarks === "same" ? "the same temperature as the darks" : `${m.temperature.lightsVsDarks} than the darks`}.`,
        ].filter(Boolean).join(" "),
  ].join("\n");
}
