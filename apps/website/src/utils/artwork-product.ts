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

    const prints = tagged.filter((v) => v.productType !== "original");
    const originals = tagged.filter((v) => v.productType === "original");

    const cheapest = (variants: any[]) => {
        const withPrice = variants.filter((v) => v.price);
        if (withPrice.length === 0) return null;
        return Math.min(...withPrice.map((v) => Number(v.price)));
    };

    const attrs = (tagged[0]?.attributes ?? {}) as Record<string, string>;

    return {
        medium: attrs.medium ?? "",
        dimensions: attrs.dimensions ?? "",
        hasAvailable: tagged.length > 0,
        printPriceFrom: cheapest(prints),
        originalPrice: cheapest(originals),
    };
}
