"use server";

// The letter, built only here so that the browser never gets the code that writes it or the text it
// hides. Before payment the preview: the draft's letter redacted (forhandsvisning.ts) and the cards
// of «Lignende saker»; nothing is saved and no answer is logged. After payment the whole letter, only
// for the owner, with the car and the faults as bought (laas).
import { headers } from "next/headers";
import { byggBrev, emne, tilTekst } from "@/lib/app/brev";
import type { Blokk, Presedens } from "@/lib/app/brevtyper";
import { idag } from "@/lib/app/dato";
import { erObjekt } from "@/lib/app/flett";
import { forhandsvisning } from "@/lib/app/forhandsvisning";
import { laas, rensSkjema } from "@/lib/app/saken";
import { syncAreas } from "@/lib/app/skjema";
import { utkastResultat, utkastTilSvar } from "@/lib/app/utkast";
import type { Kriterium, Treff } from "@/lib/matching/ranger";
import { SANKSJONER } from "@/lib/feilvurdering/skjema";
import { ipFra, lagGrense } from "@/lib/rategrense";
import { hentEgenSak } from "@/lib/sak/db";
import { lignendeFor } from "./lignende-db";
import { rensUtkast } from "./rens";
import { feiltekst } from "@/lib/logg";

type Feil = { ok: false; melding: string };
export type Forhandsvist = { ok: true; blokker: Blokk[]; lignende: Awaited<ReturnType<typeof lignendeFor>> | null } | Feil;
export type FulltBrev = { ok: true; blokker: Blokk[]; tekst: string; emne: string } | Feil;

// The letter is fetched again as the buyer types (debounced in the browser).
const forMangeForhandsvisninger = lagGrense({ antall: 120, vinduMs: 60_000 });
const forMangeBrev = lagGrense({ antall: 120, vinduMs: 60_000 });
const ipAdresse = async () => ipFra(await headers());
const FOR_MANGE: Feil = { ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." };

export async function forhandsvis(inn: { utkast: unknown }): Promise<Forhandsvist> {
  if (forMangeForhandsvisninger(await ipAdresse())) return FOR_MANGE;
  const dag = idag();
  const utkast = rensUtkast(inn?.utkast, dag);
  if (!utkast) return { ok: false, melding: "Noe er galt med svarene. Prøv igjen." };
  try {
    const svar = utkastTilSvar(utkast);
    // A case the letter does not cover gets no decisions to compare with. When the database fails, the
    // preview is built without them (only the error's message is logged, never the answers).
    const lignende =
      svar && !["utenfor", "frist"].includes(utkastResultat(utkast, dag).tier)
        ? await lignendeFor(svar).catch((e: unknown) => {
            console.error("lignende saker feilet", feiltekst(e));
            return null;
          })
        : null;
    return { ok: true, blokker: forhandsvisning(utkast.skjema, lignende?.kort[0] ?? null, dag), lignende };
  } catch (e) {
    console.error("forhåndsvisningen feilet", feiltekst(e));
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}

const KRITERIER: readonly string[] = ["underkategori", "tidsniva", "km", "alder", "som_den_er", "krav", "egen_vurdering", "grunnlag"] satisfies Kriterium[];
const TREFF: readonly string[] = ["likt", "strengere", "mildere", "delvis", "ulikt", "ukjent", "ikke_oppgitt"] satisfies Treff[];

const tekst = (v: unknown, maks: number): v is string => typeof v === "string" && v.length <= maks;
const tekstEllerNull = (v: unknown, maks: number): v is string | null => v === null || tekst(v, maks);
const tallEllerNull = (v: unknown): v is number | null => v === null || (typeof v === "number" && Number.isFinite(v));
const boolEllerNull = (v: unknown): v is boolean | null => v === null || typeof v === "boolean";

// The decision the letter cites, as the browser sends it back from «Lignende vedtak»: «venter», none, or a
// Presedens checked field by field. Undefined when it is anything else. Only the known fields are kept.
function rensPresedens(v: unknown): Presedens | "venter" | null | undefined {
  if (v === null || v === "venter") return v;
  if (!erObjekt(v)) return undefined;
  const { id, saksnummer, vedtaksdato, bil, utfall, avsnitt, kildeUrl, utvalg, anbefalt, niva, gjaldt, km, alder, somDenEr, likhet, treff } = v;
  const gyldig =
    typeof id === "number" &&
    Number.isSafeInteger(id) &&
    id > 0 &&
    tekstEllerNull(saksnummer, 200) &&
    tekstEllerNull(vedtaksdato, 200) &&
    tekst(bil, 200) &&
    Array.isArray(utfall) &&
    utfall.length <= 5 &&
    utfall.every((x) => SANKSJONER.includes(x)) &&
    tekst(avsnitt, 4000) &&
    (kildeUrl === null || (tekst(kildeUrl, 300) && kildeUrl.startsWith("https://"))) &&
    tekst(utvalg, 200) &&
    typeof anbefalt === "boolean" &&
    (niva === "A" || niva === "B") &&
    // The legal points of a level-B decision, joined: all nine come to about 520 characters.
    tekst(gjaldt, 600) &&
    tallEllerNull(km) &&
    tallEllerNull(alder) &&
    boolEllerNull(somDenEr) &&
    typeof likhet === "number" &&
    likhet >= 0 &&
    likhet <= 100 &&
    erObjekt(treff) &&
    Object.entries(treff).every(([k, t]) => KRITERIER.includes(k) && typeof t === "string" && TREFF.includes(t));
  if (!gyldig) return undefined;
  return { id, saksnummer, vedtaksdato, bil, utfall, avsnitt, kildeUrl, utvalg, anbefalt, niva, gjaldt, km, alder, somDenEr, likhet, treff: treff as Record<Kriterium, Treff> };
}

// `presedens` is the decision picked in «Lignende vedtak», or «venter» while the list is still being fetched.
export async function fulltBrev(inn: { id: unknown; skjema: unknown; presedens: unknown }): Promise<FulltBrev> {
  if (forMangeBrev(await ipAdresse())) return FOR_MANGE;
  try {
    const lagret = await hentEgenSak(inn?.id);
    if (!lagret) return { ok: false, melding: "Brevet er ikke betalt." };
    const dag = idag();
    const skjema = rensSkjema(inn.skjema, dag);
    const presedens = rensPresedens(inn.presedens);
    if (!skjema || presedens === undefined) return { ok: false, melding: "Noe er galt med svarene. Prøv igjen." };
    const blokker = byggBrev(syncAreas(laas(lagret.skjema, skjema)), presedens, dag);
    return { ok: true, blokker, tekst: tilTekst(blokker), emne: emne(blokker) };
  } catch (e) {
    console.error("brevet feilet", feiltekst(e));
    return { ok: false, melding: "Noe gikk galt. Prøv igjen." };
  }
}
