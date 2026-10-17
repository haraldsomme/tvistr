import type { Metadata } from "next";
import { HELT_BREV_UTEN_BETALING } from "@/lib/vipps/profil";
import { Sjekk } from "./sjekk";

export const metadata: Metadata = { title: "Sjekk saken din – Tvistr" };

// The free check and its verdict (sjekk.tsx). `?start` (the front page's buttons) opens it at question 1.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { start } = await searchParams;
  return <Sjekk utvikling={HELT_BREV_UTEN_BETALING()} fraStart={start !== undefined} />;
}
