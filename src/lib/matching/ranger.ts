import type { Lagret as Avgjorende } from "@/lib/avgjorende/skjema";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { erOpplysning } from "@/lib/feil/kategorier";
import { type RettsligPoeng, rettsligePoeng } from "./rett";
import type { Brukersak, Kandidat, Kategorisvar } from "./typer";
import { VEKTER } from "./vekter";

// Picks the decisions the letter can cite (docs/vedtaksvalg.md). Two levels:
//   A  the same defect: same subcategory, judged by the committee on its own (not together with
//      other defects), at least two quotes from the committee's assessment, and the car in the
//      decision not easier for the buyer on km, age or «som den er»
//   B  any decision that settled one of the buyer's legal points (rett.ts), with a quote
// Points sort within a level. For the kind «opplysning» the car's profile does not count: the defect
// existed at delivery. A win on a warranty counts only for a complaint about the warranty.
export type Kriterium = "underkategori" | "tidsniva" | "km" | "alder" | "som_den_er" | "krav" | "egen_vurdering" | "grunnlag";
// `strengere`/`mildere`: the decision was harder/easier for the buyer than the user's case.
// `delvis`: the decision granted the claim, but on more defects than this one. `ukjent`: the decision
// lacks the value. `ikke_oppgitt`: the user did (or there is no defect to compare), and it is left
// out of the maximum.
export type Treff = "likt" | "strengere" | "mildere" | "delvis" | "ulikt" | "ukjent" | "ikke_oppgitt";
export type Niva = "A" | "B";
// Quotes a level-A decision needs for its defect.
export const MIN_SITATER_A = 2;

export type Rangert = {
  id: number;
  niva: Niva;
  // The defect the decision is compared on, and the buyer's category it is compared with; null on level B.
  feil: AvledetFeil | null;
  hoved: string | null;
  rett: RettsligPoeng[];
  poengsum: number;
  treff: Record<Kriterium, Treff>;
};

export type Rangering = {
  kandidater: Rangert[];
  // Decisions per level before the list is cut to `kandidater`.
  perNiva: Record<Niva, number>;
};

type Vurdert = { treff: Treff; poeng: number };

const IKKE_OPPGITT: Vurdert = { treff: "ikke_oppgitt", poeng: 0 };
const UKJENT: Vurdert = { treff: "ukjent", poeng: 0 };
const intervall = (x: number | null, grenser: readonly number[]) => (x === null ? null : grenser.filter((g) => x >= g).length);

// Higher is harder for the buyer (later defect, more km, older car). Null in the decision is unknown,
// null from the user leaves the criterion out.
function retning(bruker: number | null, vedtak: number | null, p: { likt: number; naer: number }): Vurdert {
  if (bruker === null) return IKKE_OPPGITT;
  if (vedtak === null) return UKJENT;
  if (vedtak === bruker) return { treff: "likt", poeng: p.likt };
  return vedtak > bruker ? { treff: "strengere", poeng: p.naer } : { treff: "mildere", poeng: 0 };
}

// Whether the decision matches; null when the decision lacks the value.
function ja(likt: boolean | null, poeng: number): Vurdert {
  if (likt === null) return UKJENT;
  return likt ? { treff: "likt", poeng } : { treff: "ulikt", poeng: 0 };
}

// What the committee rested the defect on, against what the user has. A win on the seller's statement
// or an expert report is easier than the user's case when the user has neither. A concealed fact
// (§ 16 b) needs no statement, so the seller's silence matches it.
function grunnlag(k: Kandidat, f: AvledetFeil, kat: Kategorisvar, poeng: number): Vurdert {
  const likt: Vurdert = { treff: "likt", poeng };
  const mildere: Vurdert = { treff: "mildere", poeng: 0 };
  const har = (x: boolean | null): Vurdert => (x === null ? IKKE_OPPGITT : x ? likt : mildere);
  switch (f.bevisgrunnlag) {
    case "selgers_opplysning":
      return k.mangelsgrunnlag?.includes("tilbakeholdt_opplysning") && !k.mangelsgrunnlag.includes("feil_opplysninger") ? likt : har(kat.opplysning);
    case "sakkyndig_dokumentasjon":
      return har(kat.verksted);
    case "formodning_ikke_motbevist":
      // The presumption helps the user only within the presumption period.
      return kat.niva === 1 ? likt : mildere;
    case "utvalgets_skjonn":
      return likt;
    default:
      // Admitted, undisputed or not stated: the committee did not weigh the evidence.
      return UKJENT;
  }
}

