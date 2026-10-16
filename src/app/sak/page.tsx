import type { Metadata } from "next";
import { Sjekk } from "./sjekk";

export const metadata: Metadata = { title: "Sjekk saken din – Tvistr" };

// The free check and its verdict (sjekk.tsx).
export default function Page() {
  return <Sjekk />;
}
