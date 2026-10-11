// Tailwind preset for both apps: maps utilities onto the CSS custom properties in
// src/styles/tokens.css. Rules live in DESIGN.md.

// Lets opacity modifiers (bg-ink/50) work on CSS-variable colours.
const token = (name) => `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
    theme: {
        extend: {
            colors: {
                paper: token('--bg'),
                field: token('--field'),
                wall: token('--wall'),
                ink: token('--text'),
                muted: token('--muted'),
                faint: token('--faint'),
                hair: 'var(--hair)',
                'hair-soft': 'var(--hair-soft)',
                hover: 'var(--hover-wash)',
                accent: token('--accent'),
                'accent-wash': 'var(--accent-wash)',
                'on-accent': token('--on-accent'),
                warn: token('--warn'),
                neg: token('--neg')
            },
            borderColor: {
                DEFAULT: 'var(--hair)'
            },
            ringColor: {
                DEFAULT: token('--accent')
            },
            fontFamily: {
                sans: ['var(--font-inter)', 'ui-sans-serif', 'sans-serif'],
                serif: ['var(--font-cormorant)', 'Georgia', 'serif']
            },
            borderRadius: {
                xs: 'var(--radius-xs)',
                sm: 'var(--radius-sm)',
                DEFAULT: 'var(--radius-sm)',
                md: 'var(--radius-md)',
                lg: 'var(--radius-md)',
                xl: 'var(--radius-lg)',
                '2xl': 'var(--radius-lg)',
                '3xl': 'var(--radius-lg)'
            },
            transitionDuration: {
                DEFAULT: 'var(--dur-standard)',
                micro: 'var(--dur-micro)',
                standard: 'var(--dur-standard)',
                deliberate: 'var(--dur-deliberate)',
                reveal: 'var(--dur-reveal)'
            },
            transitionTimingFunction: {
                DEFAULT: 'var(--ease)'
            },
            boxShadow: {
                float: '0 0 0 1px var(--hair), 0 8px 24px -12px rgb(0 0 0 / 0.18)'
            }
        }
    }
};
