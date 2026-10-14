// The letter's timeline: purchase → each defect discovered → (report) → (complaint) → the letter's
// date. The buyer gives dates; everything the law turns on (the time level, the presumption, the
// deadlines) is worked out here from the dates, so an interval and a date can never disagree. One
// pure function, used by the form on every change, by the server (rens.ts) before anything is built,
// by the templates and by the tests.
//
// Impossible orders stop; possible but weakening ones warn.
import type { VisteSegValg } from "@/lib/feil/kategorier";
import { type Lovversjon, lovRef, lovversjon } from "./paragrafer";

export type Tidsniva = 1 | 2 | 3;

export type Tidslinje = {
  kjop: string;
  feil: { id: string; oppdaget: string; omtrentlig: boolean; rapport?: string }[];
  // The first complaint to the seller; missing when this letter is the complaint.
  reklamert?: string;
  idag: string;
};

// `felt` is where the form shows the message: kjopsdato, oppdaget, rapport or reklamert.
// `bekreft`: a warning the buyer must confirm before going on (a date near a deadline that is only
// approximate).
export type Merknad = { regel: string; felt: "kjopsdato" | "oppdaget" | "rapport" | "reklamert"; feilId?: string; melding: string; bekreft?: true };

export type Avledet = {
  feilId: string;
  dager: number;
  tidsnivaa: Tidsniva;
  // The presumption (fkjl. § 18 annet ledd) covers the defect.
  formodning: boolean;
  naerFrist?: "6mnd" | "2aar" | "5aar";
  // The interval the buyer used to choose, for the choice of decision, which reads it in words.
  intervall: VisteSegValg;
};

export type Vurdering = { stopp: Merknad[]; advarsler: Merknad[]; avledet: Avledet[] };

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const erDato = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;

