export type CertificateSettings = {
  headerText: string;
  studioName: string;
  statementTemplate: string;
  copyrightLine: string;
  careLine: string;
  signatureLabel: string;
};

export type CertificateSnapshot = {
  headerText: string;
  studioName: string;
  title: string;
  yearText: string;
  medium: string;
  dimensions: string;
  editionLabel: string | null;
  certNumber: string;
  statement: string;
  copyrightLine: string;
  careLine: string;
  signatureLabel: string;
  buyerName: string | null;
  issuedDateText: string;
};

export type SnapshotInput = {
  certNumber: string;
  title: string;
  year: number | null;
  medium: string | null;
  dimensions: string | null;
  editionNumber: number | null;
  editionSize: number | null;
  buyerName: string | null;
  issuedAt: Date;
  statementOverride?: string;
};

export const DEFAULT_CERTIFICATE_SETTINGS: CertificateSettings = {
  headerText: "Certificate of Authenticity",
  studioName: "VAMY",
  statementTemplate:
    'I certify that “{title}” is an authentic original work created by my hand. This certificate accompanies the artwork as a record of its provenance.',
  copyrightLine: "© Maeve — all reproduction rights reserved.",
  careLine: "Keep away from direct sunlight and humidity. Handle by the edges.",
  signatureLabel: "Signed by hand",
};

export function formatCertNumber(seq: number, year: number): string {
  return `VAMY-${year}-${String(seq).padStart(4, "0")}`;
}

export function editionLabel(n: number, size: number): string {
  return `${n} of ${size}`;
}

export function assertEditionAvailable(taken: number[], requested: number, size: number): void {
  if (!Number.isInteger(requested) || requested < 1 || requested > size) {
    throw new Error(`Edition number must be between 1 and ${size}.`);
  }
  if (taken.includes(requested)) {
    throw new Error(`Edition number ${requested} has already issued a certificate.`);
  }
}

export function interpolateStatement(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? "");
}

function formatIssuedDate(d: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(d);
}

export function buildCertificateSnapshot(
  input: SnapshotInput,
  settings: CertificateSettings,
): CertificateSnapshot {
  const edition =
    input.editionNumber != null && input.editionSize != null
      ? editionLabel(input.editionNumber, input.editionSize)
      : null;

  const statement =
    input.statementOverride ??
    interpolateStatement(settings.statementTemplate, {
      title: input.title,
      edition: edition ?? "",
      year: input.year != null ? String(input.year) : "",
      medium: input.medium ?? "",
    });

  return {
    headerText: settings.headerText,
    studioName: settings.studioName,
    title: input.title,
    yearText: input.year != null ? String(input.year) : "",
    medium: input.medium ?? "",
    dimensions: input.dimensions ?? "",
    editionLabel: edition,
    certNumber: input.certNumber,
    statement,
    copyrightLine: settings.copyrightLine,
    careLine: settings.careLine,
    signatureLabel: settings.signatureLabel,
    buyerName: input.buyerName ?? null,
    issuedDateText: formatIssuedDate(input.issuedAt),
  };
}
