import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import { komponenttype } from "@/lib/feil/kategorier";
import { type RettsligPoeng, rettsligePoeng } from "./rett";
import type { Brukersak, Kandidat, Kategorisvar } from "./typer";
import { VEKTER, type Vekter } from "./vekter";

// Picks the decisions with medhold a model chooses the letter's precedent from (docs/vedtaksvalg.md,
// phase 1). Each accepted defect is placed on the highest step it reaches against the buyer's case;
// the decision takes its best defect's step. Within a step, points decide. The steps:
//   1  same subcategory, time level known and the same or later, car not milder on both km and age
//   2  same subcategory, time level unknown or one milder, same profile rule
//   3  another subcategory of the same kind of part (kategorier.ts), time level the same or later
//   4  same main category
//   5  no comparable defect, but the decision settled one of the buyer's legal points (rett.ts)
// Steps 1–4 need a quote. For the kind «opplysning» time and profile do not count: the defect
// existed at delivery. A win on a warranty counts only for a complaint about the warranty.

export type Kriterium = "underkategori" | "tidsniva" | "km" | "alder" | "som_den_er" | "krav" | "egen_vurdering" | "grunnlag";
// `strengere`/`mildere`: the decision was harder/easier for the buyer than the user's case.
// `delvis`: the decision granted the claim, but on more defects than this one. `ukjent`: the decision
// lacks the value. `ikke_oppgitt`: the user did (or there is no defect to compare), and it is left
// out of the maximum.
export type Treff = "likt" | "strengere" | "mildere" | "delvis" | "ulikt" | "ukjent" | "ikke_oppgitt";
export type Trinn = 1 | 2 | 3 | 4 | 5;

export type Rangert = {
  id: number;
  trinn: Trinn;
  // The defect the decision is compared on, and the buyer's category it is compared with; null on step 5.
  feil: AvledetFeil | null;
  hoved: string | null;
  rett: RettsligPoeng[];
  poengsum: number;
  maks: number;
  treff: Record<Kriterium, Treff>;
};

export type Rangering = {
  kandidater: Rangert[];
  // Decisions per step before the list is cut to `kandidater`.
  perTrinn: Record<Trinn, number>;
};

type Vurdert = { treff: Treff; poeng: number; maks: number };

const IKKE_OPPGITT: Vurdert = { treff: "ikke_oppgitt", poeng: 0, maks: 0 };
const ukjent = (maks: number): Vurdert => ({ treff: "ukjent", poeng: 0, maks });
const intervall = (x: number | null, grenser: readonly number[]) => (x === null ? null : grenser.filter((g) => x >= g).length);

// Higher is harder for the buyer (later defect, more km, older car). Null in the decision is unknown,
// null from the user leaves the criterion out.
function retning(bruker: number | null, vedtak: number | null, v: { likt: number; naer: number }): Vurdert {
  if (bruker === null) return IKKE_OPPGITT;
  if (vedtak === null) return ukjent(v.likt);
  if (vedtak === bruker) return { treff: "likt", poeng: v.likt, maks: v.likt };
  return vedtak > bruker ? { treff: "strengere", poeng: v.naer, maks: v.likt } : { treff: "mildere", poeng: 0, maks: v.likt };
}

// Whether the decision matches; null when the decision lacks the value.
function ja(likt: boolean | null, poeng: number): Vurdert {
  if (likt === null) return ukjent(poeng);
  return likt ? { treff: "likt", poeng, maks: poeng } : { treff: "ulikt", poeng: 0, maks: poeng };
}

