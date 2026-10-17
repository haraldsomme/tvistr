// The paragraphs the letter cites, one table per version of the Consumer Purchases Act
// (forbrukerkjøpsloven, LOV-2002-06-21-34). The letter never writes a paragraph number anywhere
// else: a template asks for a point («mangel, uriktig opplysning») and gets the number for the
// version that applies to the purchase.
//
// Checked 2026-10-13 against primary sources, not from memory:
//   etter_2024  Stortinget, Lovvedtak 97 (2022–2023), the text of §§ 15–18 and 27–33 as passed
//               (stortinget.no/globalassets/pdf/lovvedtak/2022-2023/vedtak-202223-097.pdf), and
//               the consolidated law on lovdata.no/lov/2002-06-21-34 (latest amendment in force:
//               LOV-2024-06-14-32), which has the same §§ 15 annet ledd, 16, 18 annet ledd and 27.
//   før_2024    Prop. 49 LS (2022–2023), which describes the law as it stood: § 16 første ledd
//               bokstav b and c (kap. 10.1.1), § 17 første ledd bokstav a «som den er», § 18 annet
//               ledd with six months, § 27 and §§ 29–33 unchanged in number (comments «Til § 27» etc.).
//               Lovdata only serves the current text.
//   § 28 and § 50  lovdata.no 2026-10-17: § 28 has no amendment note; § 50 was amended by lov 16 juni
//               2023 nr. 60 (in force 1 January 2024). Its annet ledd now reads: «Dersom selgeren skal
//               betale kjøpesummen tilbake, plikter selgeren å betale renter etter lov 17. desember 1976
//               nr. 100 om renter ved forsinket betaling m.m. fra den dag forbrukeren reklamerte på
//               mangelen.» The number is the same before 2024, but the day the interest runs from is
//               verified for the current text only (RENTER_FRA_REKLAMASJON).
// Applies to contracts made from 1 January 2024.
//
// A point with no certain number is `null`: the letter then names «forbrukerkjøpsloven» alone and
// the point would be a known gap. None is a gap today.

export type Lovversjon = "før_2024" | "etter_2024";

export const POENG = [
  "krav", // what the thing must be like
  "avtale", // what the thing must be like: what follows from the contract
  "avvik", // defect: not as § 15 requires
  "tilbakeholdt", // defect: the seller kept back information
  "uriktig", // defect: the thing does not match what the seller said
  "forbehold", // what a reservation like «som den er» does
  "formodning", // a defect that shows itself early is presumed to have existed at delivery
  "garanti",
  "reklamasjon", // notice of a defect
  "reklamasjon_frister", // the two limits together, as the form's notices name them
  "reklamasjon_2ar", // the two-year limit
  "reklamasjon_5ar", // the five-year limit
  "retting",
  "prisavslag",
  "heving",
  "erstatning",
  "tilbakehold", // the buyer may hold back payment to cover the claim
  "renter_heving", // interest on the purchase price the seller repays
] as const;
export type Poeng = (typeof POENG)[number];

