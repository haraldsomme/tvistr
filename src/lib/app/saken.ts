// The buyer's answers as the ranking reads them (vedtaksvalg/kjoper.ts, Svar): from the check before
// payment and from the writer after. Only faults with a discovery date count, and nothing without the
// purchase (or handover) date.
import type { RapportPunkt } from "@/lib/brev/rapport";
import type { Kilde, Svar } from "@/lib/vedtaksvalg/kjoper";
import type { Skjema } from "./skjema";
import type { Sjekksvar } from "./vurdering";

// The check's state: the verdict's answers plus the car and the faults.
export type Sjekk = Sjekksvar & { reg?: string; make?: string; year?: string; lastReg?: string; cats?: string[]; issues?: Record<string, string[]>; fdates?: Record<string, string> };

// What the writer's workshop ticks mean in the ranking's words.
const WS_TIL_PUNKT: Record<string, RapportPunkt> = { bekrefter: "bekrefter", aarsak: "arsak", levering: "til_stede", ikke_slitasje: "ikke_slitasje", frarader: "frarader", kostnad: "overslag" };

const heltall = (s: string | undefined) => {
  const d = (s ?? "").replace(/\D/g, "");
  return d ? Number(d) : null;
};

export function tilSvar(s: Skjema): Svar | null {
  const kjopsdato = s.c_purchase || s.c_delivery;
  const feil = s.f_cats.filter((c) => s.f_area[c]?.found);
  if (!kjopsdato || !feil.length) return null;
  const opplysning: Kilde | null = s.seller_said === "nei" ? "nei" : s.seller_said ? "skriftlig" : null;
  const verksted: Kilde | null = s.ws === "rapport" ? "skriftlig" : s.ws === "uten" ? "muntlig" : s.ws === "nei" ? "nei" : null;
  const rapport = s.ws === "rapport" ? { punkter: s.ws_says.map((k) => WS_TIL_PUNKT[k]).filter(Boolean) } : null;
  return {
    kjopsdato,
    km: heltall(s.c_km),
    ar: heltall(s.c_year),
    somDenEr: s.c_asis ? "ja" : "nei",
    krav: s.k_main === "omlevering" ? "retting" : s.k_main === "retting" || s.k_main === "prisavslag" || s.k_main === "heving" ? s.k_main : null,
    forsok: null,
    feil: feil.map((c) => ({ hoved: c, under: s.f_parts[c] ?? [], oppdaget: s.f_area[c].found, beskrivelse: s.f_catdesc[c]?.trim() || null, opplysning, verksted, rapport })),
  };
}

export function sjekkTilSvar(a: Sjekk): Svar | null {
  const feil = (a.cats ?? []).filter((c) => a.fdates?.[c]);
  if (!a.delivery || !feil.length) return null;
  return {
    kjopsdato: a.delivery,
    km: heltall(a.km),
    ar: heltall(a.year),
    somDenEr: a.asis === "ja" || a.asis === "nei" ? a.asis : null,
    krav: null,
    forsok: null,
    feil: feil.map((c) => ({ hoved: c, under: a.issues?.[c] ?? [], oppdaget: a.fdates![c], beskrivelse: null, opplysning: null, verksted: null, rapport: null })),
  };
}

// For change detection: finnVedtak and vurderSaken are called again only when this changes.
export const nokkel = (v: Svar | null) => JSON.stringify(v);
