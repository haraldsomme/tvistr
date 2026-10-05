import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hentSak } from "@/lib/brev/sak";
import { iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { BrevSide } from "../brevside";

// The address is the key to the case, so it must not leak: no indexing, and no referrer to other sites.
export const metadata: Metadata = { title: "Reklamasjonsbrevet – Tvistr", robots: { index: false }, referrer: "no-referrer" };

// The letter is written from the case: the answers from the assessment and what the buyer has
// filled in here. A case exists only once the letter is bought, so the page always shows it, even
// when a correction has made the deadline to complain pass: the page says so, and the buyer decides.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sak = await hentSak(id);
  if (!sak) notFound();
  const idag = iDag();
  // Until the buyer has been through the wizard after buying once, the link opens the wizard. Answers
  // that no longer give a letter are corrected here first (the wizard sends them back here).
  if (!sak.utfylling.gjennomgatt && tilKlageInput(sak.svar, idag).ok) redirect(`/brev/${sak.id}/veiviser`);

  return <BrevSide id={sak.id} startSvar={sak.svar} idag={idag} startUtfylling={sak.utfylling} />;
}
