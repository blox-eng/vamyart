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

// 2400 covers a landscape piece at ~85svh on a 2× phone and a 2× laptop screen.
export const LANDING_WIDTHS = [400, 800, 1200, 1600, 2000, 2400];

// Mirrors the slider CSS: every image is the screen height minus the slim header,
// the top gap, the caption block and the bottom margin (136px on phones, 144px
// above 640px), so its rendered width is that height times the aspect.
// Uses vh, not svh: vh >= svh, so it errs one candidate large on mobile at worst,
// and an unparsable svh entry would make browsers fall back to 100vw.
// The home page preload must use the same string, or the browser fetches twice.
export function landingImageSizes(aspect: number): string {
    const a = Number(aspect.toFixed(3));
    return `(max-width: 639px) calc((100vh - 136px) * ${a}), calc((100vh - 144px) * ${a})`;
}
