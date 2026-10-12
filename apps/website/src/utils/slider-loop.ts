export function wrapScroll(scrollLeft: number, loopWidth: number): number {
    return scrollLeft >= loopWidth ? scrollLeft - loopWidth : scrollLeft;
}

export function shouldLoop(trackWidth: number, viewportWidth: number): boolean {
    return trackWidth > viewportWidth;
}

export const LANDING_WIDTHS = [400, 800, 1200, 1600, 2000];

// Mirrors the slider CSS: full width below 640px, otherwise a fixed height of
// 78vh minus the header, so the rendered width is that height times the aspect.
// The home page preload must use the same string, or the browser fetches twice.
export function landingImageSizes(aspect: number): string {
    return `(max-width: 639px) calc(100vw - 32px), calc((78vh - 72px) * ${Number(aspect.toFixed(3))})`;
}
