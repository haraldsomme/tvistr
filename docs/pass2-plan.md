# Pass 2 – implementasjonsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Mål:** Hente ut utfall per feil, spor, selgers opplysninger, bevisinnhold, tidspunkt og ordrette sitater fra de 2 359 vedtakene i grunnutvalget, og lagre dem i `vedtak_analyse` og `vedtak_feil`. Først kjøres en pilot på 100 vedtak med godkjenningskrav.

**Arkitektur:**
- **Uttak:** et skript skriver ett vedtak per tekstfil.
- **Uttrekk:** agenter i Claude Code (Workflow) leser filene og skriver JSON med *fakta*.
- **Import:** et importskript validerer, sjekker sitatene mot fulltekst, regner ut spor og andre konklusjoner (rene funksjoner), og lagrer i to nye tabeller og ett view.
- **Pilot:** kontrollagenter (Opus) vurderer resultatet, og et rapportskript måler det mot kravene.

**Teknologi:** TypeScript (tsx-skript), Drizzle ORM 0.45 mot Neon (neon-http), drizzle-kit 0.31, Workflow-verktøyet i Claude Code.

**Spesifikasjon:** [docs/pass2-design.md](pass2-design.md). Les den sammen med denne planen. Spordefinisjonen står i [docs/spor.md](spor.md).

## Globale føringer

- **Ingen automatiske tester.** Brukeren har bedt om at tester ikke tas med. Hver oppgave kontrolleres med `npm run typecheck` og en konkret kjøring.
- **Ikke commit uten at brukeren har sagt ja.** Hver oppgave ender med et *commit-punkt*, der filene listes og brukeren spørres. Bare filene som er nevnt skal legges til (`git add <filer>`), fordi arbeidstreet har mange andre ucommittede endringer.
- **Grunnutvalget:** `kjoretoytype in ('personbil','varebil') and utfall <> 'avvist' and lov = 'forbrukerkjøpsloven'`, som er 2 359 vedtak.
- **`vedtak` endres ikke.** Pass 2 skriver bare til `vedtak_analyse` og `vedtak_feil`.
- **Instruksversjon:** `pass2-v1`. Den bestemmer filnavnene (`<vedtak_id>.pass2-v1.json`) og lagres på hver rad.
- **Modeller:** uttrekket bruker `sonnet`, kontrollen bruker `opus`. `ai_modell` lagres som `claude-sonnet-5-5 (Claude Code-agent)`.
- **Personvern:**
  - Agentene leser bare `data/pass2/inn/`, som har renset tekst, aldri `data/raw/`.
  - Alt under `data/` er git-ignorert.
  - Ingen personnavn skal stå i kode, kommentarer eller dokumentasjon.
- **Kodestil:** norske identifikatorer, korte engelske kommentarer om *hvorfor*, og relative importer fra `scripts/` (`../src/...`). Inne i `src/` brukes `@/...`. Datokolonner leses som tekst `ÅÅÅÅ-MM-DD` (Drizzle `date()` i strengmodus).
- **Formodningsfrist:** 183 dager for kjøp før 2024-01-01, 730 dager fra og med den datoen.

## Review Focus

Feilsituasjoner spesifikasjonen forutsetter, men som ikke dekkes av vanlige kjøringer. Kontrollen ligger i oppgaven som eier koden.

1. **Gyldige sitater blir slettet.** Det skjer når PDF-teksten har bindestrek ved linjeskift («rust-⏎skader») eller andre anførselstegn enn sitatet. Sitatet skal godtas → oppgave 2, steg 3.
2. **Agenten skriver en verdi som ikke finnes i listen,** for eksempel `alvor: ["farlig"]`, eller `null` i en påkrevd verdi som `vurdering`. Det første skal fjernes og flagges, det andre skal avvise svaret → oppgave 2, steg 3.
3. **Ugyldige datoer,** som «2021-02-30» eller «februar 2021». Importen skal ikke krasje; datoen settes til `null` og flagges → oppgave 2, steg 3.
4. **Import av samme vedtak to ganger** (etter ny agentkjøring) skal ikke etterlate gamle rader i `vedtak_feil` → oppgave 6, steg 3.
5. **`drizzle-kit generate` vil slette `brevsak`.** Tabellen finnes i databasen, men ikke i `schema.ts`. Migreringen må ikke inneholde `DROP TABLE "brevsak"` → oppgave 4, steg 3.

---

## Filoversikt

| Fil | Ny/endret | Ansvar |
|---|---|---|
| `src/lib/analyse/skjema.ts` | ny | Verdilister, typer for agentsvaret, JSON-skjema, `INSTRUKS_VERSJON` |
| `src/lib/analyse/verifiser.ts` | ny | Harde feil, sitatsjekk, rydding og konsistensflagg. Ren, bortsett fra import av personvernmønstre |
| `src/lib/analyse/avled.ts` | ny | Lovversjon, frist, spor og vunnet spor per feil, sammendrag per vedtak. Ren |
| `src/lib/personvern/rens.ts` | endret | Eksporterer `harStrukturertePersonopplysninger` |
| `src/db/schema.ts` | endret | `vedtakAnalyse`, `vedtakFeil` og `vedtakFeilSok` (eksisterende view) |
| `drizzle/0006_pass2.sql`, `drizzle/0007_pass2_view.sql` | ny | Migreringer |
| `scripts/backup-format.ts` | endret | Tar med de nye tabellene i sikkerhetskopien |
| `scripts/pass2-hent.ts` | ny | Skriver inn-filer og ID-lister (pilot, prøve, stabilitet, id, alle, mangler) |
| `scripts/pass2-importer.ts` | ny | Leser svarfiler, verifiserer, avleder og lagrer |
| `scripts/pass2-rapport.ts` | ny | Kontrolltall, stabilitet, kalibrering og importtall mot kravene |
| `scripts/workflows/pass2-uttrekk.js` | ny | Workflow-skript for uttrekket |
| `scripts/workflows/pass2-kontroll.js` | ny | Workflow-skript for kontrollen |
| `src/lib/analyse/instruks.md` | ny | Instruksen agentene følger |
| `package.json` | endret | Skriptene `pass2:hent`, `pass2:importer` og `pass2:rapport` |
| `README.md`, `CLAUDE.md` | endret | Kjøringsrekkefølge og nye tabeller |

---

### Oppgave 1: Skjema og typer for agentsvaret

**Filer:**
- Opprett: `src/lib/analyse/skjema.ts`

**Grensesnitt:**
- Bruker: `FEILTYPER` fra `src/lib/ai/skjema.ts`.
- Leverer:
  - `INSTRUKS_VERSJON`;
  - alle verdilister: `FEILKATEGORIER`, `VURDERINGER`, `GRUNNER`, `GRUNNLAG`, `BEVISGRUNNLAG`, `PRESISJONER`, `FORMODNING`, `ALVOR`, `OPPLYSNINGSTYPER`, `OPPLYSNINGSFORMER`, `SKRIFTLIGE_FORMER`, `OPPLYSNINGSSTATUS`, `VEKT`, `BEVISSLAG`, `SAKKYNDIGE_BEVIS`, `FREMLAGT_AV`, `ARSAK`, `VED_LEVERING`, `PAREGNELIG`, `UTVALGETS_VURDERING`, `AVSLAGSGRUNNER`, `SITATTEMA`, `IKKE_MANGELSSAK_GRUNNER`, `HENVENDELSESFORMER`;
  - typene `Feil`, `Opplysning`, `Bevis`, `BegrunnelseSitat`, `VisteSeg`, `Pass2Svar` og `Spor`;
  - konstanten `PASS2_SKJEMA`.

- [ ] **Steg 1: Skriv `src/lib/analyse/skjema.ts`**

```ts
// Pass 2: what the extraction agents write per decision (docs/pass2-design.md § 4).
// Agents report facts only; conclusions are derived in avled.ts.
import { FEILTYPER } from "@/lib/ai/skjema";

export const INSTRUKS_VERSJON = "pass2-v1";

export const NYE_FEILTYPER = [
  "karosseri_lakk_glass",
  "dekk_felger",
  "utstyr_mangler",
  "eksos_utslipp",
  "eu_kontroll_registrering",
  "interior_lukt",
  "drivlinje",
  "garanti_vilkar",
  "ombygging_tuning",
  "arsmodell_identitet",
  "heftelse_pant",
] as const;
type GammelFeiltype = Exclude<(typeof FEILTYPER)[number], "annet">;
export type Feilkategori = GammelFeiltype | (typeof NYE_FEILTYPER)[number] | "annet";
export const FEILKATEGORIER: readonly Feilkategori[] = [
  ...(FEILTYPER.filter((f) => f !== "annet") as GammelFeiltype[]),
  ...NYE_FEILTYPER,
  "annet",
];

export const VURDERINGER = ["mangel", "ikke_mangel", "ikke_vurdert", "samlet_vurdering"] as const;
export const GRUNNER = [
  "paregnelig_slitasje",
  "ikke_sannsynliggjort_ved_levering",
  "ikke_dokumentert",
  "kjent_eller_opplyst",
  "synlig_ved_besiktigelse",
  "forbehold",
  "reklamert_for_sent",
  "oppstatt_etter_levering",
  "utbedret_av_selger",
  "annet",
] as const;
export const GRUNNLAG = ["avvik_fra_avtale", "feil_opplysning", "tilbakeholdt_opplysning", "darligere_stand_som_den_er", "offentligrettslig"] as const;
export const BEVISGRUNNLAG = ["formodning_ikke_motbevist", "dokumentert_utover_paregnelig", "erkjent_av_selger", "uomtvistet", "utvalgets_skjonn"] as const;
export const PRESISJONER = ["dag", "maaned", "omtrentlig", "ukjent"] as const;
export const FORMODNING = ["anvendt_for_klager", "avkreftet", "nevnt", "ikke_aktuell", "ikke_nevnt"] as const;
export const ALVOR = ["trafikkfarlig", "ikke_kjorbar"] as const;
export const OPPLYSNINGSTYPER = ["uttalelse", "taushet"] as const;
export const OPPLYSNINGSFORMER = ["annonse", "kontrakt", "melding", "salgsoppgave", "tilstandsrapport_fra_selger", "muntlig", "annet"] as const;
export const SKRIFTLIGE_FORMER: readonly string[] = ["annonse", "kontrakt", "melding", "salgsoppgave", "tilstandsrapport_fra_selger"];
export const OPPLYSNINGSSTATUS = ["lagt_til_grunn", "omtvistet", "avvist"] as const;
export const VEKT = ["for_klager", "mot_klager", "ingen"] as const;
export const BEVISSLAG = [
  "verkstedrapport",
  "NAF_test",
  "takst",
  "EU_kontroll",
  "tilstandsrapport",
  "faktura",
  "servicehistorikk",
  "sakkyndig_uttalelse",
  "bilder",
  "korrespondanse",
  "annet",
] as const;
export const SAKKYNDIGE_BEVIS: readonly string[] = ["verkstedrapport", "NAF_test", "takst", "sakkyndig_uttalelse", "tilstandsrapport"];
export const FREMLAGT_AV = ["klager", "selger", "ukjent"] as const;
export const ARSAK = ["rotarsak", "komponent", "ingen"] as const;
export const VED_LEVERING = ["ja", "nei", "uttaler_seg_ikke"] as const;
export const PAREGNELIG = ["utover", "innenfor", "uttaler_seg_ikke"] as const;
export const UTVALGETS_VURDERING = ["vektlagt", "ikke_vektlagt", "ikke_nevnt"] as const;
export const AVSLAGSGRUNNER = ["for_generell", "sier_ikke_naar", "sier_ikke_paregnelig", "motbevist", "for_sent_utfort", "annet"] as const;
export const SITATTEMA = ["mangel", "bevis", "opplysning", "formodning", "reklamasjon", "sanksjon", "belop"] as const;
export const IKKE_MANGELSSAK_GRUNNER = ["ikke_levert", "innbytte_restgjeld", "partsforhold", "annet"] as const;
export const HENVENDELSESFORMER = ["muntlig", "skriftlig", "ukjent"] as const;

type V<T extends readonly string[]> = T[number];
export type Spor = "A" | "B" | "C";

export type VisteSeg = { dato: string | null; presisjon: V<typeof PRESISJONER>; dager_etter_levering: number | null };

export type Feil = {
  id: string;
  kategori: Feilkategori;
  komponent: string | null;
  vurdering: V<typeof VURDERINGER>;
  grunn: V<typeof GRUNNER> | null;
  grunnlag: V<typeof GRUNNLAG> | null;
  bevisgrunnlag: V<typeof BEVISGRUNNLAG> | null;
  viste_seg: VisteSeg | null;
  formodning: V<typeof FORMODNING>;
  belop_tilkjent_nok: number | null;
  alvor: V<typeof ALVOR>[] | null;
  alvor_sitat: string | null;
  sitat: string | null;
};

export type Opplysning = {
  type: V<typeof OPPLYSNINGSTYPER>;
  form: V<typeof OPPLYSNINGSFORMER> | null;
  ordlyd: string | null;
  gjelder: string | null;
  svar_pa_direkte_sporsmal: boolean;
  status: V<typeof OPPLYSNINGSSTATUS>;
  vekt: V<typeof VEKT>;
  gjelder_feil: string[] | null;
  sitat: string | null;
};

export type Bevis = {
  type: V<typeof BEVISSLAG>;
  avsender: string | null;
  fremlagt_av: V<typeof FREMLAGT_AV>;
  dato: string | null;
  km_ved_undersokelse: number | null;
  arsak: V<typeof ARSAK>;
  ved_levering: V<typeof VED_LEVERING>;
  paregnelig: V<typeof PAREGNELIG>;
  kostnad_nok: number | null;
  utvalgets_vurdering: V<typeof UTVALGETS_VURDERING>;
  avslagsgrunn: V<typeof AVSLAGSGRUNNER> | null;
  gjelder_feil: string[] | null;
  sitat: string | null;
};

export type BegrunnelseSitat = { tema: V<typeof SITATTEMA>; tekst: string | null; gjelder_feil: string[] | null };

export type Pass2Svar = {
  vedtak_id: number;
  ikke_mangelssak: { grunn: V<typeof IKKE_MANGELSSAK_GRUNNER>; sitat: string | null } | null;
  feil: Feil[];
  opplysninger: Opplysning[];
  bevis: Bevis[];
  forste_henvendelse: { dato: string | null; form: V<typeof HENVENDELSESFORMER>; sitat: string | null } | null;
  paragrafer_med_ledd: string[];
  begrunnelse_sitater: BegrunnelseSitat[];
  usikkerhet: string | null;
};

// JSON Schema subset understood by sjekkSkjema (src/lib/ai/skjemasjekk.ts). Note that it accepts
// null for every string and ignores unknown values inside enum lists; verifiser.ts checks those.
const tekst = (description: string) => ({ type: "string", description });
const heltall = (description: string) => ({ anyOf: [{ type: "integer" }, { type: "null" }], description });
const valg = (verdier: readonly string[], description = "") => ({ type: "string", enum: [...verdier], description });
const liste = (items: object, description = "") => ({ type: "array", items, description });
const kanVaereNull = (skjema: object) => ({ anyOf: [skjema, { type: "null" }] });
function objekt(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

const VISTE_SEG = objekt({
  dato: tekst("ÅÅÅÅ-MM-DD eller null."),
  presisjon: valg(PRESISJONER),
  dager_etter_levering: heltall("Dager etter levering, når vedtaket oppgir tid eller dato."),
});

export const PASS2_SKJEMA = objekt({
  vedtak_id: { type: "integer" },
  ikke_mangelssak: kanVaereNull(objekt({ grunn: valg(IKKE_MANGELSSAK_GRUNNER), sitat: tekst("Ordrett.") })),
  feil: liste(
    objekt({
      id: tekst("f1, f2 …"),
      kategori: valg(FEILKATEGORIER),
      komponent: tekst("Kort."),
      vurdering: valg(VURDERINGER),
      grunn: valg(GRUNNER),
      grunnlag: valg(GRUNNLAG),
      bevisgrunnlag: valg(BEVISGRUNNLAG),
      viste_seg: kanVaereNull(VISTE_SEG),
      formodning: valg(FORMODNING),
      belop_tilkjent_nok: heltall("Bare når vedtaket knytter beløpet til denne feilen."),
      alvor: liste(valg(ALVOR)),
      alvor_sitat: tekst("Ordrett."),
      sitat: tekst("Ordrett."),
    }),
  ),
  opplysninger: liste(
    objekt({
      type: valg(OPPLYSNINGSTYPER),
      form: valg(OPPLYSNINGSFORMER),
      ordlyd: tekst("Ordrett fra selger."),
      gjelder: tekst("Kort."),
      svar_pa_direkte_sporsmal: { type: "boolean" },
      status: valg(OPPLYSNINGSSTATUS),
      vekt: valg(VEKT),
      gjelder_feil: liste({ type: "string" }),
      sitat: tekst("Ordrett."),
    }),
  ),
  bevis: liste(
    objekt({
      type: valg(BEVISSLAG),
      avsender: tekst("Firma eller rolle."),
      fremlagt_av: valg(FREMLAGT_AV),
      dato: tekst("ÅÅÅÅ-MM-DD eller null."),
      km_ved_undersokelse: heltall(""),
      arsak: valg(ARSAK),
      ved_levering: valg(VED_LEVERING),
      paregnelig: valg(PAREGNELIG),
      kostnad_nok: heltall(""),
      utvalgets_vurdering: valg(UTVALGETS_VURDERING),
      avslagsgrunn: valg(AVSLAGSGRUNNER),
      gjelder_feil: liste({ type: "string" }),
      sitat: tekst("Ordrett."),
    }),
  ),
  forste_henvendelse: kanVaereNull(objekt({ dato: tekst("ÅÅÅÅ-MM-DD eller null."), form: valg(HENVENDELSESFORMER), sitat: tekst("Ordrett.") })),
  paragrafer_med_ledd: liste({ type: "string" }),
  begrunnelse_sitater: liste(objekt({ tema: valg(SITATTEMA), tekst: tekst("Ordrett."), gjelder_feil: liste({ type: "string" }) })),
  usikkerhet: tekst(""),
});
```

