import { describe, it, expect } from "vitest";
import { pigmentCodes, PIGMENT_CODE } from "./pigments";

describe("pigmentCodes", () => {
  it("writes Colour Index codes the way the catalogue spells them", () => {
    expect(pigmentCodes("pbk9, PBR7 py35  pb15:1")).toEqual(["PBk9", "PBr7", "PY35", "PB15:1"]);
  });

  it("ignores empty input", () => {
    expect(pigmentCodes("  ")).toEqual([]);
  });

  it("accepts every catalogue spelling and rejects names", () => {
    for (const code of ["PBk9", "PBr7", "PB15:1", "PW6", "PR101"]) expect(PIGMENT_CODE.test(code)).toBe(true);
    for (const bad of ["Cadmium", "PBK9", "pb29", "P29"]) expect(PIGMENT_CODE.test(bad)).toBe(false);
  });
});
