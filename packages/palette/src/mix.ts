import { Color, mix } from "spectral.js";
import { deltaE } from "./color";
import type { Paint, Recipe } from "./types";

// An extra tube must buy at least this much ΔE to be worth mixing in.
const PAINT_PENALTY = 0.75;
const MAX_PARTS = 8;
const TRIPLE_BEAM = 8;

const colorCache = new Map<string, Color>();
function spectralColor(hex: string): Color {
  let c = colorCache.get(hex);
  if (!c) colorCache.set(hex, (c = new Color(hex)));
  return c;
}

export function mixParts(parts: [Paint, number][]): string {
  if (parts.length === 1) return parts[0][0].hex.toLowerCase();
  return mix(...parts.map(([p, n]) => [spectralColor(p.hex), n] as [Color, number])).toString().toLowerCase();
}

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);

const RATIOS: [number, number][] = [];
for (let a = 1; a <= MAX_PARTS; a++)
  for (let b = 1; b <= MAX_PARTS; b++) if (gcd(a, b) === 1) RATIOS.push([a, b]);

type Candidate = { parts: [Paint, number][]; hex: string; deltaE: number; score: number };

function candidate(target: string, parts: [Paint, number][]): Candidate {
  const hex = mixParts(parts);
  const dE = deltaE(target, hex);
  return { parts, hex, deltaE: dE, score: dE + PAINT_PENALTY * (parts.length - 1) };
}

// Best 1–3 tube recipe for a target colour, predicted with Kubelka–Munk mixing.
// Pairs are searched exhaustively over small whole-number ratios; triples extend
// the best pairs with a little of a third tube.
export function solveRecipe(target: string, paints: Paint[]): Recipe | null {
  if (paints.length === 0) return null;
  const all: Candidate[] = paints.map((p) => candidate(target, [[p, 1]]));

  const pairs: Candidate[] = [];
  for (let i = 0; i < paints.length; i++)
    for (let j = i + 1; j < paints.length; j++)
      for (const [a, b] of RATIOS) pairs.push(candidate(target, [[paints[i], a], [paints[j], b]]));
  all.push(...pairs);

  pairs.sort((x, y) => x.deltaE - y.deltaE);
  for (const pair of pairs.slice(0, TRIPLE_BEAM)) {
    const used = new Set(pair.parts.map(([p]) => p.id));
    for (const third of paints) {
      if (used.has(third.id)) continue;
      for (const scale of [2, 3, 4])
        all.push(candidate(target, [...pair.parts.map(([p, n]) => [p, n * scale] as [Paint, number]), [third, 1]]));
    }
  }

  const best = all.reduce((a, b) => (b.score < a.score ? b : a));
  return {
    hex: best.hex,
    deltaE: Math.round(best.deltaE * 10) / 10,
    parts: best.parts
      .map(([p, n]) => ({ paintId: p.id, name: p.name, pigments: p.pigments, parts: n }))
      .sort((a, b) => b.parts - a.parts),
  };
}
