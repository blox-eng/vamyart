import { describe, it, expect } from "vitest";
import { renderToBuffer } from "@react-pdf/renderer";
import { CertificateDoc } from "./CertificatePdf";
import type { CertificateSnapshot } from "@vamy/db";

const snapshot: CertificateSnapshot = {
  headerText: "Certificate of Authenticity",
  studioName: "VAMY",
  title: "Whispers",
  yearText: "2025",
  medium: "Oil on canvas",
  dimensions: "60 x 80 cm",
  editionLabel: null,
  certNumber: "VAMY-2026-0001",
  statement: "I certify that this is authentic.",
  copyrightLine: "© Maeve",
  careLine: "Handle by the edges.",
  signatureLabel: "Signed by hand",
  buyerName: null,
  issuedDateText: "23 July 2026",
};

describe("CertificateDoc", () => {
  it("renders a non-empty PDF without throwing", async () => {
    const buf = await renderToBuffer(CertificateDoc({ snapshot, imageUrl: null }));
    expect(buf.length).toBeGreaterThan(1000);
  });
});
