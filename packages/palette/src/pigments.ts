// Colour Index pigment codes: P, a class (Y, O, R, V, B, G, W, Br, Bk, M), a number
// and an optional variant, e.g. PB29, PBk9, PB15:1.
export const PIGMENT_CODE = /^P[A-Z][a-z]?\d+(:\d+)?$/;

export function pigmentCodes(input: string): string[] {
  return input
    .split(/[\s,]+/)
    .filter(Boolean)
    .map((code) => code.replace(/^p([a-z])([a-z]?)/i, (_, cls: string, sub: string) => `P${cls.toUpperCase()}${sub.toLowerCase()}`));
}
