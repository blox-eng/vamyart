import { trpc } from "../../../lib/trpc";

interface FeaturedHeroProps {
    fallbackUrl: string;
    altText: string;
    className?: string;
    id?: string;
}

export function FeaturedHero({ fallbackUrl, altText, className, id }: FeaturedHeroProps) {
    const { data: featured } = trpc.products.getFeatured.useQuery(undefined, {
        staleTime: 60_000,
    });

    const artworkSlug = featured?.artwork?.slug;
    const src = artworkSlug ? `/images/${artworkSlug}.jpg` : fallbackUrl;

    return <img id={id} className={className} src={src} alt={altText} />;
}