const IKKE_DROFTET = new Set(["erkjent_av_selger", "uomtvistet"]);

// Won on a warranty (fkjl § 18 a, named in the quote), not on a defect at delivery.
const paGaranti = (k: Kandidat, f: AvledetFeil) => !!k.paragrafer?.includes("fkjl § 18a") && /garanti/i.test(f.sitat ?? "");

// Points for the decision, and for the defect when there is one to compare.
function vurder(k: Kandidat, f: AvledetFeil | null, kat: Kategorisvar | null, sak: Brukersak): Pick<Rangert, "poengsum" | "treff"> {
  // «Som den er» is harder for the buyer; as numbers, true > false.
  const sde = (x: boolean | null) => (x === null ? null : Number(x));
  const flereFeil = k.feil.filter((x) => x.utfall === "medhold").length > 1;
  const vurdert: Record<Kriterium, Vurdert> = {
    underkategori:
      !f || !kat?.under.length ? IKKE_OPPGITT : ja(f.underkategori === null ? null : kat.under.includes(f.underkategori), VEKTER.underkategori.likt),
    tidsniva: !f || !kat ? IKKE_OPPGITT : retning(kat.niva, f.tidsniva, VEKTER.tidsniva),
    km: retning(intervall(sak.km, VEKTER.kmGrenser), intervall(k.km, VEKTER.kmGrenser), VEKTER.km),
    alder: retning(intervall(sak.alder, VEKTER.alderGrenser), intervall(k.alder, VEKTER.alderGrenser), VEKTER.alder),
    som_den_er: retning(sde(sak.somDenEr), sde(k.somDenEr), VEKTER.som_den_er),
    // What the committee granted, not what the buyer claimed; in part when other defects shared it.
    krav:
      sak.krav === null
        ? IKKE_OPPGITT
        : !k.sanksjoner?.length
          ? UKJENT
          : !k.sanksjoner.includes(sak.krav)
            ? { treff: "ulikt", poeng: 0 }
            : flereFeil
              ? { treff: "delvis", poeng: VEKTER.krav.naer }
              : { treff: "likt", poeng: VEKTER.krav.likt },
    // The committee weighed this defect itself: not together with others, not admitted or undisputed.
    egen_vurdering: !f ? IKKE_OPPGITT : ja(!f.samlet && !IKKE_DROFTET.has(f.bevisgrunnlag ?? ""), VEKTER.egen_vurdering.likt),
    grunnlag: !f || !kat ? IKKE_OPPGITT : grunnlag(k, f, kat, VEKTER.grunnlag.likt),
  };
  const verdier = Object.values(vurdert);
  return {
    poengsum: verdier.reduce((s, x) => s + x.poeng, 0),
    treff: Object.fromEntries(Object.entries(vurdert).map(([n, x]) => [n, x.treff])) as Record<Kriterium, Treff>,
  };
}

// The car in the decision is not easier for the buyer on km, age or «som den er». Unknown is not easier.
function profilOk(k: Kandidat, sak: Brukersak): boolean {
  const mild = (b: number | null, x: number | null) => b !== null && x !== null && x < b;
  if (mild(intervall(sak.km, VEKTER.kmGrenser), intervall(k.km, VEKTER.kmGrenser))) return false;
  if (mild(intervall(sak.alder, VEKTER.alderGrenser), intervall(k.alder, VEKTER.alderGrenser))) return false;
  return !(sak.somDenEr === true && k.somDenEr !== true);
}

// The same defect as the buyer's: the same subcategory, or the same main category when the buyer
// chose no subcategory or there are none to choose from (the warranty).
export function sammeFeil(f: AvledetFeil, kat: Kategorisvar): boolean {
  if (f.hovedkategori !== kat.hoved) return false;
  if (!kat.under.length) return true;
  return f.underkategori !== null && kat.under.includes(f.underkategori);
}

