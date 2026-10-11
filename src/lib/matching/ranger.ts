import type { AvledetFeil, Tidsniva } from "@/lib/feilvurdering/skjema";
import { VEKTER, type Vekter } from "./vekter";

// Ranks decisions with medhold by how closely they match the user's case, without an LLM and the
// same way every time. A decision qualifies through one accepted defect in one of the user's main
// categories; category, subcategory, time and basis are compared on that same defect.
//
// Order: the user's subcategory first, then the time filter, then points. A defect must be at the user's time level or
// stricter for the buyer (a higher level); one level milder is let through for the user's
// subcategory, and any level when fewer than `minTreff` decisions pass. A buyer who won on worse
// terms (later defect, older car, more km, «som den er») makes the user's case as strong or stronger,
// so that counts in part; better terms count nothing. A defect the committee weighed on its own goes
// before one judged together with others or not disputed. Matches below `terskel` of their maximum
// are left out.

export type Krav = "retting" | "prisavslag" | "heving";

export type Brukersak = {
  // «Vet ikke ennå» is left out before ranking; it cannot be compared. `opplysning`: the seller said
  // or wrote something about the defect before the sale. `verksted`: a workshop has examined it.
  kategorier: { hoved: string; under: string[]; niva: Tidsniva; opplysning: boolean | null; verksted: boolean | null }[];
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
  krav: Krav | null;
};

export type Kandidat = {
  id: number;
  vedtaksdato: string | null;
  km: number | null;
  alder: number | null;
  somDenEr: boolean | null;
  sanksjoner: string[] | null;
  // vedtak.mangelsgrunnlag and vedtak.paragrafer, to tell a concealed fact from a false statement and
  // to find wins on a warranty.
  mangelsgrunnlag: string[] | null;
  paragrafer: string[] | null;
  feil: AvledetFeil[];
};

export const KRITERIER = ["underkategori", "tidsniva", "km", "alder", "som_den_er", "krav", "egen_vurdering", "grunnlag"] as const;
export type Kriterium = (typeof KRITERIER)[number];
// `strengere`/`mildere`: the decision was harder/easier for the buyer than the user's case.
// `delvis`: the decision granted the claim, but on more defects than this one. `ukjent`: the decision
// lacks the value. `ikke_oppgitt`: the user did, and it is left out of the maximum.
export type Treff = "likt" | "strengere" | "mildere" | "delvis" | "ulikt" | "ukjent" | "ikke_oppgitt";

export type Rangert = {
  id: number;
  poengsum: number;
  maks: number;
  feil: AvledetFeil;
  // The defect is at the user's time level or stricter (or the level is unknown); `nesten`: one milder.
  tidOk: boolean;
  nesten: boolean;
  treff: Record<Kriterium, Treff>;
};

export type Rangering = {
  rangert: Rangert[];
  // Decisions that pass the time filter (all of them when it is dropped); `rangert` may hold more.
  antall: number;
  // Decisions per main category that pass the time filter; one matching two categories counts in both.
  perKategori: Record<string, number>;
  svaktGrunnlag: boolean;
  // The time filter was dropped, or the list holds defects at a milder time level.
  utenTidsfilter: boolean;
};

type Vurdert = { treff: Treff; poeng: number; maks: number };

const IKKE_OPPGITT: Vurdert = { treff: "ikke_oppgitt", poeng: 0, maks: 0 };
const ukjent = (maks: number): Vurdert => ({ treff: "ukjent", poeng: 0, maks });

