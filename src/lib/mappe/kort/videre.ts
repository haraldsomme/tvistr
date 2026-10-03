import { SVARFRIST_DAGER } from "@/lib/brev/brev";
import type { Utfylling } from "@/lib/brev/utfylling";
import type { Faktorer } from "@/lib/vurdering/faktorer";
import { TID_TIL_VEDTAK } from "@/lib/vurdering/tid";

export type Steg = { dato: string | null; tittel: string; tekst: string };
export type Motargument = { nokkel: "slitasje" | "forbehold" | "for_sent" | "oppsto_etter" | "kjent_feil"; tittel: string; svar: string; relevant: boolean };
export type VidereKort = { frist: string; steg: Steg[]; motargumenter: Motargument[]; ventetid: string };

export const PURRING_DAGER = 7;

export function leggTilDager(iso: string, dager: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dager);
  return d.toISOString().slice(0, 10);
}

// What happens after the letter is sent, and what to say when the dealer answers. The answers are
// rules, not model output; legal wording as in JURIDISK (brev.ts) and not yet reviewed by a lawyer.
export function videreKort(f: Faktorer, u: Utfylling, idag: string): VidereKort {
  const brevdato = u.sendt ?? idag;
  const frist = leggTilDager(brevdato, SVARFRIST_DAGER);
  const steg: Steg[] = [
    {
      dato: u.sendt ?? null,
      tittel: "Send brevet",
      tekst: "Send det skriftlig og behold dokumentasjon på at det er sendt (e-post med lesebekreftelse, eller rekommandert brev). Fyll inn datoen du sendte det under, så får du en purring med riktige datoer.",
    },
    { dato: frist, tittel: "Svarfrist for forhandleren", tekst: `Brevet gir forhandleren ${SVARFRIST_DAGER} dager til å svare.` },
    {
      dato: null,
      tittel: "Ingen svar eller avvist",
      tekst: `Send purringen, med ${PURRING_DAGER} dager til ny frist. Svarer forhandleren fortsatt ikke, eller avviser kravet, kan du bringe saken inn for Forbrukerklageutvalget.`,
    },
    { dato: null, tittel: "Forbrukerklageutvalget", tekst: "Se forbrukertilsynet.no for hvordan du klager. Ta med brevet, svaret fra forhandleren og dokumentasjonen." },
  ];
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
        : "Jeg har dokumentasjon på at feilen har en årsak som var til stede ved levering. Be forhandleren legge fram sin dokumentasjon for at feilen oppsto senere.",
      relevant: !f.presumsjon || f.rapportSierForKjop === false,
    },
    {
      nokkel: "kjent_feil",
      tittel: "«Du visste om feilen»",
      svar: "Det som ble opplyst før kjøpet, svarte ikke til det jeg faktisk fikk. Jeg viser til annonsen og meldingene som viser hva som ble sagt.",
      relevant: f.opplystForKjop === "ja",
    },
  ];
  return { frist, steg, motargumenter: [...mal.filter((m) => m.relevant), ...mal.filter((m) => !m.relevant)], ventetid: TID_TIL_VEDTAK };
}
