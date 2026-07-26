export interface ArtworkDisplayData {
    medium: string;
    dimensions: string;
    hasAvailable: boolean;
    printPriceFrom: number | null;
    originalPrice: number | null;
}

export function deriveArtworkDisplayData(products: any[]): ArtworkDisplayData {
    if (!products || products.length === 0) {
        return { medium: "", dimensions: "", hasAvailable: false, printPriceFrom: null, originalPrice: null };
    }

    // Tag each variant with its parent product's type, then flatten
    const tagged = products.flatMap((p: any) =>
        ((p.variants ?? []) as any[]).map((v: any) => ({ ...v, productType: p.productType }))
    );

    // Same "sold" rule as isVariantSold / ProductSelector: a variant is gone when it's
    // been flagged (soldAt) or it's a one-of-a-kind original with no stock. Sold variants
    // must not advertise a price or an "Available" dot on the card.
    // Keep this expression textually identical to isVariantSold (packages/db) and the
    // ProductSelector inline copy — the duplication is deliberate (client bundle can't
    // import @vamy/db), so matching text keeps future edits easy to mirror.
    const isSold = (v: any) =>
        v.soldAt != null || (v.isOriginal && v.stockQuantity <= 0);
    const sellable = tagged.filter((v) => !isSold(v));

    const prints = sellable.filter((v) => v.productType !== "original");
    const originals = sellable.filter((v) => v.productType === "original");

    const cheapest = (variants: any[]) => {
        const withPrice = variants.filter((v) => v.price);
        if (withPrice.length === 0) return null;
        return Math.min(...withPrice.map((v) => Number(v.price)));
    };

    // Descriptive attributes come from any variant (incl. sold) so a sold piece keeps its
    // medium/dimensions on the card; only price + availability are gated on being sellable.
    const attrs = (tagged[0]?.attributes ?? {}) as Record<string, string>;

    return {
        medium: attrs.medium ?? "",
        dimensions: attrs.dimensions ?? "",
        hasAvailable: sellable.length > 0,
        printPriceFrom: cheapest(prints),
        originalPrice: cheapest(originals),
    };
}
