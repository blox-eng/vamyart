export type Carrier = "DHL" | "GLS" | "UPS" | "Econt" | "Other";

const URL_BUILDERS: Partial<Record<Carrier, (trackingNumber: string) => string>> = {
    DHL:   (n) => `https://www.dhl.com/en/express/tracking.html?AWB=${encodeURIComponent(n)}`,
    GLS:   (n) => `https://gls-group.com/track/${encodeURIComponent(n)}`,
    UPS:   (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
    Econt: (n) => `https://www.econt.com/en/services/track/${encodeURIComponent(n)}`,
};

export function inferCarrierTrackingUrl(carrier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
    if (!carrier || !trackingNumber) return null;
    const builder = URL_BUILDERS[carrier as Carrier];
    return builder ? builder(trackingNumber) : null;
}
