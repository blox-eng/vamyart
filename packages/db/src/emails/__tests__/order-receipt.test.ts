import { describe, it, expect } from "vitest";
import { renderOrderReceiptHtml } from "../order-receipt";

describe("renderOrderReceiptHtml", () => {
    const sample = {
        orderNumber: "order_test_42",
        buyerName: "Jane Smith",
        pieceName: "Whispers — Original",
        variantName: "Original — 70 × 100 cm",
        medium: "Oil on canvas",
        totalPaidEur: 2500,
        shippingAddress: {
            line1: "Rue du Louvre 5",
            line2: null,
            city: "Paris",
            postalCode: "75001",
            country: "France",
        },
        leadTime: "within 30 days",
        termsUrl: "https://vamy.art/terms",
        privacyUrl: "https://vamy.art/privacy",
    };

    it("includes order number, piece name, total, buyer name, and shipping address", () => {
        const html = renderOrderReceiptHtml(sample);
        expect(html).toContain("order_test_42");
        expect(html).toContain("Whispers — Original");
        expect(html).toContain("Original — 70 × 100 cm");
        expect(html).toContain("Jane Smith");
        expect(html).toContain("€2,500");
        expect(html).toContain("Rue du Louvre 5");
        expect(html).toContain("Paris");
        expect(html).toContain("75001");
        expect(html).toContain("— Maeve");
    });

    it("interpolates leadTime into the body", () => {
        const html = renderOrderReceiptHtml({ ...sample, leadTime: "within 7 days" });
        expect(html).toContain("ship within 7 days");
    });

    it("escapes HTML in user-controlled fields", () => {
        const evil = renderOrderReceiptHtml({
            ...sample,
            buyerName: '<script>alert(1)</script>',
            pieceName: 'Whispers & Co',
        });
        expect(evil).not.toContain("<script>alert(1)</script>");
        expect(evil).toContain("&lt;script&gt;");
        expect(evil).toContain("Whispers &amp; Co");
    });
});
