// What the buyer says about contact with the seller and about a workshop report. The form (steps 3
// and 4), the cleaning on the server and the letter all read the same lists, so a tick in the form is
// one fixed sentence in the letter, and what is not ticked gives no sentence.
import { reklamasjonFor } from "./tidslinje";
import type { Brevsak, Brevfeil } from "./typer";

// Step 4, «Kontakt med selger»: what the seller has done since the complaint. One answer, so the
// number of repairs and the answer cannot contradict each other: repairs are counted only under
// «Forsøkt å rette», and every other answer means none.
export const SELGER_SVAR = [
  { id: "ikke_svart", navn: "Ikke svart" },
  { id: "avviste", navn: "Avvist kravet" },
  { id: "tilbod_retting", navn: "Tilbudt retting, ikke gjennomført" },
  { id: "forsokt", navn: "Forsøkt å rette" },
  { id: "annet", navn: "Annet" },
] as const;
export type SelgerSvar = (typeof SELGER_SVAR)[number]["id"];

// Step 3: who examined the car. `brev` is how the letter says it.
export const VERKSTED_HVEM = [
  { id: "uavhengig", navn: "Uavhengig verksted", brev: "uavhengig verksted" },
  { id: "selgers", navn: "Selgers eget verksted", brev: "deres eget verksted" },
  { id: "merke", navn: "Merkeverksted", brev: "merkeverksted" },
] as const;
export type VerkstedHvem = (typeof VERKSTED_HVEM)[number]["id"];

// The ticks, in the order the letter gives them. `skjema` is the text beside the tick; `setning` the
// sentence in the letter (null: no sentence of its own); `modell` how the choice of decision reads it.
export const RAPPORT_PUNKTER = [
  { id: "bekrefter", skjema: "Rapporten bekrefter feilen", setning: "Verkstedet bekrefter feilen.", modell: "bekrefter feilen" },
  { id: "arsak", skjema: "Rapporten angir årsaken", setning: "Verkstedet har fastslått årsaken.", modell: "angir årsaken" },
  {
    id: "til_stede",
    skjema: "Rapporten sier at feilen har utviklet seg over tid / var til stede ved levering",
    setning: "Verkstedet legger til grunn at feilen har utviklet seg over tid og forelå ved leveringen.",
    modell: "sier at feilen var til stede ved leveringen",
  },
  {
    id: "ikke_slitasje",
    skjema: "Rapporten sier at feilen ikke er normal slitasje",
    setning: "Verkstedet vurderer feilen som unormal for bilens alder og kjørelengde.",
    modell: "sier at feilen ikke er normal slitasje",
  },
  { id: "frarader", skjema: "Rapporten fraråder bruk av bilen", setning: "Verkstedet fraråder bruk av bilen før feilen er utbedret.", modell: "fraråder bruk av bilen" },
  { id: "overslag", skjema: "Rapporten inneholder kostnadsoverslag", setning: null, modell: "har kostnadsoverslag" },
] as const;
export type RapportPunkt = (typeof RAPPORT_PUNKTER)[number]["id"];

export const MAKS_KONKLUSJON = 300;
export const MAKS_VERKSTEDNAVN = 60;

// The report a workshop has put in writing about one defect.
export type Rapport = {
  hvem: VerkstedHvem;
  navn: string;
  // The date of the report, ISO.
  dato: string;
  // The ticks, in the order of RAPPORT_PUNKTER.
  punkter: RapportPunkt[];
  // The report's conclusion as the buyer copied it, or null.
  konklusjon: string | null;
  // The estimate in kr. Only with the tick «inneholder kostnadsoverslag»: it is the workshop's figure.
  overslag: number | null;
};

// The buyer's own words the letter quotes (the description and the report's conclusion): only trim,
// the maximum length and double quotation marks (the letter puts «» round it). Line breaks become
// spaces, since the text stands in one paragraph.
export function rensFritekst(s: unknown, maks: number): string | null {
  if (typeof s !== "string") return null;
  const t = s
    .replace(/[\r\n]+/g, " ")
    .replace(/\p{Cf}/gu, "")
    .replace(/["“”„«»]/g, "")
    .replace(/ {2,}/g, " ")
    .trim()
    .slice(0, maks)
    .trim();
  return t || null;
}
export const MAKS_BESKRIVELSE = 200;
export const rensKonklusjon = (s: unknown) => rensFritekst(s, MAKS_KONKLUSJON);

export const harPunkt = (r: Pick<Rapport, "punkter"> | null, p: RapportPunkt) => !!r?.punkter.includes(p);

// A report copied to several defects (same workshop and date) is one report in the enclosures and in
// the sum of the estimates.
const nokkel = (r: Pick<Rapport, "navn" | "dato">) => `${r.navn}|${r.dato}`;

// The distinct reports of the case, with the defects each covers.
export function rapporter(s: Pick<Brevsak, "feil">): { rapport: Rapport; feil: Brevfeil[] }[] {
  const ut = new Map<string, { rapport: Rapport; feil: Brevfeil[] }>();
  for (const f of s.feil) {
    if (!f.rapport) continue;
    const k = nokkel(f.rapport);
    const e = ut.get(k);
    if (e) e.feil.push(f);
    else ut.set(k, { rapport: f.rapport, feil: [f] });
  }
  return [...ut.values()];
}

// The estimates of the defects, added up. One estimate per defect, also when a report covers several
// (then the buyer has given the figure for each), and only when the report has the tick.
type MedOverslag = { rapport: Pick<Rapport, "navn" | "dato" | "punkter" | "overslag"> | null };
const harOverslag = (f: MedOverslag) => !!(f.rapport && harPunkt(f.rapport, "overslag") && f.rapport.overslag);

export function overslagSum(s: { feil: MedOverslag[] }): { sum: number; antallRapporter: number } | null {
  const poster = s.feil.filter(harOverslag);
  if (!poster.length) return null;
  return { sum: poster.reduce((t, f) => t + f.rapport!.overslag!, 0), antallRapporter: new Set(poster.map((f) => nokkel(f.rapport!))).size };
}

// The known defects with and without an estimate. A symptom («vet ikke») has its own demand to be
// examined and repaired, so it is in neither.
export function overslagFordeling<F extends MedOverslag & { hoved: string }>(s: { feil: F[] }): { med: F[]; uten: F[] } {
  const kjente = s.feil.filter((f) => f.hoved !== "vet_ikke");
  return { med: kjente.filter(harOverslag), uten: kjente.filter((f) => !harOverslag(f)) };
}

export const forsokAv =(s: Pick<Brevsak, "kontakt">) => s.kontakt?.forsok ?? 0;

// The defects the earlier complaint covered, and the ones discovered after it, which this letter
// complains about. Without an earlier complaint every defect is new. The repairs tried and the seller's
// answer belong to the covered ones only.
export function reklamerte(s: Pick<Brevsak, "feil" | "kontakt" | "dato">): { tidligere: Brevfeil[]; nye: Brevfeil[] } {
  const omfattet = (f: Brevfeil) => reklamasjonFor(f, s.kontakt?.dato, s.dato).omfattet;
  return { tidligere: s.feil.filter(omfattet), nye: s.feil.filter((f) => !omfattet(f)) };
}
