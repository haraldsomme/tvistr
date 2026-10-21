import type { Metadata } from "next";
import { HELT_BREV_UTEN_BETALING } from "@/lib/vipps/profil";
import { Sjekk } from "./sjekk";

export const metadata: Metadata = { title: "Sjekk saken din – Tvistr" };

// The questions, the letter as they make it, and the verdict before payment (sjekk.tsx). `?start` (the
// front page's buttons) opens question 1 with the answers kept; `?ny` (the account menu) starts a new draft.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { start, ny } = await searchParams;
  return <Sjekk utvikling={HELT_BREV_UTEN_BETALING()} fraStart={start !== undefined} ny={ny !== undefined} />;
}
