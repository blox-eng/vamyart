// The strip holds three identical copies `loop` px apart, so any scroll position
// can be swapped for one a whole copy away without a visible change.

// Where to jump (instantly) before moving by `delta`, so that both ends of the
// move stay inside [0, maxScroll] and a smooth scroll never hits an edge.
export function planMove(current: number, delta: number, loop: number, maxScroll: number): { start: number; target: number } {
    const lo = Math.max(0, -delta);
    const hi = maxScroll - Math.max(0, delta);
    let start = current;
    while (start < lo) start += loop;
    while (start > hi) start -= loop;
    return { start, target: start + delta };
}

// The equivalent position nearest the middle copy: furthest from both edges.
export function centerScroll(scrollLeft: number, loop: number, maxScroll: number): number {
    return scrollLeft + Math.round((maxScroll / 2 - scrollLeft) / loop) * loop;
}

export function shouldLoop(trackWidth: number, viewportWidth: number): boolean {
    return trackWidth > viewportWidth;
}

export const LANDING_WIDTHS = [400, 800, 1200, 1600, 2000];

// Mirrors the slider CSS: full width below 640px, otherwise a fixed height of
// 78svh minus the header, so the rendered width is that height times the aspect.
// Uses vh, not svh: vh >= svh, so it errs one candidate large on mobile at worst,
// and an unparsable svh entry would make browsers fall back to 100vw.
// The home page preload must use the same string, or the browser fetches twice.
export function landingImageSizes(aspect: number): string {
    return `(max-width: 639px) calc(100vw - 32px), calc((78vh - 72px) * ${Number(aspect.toFixed(3))})`;
}
