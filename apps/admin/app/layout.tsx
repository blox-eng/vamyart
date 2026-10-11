import type { Metadata } from "next";
import "@vamy/ui/tokens.css";
import "./globals.css";
import { Providers } from "./providers";
import { inter, cormorant } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "Maeve Studio",
  robots: "noindex, nofollow",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${cormorant.variable}`}>
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
