// What the buyer says about contact with the seller and about a workshop report. The form (steps 3
// and 4), the cleaning on the server and the letter all read the same lists, so a tick in the form is
// one fixed sentence in the letter, and what is not ticked gives no sentence.
import type { Brevsak, Brevfeil } from "./typer";

// Step 4, «Kontakt med selger»: what the seller answered to the complaint.
export const SELGER_SVAR = [
  { id: "avviste", navn: "Avviste kravet" },
  { id: "ikke_svart", navn: "Har ikke svart" },
  { id: "tilbod_retting", navn: "Tilbød retting" },
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
export function overslagSum(s: { feil: { rapport: Pick<Rapport, "navn" | "dato" | "punkter" | "overslag"> | null }[] }): { sum: number; antallRapporter: number } | null {
  const poster = s.feil.filter((f) => f.rapport && harPunkt(f.rapport, "overslag") && f.rapport.overslag);
  if (!poster.length) return null;
  return { sum: poster.reduce((t, f) => t + f.rapport!.overslag!, 0), antallRapporter: new Set(poster.map((f) => nokkel(f.rapport!))).size };
}

export const forsokAv = (s: Pick<Brevsak, "kontakt">) => s.kontakt?.forsok ?? 0;
