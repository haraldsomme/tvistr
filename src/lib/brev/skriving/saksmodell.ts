import { beregnFaktorer, kjopsdatoFor, type Faktorer } from "@/lib/vurdering/faktorer";
import { NAAR } from "@/lib/vurdering/grunnlag";
import { tilKlageInput, type Innsending } from "@/lib/vurdering/innsending";
import { gyldigRetting, type KlageInput } from "@/lib/vurdering/typer";
import { avledSvar } from "../svar";
import type { Utfylling } from "../utfylling";

// The case as the writing engine sees it: the answers from the assessment with the facts from the letter
// page laid over them (`avledSvar`), the time line, the texts the buyer pasted in (cleaned of personal
// data) and the answers from the clarifying round. Pure; nothing here is sent anywhere.

// Texts the buyer pasted in, the only thing the letter may quote: the workshop or condition report, the
// ad, contract or message with what was said before the purchase, and the dealer's written answer.
export const KILDER = ["rapport", "opplysning", "svar"] as const;
export type Kilde = (typeof KILDER)[number];
export type Kildetekster = Partial<Record<Kilde, string>>;

export const TEMAER = ["kjopet", "feilen", "for_kjopet", "kontakt", "rapport", "krav"] as const;
export type Tema = (typeof TEMAER)[number];
// A question from the clarifying round and the buyer's answer; null when it was skipped.
export type Avklaring = { moment?: string; tema: Tema; sporsmal: string; svar: string | null };

export type Grunnlag = { svar: Innsending; utfylling: Utfylling; kilder?: Kildetekster; avklaringer?: Avklaring[] };

export type Hendelse = { type: "kjop" | "feil" | "reklamasjon" | "svar" | "siste_forsok" | "reparasjon" | "rapport"; dato: string };

export type Saksmodell = {
  idag: string;
  input: KlageInput;
  faktorer: Faktorer;
  // With an answer about the repair that no longer fits the contact answer dropped.
  utfylling: Utfylling;
  // The exact day when known, otherwise the engine's estimate from «hvor lenge siden».
  kjopsdato: string;
  tidslinje: Hendelse[];
  kilder: Kildetekster;
  avklaringer: Avklaring[];
  // The buyer's own name, address, phone, e-mail, account number and plate: never sent to a model.
  kjente: Kjent[];
};

// A value that identifies the buyer. Whole values match in any case; a part of the name only as
// written, since «Per» or «Strøm» is also an ordinary word («500 kr per dag»).
export type Kjent = { tekst: string; somSkrevet: boolean };

export const somMonster = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const kjentMonster = (k: Kjent) => new RegExp(`(?<!\\p{L})${somMonster(k.tekst)}(?!\\p{L})`, k.somSkrevet ? "u" : "iu");

const EPOST = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
const MOBIL = /(?:\+47\s?)?(?<!\d)[49]\d{2}\s?\d{2}\s?\d{3}(?!\d)/g;
const FASTNETT = /(?:\+47\s?)?(?<!\d)\d{2}\s\d{2}\s\d{2}\s\d{2}(?!\d)/g;
const REGNR = /(?<![\p{L}\d])[A-ZÆØÅ]{2}\s?\d{4,5}(?!\d)/gu;

// Replaces what identifies the buyer with «…»: the values the case knows, longest first, and anything
// that looks like an e-mail address, a phone number or a plate.
export function rensTekst(t: string, kjente: Kjent[]): string {
  let r = t;
  for (const k of [...kjente].sort((a, b) => b.tekst.length - a.tekst.length)) {
    const m = kjentMonster(k);
    r = r.replace(new RegExp(m.source, `${m.flags}g`), "…");
  }
  return r.replace(EPOST, "…").replace(MOBIL, "…").replace(FASTNETT, "…").replace(REGNR, "…");
}

function kjenteOpplysninger(u: Utfylling): Kjent[] {
  const a = u.avsender;
  const hele = [a?.navn, a?.adresse, a?.telefon, a?.epost, a?.kontonummer, u.kjoretoy?.regnr, u.kjoretoy?.regnr.replace(/\s/g, "")];
  const deler = a ? a.navn.split(/\s+/) : [];
  const gyldig = (x: string | undefined): x is string => typeof x === "string" && x.trim().length >= 3;
  return [...hele.filter(gyldig).map((tekst) => ({ tekst, somSkrevet: false })), ...deler.filter(gyldig).map((tekst) => ({ tekst, somSkrevet: true }))];
}

function tidslinjeFor(input: KlageInput, u: Utfylling): Hendelse[] {
  const h: Hendelse[] = [];
  if (input.bilOgKjop.kjopsdato) h.push({ type: "kjop", dato: input.bilOgKjop.kjopsdato });
  if (u.feilen) h.push({ type: "feil", dato: u.feilen.dato });
  if (input.feilen.kontakt === "ja" && u.reklamasjon) {
    h.push({ type: "reklamasjon", dato: u.reklamasjon.dato });
    // `svarDato` is the dealer's answer, or the last attempt when the dealer has tried to repair.
    if (u.reklamasjon.svarDato) h.push({ type: u.retting === "forsokt" ? "siste_forsok" : "svar", dato: u.reklamasjon.svarDato });
  }
  if (u.retting === "reparert_selv" && u.reparasjon) h.push({ type: "reparasjon", dato: u.reparasjon.dato });
  if (input.bevis.rapportSierForKjop === true && u.rapport) h.push({ type: "rapport", dato: u.rapport.dato });
  // Stable: events on the same day keep the order above.
  return h.sort((a, b) => a.dato.localeCompare(b.dato));
}

