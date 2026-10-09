// Pass 2: what the extraction agents write per decision (docs/pass2-design.md § 4).
// Agents report facts only; conclusions are derived in avled.ts.
import { FEILTYPER } from "@/lib/ai/skjema";

export const INSTRUKS_VERSJON = "pass2-v3";

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
// Outcome of a joint assessment ("feilene samlet sett"), so won cases stay visible per defect.
export const SAMLET_UTFALL = ["mangel", "ikke_mangel"] as const;
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
// Whether a statement names something concrete or is a general phrase ("god stand"); docs/spor.md.
export const REKKEVIDDE = ["spesifikk", "generell"] as const;
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
export const IKKE_MANGELSSAK_GRUNNER = [
  "ikke_levert",
  "avbestilling_angrerett",
  "innbytte_restgjeld",
  "partsforhold",
  "foreldet_eller_for_sen_reklamasjon",
  "forlik_eller_avtale",
  "annet",
] as const;
export const HENVENDELSESFORMER = ["muntlig", "skriftlig", "ukjent"] as const;

type V<T extends readonly string[]> = T[number];
export type Spor = "A" | "B" | "C";

export type VisteSeg = { dato: string | null; presisjon: V<typeof PRESISJONER>; dager_etter_levering: number | null };

export type Feil = {
  id: string;
  kategori: Feilkategori;
  komponenter: string[] | null;
  vurdering: V<typeof VURDERINGER>;
  samlet_utfall: V<typeof SAMLET_UTFALL> | null;
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
  rekkevidde: V<typeof REKKEVIDDE> | null;
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

// The outcome that counts for a defect: its own, or the joint outcome when it was only assessed
// together with others. Null when the committee did not decide it.
export function utfallForFeil(f: Pick<Feil, "vurdering" | "samlet_utfall">): V<typeof SAMLET_UTFALL> | null {
  if (f.vurdering === "mangel" || f.vurdering === "ikke_mangel") return f.vurdering;
  return f.vurdering === "samlet_vurdering" ? f.samlet_utfall : null;
}

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
      komponenter: liste({ type: "string" }, "Det klageren nevnte innenfor denne feilen, kort."),
      vurdering: valg(VURDERINGER),
      samlet_utfall: valg(SAMLET_UTFALL),
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
      rekkevidde: valg(REKKEVIDDE),
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
