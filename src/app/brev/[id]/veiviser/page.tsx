import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { hentSak } from "@/lib/brev/sak";
import { hentKjoretoy } from "@/lib/kjoretoy/vegvesen";
import { iDag } from "@/lib/vurdering/faktorer";
import { gyldigKjopsdato, kjopsalderAv, tilKlageInput } from "@/lib/vurdering/innsending";
import { STEG_IDER, type StegId } from "../../steg/liste";
import { Veiviser } from "../../veiviser/veiviser";

// The address is the key to the case, so it must not leak: no indexing, and no referrer to other sites.
export const metadata: Metadata = { title: "Brevet ditt – Tvistr", robots: { index: false }, referrer: "no-referrer" };

// The registry's day for the current owner, as a suggestion for the purchase date (not stored). It is
// dropped when it does not fit the answer the buyer gave to «hvor lenge siden».
async function kjopsdatoFraRegisteret(regnr: string | undefined, kjopAlder: string, idag: string): Promise<string | null> {
  if (!regnr) return null;
  try {
    const oppslag = await hentKjoretoy(regnr);
    if (!oppslag.ok || !oppslag.eierFra || !gyldigKjopsdato(oppslag.eierFra, idag)) return null;
    const alder = kjopsalderAv({ kjopsdato: oppslag.eierFra, kjopAlder: "" }, idag);
    return kjopAlder === "" || kjopAlder === alder ? oppslag.eierFra : null;
  } catch {
    return null;
  }
}

const erStegId = (v: unknown): v is StegId => typeof v === "string" && (STEG_IDER as readonly string[]).includes(v);

// The wizard after buying: every fill-in step, one per screen, before the letter is shown. `?steg=`
// opens one step; with `&tilbake=brev` it shows only that step and goes back to the letter after.
// Answers that no longer give a letter are corrected on the letter page.
export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const { id } = await params;
  const { steg, tilbake } = await searchParams;
  const sak = await hentSak(id);
  if (!sak) notFound();
  const idag = iDag();
  if (!tilKlageInput(sak.svar, idag).ok) redirect(`/brev/${sak.id}`);

  const forslagKjopsdato = gyldigKjopsdato(sak.svar.kjopsdato, idag) ? null : await kjopsdatoFraRegisteret(sak.utfylling.kjoretoy?.regnr, sak.svar.kjopAlder, idag);
  const startSteg = erStegId(steg) ? steg : null;

  return (
    <Veiviser
      id={sak.id}
      startSvar={sak.svar}
      startUtfylling={sak.utfylling}
      idag={idag}
      forslagKjopsdato={forslagKjopsdato}
      startSteg={startSteg}
      // A case not yet gone through the wizard goes through all of it, even from an old link to one step.
      tilbakeTilBrev={startSteg !== null && tilbake === "brev" && sak.utfylling.gjennomgatt === true}
    />
  );
}
