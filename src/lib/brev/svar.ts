import { ABSOLUTT_FRIST_AR, iDag, leggTilManeder } from "@/lib/vurdering/faktorer";
import {
  kjopsdatoAv,
  lesInnsending,
  tilKlageInput,
  type Innsending,
} from "@/lib/vurdering/innsending";
import type { Utfylling } from "./utfylling";

// Checks a whole set of answers from the assessment, as the letter page corrects it (one topic at a
// time, in `Lagring.svar`). Same check as the assessment itself: `tilKlageInput` runs every step's
// rules, so a correction can never leave the case with answers the assessment would have rejected.
export function lesSvar(raw: unknown, idag = iDag()): { ok: true; svar: Innsending } | { ok: false; feil: string } {
  const parsed = tilKlageInput(raw, idag);
  if (!parsed.ok) return parsed;
  return { ok: true, svar: lesInnsending(raw as Record<string, unknown>) };
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
