// What a workshop report can say, as the choice of decision reads it (vedtaksvalg/kjoper.ts).

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
