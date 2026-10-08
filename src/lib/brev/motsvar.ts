import { norskDato, utenSluttegn } from "@/lib/brev/brev";
import type { Utfylling } from "@/lib/brev/utfylling";
import type { Faktorer } from "@/lib/vurdering/faktorer";

export type Motargument = { nokkel: "slitasje" | "forbehold" | "for_sent" | "oppsto_etter" | "kjent_feil"; tittel: string; svar: string; relevant: boolean };

// What to say when the dealer answers, the ones that fit the case first. The answers are rules, not
// model output; legal wording as in JURIDISK (brev.ts) and not yet reviewed by a lawyer. Pure, so the
// tab beside the letter builds it from the same answers as the letter.
export function motsvar(f: Faktorer, u: Utfylling): Motargument[] {
  // The words from the report the written letter quotes; else the buyer's transcript from before.
  const rapportSitat = u.brev?.utkast.sitater.find((x) => x.kilde === "rapport")?.tekst ?? u.rapport?.sitat;
  const mal: Motargument[] = [
    {
      nokkel: "forbehold",
      tittel: "«Bilen er solgt som den er»",
      // Before 2024 the reservation was valid, but the car is still defective when it is worse than the
      // buyer could expect (§ 17 as it read then); from 2024 a general reservation has no effect (§ 15 second paragraph).
      svar:
        f.presumsjonManeder === 6
          ? "Selv om bilen ble solgt «som den er», har den en mangel når den er i dårligere stand enn jeg med rimelighet hadde grunn til å forvente ut fra forbeholdet, kjøpesummen og forholdene ellers, jf. forbrukerkjøpsloven § 17 første ledd bokstav a slik den lød da vi inngikk avtalen."
          : "Et alminnelig forbehold om at bilen selges «som den er», har ingen virkning overfor en forbruker, jf. § 3. Bare et avvik jeg ble spesielt opplyst om og uttrykkelig og særskilt godtok, kan gjøres gjeldende mot meg, jf. § 15 andre ledd.",
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
        : `${u.rapport ? `Rapporten fra ${u.rapport.fra} datert ${norskDato(u.rapport.dato)} ${rapportSitat ? `sier: «${utenSluttegn(rapportSitat)}». ` : "viser at feilen var til stede ved levering. "}` : "Jeg har dokumentasjon på at feilen har en årsak som var til stede ved levering. "}Be forhandleren legge fram sin dokumentasjon for at feilen oppsto senere.`,
      relevant: !f.presumsjon || f.rapportSierForKjop === false,
    },
    {
      nokkel: "kjent_feil",
      tittel: "«Du visste om feilen»",
      svar:
        f.presumsjonManeder === 24
          ? "Det er ikke nok at jeg kjente til feilen. Bare et avvik jeg ble spesielt opplyst om og uttrykkelig og særskilt godtok, kan holdes mot meg, jf. § 15 andre ledd. Det har dere ikke vist."
          : "Det som ble opplyst før kjøpet, svarte ikke til det jeg faktisk fikk. Feilen er mer omfattende enn det jeg kjente til, og jeg viser til annonsen og meldingene som viser hva som ble sagt.",
      relevant: f.opplyst !== "nei",
    },
  ];
  return [...mal.filter((m) => m.relevant), ...mal.filter((m) => !m.relevant)];
}
