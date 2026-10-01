import { KONTAKT_VALG, type FeilKnapp, type KlageInput, type Kontakt } from "./typer";

// What the form collects (steps 1–3) and the checks shared by the client (enables «Neste») and the
// API route (never trusts the client). Free text is user input; nothing here is stored.

export const FEILTYPER_KNAPPER: readonly FeilKnapp[] = ["motor", "girkasse", "elektrisk", "rust", "bremser", "annet"];
export const OPPLYST_VALG = ["ja", "nei", "usikker"] as const;
export const BEVIS_FELT = ["kjopekontrakt", "verkstedrapport", "bilder", "korrespondanse", "annonse"] as const;

type BevisFelt = (typeof BEVIS_FELT)[number];

export type Innsending = {
  kjopsdato: string;
  kjopesumNok: string; // digits only
  feiltyper: FeilKnapp[];
  beskrivelse: string;
  oppdagetDato: string;
  opplystForKjop: (typeof OPPLYST_VALG)[number] | "";
  kontakt: Kontakt | "";
  bevis: Record<BevisFelt, boolean>;
  rapportSierForKjop: "ja" | "nei" | "";
  utbedringskostnadNok: string; // digits only, optional; asked together with the report
};

export const TOM_INNSENDING: Innsending = {
  kjopsdato: "",
  kjopesumNok: "",
  feiltyper: [],
  beskrivelse: "",
  oppdagetDato: "",
  opplystForKjop: "",
  kontakt: "",
  bevis: { kjopekontrakt: false, verkstedrapport: false, bilder: false, korrespondanse: false, annonse: false },
  rapportSierForKjop: "",
  utbedringskostnadNok: "",
};

const DAG_MS = 86_400_000;

function erIsoDato(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// One day of slack so a client in a timezone ahead of UTC is not rejected for «today».
const erIkkeFremtid = (s: string) => Date.parse(`${s}T00:00:00Z`) <= Date.now() + DAG_MS;

const heltall = (s: string, min: number, max: number) => /^\d{1,9}$/.test(s) && Number(s) >= min && Number(s) <= max;

function feil(i: Innsending, steg: 1 | 2 | 3): string | null {
  if (steg === 1) {
    if (!erIsoDato(i.kjopsdato) || !erIkkeFremtid(i.kjopsdato) || i.kjopsdato < "1990-01-01") return "Velg kjøpsdato.";
    if (!heltall(i.kjopesumNok, 1, 10_000_000)) return "Skriv inn kjøpesummen.";
  }
  if (steg === 2) {
    if (i.feiltyper.length === 0) return "Velg hva som er galt.";
    const n = i.beskrivelse.trim().length;
    if (n < 10 || n > 2000) return "Beskriv feilen med minst 10 tegn (maks 2000).";
    if (!erIsoDato(i.oppdagetDato) || !erIkkeFremtid(i.oppdagetDato)) return "Velg når du oppdaget feilen.";
    if (erIsoDato(i.kjopsdato) && i.oppdagetDato < i.kjopsdato) return "Feilen kan ikke være oppdaget før kjøpsdatoen.";
    if (!i.opplystForKjop || !OPPLYST_VALG.includes(i.opplystForKjop)) return "Svar på om du ble fortalt om feilen.";
    if (!i.kontakt || !KONTAKT_VALG.includes(i.kontakt)) return "Svar på om du har kontaktet forhandleren.";
  }
  if (steg === 3 && i.bevis.verkstedrapport) {
    if (i.rapportSierForKjop !== "ja" && i.rapportSierForKjop !== "nei") return "Svar på hva rapporten sier om feilen.";
    if (i.utbedringskostnadNok !== "" && !heltall(i.utbedringskostnadNok, 1, 10_000_000)) {
      return "Skriv inn utbedringskostnaden i hele kroner, eller la feltet stå tomt.";
    }
  }
  return null;
}

export const stegGyldig = (i: Innsending, steg: 1 | 2 | 3): boolean => feil(i, steg) === null;

const tekst = (v: unknown) => (typeof v === "string" ? v : "");
const bool = (v: unknown) => v === true;

// Parses an untrusted request body into the engine's input. The seller-type and private-use
// questions are not part of the form yet, so dealer purchase for private use is assumed.
export function tilKlageInput(raw: unknown): { ok: true; input: KlageInput } | { ok: false; feil: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { ok: false, feil: "Ugyldig forespørsel." };
  const r = raw as Record<string, unknown>;
  const bevisRaw = (typeof r.bevis === "object" && r.bevis !== null ? r.bevis : {}) as Record<string, unknown>;

  const i: Innsending = {
    kjopsdato: tekst(r.kjopsdato),
    kjopesumNok: tekst(r.kjopesumNok),
    feiltyper: Array.isArray(r.feiltyper) ? (r.feiltyper.filter((t): t is FeilKnapp => FEILTYPER_KNAPPER.includes(t)) as FeilKnapp[]) : [],
    beskrivelse: tekst(r.beskrivelse),
    oppdagetDato: tekst(r.oppdagetDato),
    opplystForKjop: tekst(r.opplystForKjop) as Innsending["opplystForKjop"],
    kontakt: tekst(r.kontakt) as Innsending["kontakt"],
    bevis: Object.fromEntries(BEVIS_FELT.map((f) => [f, bool(bevisRaw[f])])) as Innsending["bevis"],
    rapportSierForKjop: r.rapportSierForKjop === "ja" || r.rapportSierForKjop === "nei" ? r.rapportSierForKjop : "",
    utbedringskostnadNok: tekst(r.utbedringskostnadNok),
  };
  const f = feil(i, 1) ?? feil(i, 2) ?? feil(i, 3);
  if (f) return { ok: false, feil: f };

  return {
    ok: true,
    input: {
      kvalifisering: { selgerType: "forhandler", privatBruk: true },
      bilOgKjop: { kjopsdato: i.kjopsdato, kjopesumNok: Number(i.kjopesumNok) },
      feilen: {
        typer: [...new Set(i.feiltyper)],
        beskrivelse: i.beskrivelse.trim(),
        oppdagetDato: i.oppdagetDato,
        opplystForKjop: i.opplystForKjop as Exclude<Innsending["opplystForKjop"], "">,
        kontakt: i.kontakt as Kontakt,
        utbedringskostnadNok: i.bevis.verkstedrapport && i.utbedringskostnadNok !== "" ? Number(i.utbedringskostnadNok) : null,
      },
      bevis: { ...i.bevis, rapportSierForKjop: i.bevis.verkstedrapport ? i.rapportSierForKjop === "ja" : null },
    },
  };
}