// What the committee rested the defect on, against what the user has. A win on the seller's statement
// or an expert report is easier than the user's case when the user has neither. A concealed fact
// (§ 16 b) needs no statement, so the seller's silence matches it.
function grunnlag(k: Kandidat, f: AvledetFeil, kat: Kategorisvar, poeng: number): Vurdert {
  const likt: Vurdert = { treff: "likt", poeng, maks: poeng };
  const har = (x: boolean | null): Vurdert => (x === null ? IKKE_OPPGITT : x ? likt : { treff: "mildere", poeng: 0, maks: poeng });
  switch (f.bevisgrunnlag) {
    case "selgers_opplysning":
      return k.mangelsgrunnlag?.includes("tilbakeholdt_opplysning") && !k.mangelsgrunnlag.includes("feil_opplysninger") ? likt : har(kat.opplysning);
    case "sakkyndig_dokumentasjon":
      return har(kat.verksted);
    case "formodning_ikke_motbevist":
      // The presumption helps the user only within the presumption period.
      return kat.niva === 1 ? likt : { treff: "mildere", poeng: 0, maks: poeng };
    case "utvalgets_skjonn":
      return likt;
    default:
      // Admitted, undisputed or not stated: the committee did not weigh the evidence.
      return ukjent(poeng);
  }
}

const IKKE_DROFTET = new Set(["erkjent_av_selger", "uomtvistet"]);

// Won on a warranty (fkjl § 18 a, named in the quote), not on a defect at delivery.
const paGaranti = (k: Kandidat, f: AvledetFeil) => !!k.paragrafer?.includes("fkjl § 18a") && /garanti/i.test(f.sitat ?? "");

// Points for the decision, and for the defect when there is one to compare.
function vurder(k: Kandidat, f: AvledetFeil | null, kat: Kategorisvar | null, sak: Brukersak, v: Vekter): Pick<Rangert, "poengsum" | "maks" | "treff"> {
  // «Som den er» is harder for the buyer; as numbers, true > false.
  const sde = (x: boolean | null) => (x === null ? null : Number(x));
  const flereFeil = k.feil.filter((x) => x.utfall === "medhold").length > 1;
  const vurdert: Record<Kriterium, Vurdert> = {
    underkategori:
      !f || !kat?.under.length ? IKKE_OPPGITT : ja(f.underkategori === null ? null : kat.under.includes(f.underkategori), v.underkategori.likt),
    tidsniva: !f || !kat ? IKKE_OPPGITT : retning(kat.niva, f.tidsniva, v.tidsniva),
    km: retning(intervall(sak.km, v.kmGrenser), intervall(k.km, v.kmGrenser), v.km),
    alder: retning(intervall(sak.alder, v.alderGrenser), intervall(k.alder, v.alderGrenser), v.alder),
    som_den_er: retning(sde(sak.somDenEr), sde(k.somDenEr), v.som_den_er),
    // What the committee granted, not what the buyer claimed; in part when other defects shared it.
    krav:
      sak.krav === null
        ? IKKE_OPPGITT
        : !k.sanksjoner?.length
          ? ukjent(v.krav.likt)
          : !k.sanksjoner.includes(sak.krav)
            ? { treff: "ulikt", poeng: 0, maks: v.krav.likt }
            : flereFeil
              ? { treff: "delvis", poeng: v.krav.naer, maks: v.krav.likt }
              : { treff: "likt", poeng: v.krav.likt, maks: v.krav.likt },
    // The committee weighed this defect itself: not together with others, not admitted or undisputed.
    egen_vurdering: !f ? IKKE_OPPGITT : ja(!f.samlet && !IKKE_DROFTET.has(f.bevisgrunnlag ?? ""), v.egen_vurdering.likt),
    grunnlag: !f || !kat ? IKKE_OPPGITT : grunnlag(k, f, kat, v.grunnlag.likt),
  };
  const verdier = Object.values(vurdert);
  return {
    poengsum: verdier.reduce((s, x) => s + x.poeng, 0),
    maks: verdier.reduce((s, x) => s + x.maks, 0),
    treff: Object.fromEntries(Object.entries(vurdert).map(([n, x]) => [n, x.treff])) as Record<Kriterium, Treff>,
  };
}

// Not easier for the buyer on both km and age.
function profilOk(k: Kandidat, sak: Brukersak, v: Vekter): boolean {
  const mild = (b: number | null, x: number | null) => b !== null && x !== null && x < b;
  return !(mild(intervall(sak.km, v.kmGrenser), intervall(k.km, v.kmGrenser)) && mild(intervall(sak.alder, v.alderGrenser), intervall(k.alder, v.alderGrenser)));
}

