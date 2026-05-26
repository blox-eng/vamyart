export type NetlifyImageOpts = {
    width: number;
    height?: number;
    quality?: number;
    fit?: 'cover' | 'contain' | 'fill';
};

const DEFAULT_WIDTHS = [400, 800, 1200, 1600];

// SVGs don't raster-transform, data URIs are inline, and an already-rewritten URL
// must not be double-wrapped. The placeholder fallback is an SVG, so it falls here too.
function isTransformable(src: string): boolean {
    if (!src) return false;
    if (src.startsWith('data:')) return false;
    if (src.startsWith('/.netlify/images')) return false;
    const pathOnly = src.split(/[?#]/)[0];
    if (pathOnly.toLowerCase().endsWith('.svg')) return false;
    return true;
}

// Pure: always builds the URL (or passes through). No environment checks — unit-tested directly.
export function buildNetlifyImageUrl(src: string, opts: NetlifyImageOpts): string {
    if (!isTransformable(src)) return src;
    const { width, height, quality = 75, fit = 'cover' } = opts;
    const parts = [`url=${encodeURIComponent(src)}`, `w=${width}`];
    if (height != null) {
        parts.push(`h=${height}`, `fit=${fit}`);
    }
    parts.push(`q=${quality}`);
    return `/.netlify/images?${parts.join('&')}`;
}

// Optimize only on Netlify (production builds) and never inside the Stackbit visual editor,
// where rewriting `src` would break inline-edit field mapping. `next dev` and Vitest no-op.
// `process.env.stackbitPreview` is the build-inlined alias of STACKBIT_PREVIEW (see next.config.js).
function optimizationEnabled(): boolean {
    return process.env.NODE_ENV === 'production' && !process.env.stackbitPreview;
}

export function netlifyImage(src: string, opts: NetlifyImageOpts): string {
    if (!optimizationEnabled()) return src;
    return buildNetlifyImageUrl(src, opts);
}

export function netlifyImageSrcSet(
    src: string,
    widths: number[] = DEFAULT_WIDTHS,
    opts: Omit<NetlifyImageOpts, 'width'> = {}
): string {
    if (!optimizationEnabled() || !isTransformable(src)) return '';
    return widths.map((w) => `${buildNetlifyImageUrl(src, { ...opts, width: w })} ${w}w`).join(', ');
}
