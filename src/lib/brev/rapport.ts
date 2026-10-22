// What a workshop report can say, as the choice of decision reads it (vedtaksvalg/kjoper.ts).

// The ticks, in the order the letter gives them. `modell` is how the choice of decision reads it.
export const RAPPORT_PUNKTER = [
  { id: "bekrefter", modell: "bekrefter feilen" },
  { id: "arsak", modell: "angir årsaken" },
  { id: "til_stede", modell: "sier at feilen var til stede ved leveringen" },
  { id: "ikke_slitasje", modell: "sier at feilen ikke er normal slitasje" },
  { id: "frarader", modell: "fraråder bruk av bilen" },
  { id: "overslag", modell: "har kostnadsoverslag" },
] as const;
export type RapportPunkt = (typeof RAPPORT_PUNKTER)[number]["id"];