const to = (n: number) => String(n).padStart(2, "0");
// Calendar months, the way the law counts: 31 August + 6 months is 28 (or 29) February.
export function plussManeder(iso: string, m: number): string {
  const [a, mnd, d] = iso.split("-").map(Number);
  const total = a * 12 + (mnd - 1) + m;
  const ar = Math.floor(total / 12);
  const mo = total - ar * 12;
  const siste = new Date(Date.UTC(ar, mo + 1, 0)).getUTCDate();
  return `${ar}-${to(mo + 1)}-${to(Math.min(d, siste))}`;
}
export function plussDager(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export const dagerMellom = (fra: string, til: string) => Math.round((Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000);

// Six months before 2024, two years from 2024 (fkjl. § 18 annet ledd); two and five years for the
// complaint (§ 27 annet ledd); and how close to one of them a date must be to be checked again.
export const FORMODNING_MND = { før_2024: 6, etter_2024: 24 } as const;
const TO_AAR = 24;
const FEM_AAR = 60;
export const NAER_DAGER = 14;
const SEN_REKLAMASJON_MND = 2;
const SEN_RAPPORT_MND = 6;

// The time level of a defect discovered on `oppdaget`, as the ranking and the templates use it:
// 1 within the presumption, 3 past two years, 2 between (only before 2024).
export function tidsnivaFor(kjop: string, oppdaget: string, v: Lovversjon = lovversjon(kjop)): Omit<Avledet, "feilId"> {
  const dager = dagerMellom(kjop, oppdaget);
  const tidsnivaa: Tidsniva = oppdaget <= plussManeder(kjop, FORMODNING_MND[v]) ? 1 : oppdaget > plussManeder(kjop, TO_AAR) ? 3 : 2;
  const intervall: VisteSegValg = oppdaget <= plussManeder(kjop, 6) ? "innen_6_mnd" : oppdaget > plussManeder(kjop, TO_AAR) ? "over_24_mnd" : "6_til_24_mnd";
  // Six months is a limit in the law only before 2024.
  const frister: [NonNullable<Avledet["naerFrist"]>, number][] = [["2aar", TO_AAR], ["5aar", FEM_AAR]];
  if (v === "før_2024") frister.unshift(["6mnd", 6]);
  const naer = frister.find(([, m]) => Math.abs(dagerMellom(plussManeder(kjop, m), oppdaget)) <= NAER_DAGER)?.[0];
  return { dager, tidsnivaa, formodning: tidsnivaa === 1, intervall, ...(naer && { naerFrist: naer }) };
}

// Whether a defect was part of the buyer's earlier complaint (discovered on or before its date), and
// the day the defect is complained about: the earlier complaint if so, otherwise the letter's date.
// The form's warning and the letter's sentences both read it, so they cannot disagree.
export function reklamasjonFor(f: { oppdaget: string }, reklamert: string | null | undefined, brevdato: string): { omfattet: boolean; dato: string } {
  const omfattet = !!reklamert && reklamert >= f.oppdaget;
  return { omfattet, dato: omfattet ? reklamert! : brevdato };
}

// A complaint within two months of the discovery is always in time (§ 27 første ledd). An approximate
// day counts from the first of its month, since the letter names only the month.
export const innenToManeder = (f: { oppdaget: string; omtrentlig: boolean }, dato: string) =>
  dato <= plussManeder(f.omtrentlig ? `${f.oppdaget.slice(0, 8)}01` : f.oppdaget, SEN_REKLAMASJON_MND);

// The notices the form shows about the limits for complaining. The paragraph numbers come from
// paragrafer.ts for the version that applies to the purchase, as in the letter.
export const fristTekst = (v: Lovversjon) =>
  `Fristen for å reklamere er fem år for deler som er ment å vare vesentlig lenger enn to år, ellers to år, regnet fra overtakelsen (${lovRef(v, "reklamasjon_frister")}). Reklamasjonen må i tillegg fremsettes innen rimelig tid etter at feilen ble oppdaget (${lovRef(v, "reklamasjon")}).`;
export const OVER_TO_AAR_KJOP =
  "Det er mer enn to år siden du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det.";
export const OVER_TO_AAR_FEIL =
  "En eller flere feil viste seg mer enn to år etter at du overtok bilen. For biler gjelder som regel en frist på fem år, men for slitedeler kan fristen være to år. Selger kan bruke det.";

const FRISTNAVN = { "6mnd": "seks måneder", "2aar": "to år", "5aar": "fem år" } as const;

export function vurderTidslinje(t: Tidslinje, v: Lovversjon = lovversjon(t.kjop)): Vurdering {
  const stopp: Merknad[] = [];
  const advarsler: Merknad[] = [];
  const avledet: Avledet[] = [];

  if (!erDato(t.kjop)) return { stopp: [{ regel: "kjop_mangler", felt: "kjopsdato", melding: "Velg kjøpsdatoen." }], advarsler, avledet };
  if (t.kjop > t.idag) stopp.push({ regel: "kjop_fremtid", felt: "kjopsdato", melding: "Kjøpsdatoen kan ikke være i fremtiden." });
  if (t.kjop < plussManeder(t.idag, -FEM_AAR))
    stopp.push({ regel: "kjop_fem_aar", felt: "kjopsdato", melding: `Det er mer enn fem år siden du overtok bilen. Den lengste fristen for å reklamere er fem år (${lovRef(v, "reklamasjon_5ar")}), og dette brevet kan ikke brukes etter det. Mener du selger har holdt noe skjult, eller har du en garanti som gjelder lenger, bør du kontakte Forbrukerrådet eller en advokat.` });

  // A date that is missing is required elsewhere; here only dates that are there are judged.
  const gyldige = t.feil.filter((f) => erDato(f.oppdaget) && f.oppdaget > t.kjop && f.oppdaget <= t.idag);
  for (const f of t.feil) {
    if (!erDato(f.oppdaget)) continue;
    if (f.oppdaget <= t.kjop) stopp.push({ regel: "oppdaget_for_kjop", felt: "oppdaget", feilId: f.id, melding: "Feilen kan ikke ha vist seg før du overtok bilen." });
    else if (f.oppdaget > t.idag) stopp.push({ regel: "oppdaget_fremtid", felt: "oppdaget", feilId: f.id, melding: "Datoen kan ikke være i fremtiden." });
    else {
      const a = { feilId: f.id, ...tidsnivaFor(t.kjop, f.oppdaget, v) };
      avledet.push(a);
      if (a.naerFrist) {
        // Before 2024 two years and five years are deadlines for the complaint, not for the burden of proof.
        const bevis = a.naerFrist === "6mnd" || (a.naerFrist === "2aar" && v === "etter_2024");
        advarsler.push({
          regel: "naer_frist",
          felt: "oppdaget",
          feilId: f.id,
          melding: `Datoen ligger nær en frist i loven (${FRISTNAVN[a.naerFrist]}). Sjekk at den stemmer; den avgjør ${bevis ? "hvem som må bevise når feilen oppsto" : "om reklamasjonen er i tide"}.`,
          ...(f.omtrentlig && { bekreft: true as const }),
        });
      }
    }
    if (erDato(f.rapport)) {
      if (f.rapport < f.oppdaget) stopp.push({ regel: "rapport_for_oppdaget", felt: "rapport", feilId: f.id, melding: "Rapporten kan ikke være datert før du oppdaget feilen." });
      else if (f.rapport > t.idag) stopp.push({ regel: "rapport_fremtid", felt: "rapport", feilId: f.id, melding: "Datoen kan ikke være i fremtiden." });
      else if (f.rapport > plussManeder(f.oppdaget, SEN_RAPPORT_MND))
        advarsler.push({ regel: "rapport_sen", felt: "rapport", feilId: f.id, melding: "Det gikk lang tid fra feilen ble oppdaget til verkstedet undersøkte den. Selger kan bruke det." });
    }
  }

  const forste = gyldige.map((f) => f.oppdaget).sort()[0];
  if (erDato(t.reklamert)) {
    if (t.reklamert > t.idag) stopp.push({ regel: "reklamert_fremtid", felt: "reklamert", melding: "Datoen kan ikke være i fremtiden." });
    else if (t.reklamert <= t.kjop || (forste && t.reklamert < forste))
      stopp.push({ regel: "reklamert_for_oppdaget", felt: "reklamert", melding: "Du kan ikke ha reklamert før den første feilen viste seg. Sjekk datoene." });
  }

  // A complaint more than two months after the discovery (§ 27 første ledd: within reasonable time,
  // never less than two months). The complaint is the earlier one when it came after this defect was
  // discovered; otherwise it is this letter.
  for (const f of gyldige) {
    const r = reklamasjonFor(f, erDato(t.reklamert) ? t.reklamert : null, t.idag);
    if (r.dato > plussManeder(f.oppdaget, SEN_REKLAMASJON_MND))
      advarsler.push({
        regel: "reklamasjon_sen",
        felt: r.omfattet ? "reklamert" : "oppdaget",
        feilId: f.id,
        melding: `Reklamasjon innen to måneder etter at feilen ble oppdaget er alltid i tide. Etter det vurderes det om du reklamerte innen rimelig tid. Du reklamerer mer enn to måneder etter at feilen ble oppdaget. Selger kan hevde at reklamasjonen er for sen (${lovRef(v, "reklamasjon")}). Du kan likevel lage brevet.`,
      });
  }
  return { stopp, advarsler, avledet };
}