- [ ] **Steg 2: Typesjekk**

Kjør: `npm run typecheck`
Forventet: ingen feil.

- [ ] **Steg 3: Commit-punkt.** Spør brukeren. Ved ja: `git add src/lib/analyse/skjema.ts && git commit -m "Pass 2: skjema og typer for agentsvaret"`

---

### Oppgave 2: Verifisering (`verifiser.ts`)

**Filer:**
- Opprett: `src/lib/analyse/verifiser.ts`
- Endre: `src/lib/personvern/rens.ts`. Ny eksport legges etter `rensValgfri`.

**Grensesnitt:**
- Bruker: typene og listene fra oppgave 1, og `sjekkSkjema(skjema, verdi): string[]` fra `src/lib/ai/skjemasjekk.ts`.
- Leverer:
  - `type VedtakForVerifisering = { fulltekstRenset: string; utfall: string | null; tilkjentTotaltNok: number | null; kjopsdato: string | null; overtakelsesdato: string | null }`
  - `type VerifisertFeil = Omit<Feil, "alvor" | "viste_seg"> & { alvor: Alvor[]; viste_seg: VisteSeg; sitat_verifisert: boolean | null }`
  - `type VerifisertOpplysning = Omit<Opplysning, "gjelder_feil"> & { gjelder_feil: string[]; sitat_verifisert: boolean | null; ordlyd_verifisert: boolean | null }`
  - `type VerifisertBevis = Omit<Bevis, "gjelder_feil"> & { gjelder_feil: string[]; sitat_verifisert: boolean | null }`
  - `type VerifisertBegrunnelse = { tema; tekst: string; gjelder_feil: string[] }`
  - `type VerifisertSvar`
  - `hardeFeil(raa: unknown, forventetId: number, finnes: boolean): string[]`
  - `verifiserSvar(svar: Pass2Svar, v: VedtakForVerifisering): { svar: VerifisertSvar; kontrollArsaker: string[]; sitaterForsokt: number; sitaterNullet: number }`
  - `dagerMellom(fra: string, til: string): number`
  - `gyldigDato(s: string | null): boolean`
  - `fulltekstVarianter(fulltekst: string): string[]`
  - `finnesIFulltekst(tekst: string, varianter: string[], minBit?: number): boolean`

- [ ] **Steg 1: Eksporter mønstersjekken fra `rens.ts`.** Legg dette rett etter funksjonen `rensValgfri`:

```ts
// True if the text holds a structured identifier (e-mail, national id, VIN, reg. no., phone).
export function harStrukturertePersonopplysninger(tekst: string): boolean {
  return MONSTRE.some(([re]) => new RegExp(re.source, re.flags.replace("g", "")).test(tekst));
}
```

- [ ] **Steg 2: Skriv `src/lib/analyse/verifiser.ts`**

```ts
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
} from "./skjema";

export type VedtakForVerifisering = {
  fulltekstRenset: string;
  utfall: string | null;
  tilkjentTotaltNok: number | null;
  kjopsdato: string | null;
  overtakelsesdato: string | null;
};
type Alvor = (typeof ALVOR)[number];
export type VerifisertFeil = Omit<Feil, "alvor" | "viste_seg"> & { alvor: Alvor[]; viste_seg: VisteSeg; sitat_verifisert: boolean | null };
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

function normaliser(s: string): string {
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
    if (t && harStrukturertePersonopplysninger(t)) {
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
    if (f.vurdering === "mangel" && !f.grunnlag) flagg(`feil ${f.id}: mangel uten grunnlag`);
    if (f.vurdering === "ikke_mangel" && !f.grunn) flagg(`feil ${f.id}: ikke_mangel uten grunn`);
    return {
      ...f,
      komponent: fritekst(f.komponent, `feil ${f.id} komponent`),
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
    return {
      ...o,
      form: o.type === "taushet" ? null : o.form,
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
    const mangler = feil.filter((f) => f.vurdering === "mangel");
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
```

- [ ] **Steg 3: Kontroller Review Focus 1–3 med en kjøring.** Skriv `scripts/tmp-sjekk-verifiser.ts`. Fila slettes etterpå og skal ikke committes.

```ts
import { finnesIFulltekst, fulltekstVarianter, gyldigDato, hardeFeil } from "../src/lib/analyse/verifiser";

const ft = "Utvalget finner at rust-\nskadene på «bakskjermen» var til stede ved levering. Bilen var ikke EU-\nkontrollert.";
const v = fulltekstVarianter(ft);
console.log("bindestrek fjernet:", finnesIFulltekst("rustskadene på \"bakskjermen\" var til stede ved levering", v));
console.log("bindestrek beholdt:", finnesIFulltekst("Bilen var ikke EU-kontrollert.", v, 3));
console.log("ellipse:", finnesIFulltekst("Utvalget finner at rust-skadene … var til stede ved levering", v));
console.log("ikke ordrett (skal være false):", finnesIFulltekst("Utvalget mener at rustskadene var der", v));
console.log("datoer (true,false,false):", gyldigDato("2021-02-28"), gyldigDato("2021-02-30"), gyldigDato("februar 2021"));
const tomt = { vedtak_id: 1, ikke_mangelssak: null, feil: [{ id: "f1", kategori: "motor", komponent: null, vurdering: null, grunn: null, grunnlag: null, bevisgrunnlag: null, viste_seg: null, formodning: "ikke_nevnt", belop_tilkjent_nok: null, alvor: ["farlig"], alvor_sitat: null, sitat: null }], opplysninger: [], bevis: [], forste_henvendelse: null, paragrafer_med_ledd: [], begrunnelse_sitater: [], usikkerhet: null };
console.log("vurdering null avvises:", hardeFeil(tomt, 1, true));
```

Kjør: `npx tsx scripts/tmp-sjekk-verifiser.ts && rm scripts/tmp-sjekk-verifiser.ts`

Forventet:
- `true`, `true`, `true`, `false`;
- `true false false`;
- en liste som inneholder `feil f1: kategori, vurdering og formodning må være satt`.

At `alvor: ["farlig"]` fjernes og flagges, kontrolleres i oppgave 9, når `verifiserSvar` kjøres på ekte svar.

- [ ] **Steg 4: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil.

- [ ] **Steg 5: Commit-punkt.** Spør brukeren. Ved ja: `git add src/lib/analyse/verifiser.ts src/lib/personvern/rens.ts && git commit -m "Pass 2: sitatsjekk og verifisering av agentsvar"`

---

### Oppgave 3: Avledning (`avled.ts`)

**Filer:**
- Opprett: `src/lib/analyse/avled.ts`

**Grensesnitt:**
- Bruker: `VerifisertSvar` og `VerifisertFeil` fra oppgave 2, `dagerMellom` fra oppgave 2, og `SKRIFTLIGE_FORMER`, `SAKKYNDIGE_BEVIS` og `Spor` fra oppgave 1.
- Leverer:
  - `type VedtakFakta = { kjopsdato: string | null; overtakelsesdato: string | null; vedtaksdato: string | null; klagerErForbruker: boolean | null }`
  - `type Lovversjon = "før_2024" | "etter_2024" | "ukjent"`
  - `avledLovversjon(v): Lovversjon` og `formodningsfrist(l): number | null`
  - `type AvledetFeil` og `type AvledetAnalyse`. Nøklene er camelCase og like kolonnenøklene i oppgave 4, så de kan spres rett inn i insert.
  - `avledAnalyse(svar: VerifisertSvar, v: VedtakFakta): { analyse: AvledetAnalyse; feil: AvledetFeil[] }`

- [ ] **Steg 1: Skriv `src/lib/analyse/avled.ts`**

```ts
// Conclusions computed from the agents' facts (docs/pass2-design.md § 7, docs/spor.md).
// Changing a definition here only needs a re-import, never a new agent run.
import { SAKKYNDIGE_BEVIS, SKRIFTLIGE_FORMER, type Spor } from "./skjema";
import { dagerMellom, type VerifisertFeil, type VerifisertSvar } from "./verifiser";

export type VedtakFakta = { kjopsdato: string | null; overtakelsesdato: string | null; vedtaksdato: string | null; klagerErForbruker: boolean | null };
export type Lovversjon = "før_2024" | "etter_2024" | "ukjent";

export function avledLovversjon(v: VedtakFakta): Lovversjon {
  const d = v.kjopsdato ?? v.overtakelsesdato;
  if (d) return d < "2024-01-01" ? "før_2024" : "etter_2024";
  // Cases take months to reach a decision, so a decision before mid-2024 means a purchase before 2024.
  if (v.vedtaksdato && v.vedtaksdato < "2024-06-01") return "før_2024";
  return "ukjent";
}

// fkjl § 18 second paragraph: six months before 2024, two years from 1 January 2024.
export function formodningsfrist(l: Lovversjon): number | null {
  return l === "før_2024" ? 183 : l === "etter_2024" ? 730 : null;
}

export type AvledetFeil = {
  feilId: string;
  kategori: string;
  komponent: string | null;
  vurdering: string;
  grunn: string | null;
  grunnlag: string | null;
  bevisgrunnlag: string | null;
  spor: Spor[];
  sporVunnet: Spor[];
  alvor: string[];
  dagerEtterLevering: number | null;
  visteSegPresisjon: string;
  innenFormodningsfrist: boolean | null;
  formodning: string;
  belopTilkjentNok: number | null;
  harSkriftligOpplysning: boolean;
  harSakkyndigBevis: boolean;
};

export type AvledetAnalyse = {
  ikkeMangelssak: boolean;
  ikkeMangelssakGrunn: string | null;
  lovversjon: Lovversjon;
  spor: Spor[];
  sporVunnet: Spor[];
  formodningAnvendt: boolean;
  dagerTilFeil: number | null;
  forsteHenvendelseDato: string | null;
  forsteHenvendelseForm: string | null;
  grunnlag: string[];
  opplysningSkriftligForKlager: boolean;
  selgerBevisFinnes: boolean;
  bevisUtoverParegnelig: boolean;
  paragraferMedLedd: string[];
};

// An empty gjelder_feil means the item concerns the whole case, so it applies to every defect.
const knyttet = (refs: string[], feilId: string) => refs.length === 0 || refs.includes(feilId);
const ORDEN: Spor[] = ["A", "B", "C"];
const sortert = (s: Set<Spor>) => ORDEN.filter((x) => s.has(x));

function dagerEtterLevering(f: VerifisertFeil, v: VedtakFakta): number | null {
  const start = v.overtakelsesdato ?? v.kjopsdato;
  // An exact date beats the agent's day count (verifiser.ts flags the disagreement).
  if (f.viste_seg.dato && start && f.viste_seg.presisjon === "dag") return dagerMellom(start, f.viste_seg.dato);
  return f.viste_seg.dager_etter_levering;
}

function avledFeil(f: VerifisertFeil, svar: VerifisertSvar, v: VedtakFakta, frist: number | null): AvledetFeil {
  const skriftlige = svar.opplysninger.filter(
    (o) => knyttet(o.gjelder_feil, f.id) && o.type === "uttalelse" && o.form != null && SKRIFTLIGE_FORMER.includes(o.form),
  );
  const sakkyndige = svar.bevis.filter(
    (b) =>
      knyttet(b.gjelder_feil, f.id) &&
      b.fremlagt_av === "klager" &&
      SAKKYNDIGE_BEVIS.includes(b.type) &&
      (b.paregnelig !== "uttaler_seg_ikke" || b.ved_levering !== "uttaler_seg_ikke"),
  );
  const dager = dagerEtterLevering(f, v);
  const innenFrist = frist != null && dager != null ? dager <= frist : null;

  const vunnet = new Set<Spor>();
  if (f.vurdering === "mangel") {
    if (skriftlige.some((o) => o.status === "lagt_til_grunn" && o.vekt === "for_klager")) vunnet.add("A");
    if (f.bevisgrunnlag === "formodning_ikke_motbevist") vunnet.add("B");
    if (f.bevisgrunnlag === "dokumentert_utover_paregnelig") vunnet.add("C");
  }
  // A track that was won was also tried, even when the facts above did not mark it.
  const prov = new Set<Spor>(vunnet);
  if (skriftlige.length) prov.add("A");
  if (innenFrist === true || f.formodning === "anvendt_for_klager" || f.formodning === "avkreftet") prov.add("B");
  if (sakkyndige.length) prov.add("C");

  return {
    feilId: f.id,
    kategori: f.kategori,
    komponent: f.komponent,
    vurdering: f.vurdering,
    grunn: f.grunn,
    grunnlag: f.grunnlag,
    bevisgrunnlag: f.bevisgrunnlag,
    spor: sortert(prov),
    sporVunnet: sortert(vunnet),
    alvor: f.alvor,
    dagerEtterLevering: dager,
    visteSegPresisjon: f.viste_seg.presisjon,
    innenFormodningsfrist: innenFrist,
    formodning: f.formodning,
    belopTilkjentNok: f.belop_tilkjent_nok,
    harSkriftligOpplysning: prov.has("A"),
    harSakkyndigBevis: prov.has("C"),
  };
}

export function avledAnalyse(svar: VerifisertSvar, v: VedtakFakta): { analyse: AvledetAnalyse; feil: AvledetFeil[] } {
  const lovversjon = avledLovversjon(v);
  const frist = formodningsfrist(lovversjon);
  const feil = svar.feil.map((f) => avledFeil(f, svar, v, frist));
  const dager = feil.map((f) => f.dagerEtterLevering).filter((d): d is number => d != null);
  const ikkeForbruker = v.klagerErForbruker === false;

  return {
    analyse: {
      ikkeMangelssak: svar.ikke_mangelssak != null || ikkeForbruker,
      ikkeMangelssakGrunn: svar.ikke_mangelssak?.grunn ?? (ikkeForbruker ? "ikke_forbruker" : null),
      lovversjon,
      spor: sortert(new Set(feil.flatMap((f) => f.spor))),
      sporVunnet: sortert(new Set(feil.flatMap((f) => f.sporVunnet))),
      formodningAnvendt: feil.some((f) => f.formodning === "anvendt_for_klager"),
      dagerTilFeil: dager.length ? Math.min(...dager) : null,
      forsteHenvendelseDato: svar.forste_henvendelse?.dato ?? null,
      forsteHenvendelseForm: svar.forste_henvendelse?.form ?? null,
      grunnlag: [...new Set(feil.map((f) => f.grunnlag).filter((g): g is string => g != null))],
      opplysningSkriftligForKlager: svar.opplysninger.some(
        (o) => o.type === "uttalelse" && o.form != null && SKRIFTLIGE_FORMER.includes(o.form) && o.status === "lagt_til_grunn" && o.vekt === "for_klager",
      ),
      selgerBevisFinnes: svar.bevis.some((b) => b.fremlagt_av === "selger"),
      bevisUtoverParegnelig: svar.bevis.some((b) => b.fremlagt_av === "klager" && b.paregnelig === "utover"),
      paragraferMedLedd: svar.paragrafer_med_ledd,
    },
    feil,
  };
}
```

