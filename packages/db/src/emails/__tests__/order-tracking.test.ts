import { describe, it, expect } from "vitest";
import { renderOrderTrackingHtml } from "../order-tracking";

describe("renderOrderTrackingHtml", () => {
    const base = {
        orderNumber: "order_test_7",
        buyerName: "Jane Smith",
        pieceName: "Whispers — Original",
        carrier: "DHL",
        trackingNumber: "JD000123",
        note: "Packed with care, should arrive within 3–7 working days.",
        termsUrl: "https://vamy.art/terms",
        privacyUrl: "https://vamy.art/privacy",
    };

    it("renders a tracking URL button when carrier is known", () => {
        const html = renderOrderTrackingHtml(base);
        expect(html).toContain("DHL");
        expect(html).toContain("JD000123");
        expect(html).toContain("https://www.dhl.com/en/express/tracking.html?AWB=JD000123");
        expect(html).toContain("Whispers — Original");
        expect(html).toContain("Packed with care");
        expect(html).toContain("— Maeve");
    });

    it("renders only the tracking number when carrier is unknown", () => {
        const html = renderOrderTrackingHtml({ ...base, carrier: "Other" });
        expect(html).toContain("JD000123");
        expect(html).not.toContain("https://www.dhl.com");
    });

    it("omits note block when no note provided", () => {
        const html = renderOrderTrackingHtml({ ...base, note: null });
        expect(html).not.toContain("Packed with care");
    });

    it("escapes HTML in user-controlled fields", () => {
        const evil = renderOrderTrackingHtml({ ...base, buyerName: "<script>x</script>" });
        expect(evil).not.toContain("<script>x</script>");
        expect(evil).toContain("&lt;script&gt;");
    });
});
