const POINTS = 10;

function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 0x01000193);
  return h >>> 0;
}

// An irregular closed blob, like a dab of paint, inside a 2r × 2r box.
// Seeded so a swatch always gets the same shape.
export function splashPath(seed: string, r: number): string {
  let state = hash(seed) || 1;
  const random = () => ((state = Math.imul(state ^ (state >>> 13), 0x5bd1e995) >>> 0) % 10_000) / 10_000;
  const clamp = (v: number) => Math.min(2 * r, Math.max(0, v));
  const pts = Array.from({ length: POINTS }, (_, i) => {
    const angle = (i / POINTS) * Math.PI * 2;
    const radius = r * (0.72 + 0.22 * random());
    return [r + radius * Math.cos(angle), r + radius * Math.sin(angle)];
  });
  const f = (v: number) => clamp(v).toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < POINTS; i++) {
    const [p0, p1, p2, p3] = [-1, 0, 1, 2].map((o) => pts[(i + o + POINTS) % POINTS]);
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + "Z";
}