- [ ] **Steg 2: Kontroller grensene med en kjøring.** Skriv `scripts/tmp-sjekk-avled.ts`. Fila slettes etterpå.

```ts
import { avledAnalyse, avledLovversjon, formodningsfrist } from "../src/lib/analyse/avled";
import type { VerifisertSvar } from "../src/lib/analyse/verifiser";

console.log(avledLovversjon({ kjopsdato: "2023-12-31", overtakelsesdato: null, vedtaksdato: null, klagerErForbruker: true })); // før_2024
console.log(avledLovversjon({ kjopsdato: null, overtakelsesdato: "2024-01-01", vedtaksdato: null, klagerErForbruker: true })); // etter_2024
console.log(avledLovversjon({ kjopsdato: null, overtakelsesdato: null, vedtaksdato: "2024-05-31", klagerErForbruker: true })); // før_2024
console.log(formodningsfrist("før_2024"), formodningsfrist("etter_2024"), formodningsfrist("ukjent")); // 183 730 null

const v = { kjopsdato: "2022-01-01", overtakelsesdato: null, vedtaksdato: "2023-01-01", klagerErForbruker: true };
const svar: VerifisertSvar = {
  vedtak_id: 1,
  ikke_mangelssak: null,
  feil: [
    { id: "f1", kategori: "motor", komponent: "turbo", vurdering: "mangel", grunn: null, grunnlag: "feil_opplysning", bevisgrunnlag: "dokumentert_utover_paregnelig", viste_seg: { dato: "2022-07-03", presisjon: "dag", dager_etter_levering: 183 }, formodning: "ikke_nevnt", belop_tilkjent_nok: null, alvor: [], alvor_sitat: null, sitat: null, sitat_verifisert: null },
    { id: "f2", kategori: "dekk_felger", komponent: "vinterdekk", vurdering: "ikke_mangel", grunn: "paregnelig_slitasje", grunnlag: null, bevisgrunnlag: null, viste_seg: { dato: null, presisjon: "omtrentlig", dager_etter_levering: 184 }, formodning: "ikke_nevnt", belop_tilkjent_nok: null, alvor: [], alvor_sitat: null, sitat: null, sitat_verifisert: null },
  ],
  opplysninger: [{ type: "uttalelse", form: "annonse", ordlyd: "Motor i topp stand", gjelder: "motor", svar_pa_direkte_sporsmal: false, status: "lagt_til_grunn", vekt: "for_klager", gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null, ordlyd_verifisert: true }],
  bevis: [{ type: "verkstedrapport", avsender: "merkeverksted", fremlagt_av: "klager", dato: null, km_ved_undersokelse: null, arsak: "rotarsak", ved_levering: "uttaler_seg_ikke", paregnelig: "utover", kostnad_nok: 30000, utvalgets_vurdering: "vektlagt", avslagsgrunn: null, gjelder_feil: ["f1"], sitat: null, sitat_verifisert: null }],
  forste_henvendelse: null,
  paragrafer_med_ledd: [],
  begrunnelse_sitater: [],
  usikkerhet: null,
};
const r = avledAnalyse(svar, v);
console.log(r.feil.map((f) => [f.feilId, f.dagerEtterLevering, f.innenFormodningsfrist, f.spor.join(""), f.sporVunnet.join("")]));
// Expected: [["f1",183,true,"ABC","AC"],["f2",184,false,"",""]]
console.log(r.analyse.spor, r.analyse.sporVunnet, r.analyse.bevisUtoverParegnelig); // ["A","B","C"] ["A","C"] true
```

Kjør: `npx tsx scripts/tmp-sjekk-avled.ts && rm scripts/tmp-sjekk-avled.ts`
Forventet: verdiene i kommentarene. 2022-01-01 → 2022-07-03 er 183 dager, så f1 er innenfor fristen. f2 har 184 dager og er utenfor.

- [ ] **Steg 3: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil.

- [ ] **Steg 4: Commit-punkt.** Spør brukeren. Ved ja: `git add src/lib/analyse/avled.ts && git commit -m "Pass 2: avledning av spor, lovversjon og sammendrag"`

---

### Oppgave 4: Tabeller, view, migrering og sikkerhetskopi

**Filer:**
- Endre: `src/db/schema.ts`. Importene legges øverst, og tabellene legges etter `kildesak`.
- Opprett: `drizzle/0006_pass2.sql`, generert og deretter kontrollert.
- Opprett: `drizzle/0007_pass2_view.sql`, egen migrering.
- Endre: `scripts/backup-format.ts`

**Grensesnitt:**
- Bruker: `VerifisertFeil`, `VerifisertOpplysning`, `VerifisertBevis` og `VerifisertBegrunnelse` (oppgave 2), og de eksisterende enumene `lovversjonEnum`, `qaStatusEnum`, `selgerTypeEnum` og `utfallEnum`.
- Leverer:
  - `vedtakAnalyse`, `vedtakFeil` og `vedtakFeilSok` (eksisterende view) i `schema.ts`;
  - typene `NyVedtakAnalyse` og `NyVedtakFeil`.

- [ ] **Steg 1: Ta sikkerhetskopi, også av `brevsak`.**
  - Kjør `npm run db:backup`. Forventet: en fil `backup/tvistr-<tid>.json.gz` og verifiserte antall rader.
  - `brevsak` er bevisst holdt utenfor den vanlige kopien, fordi den har personopplysninger. Den må derfor kopieres separat, i tilfelle migreringen sletter den.
  - Første kopi ble tatt 2026-10-09: `backup/brevsak-20261009-0759.json.gz`, 31 rader, sjekksum verifisert, filrettigheter 600.
  - Ta en ny kopi rett før migreringen med samme fremgangsmåte: `umask 077`, `select * from brevsak` og indeksdefinisjonene til gzip-JSON i `backup/brevsak-<tid>.json.gz`, og kontroller antall rader og sjekksum ved å lese fila tilbake.
  - Fila skal aldri committes eller deles. `backup/` er git-ignorert.

- [ ] **Steg 2: Legg til tabellene i `src/db/schema.ts`.**
  - Legg `primaryKey` og `pgView` til i importen fra `"drizzle-orm/pg-core"`.
  - Legg til `import { sql } from "drizzle-orm";`.
  - Legg til `import type { VerifisertBegrunnelse, VerifisertBevis, VerifisertFeil, VerifisertOpplysning } from "../lib/analyse/verifiser";`.
  - Legg dette etter `kildesak`, før type-eksportene:

```ts
// Pass 2 (docs/pass2-design.md § 5): one row per decision with the agents' facts and the derived
// filter columns. Re-running pass 2 replaces the row; the raw answers stay in data/pass2/ut/.
export const vedtakAnalyse = pgTable(
  "vedtak_analyse",
  {
    vedtakId: integer("vedtak_id")
      .primaryKey()
      .references(() => vedtak.id, { onDelete: "cascade" }),
    instruksVersjon: text("instruks_versjon").notNull(),
    aiModell: text("ai_modell").notNull(),
    analysertTidspunkt: timestamp("analysert_tidspunkt", { withTimezone: true }).notNull().defaultNow(),
    // Quotes are verified against this exact text; a re-redaction changes the hash.
    fulltekstSha256: text("fulltekst_sha256").notNull(),
    raasvarSha256: text("raasvar_sha256").notNull(),
    ikkeMangelssak: boolean("ikke_mangelssak").notNull(),
    ikkeMangelssakGrunn: text("ikke_mangelssak_grunn"),
    lovversjon: lovversjonEnum("lovversjon").notNull(),
    spor: text("spor").array().notNull(),
    sporVunnet: text("spor_vunnet").array().notNull(),
    formodningAnvendt: boolean("formodning_anvendt").notNull(),
    dagerTilFeil: integer("dager_til_feil"),
    forsteHenvendelseDato: date("forste_henvendelse_dato"),
    forsteHenvendelseForm: text("forste_henvendelse_form"),
    grunnlag: text("grunnlag").array().notNull(),
    opplysningSkriftligForKlager: boolean("opplysning_skriftlig_for_klager").notNull(),
    selgerBevisFinnes: boolean("selger_bevis_finnes").notNull(),
    bevisUtoverParegnelig: boolean("bevis_utover_paregnelig").notNull(),
    paragraferMedLedd: text("paragrafer_med_ledd").array().notNull(),
    feil: jsonb("feil").$type<VerifisertFeil[]>().notNull(),
    opplysninger: jsonb("opplysninger").$type<VerifisertOpplysning[]>().notNull(),
    bevis: jsonb("bevis").$type<VerifisertBevis[]>().notNull(),
    begrunnelseSitater: jsonb("begrunnelse_sitater").$type<VerifisertBegrunnelse[]>().notNull(),
    usikkerhet: text("usikkerhet"),
    kontrollArsaker: text("kontroll_arsaker").array().notNull().default(sql`'{}'::text[]`),
    qaStatus: qaStatusEnum("qa_status").notNull().default("ukontrollert"),
    qaKommentar: text("qa_kommentar"),
    qaTidspunkt: timestamp("qa_tidspunkt", { withTimezone: true }),
  },
  (t) => [
    index("vedtak_analyse_spor_idx").using("gin", t.spor),
    index("vedtak_analyse_grunnlag_idx").using("gin", t.grunnlag),
    index("vedtak_analyse_lovversjon_idx").on(t.lovversjon),
    index("vedtak_analyse_ikke_mangelssak_idx").on(t.ikkeMangelssak),
  ],
);

// One row per claimed defect; this is what the letter engine matches against (via vedtak_feil_sok).
export const vedtakFeil = pgTable(
  "vedtak_feil",
  {
    vedtakId: integer("vedtak_id")
      .notNull()
      .references(() => vedtakAnalyse.vedtakId, { onDelete: "cascade" }),
    feilId: text("feil_id").notNull(),
    kategori: text("kategori").notNull(),
    komponent: text("komponent"),
    vurdering: text("vurdering").notNull(),
    grunn: text("grunn"),
    grunnlag: text("grunnlag"),
    bevisgrunnlag: text("bevisgrunnlag"),
    spor: text("spor").array().notNull(),
    sporVunnet: text("spor_vunnet").array().notNull(),
    alvor: text("alvor").array().notNull(),
    dagerEtterLevering: integer("dager_etter_levering"),
    visteSegPresisjon: text("viste_seg_presisjon").notNull(),
    innenFormodningsfrist: boolean("innen_formodningsfrist"),
    formodning: text("formodning").notNull(),
    belopTilkjentNok: integer("belop_tilkjent_nok"),
    harSkriftligOpplysning: boolean("har_skriftlig_opplysning").notNull(),
    harSakkyndigBevis: boolean("har_sakkyndig_bevis").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.vedtakId, t.feilId] }),
    index("vedtak_feil_kategori_idx").on(t.kategori),
    index("vedtak_feil_vurdering_idx").on(t.vurdering),
    index("vedtak_feil_spor_idx").using("gin", t.spor),
    index("vedtak_feil_spor_vunnet_idx").using("gin", t.sporVunnet),
  ],
);

// Created in drizzle/0007_pass2_view.sql. Joins the decision fields in instead of copying them,
// so they cannot drift from `vedtak`.
export const vedtakFeilSok = pgView("vedtak_feil_sok", {
  vedtakId: integer("vedtak_id").notNull(),
  feilId: text("feil_id").notNull(),
  kategori: text("kategori").notNull(),
  komponent: text("komponent"),
  vurdering: text("vurdering").notNull(),
  grunn: text("grunn"),
  grunnlag: text("grunnlag"),
  bevisgrunnlag: text("bevisgrunnlag"),
  spor: text("spor").array().notNull(),
  sporVunnet: text("spor_vunnet").array().notNull(),
  alvor: text("alvor").array().notNull(),
  dagerEtterLevering: integer("dager_etter_levering"),
  visteSegPresisjon: text("viste_seg_presisjon").notNull(),
  innenFormodningsfrist: boolean("innen_formodningsfrist"),
  formodning: text("formodning").notNull(),
  belopTilkjentNok: integer("belop_tilkjent_nok"),
  harSkriftligOpplysning: boolean("har_skriftlig_opplysning").notNull(),
  harSakkyndigBevis: boolean("har_sakkyndig_bevis").notNull(),
  saksnummer: text("saksnummer"),
  vedtaksdato: date("vedtaksdato"),
  kildeUrl: text("kilde_url").notNull(),
  selgerType: selgerTypeEnum("selger_type"),
  alderVedKjop: integer("alder_ved_kjop"),
  kmVedKjop: integer("km_ved_kjop"),
  kjopesumNok: integer("kjopesum_nok"),
  utfall: utfallEnum("utfall"),
  lovversjon: lovversjonEnum("lovversjon").notNull(),
  ikkeMangelssak: boolean("ikke_mangelssak").notNull(),
}).existing();
```

