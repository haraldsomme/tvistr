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
// Applies to contracts made from 1 January 2024.
//
// A point with no certain number is `null`: the letter then names «forbrukerkjøpsloven» alone and
// the point is listed as a known gap in docs/brev.md. None is a gap today.

export type Lovversjon = "før_2024" | "etter_2024";

export const POENG = [
  "krav", // what the thing must be like
  "avvik", // defect: not as § 15 requires
  "tilbakeholdt", // defect: the seller kept back information
  "uriktig", // defect: the thing does not match what the seller said
  "forbehold", // what a reservation like «som den er» does
  "formodning", // a defect that shows itself early is presumed to have existed at delivery
  "garanti",
  "reklamasjon", // notice of a defect
  "reklamasjon_2ar", // the two-year limit
  "reklamasjon_5ar", // the five-year limit
  "retting",
  "prisavslag",
  "heving",
  "erstatning",
] as const;
export type Poeng = (typeof POENG)[number];

export const PARAGRAFER: Record<Lovversjon, Record<Poeng, string | null>> = {
  før_2024: {
    krav: "§ 15",
    avvik: "§ 16 første ledd bokstav a",
    tilbakeholdt: "§ 16 første ledd bokstav b",
    uriktig: "§ 16 første ledd bokstav c",
    forbehold: "§ 17 første ledd bokstav a",
    formodning: "§ 18 annet ledd",
    garanti: "§ 18 a",
    reklamasjon: "§ 27 første ledd",
    reklamasjon_2ar: "§ 27 annet ledd første punktum",
    reklamasjon_5ar: "§ 27 annet ledd annet punktum",
    retting: "§§ 29 og 30",
    prisavslag: "§ 31",
    heving: "§ 32",
    erstatning: "§ 33",
  },
  etter_2024: {
    krav: "§ 15",
    avvik: "§ 16 første ledd bokstav a",
    tilbakeholdt: "§ 16 første ledd bokstav b",
    uriktig: "§ 16 første ledd bokstav c",
    // § 17 is now about wrong installation. A reservation is an agreed exception only under § 15
    // annet ledd.
    forbehold: "§ 15 annet ledd",
    formodning: "§ 18 annet ledd",
    garanti: "§ 18 a",
    reklamasjon: "§ 27 første ledd",
    reklamasjon_2ar: "§ 27 annet ledd første punktum",
    reklamasjon_5ar: "§ 27 annet ledd annet punktum",
    retting: "§§ 29 og 30",
    prisavslag: "§ 31",
    heving: "§ 32",
    erstatning: "§ 33",
  },
};

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

// «§ 15» for «etter § 15», or «forbrukerkjøpsloven» for a gap.
export const parRef = (v: Lovversjon, p: Poeng): string => paragraf(v, p) ?? "forbrukerkjøpsloven";

// «, jf. § 15 og § 18 a», or nothing when no number is known. Appended to a sentence before its full stop.
export function jf(v: Lovversjon, ...poeng: Poeng[]): string {
  const par = poeng.map((p) => paragraf(v, p)).filter((x): x is string => !!x);
  return par.length ? `, jf. ${par.length < 2 ? par[0] : `${par.slice(0, -1).join(", ")} og ${par.at(-1)}`}` : "";
}

// The source label a sentence carries for the point it cites.
export const lovkilde = (v: Lovversjon, p: Poeng): string => `lov:${v}:${p}`;