// What the committee rested an accepted defect on, from the extraction.
export const avgjorendeFor = (a: Avgjorende | null, f: AvledetFeil) => a?.feil.find((x) => x.id === f.id) ?? null;

// Whether an accepted defect makes the decision level A against one of the buyer's categories.
export function nivaA(k: Kandidat, f: AvledetFeil, kat: Kategorisvar, sak: Brukersak): boolean {
  if (f.utfall !== "medhold" || !sammeFeil(f, kat)) return false;
  if (kat.hoved !== "garanti" && paGaranti(k, f)) return false;
  const a = avgjorendeFor(k.avgjorende, f);
  if (!a || a.sitater.length < MIN_SITATER_A || f.samlet || a.samlet_med.length) return false;
  // From v4: the assessment names this defect and found it a defect on its own.
  if (a.nevnt_i_vurderingen === false || a.vurdert_for_seg === false) return false;
  return erOpplysning(f.hovedkategori, f.underkategori) || profilOk(k, sak);
}

// The buyer's legal points the decision settled. From v4 each needs the committee's own sentence for it.
export function rettFor(k: Kandidat, sak: Brukersak): RettsligPoeng[] {
  const rett = rettsligePoeng(k, sak);
  const sitert = k.avgjorende?.rettslige_sitater;
  return sitert ? rett.filter((p) => sitert.some((s) => s.poeng === p)) : rett;
}

function plasser(k: Kandidat, sak: Brukersak): Rangert | null {
  const rett = rettFor(k, sak);
  let best: Rangert | null = null;
  for (const kat of sak.kategorier)
    for (const f of k.feil) {
      if (!nivaA(k, f, kat, sak)) continue;
      const r: Rangert = { id: k.id, niva: "A", feil: f, hoved: kat.hoved, rett, ...vurder(k, f, kat, sak) };
      if (!best || r.poengsum > best.poengsum) best = r;
    }
  if (best) return best;
  const harSitat = !!k.avgjorende?.rettslige_sitater?.length || !!k.avgjorende?.feil.some((a) => a.sitater.length);
  return rett.length && harSitat ? { id: k.id, niva: "B", feil: null, hoved: null, rett, ...vurder(k, null, null, sak) } : null;
}

// One decision published twice («FKU-2025-55355» and «FKU-2025-55355-2») counts once.
const sakskode = (k: Kandidat) => k.saksnummer?.replace(/^(FKU-\d{4}-\d+)-\d+$/, "$1") ?? `id:${k.id}`;

// Level A first, then B; within A by points, within B by the number of the buyer's legal points hit.
// The buyer's case with one fault only: each fault is matched with decisions of its own, so the letter
// can cite one decision per fault. The car, the claim and the attempts are the case's.
export const sakForFeil = (sak: Brukersak, i: number): Brukersak => ({ ...sak, kategorier: [sak.kategorier[i]] });

export function ranger(alle: Kandidat[], sak: Brukersak): Rangering {
  const etterId = new Map(alle.map((k) => [k.id, k]));
  const dato = (r: Rangert) => etterId.get(r.id)!.vedtaksdato ?? "";
  const sett = new Set<string>();
  const plassert = alle
    .map((k) => plasser(k, sak))
    .filter((r): r is Rangert => r !== null)
    .sort(
      (a, b) =>
        a.niva.localeCompare(b.niva) ||
        (a.niva === "B" ? b.rett.length - a.rett.length : 0) ||
        b.poengsum - a.poengsum ||
        Number(b.treff.tidsniva === "likt") - Number(a.treff.tidsniva === "likt") ||
        dato(b).localeCompare(dato(a)) ||
        a.id - b.id,
    )
    .filter((r) => {
      const kode = sakskode(etterId.get(r.id)!);
      return !sett.has(kode) && !!sett.add(kode);
    });
  const perNiva: Record<Niva, number> = { A: 0, B: 0 };
  for (const r of plassert) perNiva[r.niva]++;
  return { kandidater: plassert.slice(0, VEKTER.kandidater), perNiva };
}

// One ranking per fault, in the order of sak.kategorier.
export const rangerPerFeil = (alle: Kandidat[], sak: Brukersak): Rangering[] => sak.kategorier.map((_, i) => ranger(alle, sakForFeil(sak, i)));
