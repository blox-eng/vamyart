import * as React from 'react';

const SOLD_MONTH = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });

export function soldLabel(soldAt: string | null) {
    return soldAt ? `Sold in ${SOLD_MONTH.format(new Date(soldAt))}` : 'Sold';
}

// The gallery's red sold dot, for use inside a link (wall tile, landing slide).
export function SoldDot({ soldAt, className }: { soldAt: string | null; className: string }) {
    return <span className={`sold-dot ${className}`} role="img" aria-label={soldLabel(soldAt)} />;
}

// The landing slide's dot, whose label slides in beside it while the slide is hovered.
export function SoldTag({ soldAt }: { soldAt: string | null }) {
    return (
        <span className="sold-tag" role="img" aria-label={soldLabel(soldAt)}>
            <span className="sold-tag-label">{soldLabel(soldAt)}</span>
            <span className="sold-dot" />
        </span>
    );
}

// The piece page's dot: hover, focus or tap opens the sale date and a quiet commission link.
export function SoldMark({ soldAt, commissionHref }: { soldAt: string | null; commissionHref: string }) {
    const [open, setOpen] = React.useState(false);
    const id = React.useId();
    return (
        <div
            className="sold-mark"
            data-open={open || undefined}
            onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
        >
            <button
                type="button"
                className="sold-mark-button"
                aria-label={soldLabel(soldAt)}
                aria-expanded={open}
                aria-controls={id}
                onClick={() => setOpen((o) => !o)}
            >
                <span className="sold-dot" aria-hidden="true" />
            </button>
            <div id={id} className="sold-note">
                <span aria-hidden="true">{soldLabel(soldAt)}</span>
                <a href={commissionHref}>Commission a piece like this</a>
            </div>
        </div>
    );
}
