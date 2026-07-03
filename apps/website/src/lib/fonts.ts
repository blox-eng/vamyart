import { Inter, Cormorant_Garamond } from 'next/font/google';

// Self-hosted at build time (same-origin, auto-preloaded, font-display: swap) —
// replaces the render-blocking Google Fonts @import. The variable class names
// are applied to <Html> in _document so the html/body font-family rules
// (Tailwind preflight + addBase plugin) can resolve them; CSS custom
// properties only inherit downward, so they must be defined at the root.
// Add 'cyrillic' to both subsets arrays when the BG locale ships.
export const inter = Inter({
    subsets: ['latin'],
    weight: ['400', '500', '700'],
    display: 'swap',
    variable: '--font-inter'
});

export const cormorant = Cormorant_Garamond({
    subsets: ['latin'],
    weight: ['300', '400', '600'],
    style: ['normal', 'italic'],
    display: 'swap',
    variable: '--font-cormorant'
});
