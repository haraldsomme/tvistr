const kr = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });

export const formatKr = (v: number | null | undefined) => (v == null ? "–" : `${kr.format(Math.round(v))} kr`);
export const formatProsent = (v: number) => `${Math.round(v * 100)} %`;
export const formatListe = (v: string[] | null | undefined) => (v?.length ? v.join(", ").replaceAll("_", " ") : "–");
export const formatTekst = (v: string | number | boolean | null | undefined) =>
  v == null || v === "" ? "–" : typeof v === "boolean" ? (v ? "ja" : "nei") : String(v).replaceAll("_", " ");
