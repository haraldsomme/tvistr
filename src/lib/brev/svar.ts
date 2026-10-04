import { ABSOLUTT_FRIST_AR, beregnFaktorer, iDag, leggTilManeder } from "@/lib/vurdering/faktorer";
import {
  kjopsdatoAv,
  lesInnsending,
  medKjopsdato,
  tilKlageInput,
  TOM_INNSENDING,
  type Innsending,
  type Stopp,
} from "@/lib/vurdering/innsending";
import type { Utfylling } from "./utfylling";

// The answers from the assessment a step on the letter page corrects: the purchase (Kjøpet), whether
// the buyer knew (Før kjøpet), contact with the dealer (Kontakt) and the report (Bevis). Who the car was
// bought from and the defect are locked to the case like the vehicle, so a letter bought for one claim
// cannot be turned into another; the rest are derived from the fill-in (`avledSvar`).
export const REDIGERBARE_SVAR = [
  "kjopsdato",
  "kjopesum",
  "kmVedKjop",
  "opplystForKjop",
  "kontakt",
  "verkstedrapport",
  "rapportSierForKjop",
] as const satisfies readonly (keyof Innsending)[];

// The stored answers with a step's corrections laid over them. Only the answers a step corrects are
// taken, and only those the save sends; everything else is ignored, as the vehicle is. The purchase date
// is then applied as the assessment applies it (`medKjopsdato`), so «hvor lenge siden» and «hvor lenge
// etter» follow it. null when the save is not an object.
export function rettSvar(lagret: Innsending, raw: unknown, idag = iDag()): Innsending | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  const lest = lesInnsending(r, idag);
  const ny: Innsending = { ...lagret };
  for (const felt of REDIGERBARE_SVAR) if (Object.hasOwn(r, felt)) ny[felt] = lest[felt] as never;
  return medKjopsdato(ny, ny.kjopsdato, idag);
}

// Would the assessment give a letter for these answers? Not when it would reject them, nor when the law
// stops the claim (`utenfor`).
type Status = { ok: true } | { ok: false; feil: string; stopp?: Stopp };
function svarStatus(svar: Innsending, idag: string): Status {
  const parsed = tilKlageInput(svar, idag);
  if (!parsed.ok) return parsed;
  const stopp = beregnFaktorer(parsed.input, idag).stopp;
  return stopp ? { ok: false, feil: STOPPET[stopp], stopp } : { ok: true };
}

// Why a correction the law would stop is not saved. Not reviewed by a lawyer.
const STOPPET: Record<Stopp, string> = {
  frist:
    "Med dette svaret er fristen for å reklamere ute: det må skje senest fem år etter kjøpet. Vurderingen ville ikke gitt et brev, så endringen er ikke lagret. Sjekk kjøpsdatoen og det du har svart om kontakt med forhandleren.",
  privat: "Med dette svaret gjelder ikke forbrukerkjøpsloven for kjøpet, og vurderingen ville ikke gitt et brev. Endringen er ikke lagret.",
  firma: "Med dette svaret gjelder ikke forbrukerkjøpsloven for kjøpet, og vurderingen ville ikke gitt et brev. Endringen er ikke lagret.",
};

const likeSvar = (a: Innsending, b: Innsending) =>
  (Object.keys(TOM_INNSENDING) as (keyof Innsending)[]).every((k) => String(a[k]) === String(b[k]));

// Checks a save by where it leaves the answers, after the derived answers are worked out: a correction
// can never leave the case with answers the assessment would have rejected, or one the law stops. What
// time alone has done is not held against the buyer: a case that was already stopped or incomplete
// before the save (a purchase that has passed five years since) can still be saved, and the letter
// warns about it. A save that does not change the answers always goes through. null when it can be saved.
export function kontrollerRettelse(for_: Innsending, etter: Innsending, idag = iDag()): string | null {
  const status = svarStatus(etter, idag);
  if (status.ok) return null;
  if (!status.stopp) return likeSvar(for_, etter) ? null : status.feil;
  return svarStatus(for_, idag).ok ? status.feil : null;
}

// The bucket «hvor lenge etter kjøpet» the engine sorts an exact day into, the same cut-offs the
// assessment's buttons stand for (6 and 24 months after the purchase).
function oppdagetFor(kjopsdato: string, dato: string): Innsending["oppdaget"] {
  if (dato <= leggTilManeder(kjopsdato, 6)) return "innen_6_mnd";
  if (dato <= leggTilManeder(kjopsdato, 24)) return "6_mnd_til_2_ar";
  return "over_2_ar";
}

// The answers from the assessment, with the exact facts the letter page has since collected laid over
// the guesses the assessment made from them: how long after the purchase the defect showed (from its
// exact date), whether the first complaint came within five years (from its exact date), whether what
// was said before the purchase is documented (from where it was said), and whether there are pictures
// (from the attachments chosen). A field the matching step has not reached yet keeps the assessment's
// own answer, so the engine always has something to work with.
export function avledSvar(svar: Innsending, u: Utfylling, idag: string): Innsending {
  const kjopsdato = kjopsdatoAv(svar, idag);
  const ny = { ...svar };
  if (u.feilen) ny.oppdaget = oppdagetFor(kjopsdato, u.feilen.dato);
  if (u.reklamasjon) ny.reklamertInnenFemAr = u.reklamasjon.dato <= leggTilManeder(kjopsdato, ABSOLUTT_FRIST_AR * 12) ? "ja" : "nei";
  if (u.feilopplyst === "nei") ny.feilOpplysning = "nei";
  else if (u.feilopplyst === "ja" && u.opplysning) ny.feilOpplysning = u.opplysning.kilde === "muntlig" ? "ja_udokumentert" : "ja_dokumentert";
  if (u.vedlegg) ny.bilder = u.vedlegg.includes("bilder") ? "ja" : "nei";
  return ny;
}
