import { wilson } from "@/lib/wilson";
import type { AktorKort } from "./kort/aktorer";
import type { AvgjordeKort } from "./kort/avgjorde";
import type { BelopKort } from "./kort/belop";
import type { StyrkeKort } from "./kort/styrke";
import type { Sjekkpunkt } from "./kort/styrk";
import type { VidereKort } from "./kort/videre";

// The saksmappe: numbers from earlier decisions, shaped for one case. Every share carries its sample
// size, and a sample below its threshold gives «for få saker» instead of a number.

export const MIN_N = 10;
export const MIN_N_FORHANDLER = 3;
export const MIN_N_MODELL = 5;

export type Andel = { n: number; vunnet: number; andel: number; lav: number; hoy: number };
export type ForFa = { forFa: true; n: number };
export const erForFa = (x: unknown): x is ForFa => typeof x === "object" && x !== null && "forFa" in x;

export function andel(vunnet: number, n: number, minN: number): Andel | ForFa {
  if (n < minN || n === 0) return { forFa: true, n };
  const [lav, hoy] = wilson(vunnet, n);
  return { n, vunnet, andel: vunnet / n, lav, hoy };
}

export type UtvalgTall = { n: number; fullt: number; delvis: number; avslag: number; trinn: number; beskrivelse: string; spesifikk: boolean };
export type Kvartiler = { n: number; p25: number; median: number; p75: number };
export type BelopTall = {
  // Total awarded, among decisions where something was awarded.
  tilkjent: Kvartiler | null;
  // Awarded price reduction as a share of the repair cost.
  prisavslagAvUtbedring: Kvartiler | null;
  // Decisions where cancelling the purchase was the main claim.
  heving: { n: number; fullt: number; delvis: number; ikke: number } | null;
  erstatning: { nKrevd: number; nTilkjent: number; median: number | null };
};
export type TemaRad = { kilde: "tvistetema" | "bevistyper" | "mangelsgrunnlag"; verdi: string; nMedhold: number; nAvslag: number };
export type TemaTall = { medhold: number; avslag: number; rader: TemaRad[] };
export type EksempelVedtak = {
  id: number;
  saksnummer: string;
  ar: number;
  utfall: "medhold" | "delvis_medhold" | "ikke_medhold";
  tilkjentNok: number | null;
  sammendrag: string | null;
  momenter: string[];
  kildeUrl: string;
  merke: string | null;
  modell: string | null;
  dagerTilReklamasjon: number | null;
};
export type ForhandlerTall = { n: number; vunnet: number; sisteAr: number | null; feiltyper: { verdi: string; n: number }[] };
export type ModellTall = { n: number; vunnet: number };
export type BevisTall = { nMedhold: number; verkstedrapport: number; bilder: number; takst: number; naf: number; kvittering: number };

// What the builder needs from the database; the SQL lives in hent.ts, tests pass fixed numbers.
export type MappeData = {
  utvalg(): Promise<UtvalgTall>;
  belop(): Promise<BelopTall>;
  temaer(): Promise<TemaTall>;
  eksempler(): Promise<EksempelVedtak[]>;
  forhandler(navn: string | null, orgnr: string | null): Promise<ForhandlerTall | null>;
  modell(merke: string, modell: string): Promise<ModellTall>;
  bevis(): Promise<BevisTall>;
};

export type Mappe = { idag: string; styrke: StyrkeKort; belop: BelopKort; avgjorde: AvgjordeKort; aktorer: AktorKort; styrk: Sjekkpunkt[]; videre: VidereKort };