Legg til nederst, sammen med de andre type-eksportene:

```ts
export type NyVedtakAnalyse = typeof vedtakAnalyse.$inferInsert;
export type NyVedtakFeil = typeof vedtakFeil.$inferInsert;
```

- [ ] **Steg 3: Generer migreringen og fjern slettingen av `brevsak` (Review Focus 5).**

Kjør: `npm run db:generate -- --name pass2`
Forventet: en ny fil `drizzle/0006_pass2.sql`.

Les fila. Står det `DROP TABLE "brevsak"` eller `DROP INDEX "brevsak_utloper_idx"`, slett de linjene og `--> statement-breakpoint` rett etter dem.
- **Hvorfor:** tabellen er tatt ut av `schema.ts`, men finnes fortsatt i databasen og skal beholdes.
- **Kontroller:** `grep -n brevsak drizzle/0006_pass2.sql` skal ikke gi noe treff.
- **Kontroller også at fila bare oppretter** `vedtak_analyse`, `vedtak_feil`, primærnøkkelen, fremmednøklene og indeksene. Den skal ikke røre `vedtak`, `kildedokument` eller `kildesak`.

- [ ] **Steg 4: Lag migreringen for viewet**

Kjør: `npx drizzle-kit generate --custom --name pass2_view`
Forventet: en tom fil `drizzle/0007_pass2_view.sql`. Fyll den med:

```sql
-- Search view for the letter engine: one row per defect with the decision fields joined in.
CREATE VIEW "vedtak_feil_sok" AS
SELECT
  f.vedtak_id, f.feil_id, f.kategori, f.komponent, f.vurdering, f.grunn, f.grunnlag, f.bevisgrunnlag,
  f.spor, f.spor_vunnet, f.alvor, f.dager_etter_levering, f.viste_seg_presisjon, f.innen_formodningsfrist,
  f.formodning, f.belop_tilkjent_nok, f.har_skriftlig_opplysning, f.har_sakkyndig_bevis,
  v.saksnummer, v.vedtaksdato, v.kilde_url, v.selger_type, v.alder_ved_kjop, v.km_ved_kjop, v.kjopesum_nok, v.utfall,
  a.lovversjon, a.ikke_mangelssak
FROM vedtak_feil f
JOIN vedtak_analyse a ON a.vedtak_id = f.vedtak_id
JOIN vedtak v ON v.id = f.vedtak_id;
```

- [ ] **Steg 5: Kjør migreringene**

Kjør: `npm run db:migrate`
Forventet: `Migreringer er oppdatert.`

Kontroller med en midlertidig `scripts/tmp-sjekk-db.ts`, som slettes etterpå:

```ts
import { sql } from "drizzle-orm";
import { db } from "../src/db";
const r = await db.execute(sql`select
  (select count(*) from vedtak_analyse)::int analyse,
  (select count(*) from vedtak_feil)::int feil,
  (select count(*) from vedtak_feil_sok)::int sok,
  (select count(*) from information_schema.tables where table_name = 'brevsak')::int brevsak`);
console.log(r.rows);
```

Kjør: `npx tsx --env-file=.env.local scripts/tmp-sjekk-db.ts && rm scripts/tmp-sjekk-db.ts`
Forventet: `[{ analyse: 0, feil: 0, sok: 0, brevsak: 1 }]`.

Er `brevsak` 0 likevel, stopp, og si fra til brukeren før noe annet gjøres. Tabellen kan gjenopprettes fra kopien i steg 1.

- [ ] **Steg 6: Ta med tabellene i sikkerhetskopien.** I `scripts/backup-format.ts`, endre importen og `TABELLER`. Rekkefølgen er viktig, fordi tabeller det refereres til må komme først:

```ts
import { kildedokument, kildesak, vedtak, vedtakAnalyse, vedtakFeil } from "../src/db/schema";
```
```ts
export const TABELLER = { kildedokument, kildesak, vedtak, vedtakAnalyse, vedtakFeil } as const;
```

Kjør: `npm run db:backup`
Forventet: fem tabeller i oversikten, de to nye med 0 rader.

- [ ] **Steg 7: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil.

- [ ] **Steg 8: Commit-punkt.** Spør brukeren. Ved ja: `git add src/db/schema.ts drizzle/0006_pass2.sql drizzle/0007_pass2_view.sql drizzle/meta scripts/backup-format.ts && git commit -m "Pass 2: tabellene vedtak_analyse og vedtak_feil og viewet vedtak_feil_sok"`

---

### Oppgave 5: Uttaksskriptet (`pass2-hent.ts`)

**Filer:**
- Opprett: `scripts/pass2-hent.ts`
- Endre: `package.json` (`scripts`)

**Grensesnitt:**
- Bruker: `db`, `vedtak` og `vedtakAnalyse` (oppgave 4), og `INSTRUKS_VERSJON` (oppgave 1).
- Leverer:
  - filer `data/pass2/inn/<id>.txt`;
  - lister `data/pass2/lister/<navn>.json` (en JSON-liste med tall);
  - `export const DATASJEKK_IDER: number[]`.

- [ ] **Steg 1: Skriv `scripts/pass2-hent.ts`**

```ts
// Writes one text file per decision for the pass 2 extraction agents, plus an id list for the
// Workflow run (docs/pass2-design.md § 3, § 9.1).
//
//   npm run pass2:hent -- --pilot            100 stratified decisions → lister/pilot.json
//   npm run pass2:hent -- --prove            5 decisions outside the pilot → lister/prove.json
//   npm run pass2:hent -- --stabilitet       20 of the pilot for the second run → lister/stabilitet.json
//   npm run pass2:hent -- --id 12,34 [--navn x]
//   npm run pass2:hent -- --mangler          base sample without an analysis for this instruction version
//   npm run pass2:hent -- --alle

import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { inArray, sql, type SQL } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { INSTRUKS_VERSJON } from "../src/lib/analyse/skjema";

const { values: args } = parseArgs({
  options: {
    pilot: { type: "boolean", default: false },
    prove: { type: "boolean", default: false },
    stabilitet: { type: "boolean", default: false },
    mangler: { type: "boolean", default: false },
    alle: { type: "boolean", default: false },
    id: { type: "string" },
    navn: { type: "string" },
  },
});

const MAPPE = "data/pass2";

// Read in the data check (docs/vedtakssammenligning-datasjekk.md). The instruction's examples come
// from these, so they stay out of every measured sample.
export const DATASJEKK_IDER = [
  284, 659, 1389, 1043, 1645, 1555, 3027, 3454, 981, 2480, 2679, 3301, 2655, 1675, 720, 782, 398, 2863, 851, 2373, 718, 2031, 597, 2564, 510,
  1579, 2410, 1237, 1853, 3443, 3151, 1179, 1017, 1695, 2, 2068, 925, 2796, 1438, 3417, 243, 1683, 3367, 3445, 602, 1397, 1805, 2642, 1556, 661,
  1434, 3501, 1443, 2556, 2870, 3294, 1587, 2547, 1280, 2204, 2366, 436, 232, 2881, 2146,
  360, 3336, 3077, 1778, 948, 287, 2737, 627, 1644, 2122, 1958, 1862, 859, 2092, 1996,
  2036, 2728, 327, 3074, 1807, 2871, 1756, 3276, 3402, 2667,
  1151, 3142, 791, 2071, 1058, 1324, 1221, 572, 1150, 945,
  2702, 1388, 591, 2730, 1080, 1882, 2035, 692, 3401, 609,
];

const GRUNNUTVALG = sql`kjoretoytype in ('personbil','varebil') and utfall <> 'avvist' and lov = 'forbrukerkjøpsloven'`;
const idListe = (ider: number[]) => sql.join(ider.map((i) => sql`${i}`), sql`, `);
const ider = async (q: SQL) => (await db.execute(q)).rows.map((r) => Number(r.id));

async function trekk(filter: SQL, n: number, frø: string, unntatt: number[]) {
  const ute = [...DATASJEKK_IDER, ...unntatt];
  return ider(sql`select id from vedtak where ${GRUNNUTVALG} and ${filter} and id not in (${idListe(ute)})
    order by md5(id::text || ${frø}) limit ${n}`);
}

async function pilot() {
  const a = await trekk(sql`utfall = 'delvis_medhold' and cardinality(feiltyper) >= 2`, 50, "pass2-pilot", []);
  const b = await trekk(sql`(utfall = 'medhold' or (utfall = 'delvis_medhold' and coalesce(cardinality(feiltyper), 0) < 2))`, 25, "pass2-pilot", a);
  const c1 = await trekk(sql`utfall = 'ikke_medhold' and bevistyper && array['verkstedrapport','NAF_test']`, 15, "pass2-pilot", [...a, ...b]);
  const c2 = await trekk(sql`utfall = 'ikke_medhold'`, 10, "pass2-pilot", [...a, ...b, ...c1]);
  return [...a, ...b, ...c1, ...c2];
}

const lesListe = (navn: string) => JSON.parse(readFileSync(join(MAPPE, "lister", `${navn}.json`), "utf8")) as number[];
const md5 = (s: string) => createHash("md5").update(s).digest("hex");

async function velg(): Promise<{ navn: string; valgte: number[] }> {
  if (args.pilot) return { navn: "pilot", valgte: await pilot() };
  if (args.prove) return { navn: "prove", valgte: await trekk(sql`true`, 5, "pass2-prove", lesListe("pilot")) };
  if (args.stabilitet) {
    const p = lesListe("pilot");
    return { navn: "stabilitet", valgte: [...p].sort((x, y) => md5(`${x}pass2-stabilitet`).localeCompare(md5(`${y}pass2-stabilitet`))).slice(0, 20) };
  }
  if (args.id) return { navn: args.navn ?? "id", valgte: args.id.split(",").map(Number) };
  if (args.mangler) {
    return {
      navn: args.navn ?? "mangler",
      valgte: await ider(sql`select id from vedtak v where ${GRUNNUTVALG} and not exists (
        select 1 from vedtak_analyse a where a.vedtak_id = v.id and a.instruks_versjon = ${INSTRUKS_VERSJON}) order by id`),
    };
  }
  if (args.alle) return { navn: args.navn ?? "alle", valgte: await ider(sql`select id from vedtak where ${GRUNNUTVALG} order by id`) };
  throw new Error("Velg --pilot, --prove, --stabilitet, --id, --mangler eller --alle.");
}

async function main() {
  const { navn, valgte } = await velg();
  mkdirSync(join(MAPPE, "inn"), { recursive: true });
  mkdirSync(join(MAPPE, "lister"), { recursive: true });
  const rader = valgte.length
    ? await db
        .select({
          id: vedtak.id,
          saksnummer: vedtak.saksnummer,
          kjopsdato: vedtak.kjopsdato,
          overtakelsesdato: vedtak.overtakelsesdato,
          vedtaksdato: vedtak.vedtaksdato,
          utfall: vedtak.utfall,
          kravtyper: vedtak.kravtyper,
          prinsipaltKrav: vedtak.prinsipaltKrav,
          fulltekst: vedtak.fulltekstRenset,
        })
        .from(vedtak)
        .where(inArray(vedtak.id, valgte))
    : [];
  const mangler = rader.filter((r) => !r.fulltekst).map((r) => r.id);
  for (const r of rader) {
    if (!r.fulltekst) continue;
    const hode = [
      `VEDTAK_ID: ${r.id}`,
      `SAKSNUMMER: ${r.saksnummer ?? "ukjent"}`,
      `KJØPSDATO: ${r.kjopsdato ?? "ukjent"}`,
      `OVERTAKELSESDATO: ${r.overtakelsesdato ?? "ukjent"}`,
      `VEDTAKSDATO: ${r.vedtaksdato ?? "ukjent"}`,
      `UTFALL: ${r.utfall}`,
      `KRAV: ${(r.kravtyper ?? []).join(", ") || "ukjent"}`,
      `PRINSIPALT_KRAV: ${r.prinsipaltKrav ?? "ukjent"}`,
    ].join("\n");
    writeFileSync(join(MAPPE, "inn", `${r.id}.txt`), `${hode}\n\n<vedtak>\n${r.fulltekst}\n</vedtak>\n`);
  }
  // Keep the chosen order (strata for the pilot); it is also the order the agents get.
  const skrevet = valgte.filter((i) => rader.some((r) => r.id === i && r.fulltekst));
  writeFileSync(join(MAPPE, "lister", `${navn}.json`), JSON.stringify(skrevet));
  console.log(`${skrevet.length} inn-filer skrevet, liste: ${join(MAPPE, "lister", `${navn}.json`)}`);
  if (mangler.length) console.log(`Uten fulltekst (hoppet over): ${mangler.join(", ")}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Steg 2: Legg til skriptene i `package.json`** etter `"rett-paragrafer"`:

```json
    "pass2:hent": "tsx --env-file=.env.local scripts/pass2-hent.ts",
    "pass2:importer": "tsx --env-file=.env.local scripts/pass2-importer.ts",
    "pass2:rapport": "tsx --env-file=.env.local scripts/pass2-rapport.ts"
```

- [ ] **Steg 3: Kontroller uttaket**

Kjør: `npm run pass2:hent -- --pilot`
Forventet: `100 inn-filer skrevet, liste: data/pass2/lister/pilot.json`.

Kontroller deretter tre ting:
- `head -12 data/pass2/inn/$(node -e "console.log(require('./data/pass2/lister/pilot.json')[0])").txt` viser hodet og starten på `<vedtak>`.
- Ingen ID i `pilot.json` finnes i `DATASJEKK_IDER`: `node -e "const p=require('./data/pass2/lister/pilot.json');console.log(p.length, new Set(p).size)"` skal gi `100 100`.
- `npm run pass2:hent -- --prove` gir 5 ID-er, og ingen av dem står i `pilot.json`.

