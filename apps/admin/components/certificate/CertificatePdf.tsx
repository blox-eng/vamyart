import {
  Document,
  Page,
  View,
  Text,
  Image,
  StyleSheet,
  Font,
} from "@react-pdf/renderer";
import type { CertificateSnapshot } from "@vamy/db";

const isBrowser = typeof window !== "undefined";

if (isBrowser) {
  Font.register({
    family: "Cormorant",
    fonts: [
      { src: "/fonts/Cormorant-Regular.woff" },
      { src: "/fonts/Cormorant-SemiBold.woff", fontWeight: 600 },
    ],
  });
  Font.register({
    family: "Inter",
    fonts: [
      { src: "/fonts/Inter-Regular.woff" },
      { src: "/fonts/Inter-Medium.woff", fontWeight: 500 },
    ],
  });
}

// Outside the browser (e.g. node test runner) the brand fonts aren't registered,
// so fall back to react-pdf's built-in Helvetica to avoid a "Font family not
// registered" error.
const serifFamily = isBrowser ? "Cormorant" : "Helvetica";
const sansFamily = isBrowser ? "Inter" : "Helvetica";

const s = StyleSheet.create({
  page: { padding: 56, fontFamily: sansFamily, color: "#1a1a1a", fontSize: 10 },
  header: { fontFamily: serifFamily, fontSize: 26, fontWeight: 600, marginBottom: 2 },
  studio: { letterSpacing: 3, fontSize: 9, color: "#666", marginBottom: 24, textTransform: "uppercase" },
  image: { width: "100%", height: 240, objectFit: "contain", marginBottom: 24 },
  title: { fontFamily: serifFamily, fontSize: 20, fontWeight: 600, marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 4 },
  label: { width: 90, color: "#888", fontSize: 9, textTransform: "uppercase", letterSpacing: 1 },
  value: { flex: 1, fontSize: 10 },
  statement: { marginTop: 20, marginBottom: 28, fontSize: 10, lineHeight: 1.6, color: "#333" },
  certNo: { fontFamily: sansFamily, fontWeight: 500, fontSize: 10, marginBottom: 20 },
  sigRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 40 },
  sigBlock: { width: "45%" },
  sigLine: { borderTopWidth: 1, borderTopColor: "#1a1a1a", marginTop: 28, paddingTop: 4, fontSize: 9, color: "#666" },
  fine: { marginTop: 40, fontSize: 7.5, color: "#999", lineHeight: 1.5 },
});

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <View style={s.row}>
      <Text style={s.label}>{label}</Text>
      <Text style={s.value}>{value}</Text>
    </View>
  );
}

export function CertificateDoc({
  snapshot,
  imageUrl,
}: {
  snapshot: CertificateSnapshot;
  imageUrl: string | null;
}) {
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.header}>{snapshot.headerText}</Text>
        <Text style={s.studio}>{snapshot.studioName}</Text>

        {imageUrl ? <Image style={s.image} src={imageUrl} /> : null}

        <Text style={s.title}>{snapshot.title}</Text>
        <Field label="Year" value={snapshot.yearText} />
        <Field label="Medium" value={snapshot.medium} />
        <Field label="Dimensions" value={snapshot.dimensions} />
        {snapshot.editionLabel ? <Field label="Edition" value={snapshot.editionLabel} /> : null}
        {snapshot.buyerName ? <Field label="Collector" value={snapshot.buyerName} /> : null}

        <Text style={s.statement}>{snapshot.statement}</Text>
        <Text style={s.certNo}>Certificate No. {snapshot.certNumber}</Text>

        <View style={s.sigRow}>
          <View style={s.sigBlock}>
            <Text style={s.sigLine}>{snapshot.signatureLabel}</Text>
          </View>
          <View style={s.sigBlock}>
            <Text style={s.sigLine}>Date</Text>
          </View>
        </View>

        <Text style={s.fine}>
          {snapshot.copyrightLine}
          {snapshot.careLine ? `\n${snapshot.careLine}` : ""}
          {`\nIssued ${snapshot.issuedDateText}.`}
        </Text>
      </Page>
    </Document>
  );
}
