import type { Metadata } from "next";
import { Geist, IBM_Plex_Mono, IBM_Plex_Sans, Instrument_Sans, JetBrains_Mono, Manrope, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"] });
const plex = IBM_Plex_Sans({ variable: "--font-plex", subsets: ["latin"], weight: ["400", "500", "600"] });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin"], weight: ["400", "500"] });
const vipps = Manrope({ variable: "--font-manrope", subsets: ["latin"], weight: ["700"] });
// The form on /sak.
const instrument = Instrument_Sans({ variable: "--font-instrument", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jbmono = JetBrains_Mono({ variable: "--font-jbmono", subsets: ["latin"], weight: ["500", "600"] });

export const metadata: Metadata = {
  title: "tvistr",
  description: "",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="nb" className={`${geistSans.variable} ${serif.variable} ${plex.variable} ${plexMono.variable} ${vipps.variable} ${instrument.variable} ${jbmono.variable}`}>
      <body className="flex min-h-screen flex-col antialiased">
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
