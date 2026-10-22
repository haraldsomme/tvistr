// The points and limits behind the ranking of similar decisions (ranger.ts). Change them here only.
export const VEKTER = {
  // Points for a match within a level. `naer`: the decision was harder for the buyer than the user's
  // case (a later defect, more km, an older car, «som den er»), or (krav) granted the claim on more
  // defects than this one. Easier for the buyer, or missing in the decision, gives 0, never less.
  underkategori: { likt: 4 },
  tidsniva: { likt: 4, naer: 1 },
  km: { likt: 3, naer: 1 },
  alder: { likt: 2, naer: 1 },
  som_den_er: { likt: 2, naer: 1 },
  krav: { likt: 2, naer: 1 },
  // The committee weighed this defect itself (not together with others, not admitted or
  // undisputed): a precedent the letter can lean on.
  egen_vurdering: { likt: 4 },
  // The decision rests on what the user also has: the seller's statement, an expert report, or the
  // committee's own assessment.
  grunnlag: { likt: 4 },
  // Interval lower bounds: km under 100 000, 100–200 000, over 200 000; age under 5, 5–10, over 10.
  kmGrenser: [100_000, 200_001],
  alderGrenser: [5, 11],
  // The candidates the model chooses from, level A before B.
  kandidater: 10,
};