- [ ] **Steg 4: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil. (`pass2-importer.ts` og `pass2-rapport.ts` finnes ikke ennå. Det gjør ikke noe, fordi package.json-skriptene ikke typesjekkes.)

- [ ] **Steg 5: Commit-punkt.** Spør brukeren. Ved ja: `git add scripts/pass2-hent.ts package.json && git commit -m "Pass 2: uttak av inn-filer og ID-lister"`

---

### Oppgave 6: Importskriptet (`pass2-importer.ts`)

**Filer:**
- Opprett: `scripts/pass2-importer.ts`

**Grensesnitt:**
- Bruker: `hardeFeil` og `verifiserSvar` (oppgave 2), `avledAnalyse` (oppgave 3), `vedtakAnalyse` og `vedtakFeil` (oppgave 4), og `INSTRUKS_VERSJON`.
- Leverer:
  - rader i databasen;
  - `data/pass2/avvist/<id>.<versjon>.json`, med `{ fil, feil, raasvar }`;
  - `data/pass2/avledet/<id>.<versjon>.json`, med `{ vedtak_id, lovversjon, feil: AvledetFeil[] }`, som kontrollen bruker;
  - `data/pass2/import-<versjon>.json`, med opptellingen.

- [ ] **Steg 1: Skriv `scripts/pass2-importer.ts`**