export function lagSaksmodell(g: Grunnlag, idag: string): { ok: true; modell: Saksmodell } | { ok: false; feil: string } {
  const ar = g.utfylling.kjoretoy?.ar;
  const lest = tilKlageInput({ ...avledSvar(g.svar, g.utfylling, idag), ...(ar ? { bilAr: ar } : {}) }, idag);
  if (!lest.ok) return lest;
  const input = lest.input;
  const utfylling: Utfylling = { ...g.utfylling, retting: gyldigRetting(input.feilen.kontakt, g.utfylling.retting) };
  const kjente = kjenteOpplysninger(utfylling);
  const kilder: Kildetekster = {};
  for (const [k, t] of Object.entries(g.kilder ?? {}) as [Kilde, string | undefined][]) if (t?.trim()) kilder[k] = rensTekst(t.trim(), kjente);
  return {
    ok: true,
    modell: {
      idag,
      input,
      faktorer: beregnFaktorer(input, idag),
      utfylling,
      kjopsdato: kjopsdatoFor(input.bilOgKjop, idag),
      tidslinje: tidslinjeFor(input, utfylling),
      kilder,
      avklaringer: g.avklaringer ?? [],
      kjente,
    },
  };
}

// The first complaint with its dates named for what they are: the dealer's answer, or the last attempt.
function reklamasjonForModell(u: Utfylling): Record<string, unknown> | null {
  const r = u.reklamasjon;
  if (!r) return null;
  return {
    dato: r.dato,
    mate: r.mate,
    ...(r.forsok !== undefined && { antallForsok: r.forsok }),
    ...(r.svarDato && (u.retting === "forsokt" ? { sisteForsok: r.svarDato } : { forhandlerensSvar: r.svarDato })),
  };
}

// What the author and the reviewer are told about the case. The sender, the plate and the account are
// left out; free text is cleaned. The dealer is a business and is named.
export function sakForModell(m: Saksmodell): Record<string, unknown> {
  const { input, utfylling: u, faktorer: f } = m;
  const rens = (t: string) => rensTekst(t, m.kjente);
  return {
    kjopet: {
      kjopsdato: input.bilOgKjop.kjopsdato ?? null,
      kjopesumNok: input.bilOgKjop.kjopesumNok ?? null,
      kmVedKjop: input.bilOgKjop.kmVedKjop ?? null,
      bil: u.kjoretoy ? { merke: u.kjoretoy.merke, modell: u.kjoretoy.modell, forstRegistrert: u.kjoretoy.ar } : null,
      forbeholdIKontrakten: u.forbehold ?? null,
    },
    forhandler: u.forhandler ? { navn: u.forhandler.navn } : null,
    feilen: {
      kategorier: input.feilen.typer,
      titler: u.feilen?.feil ?? [],
      forsteGang: u.feilen?.dato ?? null,
      visteSegEtterLevering: NAAR[f.oppdaget],
      kjoperensBeskrivelse: u.feilen ? rens(u.feilen.egen) : null,
      godkjentTekst: u.feilen ? u.feilen.avsnitt.map(rens) : [],
      svarPaSporsmal: (u.feilen?.fakta ?? []).map((x) => ({ feil: x.feil, sporsmal: x.sporsmal, svar: rens(x.svar) })),
    },
    forKjopet: {
      kjenteTilFeilen: input.feilen.opplystForKjop,
      uriktigOpplysning: u.opplysning ? { kilde: u.opplysning.kilde, kjoperensGjengivelse: rens(u.opplysning.tekst) } : null,
    },
    kontakt: {
      tattOppMedForhandleren: input.feilen.kontakt,
      forhandlerensHandling: u.retting ?? null,
      forsteReklamasjon: input.feilen.kontakt === "ja" && u.reklamasjon ? reklamasjonForModell(u) : null,
      reparasjonAndreSteder: u.retting === "reparert_selv" ? (u.reparasjon ?? null) : null,
    },
    rapport:
      input.bevis.verkstedrapport || u.rapport
        ? { sierAtFeilenVarDerForKjop: input.bevis.rapportSierForKjop, fra: u.rapport ? rens(u.rapport.fra) : null, dato: u.rapport?.dato ?? null, kjoperensGjengivelse: u.rapport ? rens(u.rapport.sitat) : null }
        : null,
    krav: u.krav ? { ...u.krav, utgifter: u.krav.utgifter.map((x) => ({ ...x, ...(x.beskrivelse && { beskrivelse: rens(x.beskrivelse) }) })) } : null,
    avklaringer: m.avklaringer.map((a) => ({ ...a, svar: a.svar === null ? null : rens(a.svar) })),
    tidslinje: m.tidslinje,
  };
}
