import { erDato } from "@/lib/vurdering/faktorer";
import type { Innsending } from "@/lib/vurdering/innsending";
import type { Lagring, Utfylling } from "../utfylling";
import type { Tema } from "./saksmodell";

// What the clarifying round can hand the page: its questions and the corrections the buyer can accept.
// Kept apart from `avklaring.ts`, which calls the model, so the page can use it.

export const RETTBARE_FELT = ["kjopsdato", "kjopesum", "kmVedKjop", "feilen.dato", "reklamasjon.dato", "reklamasjon.svarDato", "reparasjon.dato", "krav.utbedringNok"] as const;
export type RettbartFelt = (typeof RETTBARE_FELT)[number];
export type Rettelse = { felt: RettbartFelt; verdi: string; begrunnelse: string };
export type Sporsmal = { id: string; moment?: string; tema: Tema; tekst: string; alternativer: string[]; flervalg: boolean };
export type Avklaringsrunde = { status: "sporsmal" | "klar"; runde: number; sporsmal: Sporsmal[]; rettelser: Rettelse[] };

const heltall = (v: string) => /^\d{1,9}$/.test(v);

// The save a correction makes, or null when the value is not valid or the case has nothing to correct.
export function rettelseTilLagring(r: Rettelse, sak: { svar: Innsending; utfylling: Utfylling }): Lagring | null {
  const u = sak.utfylling;
  switch (r.felt) {
    case "kjopsdato":
      return erDato(r.verdi) ? { svar: { ...sak.svar, kjopsdato: r.verdi } } : null;
    case "kjopesum":
    case "kmVedKjop":
      return heltall(r.verdi) ? { svar: { ...sak.svar, [r.felt]: r.verdi } } : null;
    case "feilen.dato":
      return erDato(r.verdi) && u.feilen ? { feilen: { ...u.feilen, dato: r.verdi } } : null;
    case "reklamasjon.dato":
    case "reklamasjon.svarDato":
      return erDato(r.verdi) && u.reklamasjon ? { reklamasjon: { ...u.reklamasjon, [r.felt === "reklamasjon.dato" ? "dato" : "svarDato"]: r.verdi } } : null;
    case "reparasjon.dato":
      return erDato(r.verdi) && u.reparasjon ? { reparasjon: { ...u.reparasjon, dato: r.verdi } } : null;
    case "krav.utbedringNok":
      return heltall(r.verdi) && Number(r.verdi) > 0 ? { krav: { ...u.krav, utgifter: u.krav?.utgifter ?? [], utbedringNok: Number(r.verdi) } } : null;
  }
}


// What each correctable field is called on the page.
export const FELT_TEKST: Record<RettbartFelt, string> = {
  kjopsdato: "Kjøpsdatoen",
  kjopesum: "Kjøpesummen",
  kmVedKjop: "Kilometerstanden ved kjøpet",
  "feilen.dato": "Datoen feilen viste seg",
  "reklamasjon.dato": "Datoen du tok opp feilen med forhandleren",
  "reklamasjon.svarDato": "Datoen forhandleren svarte eller sist forsøkte å rette",
  "reparasjon.dato": "Datoen for reparasjonen",
  "krav.utbedringNok": "Kostnaden ved å rette feilen",
};