```ts
// Imports the pass 2 agent answers into vedtak_analyse and vedtak_feil (docs/pass2-design.md § 6–7).
// Hard errors move the answer to data/pass2/avvist/; everything else is repaired and flagged.
//
//   npm run pass2:importer -- [--mappe data/pass2/ut] [--id 12,34] [--modell "..."] [--tørrkjøring]

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak, vedtakAnalyse, vedtakFeil } from "../src/db/schema";
import { avledAnalyse } from "../src/lib/analyse/avled";
import { INSTRUKS_VERSJON, type Pass2Svar } from "../src/lib/analyse/skjema";
import { hardeFeil, verifiserSvar } from "../src/lib/analyse/verifiser";

const { values: args } = parseArgs({
  options: {
    mappe: { type: "string", default: "data/pass2/ut" },
    id: { type: "string" },
    modell: { type: "string", default: "claude-sonnet-5-5 (Claude Code-agent)" },
    "tørrkjøring": { type: "boolean", default: false },
  },
});

const M = "data/pass2";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const GRUNNUTVALG = sql`${vedtak.kjoretoytype} in ('personbil','varebil') and ${vedtak.utfall} <> 'avvist' and ${vedtak.lov} = 'forbrukerkjøpsloven'`;

async function main() {
  const monster = new RegExp(`^(\\d+)\\.${INSTRUKS_VERSJON.replace(/\./g, "\\.")}\\.json$`);
  const valgte = args.id ? new Set(args.id.split(",").map(Number)) : null;
  const filer = readdirSync(args.mappe!)
    .map((f) => ({ f, id: Number(monster.exec(f)?.[1] ?? NaN) }))
    .filter((x) => !Number.isNaN(x.id) && (!valgte || valgte.has(x.id)));
  if (!filer.length) {
    console.log(`Ingen svarfiler for ${INSTRUKS_VERSJON} i ${args.mappe}.`);
    return;
  }
  for (const d of ["avvist", "avledet"]) mkdirSync(join(M, d), { recursive: true });

  const rader = await db
    .select({
      id: vedtak.id,
      fulltekstRenset: vedtak.fulltekstRenset,
      utfall: vedtak.utfall,
      tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
      kjopsdato: vedtak.kjopsdato,
      overtakelsesdato: vedtak.overtakelsesdato,
      vedtaksdato: vedtak.vedtaksdato,
      klagerErForbruker: vedtak.klagerErForbruker,
    })
    .from(vedtak)
    .where(sql`${inArray(vedtak.id, filer.map((x) => x.id))} and ${GRUNNUTVALG}`);
  const perId = new Map(rader.map((r) => [r.id, r]));

  const telling = { importert: 0, avvist: 0, sitaterForsokt: 0, sitaterNullet: 0, medKontrollArsaker: 0, feilpunkter: 0 };
  const arsaker = new Map<string, number>();
  const avvisteIder: number[] = [];

  for (const { f, id } of filer) {
    const raa = readFileSync(join(args.mappe!, f), "utf8");
    const avvistSti = join(M, "avvist", f);
    const avvis = (feil: string[]) => {
      writeFileSync(avvistSti, JSON.stringify({ fil: join(args.mappe!, f), feil, raasvar: raa }, null, 2));
      telling.avvist++;
      avvisteIder.push(id);
    };
    let json: unknown;
    try {
      json = JSON.parse(raa);
    } catch (e) {
      avvis([`ugyldig JSON: ${(e as Error).message}`]);
      continue;
    }
    const v = perId.get(id);
    const harde = hardeFeil(json, id, !!v?.fulltekstRenset);
    if (harde.length) {
      avvis(harde);
      continue;
    }
    const fakta = { ...v!, fulltekstRenset: v!.fulltekstRenset! };
    const r = verifiserSvar(json as Pass2Svar, fakta);
    const { analyse, feil } = avledAnalyse(r.svar, fakta);
    writeFileSync(join(M, "avledet", f), JSON.stringify({ vedtak_id: id, lovversjon: analyse.lovversjon, feil }, null, 2));

    telling.sitaterForsokt += r.sitaterForsokt;
    telling.sitaterNullet += r.sitaterNullet;
    telling.feilpunkter += feil.length;
    if (r.kontrollArsaker.length) telling.medKontrollArsaker++;
    for (const a of r.kontrollArsaker) {
      const nokkel = a.replace(/:.*$/, "");
      arsaker.set(nokkel, (arsaker.get(nokkel) ?? 0) + 1);
    }
    if (existsSync(avvistSti)) rmSync(avvistSti);
    if (args["tørrkjøring"]) {
      telling.importert++;
      continue;
    }

    const rad = {
      ...analyse,
      instruksVersjon: INSTRUKS_VERSJON,
      aiModell: args.modell!,
      analysertTidspunkt: new Date(),
      fulltekstSha256: sha(fakta.fulltekstRenset),
      raasvarSha256: sha(raa),
      feil: r.svar.feil,
      opplysninger: r.svar.opplysninger,
      bevis: r.svar.bevis,
      begrunnelseSitater: r.svar.begrunnelse_sitater,
      usikkerhet: r.svar.usikkerhet,
      kontrollArsaker: r.kontrollArsaker,
    };
    // Upsert the analysis first (vedtak_feil references it), then replace all defect rows so a
    // re-import never leaves rows from an earlier answer behind.
    const upsert = db.insert(vedtakAnalyse).values({ vedtakId: id, ...rad }).onConflictDoUpdate({ target: vedtakAnalyse.vedtakId, set: rad });
    const slett = db.delete(vedtakFeil).where(eq(vedtakFeil.vedtakId, id));
    if (feil.length) await db.batch([upsert, slett, db.insert(vedtakFeil).values(feil.map((x) => ({ vedtakId: id, ...x })))]);
    else await db.batch([upsert, slett]);
    telling.importert++;
  }

  const oppsummering = {
    versjon: INSTRUKS_VERSJON,
    mappe: args.mappe,
    tørrkjøring: args["tørrkjøring"],
    ...telling,
    andelSitaterNullet: telling.sitaterForsokt ? telling.sitaterNullet / telling.sitaterForsokt : 0,
    kontrollArsaker: Object.fromEntries([...arsaker].sort((a, b) => b[1] - a[1])),
    avvisteIder,
  };
  writeFileSync(join(M, `import-${INSTRUKS_VERSJON}.json`), JSON.stringify(oppsummering, null, 2));
  console.table(telling);
  console.table(oppsummering.kontrollArsaker);
  if (avvisteIder.length) console.log(`Avvist (se ${join(M, "avvist")}): ${avvisteIder.join(",")}`);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Steg 2: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil. Klager TypeScript på at `analyse.lovversjon` eller et JSONB-felt ikke passer `NyVedtakAnalyse`, skal typen i `avled.ts` eller `verifiser.ts` rettes. Bruk ikke `as any`.

- [ ] **Steg 3: Kontroller at gamle rader ikke blir liggende ved ny import (Review Focus 4).**
  - Lag et håndskrevet svar `data/pass2/ut/<første id i prove.json>.pass2-v1.json` med to feil (`f1`, `f2`). Fyll alle nøklene i skjemaet; tekstfelt kan være `null`.
  - Kjør `npm run pass2:importer -- --id <id>`.
  - Endre fila til bare `f1` og kjør samme kommando på nytt.
  - Kontroller med `select feil_id from vedtak_feil where vedtak_id = <id>` (midlertidig skript som i oppgave 4, steg 5). Svaret skal være bare `f1`.
  - Slett deretter testsvaret, raden (`delete from vedtak_analyse where vedtak_id = <id>`, som også fjerner `vedtak_feil` via cascade) og `data/pass2/avledet/<id>.pass2-v1.json`.

- [ ] **Steg 4: Commit-punkt.** Spør brukeren. Ved ja: `git add scripts/pass2-importer.ts && git commit -m "Pass 2: import med verifisering og avledning"`

---

### Oppgave 7: Instruksen (`instruks.md`)

**Filer:**
- Opprett: `src/lib/analyse/instruks.md`

**Grensesnitt:**
- Bruker: verdilistene fra oppgave 1. De må stå her med nøyaktig samme stavemåte.
- Leverer: teksten agentene følger. Workflow-promptene i oppgave 8 viser til denne fila.

- [ ] **Steg 1: Hent eksempeltekstene ordrett.** Instruksen skal bare bruke eksempler fra datasjekk-sakene. Lag et midlertidig skript som skriver fulltekst for disse ID-ene til `data/pass2/eksempler/<id>.txt` (git-ignorert):
  - 718 (16/1200), 597 (16/1903), 1675 (23/9931);
  - 948 (15/1940), 287 (17/1554), 2737 (21/5546);
  - 2146 (21/15811), 2204 (21/12163), 2881 (21/3689), 1587 (24/1223);
  - 1807 (22/6563), 1756 (23/4133), 2036 (22/1220);
  - 591 (16/1921), 2679 (21/5099), 1555 (24/1043).

  Hent på saksnummer, ikke på ID. Første versjon av denne lista hadde feil ID-er.

  For hvert eksempel i steg 2: finn sitatet i fila og kopier det ordrett. Stemmer klassifiseringen i steg 2 ikke med teksten, rett klassifiseringen, ikke teksten.

- [ ] **Steg 2: Skriv `src/lib/analyse/instruks.md`** med innholdet nedenfor. Sitatene med `⟪…⟫` byttes ut med den ordrette teksten fra steg 1.

````markdown
# Pass 2: instruks for uttrekk (pass2-v1)

Du leser ett vedtak om kjøp av brukt bil fra Forbrukerklageutvalget (FKU) eller Forbrukertvistutvalget og skriver et JSON-svar med **fakta fra vedtaket**. Svarene brukes til å sammenligne nye klager med tidligere vedtak, og sitatene kan bli vist til forbrukere. Et feil svar kan gi en forbruker feil råd.

## Grunnregler
1. **Bare det som står i vedtaket.** Står det ikke der: `null` eller tom liste. Aldri gjett, regn ut eller fordel.
2. **Partene og utvalget er to ting.** Del I–II gjengir hva klageren og innklagede *anførte*. Del III («Utvalget ser slik på saken») og selve vedtaket til slutt er hva utvalget *kom til*. `vurdering`, `grunn`, `grunnlag`, `bevisgrunnlag`, `status`, `vekt` og `utvalgets_vurdering` skal alltid være **utvalgets** syn.
3. **Alle nøkler skal være med**, også når verdien er `null`. Ingen ekstra nøkler.
4. **Bare verdiene i listene nedenfor**, stavet nøyaktig likt.
5. **Ingen personnavn.** Teksten er renset. Plassholdere som `[KLAGER]`, `[PERSON]`, `[REGNR]` skal stå slik de er.
6. **Datoer** som `ÅÅÅÅ-MM-DD`. Er bare måned eller år oppgitt: `dato: null`, og velg `presisjon`.
7. **Beløp** i hele kroner som heltall (kr 18 535,- → `18535`).

## Sitatregel
- `sitat`, `alvor_sitat`, `ordlyd` og `begrunnelse_sitater[].tekst` kopieres **tegn for tegn** fra vedtaket. Ikke rett skrivefeil, ikke bytt ord, ikke sett sammen setninger fra ulike steder.
- Utelater du ord, skriv `…`. Hver bit mellom `…` må være minst 20 tegn (gjelder ikke `ordlyd`).
- Skriv sitatet på én linje uten linjeskift.
- Sitater som ikke finnes i teksten, slettes automatisk. Et kort, ordrett sitat er bedre enn et langt som ikke er det.

## Arbeidsrekkefølge for hvert vedtak
1. Les hele vedtaket.
2. Lag `feil[]` fra det **klageren påberopte** (del I–II). Gi dem `f1`, `f2` … i den rekkefølgen de nevnes.
3. Les utvalgets vurdering og fyll inn utfallet for hver feil.
4. Fyll inn `opplysninger[]` og `bevis[]`, og knytt dem til feilene med `gjelder_feil`.
5. Fyll inn de øvrige feltene og `begrunnelse_sitater[]`.
6. Kontroller at hver id i `gjelder_feil` finnes i `feil[]`, og at alle nøkler er med.
7. Skriv fila før du leser neste vedtak.

## Svarformat
```json
{
  "vedtak_id": 0,
  "ikke_mangelssak": null,
  "feil": [
    {
      "id": "f1", "kategori": "", "komponent": null, "vurdering": "",
      "grunn": null, "grunnlag": null, "bevisgrunnlag": null,
      "viste_seg": { "dato": null, "presisjon": "ukjent", "dager_etter_levering": null },
      "formodning": "ikke_nevnt", "belop_tilkjent_nok": null,
      "alvor": [], "alvor_sitat": null, "sitat": null
    }
  ],
  "opplysninger": [
    {
      "type": "", "form": null, "ordlyd": null, "gjelder": null, "svar_pa_direkte_sporsmal": false,
      "status": "", "vekt": "", "gjelder_feil": [], "sitat": null
    }
  ],
  "bevis": [
    {
      "type": "", "avsender": null, "fremlagt_av": "", "dato": null, "km_ved_undersokelse": null,
      "arsak": "", "ved_levering": "", "paregnelig": "", "kostnad_nok": null,
      "utvalgets_vurdering": "", "avslagsgrunn": null, "gjelder_feil": [], "sitat": null
    }
  ],
  "forste_henvendelse": { "dato": null, "form": "ukjent", "sitat": null },
  "paragrafer_med_ledd": [],
  "begrunnelse_sitater": [ { "tema": "", "tekst": "", "gjelder_feil": [] } ],
  "usikkerhet": null
}
```
`vedtak_id` hentes fra `VEDTAK_ID` i inn-fila. Tomme lister er lov.

## ikke_mangelssak
Settes bare når utvalget avgjør saken **uten å vurdere om bilen hadde en mangel**: `{ "grunn": …, "sitat": … }`. Ellers `null`.

| grunn | Når |
|---|---|
| `ikke_levert` | Bilen ble aldri levert |
| `innbytte_restgjeld` | Saken gjelder innbytte, restgjeld eller pant i innbyttebil, ikke den kjøpte bilen |
| `partsforhold` | Innklagede frifinnes fordi de ikke var selger (for eksempel formidling) |
| `annet` | Annen sak uten mangelsvurdering (for eksempel en parkeringsbot) |

Heftelse på den kjøpte bilen er **ikke** dette. Det er en feil med kategori `heftelse_pant`.

## feil[]
Én post per feil klageren påberopte. Gjelder to påberopte feil samme komponent med ulikt utfall, for eksempel rust på to steder, skal det være to poster.

**kategori** (velg den mest konkrete):
`motor`, `girkasse`, `clutch`, `elektrisk`, `batteri_elbil`, `bremser`, `understell_hjuloppheng`, `rust`, `klimaanlegg`, `kollisjonsskade`, `km_avvik`, `servicehistorikk`, `bruktimport_opplysning`, `fukt_lekkasje`, `ramme_chassis`, `karosseri_lakk_glass`, `dekk_felger`, `utstyr_mangler`, `eksos_utslipp`, `eu_kontroll_registrering`, `interior_lukt`, `drivlinje`, `garanti_vilkar`, `ombygging_tuning`, `arsmodell_identitet`, `heftelse_pant`, `annet`.

Plasseringsregler:
- **`motor`:** turbo, registerreim, kjølesystem, vannpumpe og oljeforbruk.
- **`understell_hjuloppheng`:** servo og styring.
- **`elektrisk`:** infotainment, navigasjon, sensorer, parkeringsvarmer (Webasto), lys og låser.
- **`batteri_elbil`:** rekkevidde på elbil.
- **`eksos_utslipp`:** partikkelfilter, EGR, katalysator, AdBlue og utslippsprogramvare.
- **`drivlinje`:** firehjulstrekk, differensial, drivaksel, kardang og fordelerkasse.
- **`utstyr_mangler`:** utstyr eller tilbehør som manglet eller ikke var som avtalt eller annonsert, også nøkler, reservehjul og programvarepakker.
- **`karosseri_lakk_glass`:** lakk, bulker, riper, frontrute, støtfanger og speil, når det ikke gjelder en tidligere kollisjonsskade. Er det en tidligere kollisjonsskade, bruk `kollisjonsskade`.
- **`annet`** bare når ingenting annet passer.

**komponent:** kort fritekst («registerreim», «venstre bakskjerm»).

**vurdering:**

| Verdi | Når | Eksempel |
|---|---|---|
| `mangel` | Utvalget fant at **denne** feilen er en mangel, også om kravet ble redusert | 23/9931: ⟪«… den knekte antennen utgjør kjøpsrettslige mangler …»⟫ |
| `ikke_mangel` | Utvalget fant at denne feilen ikke er en mangel | 23/9931: ⟪«Bremser er å betegne som slitedeler … utgjør følgelig ikke en kjøpsrettslig mangel»⟫ |
| `ikke_vurdert` | Utvalget tok ikke stilling til feilen | 16/1200: ⟪«ikke nødvendig å vurdere de øvrige feil … all den tid hevingskravet har ført frem»⟫ |
| `samlet_vurdering` | Feilen ble bare vurdert sammen med andre | 16/1903: ⟪«feilene samlet sett medfører …»⟫ |

**grunn** (bare ved `ikke_mangel`, ellers `null`):
- `paregnelig_slitasje`: normal slitasje for alder, kjørelengde og pris.
- `ikke_sannsynliggjort_ved_levering`: ikke vist at feilen fantes ved levering.
- `ikke_dokumentert`: ingen bevis for at feilen finnes i det hele tatt.
- `kjent_eller_opplyst`: kjøper visste om feilen eller ble opplyst om den.
- `synlig_ved_besiktigelse`: kjøper burde ha sett feilen (fkjl § 16 tredje ledd).
- `forbehold`: dekket av «som den er» eller et annet forbehold.
- `reklamert_for_sent`.
- `oppstatt_etter_levering`.
- `utbedret_av_selger`.
- `annet`.

**grunnlag og bevisgrunnlag er to forskjellige spørsmål.** Begge settes bare ved `mangel`, ellers `null`.
- **`grunnlag`** = *hvorfor er dette en mangel?*
  - `avvik_fra_avtale`: ikke som avtalt, eller som kjøperen kunne forvente (fkjl § 15, § 16 første ledd a).
  - `feil_opplysning`: bilen svarer ikke til selgers opplysninger (§ 16 første ledd c).
  - `tilbakeholdt_opplysning`: selger unnlot å opplyse om noe selger kjente eller burde kjenne til (§ 16 første ledd b).
  - `darligere_stand_som_den_er`: solgt «som den er», men i dårligere stand enn kjøperen hadde grunn til å regne med (§ 17 i loven før 2024).
  - `offentligrettslig`: EU-kontroll, registrering o.l.

  Velg etter innholdet, ikke bare etter paragrafbokstaven, fordi utvalget bruker bokstavene ulikt.
- **`bevisgrunnlag`** = *hvorfor fant utvalget det bevist?*
  - `formodning_ikke_motbevist`: feilen viste seg innen fristen, og selger beviste ikke noe annet (§ 18 annet ledd).
  - `dokumentert_utover_paregnelig`: sakkyndig dokumentasjon viste at feilen går utover det påregnelige.
  - `erkjent_av_selger`.
  - `uomtvistet`.
  - `utvalgets_skjonn`: utvalget vurderte bevisene fritt uten noen av grunnene over.

Eksempel med begge satt, 22/6563 (klimaanlegget): ⟪«fire måneder etter kjøpet … Det antas følgelig at feilen forelå ved leveringstidspunktet, jf. fkjl. § 18 annet ledd»⟫. Her er `bevisgrunnlag: "formodning_ikke_motbevist"`, og `grunnlag` er det utvalget bygde mangelen på, ⟪sett inn fra 22/6563, normalt `avvik_fra_avtale`⟫.

**viste_seg:** når **denne** feilen viste seg.
- `dager_etter_levering` regnes fra overtakelse, eller fra kjøp når overtakelse ikke er oppgitt.
- `presisjon`:
  - `dag`: eksakt dato, eller eksakt antall dager («samme dag» = 0);
  - `maaned`: måneden er kjent;
  - `omtrentlig`: «få dager etter», «noen uker», «vinteren 2016». Er tiden ikke tallfestet, er `dager_etter_levering` `null`;
  - `ukjent`.
- Bruk **ikke** datoen for reklamasjonen som tidspunktet feilen viste seg. 16/1921: ⟪«bilen stanset etter å ha kjørt 6 mil …»⟫ gir dag 0, selv om det skriftlige kravet kom mye senere.

**formodning** (for denne feilen):
- `anvendt_for_klager`: utvalget brukte § 18 annet ledd, så feilen antas å ha vært der ved levering.
- `avkreftet`: utvalget fant formodningen motbevist eller uforenlig med feilens art. 23/4133: ⟪«… uforenelig med mangelens art»⟫.
- `nevnt`: står bare i partenes anførsler eller i et fast avsnitt om rettsreglene, uten å bli brukt. 22/1220: ⟪standardavsnittet⟫.
- `ikke_aktuell`: utvalget sier at feilen viste seg etter fristen.
- `ikke_nevnt`.

**belop_tilkjent_nok:** bare når vedtaket selv knytter et beløp til **denne** feilen. Aldri fordel et samlet beløp.

**alvor:** `trafikkfarlig` og/eller `ikke_kjorbar`, bare når utvalget eller et bevis sier det, med `alvor_sitat`. Ellers `[]`.

**sitat:** utvalgets konklusjon om denne feilen.

## opplysninger[]
Én post per opplysning fra selger som saken dreier seg om.

| Felt | Verdier |
|---|---|
| `type` | `uttalelse` (selger sa eller skrev noe) eller `taushet` (selger unnlot å opplyse) |
| `form` | `annonse`, `kontrakt`, `melding` (sms, e-post), `salgsoppgave`, `tilstandsrapport_fra_selger`, `muntlig`, `annet`. `null` ved `taushet` |
| `ordlyd` | Selgers ord, ordrett slik vedtaket gjengir dem. `null` ved `muntlig`, `taushet`, eller når vedtaket bare refererer innholdet |
| `gjelder` | Kort fritekst |
| `svar_pa_direkte_sporsmal` | `true` hvis opplysningen var svar på et direkte spørsmål fra kjøper |
| `status` | Utvalgets syn: `lagt_til_grunn`, `omtvistet` (ikke avgjort) eller `avvist` |
| `vekt` | `for_klager`, `mot_klager` eller `ingen` |
| `gjelder_feil` | Feil-id-er. `[]` betyr at opplysningen gjelder hele saken |

Eksempler:
- **Opplysning i klagers favør, 21/15811:** kontrakten ⟪«leveres eu godkjent for to nye år!»⟫. Det gir `form: "kontrakt"`, `status: "lagt_til_grunn"` og `vekt: "for_klager"`. Utvalget: ⟪«Dette er en feil opplysning.»⟫
- **Opplysning mot klager, 21/3689:** kontrakten ⟪«… påkjørsel i grøft»⟫. Utvalget la ⟪«avgjørende vekt på at klageren er opplyst om …»⟫, så `vekt: "mot_klager"`.
- **Muntlige opplysninger:** `form: "muntlig"`, `ordlyd: null`. Status er nesten alltid `omtvistet` eller `avvist`.

**Dokumenter selger la ved salget** (NAF-test, tilstandsrapport eller servicehistorikk vedlagt annonsen eller kontrakten):
- Registrer dem **alltid** som `opplysninger[]` med `form: "tilstandsrapport_fra_selger"`. Det de sier eller unnlater å si, er en opplysning fra selger.
- Påberoper selger dokumentet som bevis i saken, skal det **i tillegg** stå i `bevis[]` med `fremlagt_av: "selger"`.
- Eksempel, 24/1223: ⟪tilstandsrapporten fra selger nevnte ikke skaden⟫. Det gir en `uttalelse` med `form: "tilstandsrapport_fra_selger"`, og en `taushet` om skaden.

## bevis[]
Én post per dokument eller kilde. Selgers motbevis får egne poster.

| Felt | Verdier |
|---|---|
| `type` | `verkstedrapport`, `NAF_test`, `takst`, `EU_kontroll`, `tilstandsrapport`, `faktura`, `servicehistorikk`, `sakkyndig_uttalelse`, `bilder`, `korrespondanse`, `annet` |
| `avsender` | Firma eller rolle («merkeverksted», «NAF»), aldri personnavn |
| `fremlagt_av` | `klager`, `selger` eller `ukjent` |
| `dato`, `km_ved_undersokelse` | Når undersøkelsen ble gjort og kilometerstand da |
| `arsak` | Hva **dokumentet** sier: `rotarsak` (hvorfor feilen oppstod), `komponent` (bare komponenten er navngitt) eller `ingen` |
| `ved_levering` | Hva **dokumentet selv** sier: `ja`, `nei` eller `uttaler_seg_ikke` |
| `paregnelig` | Hva **dokumentet selv** sier om alder, kjørelengde og slitasje: `utover`, `innenfor` eller `uttaler_seg_ikke` |
| `kostnad_nok` | Utbedringskostnad i dokumentet, ikke kostnaden for selve undersøkelsen |
| `utvalgets_vurdering` | `vektlagt`, `ikke_vektlagt` eller `ikke_nevnt` |
| `avslagsgrunn` | Ved `ikke_vektlagt`: `for_generell`, `sier_ikke_naar`, `sier_ikke_paregnelig`, `motbevist`, `for_sent_utfort` eller `annet`. Ellers `null` |

**`ved_levering` og `paregnelig` gjelder dokumentet, ikke utvalgets konklusjon.** To kontrasteksempler:
- **Rapporten sier det, men utvalget avviser den, 15/1940:** verkstedet skrev ⟪«ikke normalt at gearkasse ryker på 245 000 km»⟫. Det gir `paregnelig: "utover"`. Utvalget avviste likevel beviset (⟪«De sier ikke noe om hvorvidt girkassen er defekt og eventuelt årsaken»⟫), så `utvalgets_vurdering: "ikke_vektlagt"` og `avslagsgrunn: "for_generell"`.
- **Utvalget konkluderer, men rapporten sa det ikke, 22/6563:** utvalget la til grunn at feilen forelå ved levering på grunn av § 18 annet ledd. Verkstedrapporten sa ikke noe om leveringstidspunktet, så `ved_levering: "uttaler_seg_ikke"`.

Andre eksempler:
- **17/1554:** ⟪«uttalelsen … ikke sier noe om de avdekkende feilene er uvanlig sett hen til bilens alder og kjørte kilometer»⟫ gir `avslagsgrunn: "sier_ikke_paregnelig"`.
- **21/5546:** ⟪«noe generell … gitt uten gjennomført besiktigelse»⟫ gir `avslagsgrunn: "for_generell"`.

## forste_henvendelse
Første gang kjøper tok kontakt med selger om feilen, **også muntlig**, for eksempel ved å levere bilen tilbake til selgers verksted. `form`: `muntlig`, `skriftlig` eller `ukjent`. Er det første skriftlige kravet senere enn en tidligere muntlig kontakt, gjelder den muntlige.

## paragrafer_med_ledd
Paragrafer **utvalget** anvender, med ledd og bokstav slik de står (for eksempel `"fkjl § 16 første ledd bokstav c"`). Ikke ta med paragrafer som bare står i partenes anførsler.

## begrunnelse_sitater
Opptil 8 ordrette utdrag fra **utvalgets vurdering**, 1–3 setninger hver, som forklarer utfallet. `tema` er en av:
- `mangel`, `bevis`, `opplysning`, `formodning`, `reklamasjon`, `sanksjon` eller `belop`.

`gjelder_feil` knytter sitatet til feilene.

## usikkerhet
Kort fritekst om hva du var usikker på, ellers `null`.
````

- [ ] **Steg 3: Kontroller at listene stemmer.** Kontroller at alle verdilistene i instruksen er identiske med listene i `src/lib/analyse/skjema.ts`. Skriv et midlertidig skript som leser begge og sammenligner hver liste med et regulært uttrykk mot instruksteksten, eller gjør det for hånd. Ingen verdi skal finnes i bare den ene av dem.

- [ ] **Steg 4: Send instruksen til brukeren for gjennomgang mot krav 1–5 i design-avsnitt 10.** Vent på godkjenning før oppgave 9.

- [ ] **Steg 5: Commit-punkt.** Spør brukeren. Ved ja: `git add src/lib/analyse/instruks.md && git commit -m "Pass 2: instruks for uttrekket (pass2-v1)"`

---

### Oppgave 8: Workflow-skript for uttrekk og kontroll

**Filer:**
- Opprett: `scripts/workflows/pass2-uttrekk.js`
- Opprett: `scripts/workflows/pass2-kontroll.js`

**Grensesnitt:**
- Bruker: inn-filer og lister (oppgave 5), instruksen (oppgave 7), og `avledet/` fra importen (oppgave 6).
- Leverer:
  - **Uttrekket:** filer i `utMappe`. Returnerer `{ skrevet: number[], hoppet: {vedtak_id, grunn}[], mistet: number[] }`.
  - **Kontrollen:** filer `data/pass2/kontroll/<id>.pass2-v1.json` i formatet nedenfor.

Workflow-skript er ren JavaScript og har ikke tilgang til filsystemet. Listen med ID-er sendes inn som `args`. `Date.now()` og `Math.random()` er ikke tillatt.

- [ ] **Steg 1: Skriv `scripts/workflows/pass2-uttrekk.js`**

```js
export const meta = {
  name: 'pass2-uttrekk',
  description: 'Pass 2: agenter leser vedtak i data/pass2/inn og skriver JSON-svar, ett vedtak om gangen',
  phases: [{ title: 'Uttrekk', detail: 'én agent per bolk' }],
}

