import { describe, it, expect } from "vitest";
import { inferCarrierTrackingUrl } from "../carrier-urls";

describe("inferCarrierTrackingUrl", () => {
    it("returns a DHL URL for DHL carrier", () => {
        expect(inferCarrierTrackingUrl("DHL", "JD000123")).toBe(
            "https://www.dhl.com/en/express/tracking.html?AWB=JD000123"
        );
    });
    it("returns a GLS URL for GLS carrier", () => {
        expect(inferCarrierTrackingUrl("GLS", "ABCDEF")).toBe(
            "https://gls-group.com/track/ABCDEF"
        );
    });
    it("returns a UPS URL for UPS carrier", () => {
        expect(inferCarrierTrackingUrl("UPS", "1Z999")).toBe(
            "https://www.ups.com/track?tracknum=1Z999"
        );
    });
    it("returns an Econt URL for Econt carrier", () => {
        expect(inferCarrierTrackingUrl("Econt", "EC123")).toBe(
            "https://www.econt.com/en/services/track/EC123"
        );
    });
    it("returns null for unknown carrier", () => {
        expect(inferCarrierTrackingUrl("Other", "X")).toBeNull();
        expect(inferCarrierTrackingUrl("UnknownCarrier", "X")).toBeNull();
    });
    it("returns null for missing number", () => {
        expect(inferCarrierTrackingUrl("DHL", "")).toBeNull();
    });
});
