import { describe, it, expect } from "vitest";
import {
  formatCertNumber,
  editionLabel,
  assertEditionAvailable,
  interpolateStatement,
  buildCertificateSnapshot,
  DEFAULT_CERTIFICATE_SETTINGS,
} from "./model";

describe("formatCertNumber", () => {
  it("pads the sequence to 4 digits with the year", () => {
    expect(formatCertNumber(1, 2026)).toBe("VAMY-2026-0001");
    expect(formatCertNumber(1234, 2026)).toBe("VAMY-2026-1234");
  });
  it("does not truncate sequences beyond 4 digits", () => {
    expect(formatCertNumber(12345, 2027)).toBe("VAMY-2027-12345");
  });
});

describe("editionLabel", () => {
  it("formats as 'n of size'", () => {
    expect(editionLabel(3, 25)).toBe("3 of 25");
  });
});

describe("assertEditionAvailable", () => {
  it("passes for a free number in range", () => {
    expect(() => assertEditionAvailable([1, 2], 3, 25)).not.toThrow();
  });
  it("throws when the number is already taken", () => {
    expect(() => assertEditionAvailable([1, 2, 3], 3, 25)).toThrow(/already issued/i);
  });
  it("throws when out of range", () => {
    expect(() => assertEditionAvailable([], 0, 25)).toThrow(/between 1 and 25/i);
    expect(() => assertEditionAvailable([], 26, 25)).toThrow(/between 1 and 25/i);
  });
});

describe("interpolateStatement", () => {
  it("replaces known tokens and leaves unknown text intact", () => {
    const out = interpolateStatement("This is {title}, edition {edition}.", {
      title: "Whispers",
      edition: "3 of 25",
    });
    expect(out).toBe("This is Whispers, edition 3 of 25.");
  });
  it("replaces a missing token with an empty string", () => {
    expect(interpolateStatement("{title}{edition}", { title: "X" })).toBe("X");
  });
});

describe("buildCertificateSnapshot", () => {
  const base = {
    certNumber: "VAMY-2026-0001",
    title: "Whispers",
    year: 2025,
    medium: "Oil on canvas",
    dimensions: "60 x 80 cm",
    editionNumber: null,
    editionSize: null,
    buyerName: null,
    issuedAt: new Date("2026-07-23T10:00:00Z"),
  };

  it("builds an original snapshot with no edition label", () => {
    const snap = buildCertificateSnapshot(base, DEFAULT_CERTIFICATE_SETTINGS);
    expect(snap.editionLabel).toBeNull();
    expect(snap.title).toBe("Whispers");
    expect(snap.yearText).toBe("2025");
    expect(snap.certNumber).toBe("VAMY-2026-0001");
    expect(snap.issuedDateText).toBe("23 July 2026");
  });

  it("interpolates {title} and {edition} into the statement for a print", () => {
    const snap = buildCertificateSnapshot(
      { ...base, editionNumber: 3, editionSize: 25 },
      { ...DEFAULT_CERTIFICATE_SETTINGS, statementTemplate: "{title} — {edition}" },
    );
    expect(snap.editionLabel).toBe("3 of 25");
    expect(snap.statement).toBe("Whispers — 3 of 25");
  });

  it("uses statementOverride verbatim when provided", () => {
    const snap = buildCertificateSnapshot(
      { ...base, statementOverride: "Custom wording." },
      DEFAULT_CERTIFICATE_SETTINGS,
    );
    expect(snap.statement).toBe("Custom wording.");
  });

  it("blanks null fields to empty strings so the PDF has no 'null'", () => {
    const snap = buildCertificateSnapshot(
      { ...base, year: null, medium: null, dimensions: null },
      DEFAULT_CERTIFICATE_SETTINGS,
    );
    expect(snap.yearText).toBe("");
    expect(snap.medium).toBe("");
    expect(snap.dimensions).toBe("");
  });
});
