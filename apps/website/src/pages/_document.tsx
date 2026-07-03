import { Html, Head, Main, NextScript } from 'next/document';
import { inter, cormorant } from '../lib/fonts';

// Apply the next/font CSS variables at the <html> root so the html/body
// font-family rules resolve them (see src/lib/fonts.ts).
export default function Document() {
    return (
        <Html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
            <Head />
            <body>
                <Main />
                <NextScript />
            </body>
        </Html>
    );
}
