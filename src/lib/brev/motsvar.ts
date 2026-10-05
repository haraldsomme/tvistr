import { norskDato, utenSluttegn } from "@/lib/brev/brev";
import type { Utfylling } from "@/lib/brev/utfylling";
import type { Faktorer } from "@/lib/vurdering/faktorer";

export type Motargument = { nokkel: "slitasje" | "forbehold" | "for_sent" | "oppsto_etter" | "kjent_feil"; tittel: string; svar: string; relevant: boolean };

// What to say when the dealer answers, the ones that fit the case first. The answers are rules, not
// model output; legal wording as in JURIDISK (brev.ts) and not yet reviewed by a lawyer. Pure, so the
// tab beside the letter builds it from the same answers as the letter.
export function motsvar(f: Faktorer, u: Utfylling): Motargument[] {
  const mal: Motargument[] = [
    {
      nokkel: "forbehold",
      tittel: "«Bilen er solgt som den er»",
      svar: "Et forbehold om at bilen selges «som den er» kan ikke innskrenke rettighetene til en forbruker etter forbrukerkjøpsloven, jf. § 3. Bilen skal svare til det som er avtalt og det jeg kunne forvente.",
      relevant: u.forbehold === "som_den_er",
    },
    {
      nokkel: "slitasje",
      tittel: "«Dette er normal slitasje»",
      svar: "Jeg bestrider at feilen er normal slitasje for en bil av denne alderen og kilometerstanden. Be forhandleren dokumentere påstanden, og vis til verkstedets vurdering av årsaken hvis du har en.",
      relevant: f.slitasjeAktuelt && f.lavForventning !== null,
    },
    {
      nokkel: "for_sent",
      tittel: "«Du har reklamert for sent»",
      svar: "Jeg reklamerte innen rimelig tid etter at jeg oppdaget feilen, jf. § 27. En reklamasjon innen to måneder fra jeg oppdaget feilen er alltid i tide.",
      relevant: f.reklamertForSent,
    },
    {
      nokkel: "oppsto_etter",
      tittel: "«Feilen oppsto etter kjøpet»",
      svar: f.presumsjon
        ? `Feilen viste seg innen ${f.presumsjonManeder === 24 ? "to år" : "seks måneder"} etter levering. Etter § 18 antas den da å ha eksistert ved leveringen, og det er forhandleren som må bevise noe annet.`
        : `${u.rapport ? `Rapporten fra ${u.rapport.fra} datert ${norskDato(u.rapport.dato)} sier: «${utenSluttegn(u.rapport.sitat)}». ` : "Jeg har dokumentasjon på at feilen har en årsak som var til stede ved levering. "}Be forhandleren legge fram sin dokumentasjon for at feilen oppsto senere.`,
      relevant: !f.presumsjon || f.rapportSierForKjop === false,
    },
    {
      nokkel: "kjent_feil",
      tittel: "«Du visste om feilen»",
      svar: "Det som ble opplyst før kjøpet, svarte ikke til det jeg faktisk fikk. Jeg viser til annonsen og meldingene som viser hva som ble sagt.",
      relevant: f.opplystForKjop === "ja",
    },
  ];
  return [...mal.filter((m) => m.relevant), ...mal.filter((m) => !m.relevant)];
}
