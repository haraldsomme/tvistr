// Checks an agent answer before import (docs/pass2-design.md § 6): hard errors reject the answer;
// everything else is repaired (nulled, dropped) and recorded in kontrollArsaker.
import { sjekkSkjema } from "@/lib/ai/skjemasjekk";
import { harStrukturertePersonopplysninger } from "@/lib/personvern/rens";
import {
  ALVOR,
  PASS2_SKJEMA,
  type Bevis,
  type BegrunnelseSitat,
  type Feil,
  type Opplysning,
  type Pass2Svar,
  type VisteSeg,
  utfallForFeil,
} from "./skjema";

export type VedtakForVerifisering = {
  fulltekstRenset: string;
  utfall: string | null;
  tilkjentTotaltNok: number | null;
  kjopsdato: string | null;
  overtakelsesdato: string | null;
};
type Alvor = (typeof ALVOR)[number];
export type VerifisertFeil = Omit<Feil, "alvor" | "viste_seg" | "komponenter"> & {
  komponenter: string[];
  alvor: Alvor[];
  viste_seg: VisteSeg;
  sitat_verifisert: boolean | null;
};
export type VerifisertOpplysning = Omit<Opplysning, "gjelder_feil"> & { gjelder_feil: string[]; sitat_verifisert: boolean | null; ordlyd_verifisert: boolean | null };
export type VerifisertBevis = Omit<Bevis, "gjelder_feil"> & { gjelder_feil: string[]; sitat_verifisert: boolean | null };
export type VerifisertBegrunnelse = { tema: BegrunnelseSitat["tema"]; tekst: string; gjelder_feil: string[] };
export type VerifisertSvar = Omit<Pass2Svar, "feil" | "opplysninger" | "bevis" | "begrunnelse_sitater"> & {
  feil: VerifisertFeil[];
  opplysninger: VerifisertOpplysning[];
  bevis: VerifisertBevis[];
  begrunnelse_sitater: VerifisertBegrunnelse[];
};

const MIN_SITATBIT = 20;
const MIN_ORDLYDBIT = 3;
const MAKS_BEGRUNNELSER = 8;

