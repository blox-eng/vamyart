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

export function measure(rgba: Uint8ClampedArray, width: number): Measurements {
  const n = rgba.length / 4;
  const height = n / width;
  const L = new Float32Array(n);
  const C = new Float32Array(n);
  const warmth = new Float32Array(n);
  const cells = Array.from({ length: GRID * GRID }, () => ({ sum: 0, sq: 0, chroma: 0, warmth: 0, count: 0 }));
  const map = Array.from({ length: MAP * MAP }, () => ({ sum: 0, count: 0 }));

  for (let i = 0; i < n; i++) {
    const [l, a, b] = oklab(rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]);
    L[i] = l;
    C[i] = Math.hypot(a, b);
    warmth[i] = a * WARM_AXIS[0] + b * WARM_AXIS[1];
    const fy = Math.floor(i / width) / height;
    const fx = (i % width) / width;
    const c = cells[Math.min(GRID - 1, Math.floor(fy * GRID)) * GRID + Math.min(GRID - 1, Math.floor(fx * GRID))];
    c.sum += l;
    c.sq += l * l;
    c.chroma += C[i];
    c.warmth += warmth[i];
    c.count++;
    const m = map[Math.min(MAP - 1, Math.floor(fy * MAP)) * MAP + Math.min(MAP - 1, Math.floor(fx * MAP))];
    m.sum += l;
    m.count++;
  }

  const sortedL = L.slice().sort();
  const shares: [number, number, number] = [0, 0, 0];
  for (const l of L) shares[Math.min(2, Math.floor(l * 3))]++;

  const place = (c: number) => PLACES[c];
  const spread = cells.map((c) => (c.count ? c.sq / c.count - (c.sum / c.count) ** 2 : 0));
  const cellChroma = cells.map((c) => (c.count ? c.chroma / c.count : 0));
  const meanChroma = C.reduce((s, v) => s + v, 0) / n;
  const strongest = cellChroma.indexOf(Math.max(...cellChroma));

  let chromatic = 0;
  let tinted = 0;
  let warm = 0;
  let lightWarmth = 0;
  let darkWarmth = 0;
  let lights = 0;
  let darks = 0;
  const darkBelow = percentile(sortedL, 1 / 3);
  const lightAbove = percentile(sortedL, 2 / 3);
  for (let i = 0; i < n; i++) {
    if (C[i] >= NEUTRAL_CHROMA) chromatic++;
    if (C[i] >= TINT_CHROMA) {
      tinted++;
      if (warmth[i] > 0) warm++;
    }
    if (L[i] >= lightAbove) { lightWarmth += warmth[i]; lights++; }
    if (L[i] <= darkBelow) { darkWarmth += warmth[i]; darks++; }
  }
  const cellWarmth = cells.map((c) => (c.count ? c.warmth / c.count : 0));
  const warmest = cellWarmth.indexOf(Math.max(...cellWarmth));
  const coolest = cellWarmth.indexOf(Math.min(...cellWarmth));
  const temperatureVaries = cellWarmth[warmest] - cellWarmth[coolest] > SAME_TEMPERATURE;
  const warmthGap = lightWarmth / Math.max(1, lights) - darkWarmth / Math.max(1, darks);

  return {
    value: {
      mean: round(sortedL.reduce((s, v) => s + v, 0) / n),
      low: round(percentile(sortedL, 0.05)),
      high: round(percentile(sortedL, 0.95)),
      shares: shares.map((s) => round(s / n)) as [number, number, number],
      grid: Array.from({ length: MAP }, (_, r) =>
        Array.from({ length: MAP }, (_, c) => {
          const x = map[r * MAP + c];
          return x.count ? Math.round((100 * x.sum) / x.count) : 0;
        })
      ),
      contrastAt: place(spread.indexOf(Math.max(...spread))),
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
    `Value map, mean lightness in a 5×5 grid, rows top to bottom: ${m.value.grid.map((row) => row.join(" ")).join(" / ")}.`,
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
