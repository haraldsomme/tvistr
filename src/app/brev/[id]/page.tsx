import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hentSak } from "@/lib/brev/sak";
import { beregnFaktorer, iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput, tilParametre } from "@/lib/vurdering/innsending";
import { BrevSide } from "../brevside";

// The address is the key to the case, so it must not leak: no indexing, and no referrer to other sites.
export const metadata: Metadata = { title: "Reklamasjonsbrevet – Tvistr", robots: { index: false }, referrer: "no-referrer" };

// The letter is written from the case: the answers from the assessment and what the buyer has
// filled in here. When the answers no longer give a letter (the deadline to complain has passed
// since the case was opened), the buyer goes back to the assessment.
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const sak = await hentSak(id);
  if (!sak) notFound();

  const tilVurdering = `/vurdering?${tilParametre(sak.svar)}&sak=${sak.id}`;
  const parsed = tilKlageInput(sak.svar);
  if (!parsed.ok || beregnFaktorer(parsed.input).fristUte) redirect(tilVurdering);

  return <BrevSide id={sak.id} input={parsed.input} idag={iDag()} tilbakeHref={tilVurdering} startUtfylling={sak.utfylling} />;
}