// args: { ider: number[], bolk: number, utMappe: string, versjon: string, modell: string }
const ider = args.ider
const bolk = args.bolk || 5
const utMappe = args.utMappe || 'data/pass2/ut'
const versjon = args.versjon
const modell = args.modell || 'sonnet'

const bolker = []
for (let i = 0; i < ider.length; i += bolk) bolker.push(ider.slice(i, i + bolk))
log(`${ider.length} vedtak i ${bolker.length} bolker à ${bolk}, ut: ${utMappe}`)

const RESULTAT = {
  type: 'object',
  properties: {
    skrevet: { type: 'array', items: { type: 'integer' } },
    hoppet_over: {
      type: 'array',
      items: { type: 'object', properties: { vedtak_id: { type: 'integer' }, grunn: { type: 'string' } }, required: ['vedtak_id', 'grunn'] },
    },
  },
  required: ['skrevet', 'hoppet_over'],
}

const prompt = (b) => `Du henter ut fakta fra vedtak fra Forbrukerklageutvalget for Tvistr (pass 2).

1. Les instruksen i src/lib/analyse/instruks.md nøye. Den bestemmer alle felt, alle tillatte verdier og sitatregelen.
2. Behandle disse vedtakene ETT OM GANGEN, i denne rekkefølgen: ${b.join(', ')}.
   For hvert vedtak: les data/pass2/inn/<id>.txt og skriv svaret som gyldig JSON til ${utMappe}/<id>.${versjon}.json med Write-verktøyet. Skriv fila ferdig FØR du leser neste inn-fil.
3. Les ingen andre filer enn instruksen og disse inn-filene. Ikke kjør kommandoer mot databasen, ikke bruk nettet, og les aldri data/raw/.
4. Når alle er skrevet: returner id-ene du skrev, og eventuelle du måtte hoppe over, med grunn.`

const resultater = await parallel(
  bolker.map((b, i) => () => agent(prompt(b), { label: `bolk ${i + 1}: ${b.join(',')}`, phase: 'Uttrekk', schema: RESULTAT, model: modell })),
)
const skrevet = resultater.filter(Boolean).flatMap((r) => r.skrevet)
const hoppet = resultater.filter(Boolean).flatMap((r) => r.hoppet_over)
const mistet = bolker.filter((b, i) => !resultater[i]).flat()
if (hoppet.length) log(`Hoppet over: ${hoppet.map((h) => h.vedtak_id).join(',')}`)
if (mistet.length) log(`Bolker som feilet, ${mistet.length} vedtak: ${mistet.join(',')}`)
return { skrevet, hoppet, mistet }
```

- [ ] **Steg 2: Skriv `scripts/workflows/pass2-kontroll.js`**

```js
export const meta = {
  name: 'pass2-kontroll',
  description: 'Pass 2: Opus-agenter kontrollerer uttrekket mot fulltekst og skriver dom med sitat per uenighet',
  phases: [{ title: 'Kontroll', detail: 'én agent per bolk', model: 'opus' }],
}

// args: { ider: number[], bolk: number, versjon: string, kontrollMappe?: string, uavhengig?: boolean }
// uavhengig = the second control used for calibration: its own folder and an explicit brief to look for errors.
const ider = args.ider
const bolk = args.bolk || 5
const versjon = args.versjon
const kontrollMappe = args.kontrollMappe || 'data/pass2/kontroll'
const uavhengig = !!args.uavhengig

const bolker = []
for (let i = 0; i < ider.length; i += bolk) bolker.push(ider.slice(i, i + bolk))

const FORMAT = `{
  "vedtak_id": 123,
  "feil": [
    { "feil_id": "f1",
      "vurdering":     { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "grunnlag":      { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "bevisgrunnlag": { "riktig": false, "riktig_verdi": "uomtvistet", "sitat": "ordrett fra vedtaket" },
      "spor":          { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "spor_vunnet":   { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "formodning":    { "riktig": true,  "riktig_verdi": null, "sitat": null },
      "viste_seg":     { "riktig": true,  "riktig_verdi": null, "sitat": null } }
  ],
  "manglende_feil": [ { "beskrivelse": "feil klageren påberopte som mangler i svaret", "sitat": "ordrett" } ],
  "overflodige_feil": [ "f3" ],
  "opplysninger": { "riktige": 2, "feil": 1, "merknader": [ { "hva": "kort", "sitat": "ordrett" } ] },
  "bevis": { "riktige": 3, "feil": 0, "merknader": [] }
}`

const vinkel = uavhengig
  ? 'Gå ut fra at uttrekket inneholder feil, og let aktivt etter dem, særlig i vurdering per feil, grunnlag mot bevisgrunnlag, og hva bevisene selv sier mot hva utvalget konkluderte. Men merk bare det du kan belegge med sitat.'
  : 'Vær streng og konkret.'

const prompt = (b) => `Du kontrollerer et automatisk uttrekk fra vedtak fra Forbrukerklageutvalget (Tvistr, pass 2). ${vinkel}

For hvert vedtak (id-er: ${b.join(', ')}), ett om gangen:
1. Les src/lib/analyse/instruks.md (reglene uttrekket skulle følge) og docs/spor.md (spordefinisjonen).
2. Les fulltekst: data/pass2/inn/<id>.txt. Les uttrekket: data/pass2/ut/<id>.${versjon}.json. Les avledede spor per feil: data/pass2/avledet/<id>.${versjon}.json (feltene spor og sporVunnet).
3. Vurder hver feil i uttrekket: er vurdering, grunnlag, bevisgrunnlag, formodning og viste_seg riktige etter instruksen? Er spor og spor_vunnet riktige etter docs/spor.md, gitt hva vedtaket faktisk sier?
4. For HVER uenighet: sett riktig=false, oppgi riktig_verdi, og sitér ordrett fra fulltekst det som viser det. Uten sitat: ikke uenig.
5. Tell opp opplysninger[] og bevis[] som er riktige eller feil, med merknad og sitat for hver feil.
6. Skriv dommen som JSON til ${kontrollMappe}/<id>.${versjon}.json i dette formatet, før du går videre til neste vedtak:
${FORMAT}

Les ikke docs/vedtakssammenligning-datasjekk.md og ingen andre filer under data/pass2/ enn de som er nevnt. Les særlig ikke andre kontrollmapper. Ikke bruk databasen eller nettet.
Returner listen over id-er du skrev.`

