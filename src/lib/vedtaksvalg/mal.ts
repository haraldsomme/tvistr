import { liste } from "@/lib/brev/format";

// The paragraph that cites the decision, filled from fields and verified quotes only. Nothing about
// the decision is written in free prose, so it cannot claim what the decision did not say.

// The decision as the template reads it.
export type Malvedtak = {
  // The committee as the decision names itself.
  utvalg: string;
  saksnummer: string | null;
  vedtaksdato: string | null;
  // The car as the decision itself names it (avgjorende v4); the make and model fields when missing.
  bil: string | null;
  merke: string | null;
  modell: string | null;
  arsmodell: number | null;
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
};

export type Kjoperbil = { km: number | null; alder: number | null; somDenEr: boolean | null };

// A side counts only when it clearly favours the buyer, since the decision's age is worked out from
// the model year and may be a year off.
export const MIN_ALDERSFORSKJELL = 2;
export const MIN_KM_ANDEL = 0.9;

// «FKU-2026-117158» is the archive's id; the decision itself says «sak 117158».
export const visSaksnummer = (s: string | null) => s?.replace(/^FKU-\d{4}-(\d+)(?:-\d+)?$/, "$1") ?? null;
export const visDato = (iso: string | null) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${Number(iso.slice(8))}.${Number(iso.slice(5, 7))}.${iso.slice(0, 4)}` : null);
const visKm = (km: number) => new Intl.NumberFormat("nb-NO").format(km);
const sitert = (s: string) => `«${s}»${/[.!?]$/.test(s) ? "" : "."}`;

function henvisning(v: Malvedtak): string {
  const nr = visSaksnummer(v.saksnummer);
  const dato = visDato(v.vedtaksdato);
  return `Det vises til ${v.utvalg}s vedtak${nr ? ` i sak ${nr}` : ""}${dato ? ` av ${dato}` : ""}`;
}

function bilen(v: Malvedtak): string {
  const navn = [v.merke, v.modell].filter(Boolean).join(" ");
  const bil = v.bil ? `en ${v.bil}` : navn ? `en ${navn}` : "en bil";
  const ar = v.arsmodell && !v.bil ? ` av årsmodell ${v.arsmodell}` : "";
  const km = v.km !== null ? ` som hadde gått ${visKm(v.km)} km ved kjøpet` : "";
  return `${bil}${ar}${km}${v.somDenEr ? ", solgt «som den er»" : ""}`;
}

// The sides where the buyer's car was clearly better placed than the decision's; null when none is.
// A side against the buyer is never named.
export function sammenligning(k: Kjoperbil, v: Malvedtak): string | null {
  const deler: string[] = [];
  if (k.alder !== null && v.alder !== null && v.alder - k.alder >= MIN_ALDERSFORSKJELL) deler.push(`var yngre (${k.alder} mot ${v.alder} år)`);
  if (k.km !== null && v.km !== null && k.km <= v.km * MIN_KM_ANDEL) deler.push(`hadde gått kortere (${visKm(k.km)} mot ${visKm(v.km)} km)`);
  if (k.somDenEr === false && v.somDenEr === true) deler.push("var ikke solgt «som den er»");
  return deler.length ? `Bilen i foreliggende sak ${liste(deler)}.` : null;
}

// Level A: the same defect. `sanksjoner` is what the committee granted for this defect.
export function avsnittA(v: Malvedtak, komponent: string, sitater: string[], sanksjoner: string[], k: Kjoperbil): string {
  const [forste, andre] = sitater;
  return [
    `${henvisning(v)}. Saken gjaldt ${komponent} på ${bilen(v)}.`,
    `Utvalget uttalte: ${sitert(forste)}`,
    andre ? `Utvalget uttalte videre: ${sitert(andre)}` : null,
    sanksjoner.length ? `Kjøperen fikk medhold i krav om ${liste(sanksjoner)}.` : null,
    sammenligning(k, v),
  ]
    .filter(Boolean)
    .join(" ");
}

// Level B: a decision that settled one of the buyer's legal points. The defect is named as it was,
// without saying how it relates to the buyer's, which the fields cannot always tell.
export function avsnittB(v: Malvedtak, komponent: string, sitat: string): string {
  return `${henvisning(v)}, som gjaldt ${komponent}. Utvalget uttalte: ${sitert(sitat)}`;
}

