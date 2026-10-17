// Merging stored or posted answers over the defaults, for the browser (lagring.ts) and the server (rensSkjema).
export const erObjekt = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const slag = (v: unknown) => (v === null ? "null" : Array.isArray(v) ? "liste" : typeof v);

// The stored fields over the defaults, keeping only those of the default's type (an edited or older
// draft must not crash the page). A default of null takes any plain value; unknown keys are kept.
export function flett(s: Record<string, unknown>, v: Record<string, unknown>) {
  const ut = { ...s };
  for (const [k, x] of Object.entries(v)) {
    if (!(k in s) || slag(x) === slag(s[k]) || (s[k] === null && slag(x) !== "liste" && slag(x) !== "object")) ut[k] = x;
  }
  return ut;
}