// The step one accepted defect reaches against one of the buyer's categories; null when none.
export function trinnFor(k: Kandidat, f: AvledetFeil, kat: Kategorisvar, sak: Brukersak, v: Vekter = VEKTER): Trinn | null {
  if (!f.sitat) return null;
  const type = komponenttype(f.hovedkategori, f.underkategori);
  const opplysning = type === "opplysning";
  const profil = opplysning || profilOk(k, sak, v);
  const sammeUnder = f.hovedkategori === kat.hoved && f.underkategori !== null && kat.under.includes(f.underkategori);
  if (sammeUnder && profil && (opplysning || (f.tidsniva !== null && f.tidsniva >= kat.niva))) return 1;
  if (sammeUnder && profil && (f.tidsniva === null || f.tidsniva === kat.niva - 1)) return 2;
  const tidOk = opplysning || f.tidsniva === null || f.tidsniva >= kat.niva;
  const typer = new Set(kat.under.length ? kat.under.map((u) => komponenttype(kat.hoved, u)) : [komponenttype(kat.hoved, null)]);
  if (!sammeUnder && type && typer.has(type) && tidOk) return 3;
  if (f.hovedkategori === kat.hoved) return 4;
  return null;
}

function plasser(k: Kandidat, sak: Brukersak, v: Vekter): Rangert | null {
  const rett = rettsligePoeng(k, sak);
  let best: Rangert | null = null;
  for (const kat of sak.kategorier)
    for (const f of k.feil) {
      if (f.utfall !== "medhold" || (kat.hoved !== "garanti" && paGaranti(k, f))) continue;
      const trinn = trinnFor(k, f, kat, sak, v);
      if (trinn === null) continue;
      const r: Rangert = { id: k.id, trinn, feil: f, hoved: kat.hoved, rett, ...vurder(k, f, kat, sak, v) };
      if (!best || r.trinn < best.trinn || (r.trinn === best.trinn && r.poengsum > best.poengsum)) best = r;
    }
  if (best) return best;
  return rett.length ? { id: k.id, trinn: 5, feil: null, hoved: null, rett, ...vurder(k, null, null, sak, v) } : null;
}

// One decision published twice («FKU-2025-55355» and «FKU-2025-55355-2») counts once.
const sakskode = (k: Kandidat) => k.saksnummer?.replace(/^(FKU-\d{4}-\d+)-\d+$/, "$1") ?? `id:${k.id}`;

export function ranger(alle: Kandidat[], sak: Brukersak, v: Vekter = VEKTER): Rangering {
  const etterId = new Map(alle.map((k) => [k.id, k]));
  const dato = (r: Rangert) => etterId.get(r.id)!.vedtaksdato ?? "";
  const sammeHoved = (r: Rangert) => r.feil !== null && r.feil.hovedkategori === r.hoved;
  const etterPoeng = (a: Rangert, b: Rangert) =>
    b.poengsum - a.poengsum || Number(b.treff.tidsniva === "likt") - Number(a.treff.tidsniva === "likt") || dato(b).localeCompare(dato(a)) || a.id - b.id;

  const sett = new Set<string>();
  const plassert = alle
    .map((k) => plasser(k, sak, v))
    .filter((r): r is Rangert => r !== null)
    // Same main category first on step 3; most legal points first on step 5.
    .sort((a, b) => a.trinn - b.trinn || Number(sammeHoved(b)) - Number(sammeHoved(a)) || b.rett.length - a.rett.length || etterPoeng(a, b))
    .filter((r) => {
      const kode = sakskode(etterId.get(r.id)!);
      return !sett.has(kode) && !!sett.add(kode);
    });

  const sammenlignbare = plassert.filter((r) => r.trinn <= 4).slice(0, v.sammenlignbare);
  const valgt = new Set(sammenlignbare.map((r) => r.id));
  const rettslige = plassert.filter((r) => !valgt.has(r.id) && r.rett.length).sort((a, b) => b.rett.length - a.rett.length || etterPoeng(a, b));
  const perTrinn: Record<Trinn, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of plassert) perTrinn[r.trinn]++;
  return { kandidater: [...sammenlignbare, ...rettslige.slice(0, v.kandidater - sammenlignbare.length)], perTrinn };
}
