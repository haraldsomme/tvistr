import type { Metadata } from "next";
import { Barlow_Condensed, Geist, Geist_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const geist = Geist({ variable: "--font-geist", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], weight: ["400", "500"] });
// The letter.
const serif = Source_Serif_4({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "600"] });
// The registration plate.
const plate = Barlow_Condensed({ variable: "--font-plate", subsets: ["latin"], weight: ["600"] });

export const metadata: Metadata = {
  title: "tvistr",
  description: "Sjekk gratis om du har en sak mot bilforhandleren, og få et ferdig reklamasjonsbrev.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb" data-scroll-behavior="smooth" className={`${geist.variable} ${geistMono.variable} ${serif.variable} ${plate.variable}`}>
      <body>{children}</body>
    </html>
  );
}