const SVAR = { type: 'object', properties: { skrevet: { type: 'array', items: { type: 'integer' } } }, required: ['skrevet'] }
const resultater = await parallel(
  bolker.map((b, i) => () => agent(prompt(b), { label: `kontroll ${i + 1}: ${b.join(',')}`, phase: 'Kontroll', schema: SVAR, model: 'opus' })),
)
const skrevet = resultater.filter(Boolean).flatMap((r) => r.skrevet)
const mistet = bolker.filter((b, i) => !resultater[i]).flat()
if (mistet.length) log(`Bolker som feilet, ${mistet.length} vedtak: ${mistet.join(',')}`)
return { skrevet, mistet }
```

- [ ] **Steg 3: Kontroller syntaksen** uten å kjøre agenter: `node --check scripts/workflows/pass2-uttrekk.js && node --check scripts/workflows/pass2-kontroll.js`. `export` på toppnivå kan gi feilmelding i `node --check` for `.js` uten `"type": "module"`. Kjør i så fall `node --input-type=module --check < scripts/workflows/pass2-uttrekk.js`, og tilsvarende for kontrollfila. Forventet: ingen utskrift.

- [ ] **Steg 4: Commit-punkt.** Spør brukeren. Ved ja: `git add scripts/workflows && git commit -m "Pass 2: Workflow-skript for uttrekk og kontroll"`

---

### Oppgave 9: Prøvekjøring på 5 vedtak

**Filer:** ingen nye. Kjøring og gjennomgang.

**Grensesnitt:**
- Bruker: `data/pass2/lister/prove.json` (oppgave 5), Workflow-skriptet (oppgave 8) og importen (oppgave 6).

- [ ] **Steg 1: Kjør uttrekket på prøvesettet.**
  - Les ID-ene: `cat data/pass2/lister/prove.json`.
  - Kjør Workflow med `scriptPath: "scripts/workflows/pass2-uttrekk.js"` og `args: { ider: [<de 5>], bolk: 5, utMappe: "data/pass2/ut", versjon: "pass2-v1", modell: "sonnet" }`.
  - Forventet: `skrevet` har 5 ID-er, og `mistet` er tom.

- [ ] **Steg 2: Tørrkjør importen**

Kjør: `npm run pass2:importer -- --id <de 5, kommaseparert> --tørrkjøring`
Forventet:
- `avvist: 0`;
- `andelSitaterNullet` er under 0,2;
- kontrollårsakene står i tabellen.

Avvises et svar, les `data/pass2/avvist/<fil>` og rett instruksen, ikke importen, hvis feilen er agentens.

- [ ] **Steg 3: Les råsvarene sammen med brukeren.**
  - Sjekk `data/pass2/ut/<id>.pass2-v1.json` mot `data/pass2/inn/<id>.txt` for alle 5.
  - Se særlig på `vurdering` per feil, at `grunnlag` og `bevisgrunnlag` ikke er blandet sammen, at `ved_levering` og `paregnelig` gjelder hva dokumentet sier, og hvilke sitater som ble nullet (de har `sitat_verifisert: false` i `data/pass2/avledet/` etter en vanlig import).
  - Noter endringer i instruksen. Øker `INSTRUKS_VERSJON` (til `pass2-v2`), må både `skjema.ts` og instruksoverskriften endres.

- [ ] **Steg 4: Importer for alvor:** `npm run pass2:importer -- --id <de 5>`. Kontroller at `select count(*) from vedtak_feil_sok` gir like mange rader som feilpunkter i importtellingen.

- [ ] **Steg 5: Beslutning.** Godkjenner brukeren prøvekjøringen, gå videre til oppgave 10. Ellers juster instruksen og gjenta oppgave 9.

---

### Oppgave 10: Rapportskriptet (`pass2-rapport.ts`)

**Filer:**
- Opprett: `scripts/pass2-rapport.ts`

**Grensesnitt:**
- Bruker:
  - `data/pass2/kontroll/*.json` (formatet i oppgave 8);
  - `data/pass2/kontroll2/*.json` (samme format, fra den uavhengige kontrollen);
  - `data/pass2/ut/` og `data/pass2/ut-stabilitet/`;
  - `data/pass2/lister/{pilot,stabilitet}.json`;
  - `data/pass2/import-pass2-v1.json`;
  - `verifiserSvar`, `avledAnalyse` og `wilson` fra `src/lib/wilson.ts`.
- Leverer: `data/pass2/rapport-pass2-v1.md` og utskrift i terminalen.

- [ ] **Steg 1: Skriv `scripts/pass2-rapport.ts`**

```ts
// Measures the pass 2 pilot against the thresholds in docs/pass2-design.md § 9.2: control agents'
// verdicts, agreement with the user's own reading, run-to-run stability and import statistics.
//
//   npm run pass2:rapport

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { inArray } from "drizzle-orm";
import { db } from "../src/db";
import { vedtak } from "../src/db/schema";
import { avledAnalyse, type AvledetFeil } from "../src/lib/analyse/avled";
import { INSTRUKS_VERSJON, type Pass2Svar } from "../src/lib/analyse/skjema";
import { hardeFeil, verifiserSvar } from "../src/lib/analyse/verifiser";
import { wilson } from "../src/lib/wilson";

type Dom = { riktig: boolean; riktig_verdi: unknown; sitat: string | null };
const FELT = ["vurdering", "grunnlag", "bevisgrunnlag", "spor", "spor_vunnet", "formodning", "viste_seg"] as const;
type KontrollFeil = { feil_id: string } & Record<(typeof FELT)[number], Dom>;
type Kontroll = {
  vedtak_id: number;
  feil: KontrollFeil[];
  manglende_feil: { beskrivelse: string; sitat: string }[];
  overflodige_feil: string[];
  opplysninger: { riktige: number; feil: number };
  bevis: { riktige: number; feil: number };
};

const M = "data/pass2";
const lesJson = <T>(sti: string) => JSON.parse(readFileSync(sti, "utf8")) as T;
const lesMappe = <T>(mappe: string): T[] =>
  existsSync(mappe) ? readdirSync(mappe).filter((f) => f.endsWith(`.${INSTRUKS_VERSJON}.json`)).map((f) => lesJson<T>(join(mappe, f))) : [];
const pst = (x: number) => `${(x * 100).toFixed(1)} %`;

type Andel = { k: number; n: number; andel: number; lav: number };
function andel(k: number, n: number): Andel {
  return { k, n, andel: n ? k / n : 0, lav: wilson(k, n)[0] };
}
// Under 100 points the requirement applies to the lower Wilson bound (design § 9.2).
const oppfylt = (a: Andel, krav: number) => (a.n >= 100 ? a.andel : a.lav) > krav;

function kontrollTall(kontroller: Kontroll[]) {
  const feil = kontroller.flatMap((k) => k.feil);
  const tell = (p: (f: KontrollFeil) => boolean) => andel(feil.filter(p).length, feil.length);
  const sum = (f: (k: Kontroll) => number) => kontroller.reduce((s, k) => s + f(k), 0);
  return {
    saker: kontroller.length,
    vurdering: tell((f) => f.vurdering.riktig),
    grunnlag: tell((f) => f.grunnlag.riktig && f.bevisgrunnlag.riktig),
    spor: tell((f) => f.spor.riktig && f.spor_vunnet.riktig),
    formodning: tell((f) => f.formodning.riktig),
    visteSeg: tell((f) => f.viste_seg.riktig),
    opplysninger: andel(sum((k) => k.opplysninger.riktige), sum((k) => k.opplysninger.riktige + k.opplysninger.feil)),
    bevis: andel(sum((k) => k.bevis.riktige), sum((k) => k.bevis.riktige + k.bevis.feil)),
    manglendeFeil: sum((k) => k.manglende_feil.length),
    overflodigeFeil: sum((k) => k.overflodige_feil.length),
  };
}

// Does quality drop later in a batch? Position = index in the pilot list modulo batch size.
function etterPosisjon(kontroller: Kontroll[], pilot: number[], bolk = 5) {
  return Array.from({ length: bolk }, (_, p) => {
    const ider = new Set(pilot.filter((_, i) => i % bolk === p));
    const feil = kontroller.filter((k) => ider.has(k.vedtak_id)).flatMap((k) => k.feil);
    return andel(feil.filter((f) => f.vurdering.riktig).length, feil.length);
  });
}

// Agreement between the two independent control agents, per field and defect.
function kalibrering(kontroller: Kontroll[], andre: Kontroll[]) {
  const perId = new Map(kontroller.map((k) => [k.vedtak_id, k]));
  let enige = 0;
  let n = 0;
  for (const m of andre) {
    const k = perId.get(m.vedtak_id);
    if (!k) continue;
    for (const mf of m.feil) {
      const kf = k.feil.find((f) => f.feil_id === mf.feil_id);
      if (!kf) continue;
      for (const felt of FELT) {
        n++;
        if (mf[felt].riktig === kf[felt].riktig) enige++;
      }
    }
  }
  return andel(enige, n);
}

async function stabilitet() {
  const liste = join(M, "lister", "stabilitet.json");
  if (!existsSync(liste)) return null;
  const ider = lesJson<number[]>(liste);
  const rader = await db
    .select({
      id: vedtak.id,
      fulltekstRenset: vedtak.fulltekstRenset,
      utfall: vedtak.utfall,
      tilkjentTotaltNok: vedtak.tilkjentTotaltNok,
      kjopsdato: vedtak.kjopsdato,
      overtakelsesdato: vedtak.overtakelsesdato,
      vedtaksdato: vedtak.vedtaksdato,
      klagerErForbruker: vedtak.klagerErForbruker,
    })
    .from(vedtak)
    .where(inArray(vedtak.id, ider));
  const like = (a: AvledetFeil, b: AvledetFeil) =>
    a.vurdering === b.vurdering && a.grunnlag === b.grunnlag && a.bevisgrunnlag === b.bevisgrunnlag && a.spor.join() === b.spor.join() && a.sporVunnet.join() === b.sporVunnet.join();
  let par = 0;
  let identiske = 0;
  for (const v of rader) {
    const fil = `${v.id}.${INSTRUKS_VERSJON}.json`;
    const [a, b] = [join(M, "ut", fil), join(M, "ut-stabilitet", fil)];
    if (!existsSync(a) || !existsSync(b) || !v.fulltekstRenset) continue;
    const fakta = { ...v, fulltekstRenset: v.fulltekstRenset };
    const avled = (sti: string): AvledetFeil[] | null => {
      const raa = lesJson<unknown>(sti);
      if (hardeFeil(raa, v.id, true).length) return null;
      return avledAnalyse(verifiserSvar(raa as Pass2Svar, fakta).svar, fakta).feil;
    };
    const fa = avled(a);
    const fb = avled(b);
    if (!fa || !fb) continue;
    par += Math.max(fa.length, fb.length);
    const nokkel = (f: AvledetFeil) => `${f.kategori}|${(f.komponent ?? "").toLowerCase().trim()}`;
    const brukt = new Set<AvledetFeil>();
    for (const f of fa) {
      // Pair on category + component; fall back to category when it is unique in both runs.
      let g = fb.find((x) => !brukt.has(x) && nokkel(x) === nokkel(f));
      if (!g && fa.filter((x) => x.kategori === f.kategori).length === 1) {
        const kandidater = fb.filter((x) => !brukt.has(x) && x.kategori === f.kategori);
        if (kandidater.length === 1) g = kandidater[0];
      }
      if (g) {
        brukt.add(g);
        if (like(f, g)) identiske++;
      }
    }
  }
  return andel(identiske, par);
}

async function main() {
  const kontroller = lesMappe<Kontroll>(join(M, "kontroll"));
  const andre = lesMappe<Kontroll>(join(M, "kontroll2"));
  const pilotSti = join(M, "lister", "pilot.json");
  const pilot = existsSync(pilotSti) ? lesJson<number[]>(pilotSti) : [];
  const importSti = join(M, `import-${INSTRUKS_VERSJON}.json`);
  const imp = existsSync(importSti) ? lesJson<{ importert: number; avvist: number; andelSitaterNullet: number; sitaterNullet: number; sitaterForsokt: number }>(importSti) : null;

  const t = kontrollTall(kontroller);
  const stab = await stabilitet();
  const kal = kalibrering(kontroller, andre);
  const pos = etterPosisjon(kontroller, pilot);

  const rad = (navn: string, a: Andel, krav?: number) =>
    `| ${navn} | ${a.k}/${a.n} | ${pst(a.andel)} | ${pst(a.lav)} | ${krav == null ? "rapporteres" : oppfylt(a, krav) ? `**oppfylt** (> ${pst(krav)})` : `**ikke oppfylt** (> ${pst(krav)})`} |`;
  const linjer = [
    `# Pass 2 – pilotrapport (${INSTRUKS_VERSJON})`,
    "",
    `Kontrollerte saker: ${t.saker}. Manglende feil: ${t.manglendeFeil}. Overflødige feil: ${t.overflodigeFeil}.`,
    "",
    "| Måling | Riktige | Andel | Nedre Wilson | Krav |",
    "|---|---|---|---|---|",
    rad("Utfall per feil (sjekk 3)", t.vurdering, 0.9),
    rad("Grunnlag og bevisgrunnlag (sjekk 4)", t.grunnlag, 0.9),
    rad("Spor og vunnet spor", t.spor, 0.9),
    stab ? rad("Stabilitet (to kjøringer)", stab, 0.9) : "| Stabilitet | – | – | – | mangler ut-stabilitet |",
    rad("Formodning (sjekk 7)", t.formodning),
    rad("Når feilen viste seg (sjekk 8)", t.visteSeg),
    rad("Opplysninger (sjekk 5c)", t.opplysninger),
    rad("Bevis (sjekk 6c)", t.bevis),
    andre.length ? rad("Kalibrering: enighet mellom to kontrollagenter", kal, 0.9) : "| Kalibrering | – | – | – | mangler kontroll2 |",
    "",
    imp
      ? `Import: ${imp.importert} importert, ${imp.avvist} avvist. Sitater nullet: ${imp.sitaterNullet}/${imp.sitaterForsokt} (${pst(imp.andelSitaterNullet)}). Alle lagrede sitater er verifisert mot fulltekst.`
      : "Import: ingen importtelling funnet.",
    "",
    "Utfall per feil etter posisjon i bolken (1 = første vedtak agenten behandlet):",
    "",
    ...pos.map((a, i) => `- Posisjon ${i + 1}: ${a.k}/${a.n} (${pst(a.andel)})`),
  ];
  const tekst = linjer.join("\n");
  writeFileSync(join(M, `rapport-${INSTRUKS_VERSJON}.md`), `${tekst}\n`);
  console.log(tekst);
}

main().then(() => process.exit(0)).catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Steg 2: Kontroller rapporten på prøvesettet.**
  - Kjør kontroll-Workflow på de 5 prøvevedtakene: `scriptPath: "scripts/workflows/pass2-kontroll.js"`, `args: { ider: [<de 5>], bolk: 5, versjon: "pass2-v1" }`.
  - Kjør deretter `npm run pass2:rapport`.
  - Forventet: en tabell med `Kontrollerte saker: 5`, tall i radene for utfall, grunnlag og spor, og «mangler ut-stabilitet» for stabiliteten.
  - Les to av kontrollfilene og kontroller at hver `riktig: false` har et sitat.

- [ ] **Steg 3: Typesjekk.** Kjør `npm run typecheck`. Forventet: ingen feil.

- [ ] **Steg 4: Commit-punkt.** Spør brukeren. Ved ja: `git add scripts/pass2-rapport.ts && git commit -m "Pass 2: pilotrapport mot godkjenningskravene"`

---

### Oppgave 11: Pilot på 100 vedtak

**Filer:** ingen nye. Resultatet er `data/pass2/rapport-pass2-v1.md` og et sammendrag i `docs/pass2-pilot.md`.

- [ ] **Steg 1: Rydd vekk prøvekjøringen fra målingen.** Prøvevedtakene står ikke i `pilot.json`, så de kommer ikke med i stabilitets- eller posisjonstallene. De kommer likevel med i kontrolltallene hvis kontrollfilene ligger igjen. Flytt dem derfor: `mkdir -p data/pass2/prove-kontroll && mv data/pass2/kontroll/* data/pass2/prove-kontroll/`.

- [ ] **Steg 2: Kjør uttrekket på piloten.** Workflow `scripts/workflows/pass2-uttrekk.js` med `args: { ider: <innholdet i data/pass2/lister/pilot.json>, bolk: 5, utMappe: "data/pass2/ut", versjon: "pass2-v1", modell: "sonnet" }`. Forventet: 100 i `skrevet`. Står det noe i `mistet` eller `hoppet`, kjør Workflow på nytt med bare de ID-ene.

- [ ] **Steg 3: Importer.** Kjør `npm run pass2:importer -- --id <pilot-ID-ene>`. Er det avviste svar: kjør uttrekket én gang til for `avvisteIder` (fra `data/pass2/import-pass2-v1.json`), og importer på nytt. Svar som avvises to ganger, gjennomgås i hovedøkten, og årsaken noteres i pilotrapporten.

- [ ] **Steg 4: Kjør stabilitetstesten.**
  - Kjør `npm run pass2:hent -- --stabilitet`, som gir 20 ID-er i `lister/stabilitet.json`.
  - Kjør Workflow `pass2-uttrekk.js` med `args: { ider: <stabilitet.json>, bolk: 5, utMappe: "data/pass2/ut-stabilitet", versjon: "pass2-v1", modell: "sonnet" }`.
  - **Ikke importer `ut-stabilitet`.**

- [ ] **Steg 5: Kjør kontrollen.** Workflow `scripts/workflows/pass2-kontroll.js` med `args: { ider: <pilot.json>, bolk: 5, versjon: "pass2-v1" }`. Forventet: 100 kontrollfiler.

- [ ] **Steg 6: Kalibrer kontrollen med en uavhengig kontrollagent.** Brukeren fyller ikke ut noe.
  - Kjør Workflow `scripts/workflows/pass2-kontroll.js` med `args: { ider: <stabilitet.json>, bolk: 5, versjon: "pass2-v1", kontrollMappe: "data/pass2/kontroll2", uavhengig: true }`.
  - Forventet: 20 filer i `data/pass2/kontroll2/`.
  - Les deretter alle feltene der de to kontrollene er uenige, sammen med fulltekst, og avgjør hvem som har rett.
  - Noter i pilotrapporten (steg 8) hvor ofte den første kontrollen tok feil. Det er feilraten som gjelder for kontrolltallene i tabellen.

- [ ] **Steg 7: Lag rapporten.** Kjør `npm run pass2:rapport`. Les `data/pass2/rapport-pass2-v1.md`.

- [ ] **Steg 8: Skriv `docs/pass2-pilot.md`** med:
  - tabellen fra rapporten (bare tall);
  - kalibreringstallet, og resultatet av gjennomgangen av uenighetene mellom kontrollagentene;
  - posisjonstallene, med en anbefaling om bolkstørrelsen (5 eller 10);
  - de vanligste kontrollårsakene;
  - 3–5 typiske feil fra kontrollen, med saksnummer og ordrett sitat;
  - en konklusjon: **godkjent** (fullkjøring) eller **ikke godkjent** (hva endres i instruksen, og ny pilot med `pass2-v2` på 100 nye vedtak).

  Ingen personnavn.

- [ ] **Steg 9: Commit-punkt.** Spør brukeren. Ved ja: `git add docs/pass2-pilot.md && git commit -m "Pass 2: pilotresultat"`

---

### Oppgave 12: Dokumentasjon

**Filer:**
- Endre: `README.md` (avsnittet om kjøringsrekkefølge)
- Endre: `CLAUDE.md` (avsnittet om `vedtak`)

- [ ] **Steg 1: README.** Legg til etter kjøringsrekkefølgen `hent → klassifiser → tolk → rapport`:

```markdown
### Pass 2 (utfall per feil, spor, opplysninger og bevis)

Kjøres med agenter i Claude Code, ikke via API. Se `docs/pass2-design.md`.

1. `npm run pass2:hent -- --mangler` skriver inn-filer og `data/pass2/lister/mangler.json`.
2. Workflow `scripts/workflows/pass2-uttrekk.js` med ID-ene fra lista skriver `data/pass2/ut/<id>.<versjon>.json`.
3. `npm run pass2:importer` validerer, sjekker sitater, avleder spor og lagrer i `vedtak_analyse` og `vedtak_feil`.
4. `npm run db:backup` før og etter store kjøringer.

Endres instruksen (`src/lib/analyse/instruks.md`) eller skjemaet (`src/lib/analyse/skjema.ts`), øk `INSTRUKS_VERSJON`. Endres bare spordefinisjonen (`src/lib/analyse/avled.ts`), holder det å kjøre importen på nytt.
```

- [ ] **Steg 2: CLAUDE.md.** Legg til etter avsnittet om `vedtak` («Bruk» / «Begrensninger»):

```markdown
**Pass 2 (`vedtak_analyse`, `vedtak_feil`, viewet `vedtak_feil_sok`)** har utfall per feil, spor A/B/C (prøvd og vunnet), selgers opplysninger, bevisinnhold, når feilen viste seg og ordrette begrunnelsessitater, verifisert mot `fulltekst_renset`. Matching mot nye saker skal gå mot `vedtak_feil_sok`, ikke `vedtak.feiltyper` (som er påberopte feil og beholdes uendret). Praksisavsnittet i brev skal ikke bruke pass 2 før piloten er godkjent (`docs/pass2-pilot.md`). Design: `docs/pass2-design.md`.
```

- [ ] **Steg 3: Commit-punkt.** Spør brukeren. Ved ja: `git add README.md CLAUDE.md && git commit -m "Pass 2: dokumentasjon"`. Merk at `README.md` og `CLAUDE.md` har andre ucommittede endringer fra før. Spør om de skal være med, eller bruk `git add -p`.

---

## Fullkjøring (etter godkjent pilot, ikke en del av denne planen)

- Kjøres med `npm run pass2:hent -- --mangler`, Workflow i porsjoner på cirka 200 vedtak (bolkstørrelse etter pilotrapporten) og `npm run pass2:importer`.
- Ta `npm run db:backup` før første porsjon.
- Etter fullkjøringen gjentas kontrollen på 50 nye tilfeldige vedtak, som en sjekk av at kvaliteten holdt.
