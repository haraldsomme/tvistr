import type { Metadata } from "next";
import { HELT_BREV_UTEN_BETALING } from "@/lib/vipps/profil";
import { Sjekk } from "./sjekk";

export const metadata: Metadata = { title: "Sjekk saken din – Tvistr" };

// The free check and its verdict (sjekk.tsx).
export default function Page() {
  return <Sjekk utvikling={HELT_BREV_UTEN_BETALING()} />;
}