const intervall = (x: number, grenser: readonly number[]) => grenser.filter((g) => x >= g).length;

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
function grunnlag(k: Kandidat, f: AvledetFeil, kat: Brukersak["kategorier"][number], poeng: number): Vurdert {
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

function vurder(k: Kandidat, f: AvledetFeil, sak: Brukersak, v: Vekter): Rangert {
  const kat = sak.kategorier.find((x) => x.hoved === f.hovedkategori)!;
  const iv = (x: number | null, g: readonly number[]) => (x === null ? null : intervall(x, g));
  // «Som den er» is harder for the buyer; as numbers, true > false.
  const sde = (x: boolean | null) => (x === null ? null : Number(x));
  const flereFeil = k.feil.filter((x) => x.utfall === "medhold").length > 1;
  const vurdert: Record<Kriterium, Vurdert> = {
    underkategori: !kat.under.length ? IKKE_OPPGITT : ja(f.underkategori === null ? null : kat.under.includes(f.underkategori), v.underkategori.likt),
    tidsniva: retning(kat.niva, f.tidsniva, v.tidsniva),
    km: retning(iv(sak.km, v.kmGrenser), iv(k.km, v.kmGrenser), v.km),
    alder: retning(iv(sak.alder, v.alderGrenser), iv(k.alder, v.alderGrenser), v.alder),
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
    egen_vurdering: ja(!f.samlet && !IKKE_DROFTET.has(f.bevisgrunnlag ?? ""), v.egen_vurdering.likt),
    grunnlag: grunnlag(k, f, kat, v.grunnlag.likt),
  };
  const verdier = Object.values(vurdert);
  return {
    id: k.id,
    poengsum: verdier.reduce((s, x) => s + x.poeng, 0),
    maks: verdier.reduce((s, x) => s + x.maks, 0),
    feil: f,
    tidOk: f.tidsniva === null || f.tidsniva >= kat.niva,
    nesten: f.tidsniva === kat.niva - 1,
    treff: Object.fromEntries(KRITERIER.map((n) => [n, vurdert[n].treff])) as Record<Kriterium, Treff>,
  };
}

const tidLikt = (r: Rangert) => r.treff.tidsniva === "likt";

export function ranger(kandidater: Kandidat[], sak: Brukersak, v: Vekter = VEKTER): Rangering {
  const sterk = (r: Rangert) => r.poengsum >= v.terskel * r.maks;
  const underLikt = (r: Rangert) => r.treff.underkategori === "likt";
  const egen = (r: Rangert) => r.treff.egen_vurdering === "likt";
  // May be shown: strong enough, and passes the time filter or is one level milder in the user's subcategory.
  const vises = (r: Rangert, fallback: boolean) => sterk(r) && (r.tidOk || fallback || (underLikt(r) && r.nesten));
  // Subcategory, the time filter, the committee's own assessment, points, the user's own level.
  const bedre = (a: Rangert, b: Rangert) =>
    Number(underLikt(b)) - Number(underLikt(a)) ||
    Number(b.tidOk) - Number(a.tidOk) ||
    Number(egen(b)) - Number(egen(a)) ||
    b.poengsum - a.poengsum ||
    Number(tidLikt(b)) - Number(tidLikt(a));

  // Every accepted defect in the user's categories, scored; the best one that may be shown stands
  // for the decision.
  const alle = kandidater.flatMap((k) => {
    // A win on a warranty counts only for a complaint about the warranty.
    const feil = k.feil.filter((f) => f.utfall === "medhold" && sak.kategorier.some((x) => x.hoved === f.hovedkategori) && (f.hovedkategori === "garanti" || !paGaranti(k, f)));
    if (!feil.length) return [];
    return [{ vurdert: feil.map((f) => vurder(k, f, sak, v)) }];
  });

  const passer = alle.filter((x) => x.vurdert.some((r) => r.tidOk));
  const fallback = passer.length < v.minTreff;
  const perKategori: Record<string, number> = Object.fromEntries(sak.kategorier.map((x) => [x.hoved, 0]));
  for (const x of fallback ? alle : passer)
    for (const h of new Set(x.vurdert.filter((r) => fallback || r.tidOk).map((r) => r.feil.hovedkategori))) perKategori[h]++;

  const dato = new Map(kandidater.map((k) => [k.id, k.vedtaksdato ?? ""]));
  const rangert = alle
    .flatMap((x) => {
      const synlige = x.vurdert.filter((r) => vises(r, fallback));
      return synlige.length ? [synlige.reduce((a, b) => (bedre(a, b) > 0 ? b : a))] : [];
    })
    .sort((a, b) => bedre(a, b) || dato.get(b.id)!.localeCompare(dato.get(a.id)!) || a.id - b.id);

  const topp = rangert.slice(0, v.topp);
  const best = rangert[0];
  const utenTidsfilter = fallback || topp.some((r) => !r.tidOk);
  const svaktGrunnlag = utenTidsfilter || rangert.length < v.minTreff || !best || best.poengsum < v.svaktAndel * best.maks;
  return { rangert, antall: (fallback ? alle : passer).length, perKategori, svaktGrunnlag, utenTidsfilter };
}
