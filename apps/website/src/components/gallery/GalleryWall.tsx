import * as React from 'react';
import Link from 'next/link';
import type { GalleryPiece } from '@vamy/db';
import { aspectOf } from '@vamy/db/gallery';
import { DEFAULT_WIDTHS, netlifyImage, netlifyImageSrcSet } from '../../utils/netlify-image';
import { distributeColumns } from '../../utils/masonry';

type Filter = { slug: string; title: string };
type Props = { pieces: GalleryPiece[]; filters: Filter[]; activeSlug: string | null };

// One server-rendered layout per breakpoint; CSS shows exactly one, so the wall
// never reflows after hydration. Hidden copies are lazy, so they never load.
const VARIANTS = [
    { columns: 2, className: 'wall-grid wall--c2', sizes: 'calc(50vw - 23px)' },
    { columns: 3, className: 'wall-grid wall--c3', sizes: 'calc(33vw - 28px)' },
    { columns: 4, className: 'wall-grid wall--c4', sizes: 'calc(25vw - 25px)' },
];

export default function GalleryWall({ pieces = [], filters = [], activeSlug }: Props) {
    const shown = pieces.filter((p) => p.image);
    const aspects = shown.map((p) => aspectOf(p.image!));
    const heading = activeSlug ? filters.find((f) => f.slug === activeSlug)?.title ?? '' : 'on the wall';

    return (
        <main id="main" className="wall">
            <header className="wall-head">
                <h1 className="wall-heading">{heading}</h1>
                {filters.length > 0 && (
                    <nav aria-label="Collections" className="wall-filters">
                        <FilterLink href="/gallery/" active={activeSlug === null}>
                            all
                        </FilterLink>
                        {filters.map((f) => (
                            <FilterLink key={f.slug} href={`/gallery/collections/${f.slug}/`} active={f.slug === activeSlug}>
                                {f.title}
                            </FilterLink>
                        ))}
                    </nav>
                )}
            </header>
            {VARIANTS.map((v) => (
                <div key={v.columns} className={v.className}>
                    {distributeColumns(aspects, v.columns).map((column, c) => (
                        <div key={c} className="wall-col">
                            {column.map((i) => (
                                <Tile key={shown[i].slug} piece={shown[i]} aspect={aspects[i]} sizes={v.sizes} />
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </main>
    );
}

function FilterLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
    return (
        <Link href={href} scroll={false} aria-current={active ? 'page' : undefined}>
            {children}
        </Link>
    );
}

function Tile({ piece, aspect, sizes }: { piece: GalleryPiece; aspect: number; sizes: string }) {
    const image = piece.image!;
    const known = image.width != null && image.height != null;
    const srcSet = netlifyImageSrcSet(image.url, DEFAULT_WIDTHS);
    return (
        <a href={`/gallery/${piece.slug}/`} aria-label={piece.title} className="wall-tile">
            <img
                src={netlifyImage(image.url, { width: DEFAULT_WIDTHS[DEFAULT_WIDTHS.length - 1] })}
                srcSet={srcSet || undefined}
                sizes={srcSet ? sizes : undefined}
                alt={image.alt}
                width={image.width ?? undefined}
                height={image.height ?? undefined}
                loading="lazy"
                decoding="async"
                style={{ aspectRatio: aspect, objectFit: known ? undefined : 'contain' }}
            />
            <span className="wall-title" aria-hidden="true">
                {piece.title}
            </span>
        </a>
    );
}
