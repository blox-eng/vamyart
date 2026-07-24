import * as React from 'react';
import classNames from 'classnames';

type Collection = { slug: string; title: string };

type Props = {
    collections?: Collection[];
    selectedSlug?: string | null;
    onSelect?: (slug: string | null) => void;
};

// Client-side chip bar rendered above the gallery grid (via PostFeedLayout's
// topSections). Selecting a chip filters `page.items` in the parent page
// component's state — no navigation, no refetch.
export default function CollectionFilterChips({ collections = [], selectedSlug = null, onSelect }: Props) {
    if (collections.length === 0) {
        return null;
    }
    return (
        <div className="w-full flex flex-wrap gap-3 mb-10">
            <Chip label="All" active={selectedSlug === null} onClick={() => onSelect?.(null)} />
            {collections.map((collection) => (
                <Chip
                    key={collection.slug}
                    label={collection.title}
                    active={selectedSlug === collection.slug}
                    onClick={() => onSelect?.(collection.slug)}
                />
            ))}
        </div>
    );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={classNames(
                'sb-component-button sb-component-button-secondary',
                'px-5 py-2 text-sm rounded-full transition-colors duration-200',
                { 'bg-dark text-light border-dark': active }
            )}
        >
            {label}
        </button>
    );
}
