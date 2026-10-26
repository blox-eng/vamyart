import * as React from 'react';
import { isPale, recipeText, splashShape } from '@vamy/palette/display';
import type { Palette, Swatch } from '@vamy/palette';

const MIN_RADIUS = 10;
const MAX_RADIUS = 19;
const MIN_AREA = 0.02;

export function splashLabel(swatch: Swatch): string {
    const name = swatch.name.trim();
    const recipe = swatch.recipe ? recipeText(swatch.recipe) : '';
    if (name && recipe) return `${name} — ${recipe}`;
    return name || recipe || swatch.hex;
}

const edge = (hex: string) => (isPale(hex) ? `color-mix(in oklab, ${hex} 85%, black)` : undefined);

// The piece's palette as knife smears of paint under the painting, folded away
// behind a quiet "Palette" line until a visitor asks for it. Hover, focus or tap
// a smear for its name and mixing recipe. Fills are the exact colours: no
// opacity, filters or shadows that would shift them.
export function PaintSplashes({ palette }: { palette: Palette }) {
    const [open, setOpen] = React.useState(false);
    const [hovered, setHovered] = React.useState<number | null>(null);
    const [pinned, setPinned] = React.useState<number | null>(null);
    const panelId = React.useId();
    const shown = hovered ?? pinned;
    const swatch = shown !== null ? palette.swatches[shown] : null;
    const largest = Math.max(...palette.swatches.map((s) => s.area)) || 1;

    return (
        <div className="paint-palette">
            <button type="button" className="paint-palette-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen((o) => !o)}>
                <span>Palette</span>
                <span className="paint-palette-dots" aria-hidden="true">
                    {palette.swatches.map((s, i) => (
                        <i key={i} style={{ background: s.hex, borderColor: edge(s.hex) ?? s.hex }} />
                    ))}
                </span>
                <span className="paint-palette-sign" aria-hidden="true" />
            </button>
            <div id={panelId} className="paint-splashes" role="group" aria-label="Palette" hidden={!open} onKeyDown={(e) => e.key === 'Escape' && setPinned(null)}>
                <div className="paint-splashes-row">
                    {palette.swatches.map((s, i) => {
                        const r = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(Math.max(s.area, MIN_AREA) / largest);
                        const { width, height, d } = splashShape(s.hex + i, r);
                        const stroke = edge(s.hex);
                        return (
                            <button
                                key={i}
                                type="button"
                                className="paint-splash"
                                aria-label={splashLabel(s)}
                                aria-pressed={pinned === i}
                                onMouseEnter={() => setHovered(i)}
                                onMouseLeave={() => setHovered(null)}
                                onFocus={() => setHovered(i)}
                                onBlur={() => setHovered(null)}
                                onClick={() => setPinned((p) => (p === i ? null : i))}
                            >
                                <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} overflow="visible" aria-hidden="true">
                                    <path d={d} fill={s.hex} style={stroke ? { stroke, strokeWidth: 1, vectorEffect: 'non-scaling-stroke' } : undefined} />
                                </svg>
                            </button>
                        );
                    })}
                </div>
                <p className="paint-splash-note" aria-hidden="true">
                    {swatch && (
                        <>
                            {swatch.name.trim() && <b>{swatch.name.trim()}</b>}
                            {swatch.recipe ? recipeText(swatch.recipe) : ''}
                        </>
                    )}
                </p>
            </div>
        </div>
    );
}