export const PARAGRAFER: Record<Lovversjon, Record<Poeng, string | null>> = {
  før_2024: {
    krav: "§ 15",
    avtale: "§ 15 første ledd",
    avvik: "§ 16 første ledd bokstav a",
    tilbakeholdt: "§ 16 første ledd bokstav b",
    uriktig: "§ 16 første ledd bokstav c",
    forbehold: "§ 17 første ledd bokstav a",
    formodning: "§ 18 annet ledd",
    // Not cited as the ground of a defect: a warranty not delivered is a breach of the contract
    // (avtale, avvik) and of what the seller said (uriktig). Kept for the table's completeness.
    garanti: "§ 18 a",
    reklamasjon: "§ 27 første ledd",
    reklamasjon_frister: "§ 27 annet ledd",
    reklamasjon_2ar: "§ 27 annet ledd første punktum",
    reklamasjon_5ar: "§ 27 annet ledd annet punktum",
    retting: "§§ 29 og 30",
    prisavslag: "§ 31",
    heving: "§ 32",
    erstatning: "§ 33",
    tilbakehold: "§ 28",
    renter_heving: "§ 50 annet ledd",
  },
  etter_2024: {
    krav: "§ 15",
    avtale: "§ 15 første ledd",
    avvik: "§ 16 første ledd bokstav a",
    tilbakeholdt: "§ 16 første ledd bokstav b",
    uriktig: "§ 16 første ledd bokstav c",
    // § 17 is now about wrong installation. A reservation is an agreed exception only under § 15
    // annet ledd.
    forbehold: "§ 15 annet ledd",
    formodning: "§ 18 annet ledd",
    garanti: "§ 18 a",
    reklamasjon: "§ 27 første ledd",
    reklamasjon_frister: "§ 27 annet ledd",
    reklamasjon_2ar: "§ 27 annet ledd første punktum",
    reklamasjon_5ar: "§ 27 annet ledd annet punktum",
    retting: "§§ 29 og 30",
    prisavslag: "§ 31",
    heving: "§ 32",
    erstatning: "§ 33",
    tilbakehold: "§ 28",
    renter_heving: "§ 50 annet ledd",
  },
};

// Whether § 50 annet ledd is verified to run the interest from the day the buyer complained. Only for
// the current text; before 2024 the letter claims the interest without a starting day.
export const RENTER_FRA_REKLAMASJON: Record<Lovversjon, boolean> = { før_2024: false, etter_2024: true };

// Provisions in other acts the letter names. forsinkelsesrenteloven § 2 (lovdata.no 2026-10-17): interest
// runs from the due date, or 30 days after a written demand when none was agreed.
export const ANDRE_LOVER = { forsinkelsesrente: "forsinkelsesrenteloven § 2" } as const;

// The law's own words, for the sentences that restate a condition. Each phrase is quoted from the
// source named beside it, so a template never paraphrases a legal test.
export const LOVORD = {
  // § 15 annet ledd (etter_2024), word for word after «med mindre forbrukeren ved inngåelsen av
  // avtalen». «Disse kravene» are those of § 15 tredje og fjerde ledd, so the sentence names them first.
  avtaltUnntak: "ble spesielt opplyst om at en bestemt egenskap ved tingen ville avvike fra disse kravene, og uttrykkelig og særskilt aksepterte dette avviket",
  // The requirements the exception is from (etter_2024): «disse kravene» in the phrase above.
  kravTredjeFjerde: "kravene i § 15 tredje og fjerde ledd",
  // Old § 17 første ledd bokstav a (før_2024), as Prop. 49 LS kap. 10.1.1 gives it. The subject is
  // changed from «forbrukeren» to «jeg», the rest is the same.
  dårligereStand: "i dårligere stand enn jeg med rimelighet hadde grunn til å forvente på bakgrunn av forbeholdet, kjøpesummens størrelse og forholdene ellers",
} as const;

export function lovversjon(kjopsdato: string | null): Lovversjon {
  // Without a purchase date the current law is assumed, as in brukerNiva.
  return kjopsdato && kjopsdato < "2024-01-01" ? "før_2024" : "etter_2024";
}

export const paragraf = (v: Lovversjon, p: Poeng): string | null => PARAGRAFER[v][p];

// «forbrukerkjøpsloven § 16 første ledd bokstav a», or «forbrukerkjøpsloven» alone for a gap.
export const lovRef = (v: Lovversjon, p: Poeng): string => {
  const par = paragraf(v, p);
  return par ? `forbrukerkjøpsloven ${par}` : "forbrukerkjøpsloven";
};

// «, jf. § 15 og § 18 a», or nothing when no number is known. Appended to a sentence before its full stop.
export function jf(v: Lovversjon, ...poeng: Poeng[]): string {
  const par = poeng.map((p) => paragraf(v, p)).filter((x): x is string => !!x);
  return par.length ? `, jf. ${par.length < 2 ? par[0] : `${par.slice(0, -1).join(", ")} og ${par.at(-1)}`}` : "";
}