export function gyldigDato(s: string | null): boolean {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function dagerMellom(fra: string, til: string): number {
  return Math.round((Date.parse(`${til}T00:00:00Z`) - Date.parse(`${fra}T00:00:00Z`)) / 86_400_000);
}

export function normaliser(s: string): string {
  return s
    .replace(/[«»“”„"]/g, '"')
    .replace(/[‘’`´]/g, "'")
    .replace(/­/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// PDF text breaks words across lines with a hyphen. A real compound ("EU-kontroll") must keep it,
// a broken word ("rust-skader" → "rustskader") must lose it; try both.
const BINDESTREK_VED_BRUDD = /(\p{L})-[ \t]*\r?\n\s*(\p{L})/gu;
export function fulltekstVarianter(fulltekst: string): string[] {
  return [normaliser(fulltekst.replace(BINDESTREK_VED_BRUDD, "$1$2")), normaliser(fulltekst.replace(BINDESTREK_VED_BRUDD, "$1-$2"))];
}

// Every piece between ellipses must occur, in order, in one of the text variants.
export function finnesIFulltekst(tekst: string, varianter: string[], minBit = MIN_SITATBIT): boolean {
  const biter = tekst
    .split(/\s*[[(]?(?:…|\.\.\.)[\])]?\s*/)
    .map(normaliser)
    .filter((b) => b.length > 0);
  if (!biter.length || biter.some((b) => b.length < minBit)) return false;
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

export function hardeFeil(raa: unknown, forventetId: number, finnes: boolean): string[] {
  const feil = sjekkSkjema(PASS2_SKJEMA, raa);
  if (feil.length) return feil;
  const s = raa as Pass2Svar;
  if (s.vedtak_id !== forventetId) feil.push(`vedtak_id ${s.vedtak_id} stemmer ikke med filnavnet (${forventetId})`);
  if (!finnes) feil.push(`vedtak ${forventetId} finnes ikke i grunnutvalget eller mangler fulltekst`);
  for (const k of ["feil", "opplysninger", "bevis", "paragrafer_med_ledd", "begrunnelse_sitater"] as const) {
    if (!Array.isArray(s[k])) feil.push(`${k} må være en liste`);
  }
  if (feil.length) return feil;
  const ider = s.feil.map((f) => f.id);
  if (ider.some((i) => !i)) feil.push("feil uten id");
  if (new Set(ider).size !== ider.length) feil.push("to feil har samme id");
  s.feil.forEach((f) => {
    if (!f.kategori || !f.vurdering || !f.formodning) feil.push(`feil ${f.id}: kategori, vurdering og formodning må være satt`);
  });
  s.opplysninger.forEach((o, i) => {
    if (!o.type || !o.status || !o.vekt) feil.push(`opplysning ${i}: type, status og vekt må være satt`);
  });
  s.bevis.forEach((b, i) => {
    if (!b.type || !b.fremlagt_av || !b.arsak || !b.ved_levering || !b.paregnelig || !b.utvalgets_vurdering) {
      feil.push(`bevis ${i}: type, fremlagt_av, arsak, ved_levering, paregnelig og utvalgets_vurdering må være satt`);
    }
  });
  s.begrunnelse_sitater.forEach((b, i) => {
    if (!b.tema) feil.push(`begrunnelse_sitat ${i}: tema må være satt`);
  });
  if (s.ikke_mangelssak && !s.ikke_mangelssak.grunn) feil.push("ikke_mangelssak uten grunn");
  return feil;
}

export function verifiserSvar(svar: Pass2Svar, v: VedtakForVerifisering) {
  const kontrollArsaker: string[] = [];
  const flagg = (s: string) => kontrollArsaker.push(s);
  const varianter = fulltekstVarianter(v.fulltekstRenset);
  let sitaterForsokt = 0;
  let sitaterNullet = 0;

  const sitat = (tekst: string | null, hvor: string, minBit = MIN_SITATBIT): { tekst: string | null; ok: boolean | null } => {
    if (tekst == null || tekst.trim() === "") return { tekst: null, ok: null };
    sitaterForsokt++;
    if (finnesIFulltekst(tekst, varianter, minBit)) return { tekst, ok: true };
    sitaterNullet++;
    flagg(`sitat ikke funnet i fulltekst: ${hvor}`);
    return { tekst: null, ok: false };
  };
  const dato = (d: string | null, hvor: string) => {
    if (d == null || d === "") return null;
    if (gyldigDato(d)) return d;
    flagg(`ugyldig dato fjernet: ${hvor}`);
    return null;
  };
  const fritekst = (t: string | null, hvor: string) => {
    // ISO dates look like phone numbers to the pattern ("2017-03-17"); they are not personal data.
    if (t && harStrukturertePersonopplysninger(t.replace(/\b\d{4}-\d{2}-\d{2}\b/g, ""))) {
      flagg(`mulig personopplysning fjernet: ${hvor}`);
      return null;
    }
    return t || null;
  };
  const ider = new Set(svar.feil.map((f) => f.id));
  const refs = (liste: string[] | null, hvor: string) => {
    const alle = liste ?? [];
    const kjente = alle.filter((r) => ider.has(r));
    if (kjente.length !== alle.length) flagg(`ukjent feil-id fjernet fra gjelder_feil: ${hvor}`);
    return kjente;
  };

  const start = v.overtakelsesdato ?? v.kjopsdato;
  const feil: VerifisertFeil[] = svar.feil.map((f) => {
    const s = sitat(f.sitat, `feil ${f.id}`);
    const a = sitat(f.alvor_sitat, `feil ${f.id} alvor`);
    const alvor = (f.alvor ?? []).filter((x) => (ALVOR as readonly string[]).includes(x));
    if (alvor.length !== (f.alvor ?? []).length) flagg(`ukjent alvor-verdi fjernet: feil ${f.id}`);
    const viste: VisteSeg = {
      dato: dato(f.viste_seg?.dato ?? null, `feil ${f.id} viste_seg`),
      presisjon: f.viste_seg?.presisjon ?? "ukjent",
      dager_etter_levering: f.viste_seg?.dager_etter_levering ?? null,
    };
    if (viste.dato && start && viste.dager_etter_levering != null && Math.abs(dagerMellom(start, viste.dato) - viste.dager_etter_levering) > 3) {
      flagg(`feil ${f.id}: viste_seg.dato og dager_etter_levering avviker`);
    }
    const samlet_utfall = f.vurdering === "samlet_vurdering" ? (f.samlet_utfall ?? null) : null;
    if (f.vurdering === "samlet_vurdering" && !samlet_utfall) flagg(`feil ${f.id}: samlet_vurdering uten samlet_utfall`);
    const utfall = utfallForFeil({ vurdering: f.vurdering, samlet_utfall });
    if (utfall === "mangel" && !f.grunnlag) flagg(`feil ${f.id}: mangel uten grunnlag`);
    if (utfall === "ikke_mangel" && !f.grunn) flagg(`feil ${f.id}: ikke_mangel uten grunn`);
    return {
      ...f,
      samlet_utfall,
      komponenter: (f.komponenter ?? []).map((k, i) => fritekst(k, `feil ${f.id} komponent ${i}`)).filter((k): k is string => k != null),
      alvor,
      alvor_sitat: a.tekst,
      viste_seg: viste,
      sitat: s.tekst,
      sitat_verifisert: s.ok,
    };
  });

  const opplysninger: VerifisertOpplysning[] = svar.opplysninger.map((o, i) => {
    const s = sitat(o.sitat, `opplysning ${i}`);
    const ord = sitat(o.ordlyd, `opplysning ${i} ordlyd`, MIN_ORDLYDBIT);
    if (o.type === "uttalelse" && !o.rekkevidde) flagg(`opplysning ${i}: uttalelse uten rekkevidde`);
    return {
      ...o,
      form: o.type === "taushet" ? null : o.form,
      rekkevidde: o.type === "taushet" ? null : o.rekkevidde,
      ordlyd: ord.tekst,
      ordlyd_verifisert: ord.ok,
      gjelder: fritekst(o.gjelder, `opplysning ${i} gjelder`),
      gjelder_feil: refs(o.gjelder_feil, `opplysning ${i}`),
      sitat: s.tekst,
      sitat_verifisert: s.ok,
    };
  });

  const bevis: VerifisertBevis[] = svar.bevis.map((b, i) => {
    const s = sitat(b.sitat, `bevis ${i}`);
    return {
      ...b,
      avsender: fritekst(b.avsender, `bevis ${i} avsender`),
      dato: dato(b.dato, `bevis ${i}`),
      avslagsgrunn: b.utvalgets_vurdering === "ikke_vektlagt" ? b.avslagsgrunn : null,
      gjelder_feil: refs(b.gjelder_feil, `bevis ${i}`),
      sitat: s.tekst,
      sitat_verifisert: s.ok,
    };
  });

  const begrunnelse_sitater: VerifisertBegrunnelse[] = svar.begrunnelse_sitater
    .slice(0, MAKS_BEGRUNNELSER)
    .map((b, i) => ({ tema: b.tema, tekst: sitat(b.tekst, `begrunnelse ${i}`).tekst, gjelder_feil: refs(b.gjelder_feil, `begrunnelse ${i}`) }))
    .filter((b): b is VerifisertBegrunnelse => b.tekst !== null);
  if (svar.begrunnelse_sitater.length > MAKS_BEGRUNNELSER) flagg(`mer enn ${MAKS_BEGRUNNELSER} begrunnelsessitater, resten fjernet`);

  const ikke_mangelssak = svar.ikke_mangelssak ? { grunn: svar.ikke_mangelssak.grunn, sitat: sitat(svar.ikke_mangelssak.sitat, "ikke_mangelssak").tekst } : null;
  const forste_henvendelse = svar.forste_henvendelse
    ? {
        dato: dato(svar.forste_henvendelse.dato, "forste_henvendelse"),
        form: svar.forste_henvendelse.form ?? "ukjent",
        sitat: sitat(svar.forste_henvendelse.sitat, "forste_henvendelse").tekst,
      }
    : null;

  if (!ikke_mangelssak && feil.length) {
    const mangler = feil.filter((f) => utfallForFeil(f) === "mangel");
    if (v.utfall === "medhold" && !mangler.length) flagg("utfall medhold, men ingen feil er mangel");
    if (v.utfall === "ikke_medhold" && mangler.length && !feil.some((f) => f.grunn === "reklamert_for_sent")) flagg("utfall ikke_medhold, men en feil er mangel");
  }
  const sumBelop = feil.reduce((s, f) => s + (f.belop_tilkjent_nok ?? 0), 0);
  if (v.tilkjentTotaltNok != null && sumBelop > v.tilkjentTotaltNok) flagg("sum belop_tilkjent_nok er større enn tilkjent_totalt_nok");

  const verifisert: VerifisertSvar = {
    ...svar,
    ikke_mangelssak,
    feil,
    opplysninger,
    bevis,
    forste_henvendelse,
    paragrafer_med_ledd: svar.paragrafer_med_ledd.filter((p) => typeof p === "string" && p.trim() !== ""),
    begrunnelse_sitater,
    usikkerhet: fritekst(svar.usikkerhet, "usikkerhet"),
  };
  return { svar: verifisert, kontrollArsaker, sitaterForsokt, sitaterNullet };
}
