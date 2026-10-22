// Reads one agent answer. Hard errors (not the decision asked for, no list of defects, duplicate
// ids) reject the whole answer; everything else is corrected or set to null, with the reason in
// `kontroll`. Quotes are checked against the redacted full text. The quote rules are pass 2's
// (branch pass2, src/lib/analyse/verifiser.ts), which held up in its pilot.
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { AVSLAGSGRUNNER, BEVISGRUNNLAG, type Feil, FORMODNING, SANKSJONER, type Svar, UTENFOR, UTFALL, VISTE_SEG } from "./skjema";

const MIN_SITATBIT = 20;
const MAKS_KOMPONENT = 60;

export function normaliser(s: string): string {
  return s
    .replace(/[«»“”„"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// PDF text breaks words across lines with a hyphen. A real compound («EU-kontroll») must keep it,
// a broken word («rust-skader» → «rustskader») must lose it; try both.
const BINDESTREK_VED_BRUDD = /(\p{L})-[ \t]*\r?\n\s*(\p{L})/gu;
export function fulltekstVarianter(fulltekst: string): string[] {
  return [normaliser(fulltekst.replace(BINDESTREK_VED_BRUDD, "$1$2")), normaliser(fulltekst.replace(BINDESTREK_VED_BRUDD, "$1-$2"))];
}

// Every piece between ellipses must occur, in order, in one of the text variants.
export function finnesIFulltekst(tekst: string, varianter: string[]): boolean {
  const biter = tekst
    .split(/\s*[[(]?(?:…|\.\.\.)[\])]?\s*/)
    .map(normaliser)
    .filter((b) => b.length > 0);
  if (!biter.length || biter.some((b) => b.length < MIN_SITATBIT)) return false;
  return varianter.some((t) => {
    let fra = 0;
    for (const b of biter) {
      const i = t.indexOf(b, fra);
      if (i < 0) return false;
      fra = i + b.length;
    }
    return true;
  });
}

export const erListe = <T extends string>(liste: readonly T[], v: unknown): v is T => typeof v === "string" && (liste as readonly string[]).includes(v);
const tekstEllerNull = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
const heltallEllerNull = (v: unknown) => (Number.isInteger(v) && (v as number) >= 0 ? (v as number) : null);

export type Lest = { ok: true; svar: Svar; kontroll: string[] } | { ok: false; feil: string };

export function lesSvar(raa: unknown, forventetId: number, fulltekst: string): Lest {
  if (!raa || typeof raa !== "object" || Array.isArray(raa)) return { ok: false, feil: "svaret er ikke et objekt" };
  const o = raa as Record<string, unknown>;
  if (o.vedtak_id !== forventetId) return { ok: false, feil: `vedtak_id er ${JSON.stringify(o.vedtak_id)}, ventet ${forventetId}` };
  if (!Array.isArray(o.feil)) return { ok: false, feil: "feil er ikke en liste" };
  const ider = o.feil.map((f) => (f && typeof f === "object" ? (f as Record<string, unknown>).id : undefined));
  if (new Set(ider).size !== ider.length) return { ok: false, feil: "to feil har samme id" };

  const kontroll: string[] = [];
  const varianter = fulltekstVarianter(fulltekst);
  const feil: Feil[] = [];
  for (const [i, f] of (o.feil as unknown[]).entries()) {
    if (!f || typeof f !== "object") return { ok: false, feil: `feil[${i}] er ikke et objekt` };
    const r = f as Record<string, unknown>;
    const id = typeof r.id === "string" && r.id ? r.id : `f${i + 1}`;
    const hoved = HOVEDKATEGORIER.find((h) => h.id === r.hovedkategori);
    if (!hoved && r.hovedkategori !== UTENFOR) return { ok: false, feil: `${id}: ukjent hovedkategori ${JSON.stringify(r.hovedkategori)}` };
    if (!erListe(UTFALL, r.utfall)) return { ok: false, feil: `${id}: ukjent utfall ${JSON.stringify(r.utfall)}` };

    let under = tekstEllerNull(r.underkategori);
    if (under && !hoved?.under.some((u) => u.id === under)) {
      kontroll.push(`${id}: underkategori ${under} hører ikke til ${String(r.hovedkategori)}`);
      under = null;
    }
    let avslag = r.avslagsgrunn ?? null;
    if (avslag !== null && (r.utfall !== "avvist" || !erListe(AVSLAGSGRUNNER, avslag))) {
      kontroll.push(`${id}: avslagsgrunn ${JSON.stringify(avslag)} passer ikke`);
      avslag = null;
    }
    if (r.utfall === "avvist" && avslag === null) kontroll.push(`${id}: avvist uten avslagsgrunn`);
    let bevis = r.bevisgrunnlag ?? null;
    if (bevis !== null && (r.utfall !== "medhold" || !erListe(BEVISGRUNNLAG, bevis))) {
      kontroll.push(`${id}: bevisgrunnlag ${JSON.stringify(bevis)} passer ikke`);
      bevis = null;
    }
    if (r.utfall === "medhold" && bevis === null) kontroll.push(`${id}: medhold uten bevisgrunnlag`);
    let sitat = tekstEllerNull(r.sitat);
    if (sitat && !finnesIFulltekst(sitat, varianter)) {
      kontroll.push(`${id}: sitatet finnes ikke ordrett`);
      sitat = null;
    }
    const visteSeg = erListe(VISTE_SEG, r.viste_seg) ? r.viste_seg : "ukjent";
    if (visteSeg !== r.viste_seg) kontroll.push(`${id}: viste_seg ${JSON.stringify(r.viste_seg)} er ikke gyldig`);
    const formodning = erListe(FORMODNING, r.formodning) ? r.formodning : "ikke_nevnt";
    if (formodning !== r.formodning) kontroll.push(`${id}: formodning ${JSON.stringify(r.formodning)} er ikke gyldig`);
    const komponent = tekstEllerNull(r.komponent);
    feil.push({
      id,
      hovedkategori: hoved?.id ?? UTENFOR,
      underkategori: under,
      komponent: komponent && komponent.slice(0, MAKS_KOMPONENT),
      utfall: r.utfall,
      samlet: r.samlet === true,
      avslagsgrunn: avslag as Feil["avslagsgrunn"],
      bevisgrunnlag: bevis as Feil["bevisgrunnlag"],
      dager_etter_levering: heltallEllerNull(r.dager_etter_levering),
      viste_seg: visteSeg,
      formodning,
      sitat,
    });
  }

  const sanksjoner = Array.isArray(o.sanksjoner) ? o.sanksjoner.filter((s) => erListe(SANKSJONER, s)) : [];
  if (Array.isArray(o.sanksjoner) && sanksjoner.length !== o.sanksjoner.length) kontroll.push("ukjent sanksjon fjernet");
  if (typeof o.som_den_er !== "boolean") kontroll.push("som_den_er mangler, satt til nei");
  if (sanksjoner.length && !feil.some((f) => f.utfall === "medhold" || f.avslagsgrunn === "dekket_av_garanti" || f.avslagsgrunn === "avgjort_etter_avtale")) kontroll.push("sanksjon uten feil med medhold");
  return {
    ok: true,
    svar: { vedtak_id: forventetId, feil, sanksjoner: [...new Set(sanksjoner)], rettingsforsok: heltallEllerNull(o.rettingsforsok), som_den_er: o.som_den_er === true, usikkerhet: tekstEllerNull(o.usikkerhet) },
    kontroll,
  };
}
