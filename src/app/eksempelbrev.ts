import type { Presedens } from "@/lib/app/brev";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { avsnittA, type Malvedtak } from "@/lib/vedtaksvalg/mal";

// The excerpt of the letter on the landing page. Every sentence is one the letter writes for the example
// case (eksempelbrev.test.ts checks it), but the decision is made up: its number and the committee's
// quote are shown blacked out, so nothing is put in the committee's mouth and no real case is used.

export const SAKSNR = "SAKSNR";
export const SITAT = "SITAT";

const VEDTAK: Malvedtak = {
  utvalg: "Forbrukerklageutvalget",
  saksnummer: SAKSNR,
  vedtaksdato: null,
  bil: "brukt elbil",
  merke: null,
  modell: null,
  arsmodell: null,
  km: 72000,
  alder: 7,
  somDenEr: false,
};

export const KJOPERBIL = { km: 38500, alder: 4, somDenEr: false };

const treff = { km: "mildere", alder: "mildere", som_den_er: "likt" } as Record<Kriterium, Treff>;

export function eksempelPresedens(): Presedens {
  return {
    id: 0,
    saksnummer: SAKSNR,
    vedtaksdato: null,
    bil: VEDTAK.bil!,
    utfall: ["heving"],
    avsnitt: avsnittA(VEDTAK, "kapasitet og rekkevidde", [SITAT], ["heving"], KJOPERBIL),
    kildeUrl: null,
    utvalg: VEDTAK.utvalg,
    anbefalt: true,
    niva: "A",
    gjaldt: "kapasitet og rekkevidde",
    km: VEDTAK.km,
    alder: VEDTAK.alder,
    somDenEr: VEDTAK.somDenEr,
    likhet: 0,
    treff,
  };
}

export type Del = { overskrift?: string; merke?: string; setninger: string[] };

export const DATO = "Oslo, 16. oktober 2026";
export const EMNE = "Reklamasjon på mangel ved Volkswagen ID.4, reg.nr. AB 12345";

export const UTDRAG: Del[] = [
  {
    overskrift: "Rettslig grunnlag",
    merke: "Regler etter kjøpsdatoen",
    setninger: [
      "Etter § 18 annet ledd skal en mangel som viser seg innen to år etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.",
      "Det er dermed dere som må bevise at feilen ikke var til stede da jeg overtok bilen.",
    ],
  },
  {
    overskrift: "Praksis fra Forbrukerklageutvalget",
    merke: "Vunnet sak",
    setninger: [
      `Det vises til Forbrukerklageutvalgets vedtak i sak ${SAKSNR}.`,
      "Saken gjaldt kapasitet og rekkevidde på en brukt elbil som hadde gått 72 000 km ved kjøpet.",
      `Utvalget uttalte: «${SITAT}».`,
      "Kjøperen fikk medhold i krav om heving.",
      "Bilen i foreliggende sak var yngre (4 mot 7 år) og hadde gått kortere (38 500 mot 72 000 km).",
      "Bilen i min sak var ikke i et svakere utgangspunkt.",
    ],
  },
  {
    overskrift: "Krav",
    merke: "Fra svarene dine",
    setninger: [
      "Mitt krav er at mangelen rettes, jf. §§ 29 og 30.",
      "Dersom retting ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, vil jeg subsidiært kreve å heve kjøpet, jf. § 32.",
    ],
  },
];

export const RESTEN = "+ mangelen, utgifter, svarfrist, neste steg og vedlegg";
