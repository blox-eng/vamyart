export interface ArtworkDisplayData {
    medium: string;
    dimensions: string;
    cheapestPrice: number | null;
    hasAvailable: boolean;
}

export function deriveArtworkDisplayData(product: any): ArtworkDisplayData {
    const allVariants = (product?.variants ?? []) as any[];
    const cheapestVariant = allVariants
        .filter((v: any) => v.available && v.price)
        .sort((a: any, b: any) => Number(a.price) - Number(b.price))[0];
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;

    return {
        medium: attrs.medium ?? "",
        dimensions: attrs.dimensions ?? "",
        cheapestPrice: cheapestVariant ? Number(cheapestVariant.price) : null,
        hasAvailable: allVariants.some((v: any) => v.available),
    };
}
