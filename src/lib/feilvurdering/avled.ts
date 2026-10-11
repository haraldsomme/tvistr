// Conclusions drawn in code from the agents' facts and the decision's dates. The law version rule is
// pass 2's (branch pass2, src/lib/analyse/avled.ts).
import type { Feil, Lagret, Svar, Tidsniva, VisteSeg } from "./skjema";

export type Lovversjon = "før_2024" | "etter_2024" | "ukjent";
export type Datoer = { kjopsdato: string | null; overtakelsesdato: string | null; vedtaksdato: string | null; dagerTilReklamasjon?: number | null };

export function avledLovversjon(v: Datoer): Lovversjon {
  const d = v.kjopsdato ?? v.overtakelsesdato;
  if (d) return d < "2024-01-01" ? "før_2024" : "etter_2024";
  // Cases take months to reach a decision, so a decision before mid-2024 means a purchase before 2024.
  if (v.vedtaksdato && v.vedtaksdato < "2024-06-01") return "før_2024";
  return "ukjent";
}

// fkjl § 18 second paragraph: six months before 2024, two years from 1 January 2024.
export function formodningsfrist(l: Lovversjon): number | null {
  return l === "før_2024" ? 183 : l === "etter_2024" ? 730 : null;
}

// 22 months: from here a defect is «near the deadline» of two years (fkjl. § 27 second paragraph).
export const NAER_FRISTEN = 670;
const PERIODE: Record<Exclude<VisteSeg, "ukjent">, [number, number]> = {
  innen_6_mnd: [0, 183],
  "6_til_22_mnd": [184, NAER_FRISTEN - 1],
  "22_til_24_mnd": [NAER_FRISTEN, 730],
  over_24_mnd: [731, Infinity],
};

// Near or past the deadline outranks the presumption: a buyer at 23 months under the 2024 law is
// within the presumption but at risk of having complained too late. The complaint day bounds the
// day the defect showed itself, so a complaint within the presumption period settles level 1.
export function tidsniva(f: Pick<Feil, "dager_etter_levering" | "viste_seg" | "formodning">, frist: number | null, dagerTilReklamasjon: number | null): Tidsniva | null {
  const [fra, til] = f.dager_etter_levering !== null ? [f.dager_etter_levering, f.dager_etter_levering] : f.viste_seg === "ukjent" ? [null, null] : PERIODE[f.viste_seg];
  if (fra !== null && fra >= NAER_FRISTEN) return 3;
  if (f.formodning === "anvendt") return 1;
  if (frist === null) return null;
  if (til !== null && til <= frist) return 1;
  if (f.formodning === "etter_fristen" || (fra !== null && fra > frist)) return 2;
  if (dagerTilReklamasjon != null && dagerTilReklamasjon <= frist) return 1;
  return null;
}

export type Avledet = {
  godtatteKategorier: string[];
  // "hoved.under", since subcategory ids are only unique within their main category.
  godtatteUnderkategorier: string[];
  godtatteNiva: string[];
  // The earliest day after delivery a defect showed itself, among all claimed defects.
  dagerTilFeil: number | null;
  lovversjon: Lovversjon;
  lagret: Lagret;
};

// The reduction as a share of the price; null when there is none, or when it is not plausible (over 100 %).
export function prisavslagProsent(sanksjoner: string[], prisavslag: number | null, kjopesum: number | null): number | null {
  if (!sanksjoner.includes("prisavslag") || !prisavslag || !kjopesum || prisavslag <= 0 || kjopesum <= 0) return null;
  const p = (100 * prisavslag) / kjopesum;
  return p > 100 ? null : Math.round(p * 10) / 10;
}

export function avled(svar: Svar, datoer: Datoer): Avledet {
  const lovversjon = avledLovversjon(datoer);
  const frist = formodningsfrist(lovversjon);
  const medhold = svar.feil.filter((f) => f.utfall === "medhold" && f.hovedkategori !== "utenfor");
  const lagret: Lagret = { ...svar, feil: svar.feil.map((f) => ({ ...f, tidsniva: tidsniva(f, frist, datoer.dagerTilReklamasjon ?? null) })) };
  const nivaer = lagret.feil
    .filter((f) => f.utfall === "medhold" && f.hovedkategori !== "utenfor" && f.tidsniva !== null)
    .flatMap((f) => [`${f.hovedkategori}:${f.tidsniva}`, ...(f.underkategori ? [`${f.hovedkategori}.${f.underkategori}:${f.tidsniva}`] : [])]);
  const dager = svar.feil.map((f) => f.dager_etter_levering).filter((d): d is number => d !== null);
  return {
    godtatteKategorier: [...new Set(medhold.map((f) => f.hovedkategori))],
    godtatteUnderkategorier: [...new Set(medhold.filter((f) => f.underkategori).map((f) => `${f.hovedkategori}.${f.underkategori}`))],
    dagerTilFeil: dager.length ? Math.min(...dager) : null,
    lovversjon,
    godtatteNiva: [...new Set(nivaer)],
    lagret,
  };
}
