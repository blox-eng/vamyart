import * as React from 'react';
import Link from 'next/link';

export type PieceCollection = { slug: string; title: string };

// The piece page's "Part of …" line, one entry of the piece's details list.
export function CollectionLinks({ collections }: { collections: PieceCollection[] }) {
    if (!collections.length) return null;
    return (
        <div>
            <dt className="sr-only">Collections</dt>
            <dd>
                Part of{' '}
                {collections.map((c, i) => (
                    <React.Fragment key={c.slug}>
                        {i > 0 && ', '}
                        <Link href={`/gallery/collections/${c.slug}`} className="underline underline-offset-4 hover:text-ink">
                            {c.title.trim()}
                        </Link>
                    </React.Fragment>
                ))}
            </dd>
        </div>
    );
}
