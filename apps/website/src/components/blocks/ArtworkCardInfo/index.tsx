import { trpc } from "../../../lib/trpc";

export function ArtworkCardInfo({ slug }: { slug: string }) {
    const { data: products } = trpc.products.listByArtworkSlug.useQuery(
        { slug },
        { staleTime: 60_000 }
    );

    if (!products || products.length === 0) return null;

    const allVariants = products.flatMap((p) => p.variants ?? []);
    const cheapest = allVariants
        .filter((v) => v.available && v.price)
        .sort((a, b) => Number(a.price) - Number(b.price))[0];

    const hasAvailable = allVariants.some((v) => v.available);
    const attrs = (allVariants[0]?.attributes ?? {}) as Record<string, string>;
    const medium = attrs.medium || "";
    const dimensions = attrs.dimensions || "";

    return (
        <div className="mt-2 space-y-1">
            {medium && (
                <p className="text-xs text-gray-500">
                    {medium}{dimensions ? ` \u00b7 ${dimensions}` : ""}
                </p>
            )}
            {cheapest ? (
                <p className="text-sm font-light">&euro;{Number(cheapest.price).toLocaleString()}</p>
            ) : (
                <p className="text-xs text-gray-400 italic">Price on request</p>
            )}
            <p className="text-xs flex items-center gap-1.5">
                <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                    hasAvailable ? "bg-green-500" : "bg-gray-400"
                }`} />
                <span className={hasAvailable ? "text-green-700" : "text-gray-400"}>
                    {hasAvailable ? "Available" : "Sold"}
                </span>
            </p>
        </div>
    );
}
