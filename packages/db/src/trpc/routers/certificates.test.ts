import { describe, it, expect } from "vitest";
import { nextCertNumberFromSeq } from "./certificates";

describe("nextCertNumberFromSeq", () => {
  it("derives the cert number from a sequence value and the issue date's year", () => {
    expect(nextCertNumberFromSeq(1, new Date("2026-07-23T00:00:00Z"))).toBe("VAMY-2026-0001");
    expect(nextCertNumberFromSeq(42, new Date("2027-01-01T00:00:00Z"))).toBe("VAMY-2027-0042");
  });
});
