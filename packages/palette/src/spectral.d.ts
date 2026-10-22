declare module "spectral.js" {
  export class Color {
    constructor(input: string | [number, number, number]);
    tintingStrength: number;
    toString(): string;
  }
  export function mix(...colors: [Color, number][]): Color;
}
