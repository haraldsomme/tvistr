import type { Presedens } from "@/lib/app/brev";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { avsnittB, type Malvedtak } from "@/lib/vedtaksvalg/mal";

// The excerpts of the letter on the landing page. Every sentence in them is one the letter writes for
// the example case (eksempelbrev.test.ts checks it). The buyer is made up, but the decision is real:
// FKU-2026-104368, as it stands in the table `vedtak`. Its number, date, link and the quote are copied
// from there (avgjorende-v5, `rettslige_sitater`, checked against the full text on import).

export const VEDTAK_URL = "https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2026-104368.pdf";

const HEVING_SITAT = "Utvalget finner at vilkårene for heving etter fkjl. § 32 er oppfylt og viser til at reparasjonskostnaden nærmer seg nesten hele bilens kjøpesum.";

const VEDTAK: Malvedtak = {
  utvalg: "Forbrukerklageutvalget",
  saksnummer: "FKU-2026-104368",
  vedtaksdato: "2026-02-02",
  bil: "Renault Twizy 2017-modell",
  merke: "Renault",
  modell: "Twizy",
  arsmodell: 2017,
  km: 2079,
  alder: 5,
  somDenEr: null,
};

const KOMPONENT = "el-motor og girkasse";

// Level B: the decision settled a legal point in the buyer's case (heving, § 32), not the same defect.
// The treff are the real ones: the Twizy had gone 2 079 km against the buyer's 38 500 and the decision
// does not say whether it was sold «som den er», so the letter's conclusion makes no claim that the
// buyer's car was as well placed.
const treff = { km: "mildere", alder: "mildere", som_den_er: "ukjent" } as Record<Kriterium, Treff>;

export function eksempelPresedens(): Presedens {
  return {
    id: 0,
    saksnummer: VEDTAK.saksnummer,
    vedtaksdato: VEDTAK.vedtaksdato,
    bil: VEDTAK.bil!,
    utfall: ["heving"],
    avsnitt: avsnittB(VEDTAK, KOMPONENT, HEVING_SITAT),
    kildeUrl: VEDTAK_URL,
    utvalg: VEDTAK.utvalg,
    anbefalt: true,
    niva: "B",
    gjaldt: KOMPONENT,
    km: VEDTAK.km,
    alder: VEDTAK.alder,
    somDenEr: VEDTAK.somDenEr,
    likhet: 0,
    treff,
  };
}

export const DATO = "Oslo, 16. oktober 2026";
export const EMNE = "Reklamasjon på mangel ved Volkswagen ID.4, reg.nr. AB 12345";

// One tab in the card: the letter's own sentences (`setninger`), the phrases to highlight in them
// (`merk`) and a line that says what the excerpt does for the buyer.
export type Fane = {
  id: string;
  navn: string;
  overskrift: string;
  setninger: string[];
  merk: string[];
  forklaring: string;
  lenke?: string;
};

export const FANER: Fane[] = [
  {
    id: "bevisbyrden",
    navn: "Bevisbyrden",
    overskrift: "Rettslig grunnlag",
    setninger: [
      "Etter § 18 annet ledd skal en mangel som viser seg innen to år etter leveringen, formodes å ha eksistert ved leveringen, med mindre noe annet bevises.",
      "Det er dermed dere som må bevise at feilen ikke var til stede da jeg overtok bilen.",
    ],
    merk: ["§ 18 annet ledd"],
    forklaring: "Brevet legger bevisbyrden der loven legger den: hos forhandleren.",
  },
  {
    id: "kravet",
    navn: "Kravet",
    overskrift: "Krav",
    setninger: [
      "Mitt krav er at mangelen rettes, jf. §§ 29 og 30.",
      "Dersom retting ikke skjer innen rimelig tid, ikke lykkes eller ikke er mulig, vil jeg subsidiært kreve å heve kjøpet, jf. § 32.",
    ],
    merk: ["§§ 29 og 30", "§ 32"],
    forklaring: "Kravet ditt med riktig hjemmel og et reservekrav hvis rettingen ikke lykkes.",
  },
  {
    id: "vunnet",
    navn: "Vunnet sak",
    overskrift: "Praksis fra Forbrukerklageutvalget",
    setninger: [eksempelPresedens().avsnitt, "Vedtaket avgjør det samme rettslige spørsmålet som denne saken reiser.", "Min sak bør vurderes på samme måte."],
    merk: ["sak 104368", "fkjl. § 32"],
    forklaring: "Henvisning til en vunnet avgjørelse fra Forbrukerklageutvalget, og argumentasjon for hvorfor din sak står like sterkt.",
    lenke: VEDTAK_URL,
  },
];
