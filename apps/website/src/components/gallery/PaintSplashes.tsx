import * as React from 'react';
import { recipeText, splashPath } from '@vamy/palette/display';
import type { Palette, Swatch } from '@vamy/palette';

const MIN_RADIUS = 9;
const MAX_RADIUS = 17;

export function splashLabel(swatch: Swatch): string {
    const name = swatch.name.trim();
    const recipe = swatch.recipe ? recipeText(swatch.recipe) : '';
    if (name && recipe) return `${name} — ${recipe}`;
    return name || recipe || swatch.hex;
}

// The piece's palette as dabs of paint on the wall under the painting. Hover,
// focus or tap a dab for its name and mixing recipe. Fills are the exact
// colours: no opacity, filters or shadows that would shift them.
export function PaintSplashes({ palette }: { palette: Palette }) {
    const [hovered, setHovered] = React.useState<number | null>(null);
    const [pinned, setPinned] = React.useState<number | null>(null);
    const shown = hovered ?? pinned;
    const largest = Math.max(...palette.swatches.map((s) => s.area)) || 1;

    return (
        <div className="paint-splashes" role="group" aria-label="Palette" onKeyDown={(e) => e.key === 'Escape' && setPinned(null)}>
            <div className="paint-splashes-row">
                {palette.swatches.map((s, i) => {
                    const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(s.area / largest);
                    return (
                        <button
                            key={i}
                            type="button"
                            className="paint-splash"
                            aria-label={splashLabel(s)}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered(null)}
                            onFocus={() => setHovered(i)}
                            onBlur={() => setHovered(null)}
                            onClick={() => setPinned((p) => (p === i ? null : i))}
                        >
                            <svg width={2 * r} height={2 * r} viewBox={`0 0 ${2 * r} ${2 * r}`} aria-hidden="true">
                                <path d={splashPath(s.hex, r)} fill={s.hex} />
                            </svg>
                        </button>
                    );
                })}
            </div>
            <p className="paint-splash-note" aria-hidden="true">
                {shown !== null ? splashLabel(palette.swatches[shown]) : ''}
            </p>
        </div>
    );
}
