// Fixed vocabularies and the JSON schemas the model fills in via strict tool use.

export const KJORETOYTYPER = ["personbil", "varebil", "bobil", "campingvogn", "mc_moped", "annet_kjoretoy"] as const;
export const FEILTYPER = [
  "motor",
  "girkasse",
  "clutch",
  "elektrisk",
  "batteri_elbil",
  "bremser",
  "understell_hjuloppheng",
  "rust",
  "klimaanlegg",
  "kollisjonsskade",
  "km_avvik",
  "servicehistorikk",
  "bruktimport_opplysning",
  "fukt_lekkasje",
  "ramme_chassis",
  "annet",
] as const;
export const FORBEHOLD = ["som_den_er", "uten_garanti", "outlet", "defekt_delebil", "kjente_feil_opplyst", "annet"] as const;
export const BEVISTYPER = ["verkstedrapport", "NAF_test", "takst", "EU_kontroll", "bilder", "kvittering", "annet"] as const;
export const KRAVTYPER = ["retting", "omlevering", "prisavslag", "heving", "erstatning"] as const;
export const MANGELSGRUNNLAG = [
  "avvik_fra_avtale",
  "feil_opplysninger",
  "tilbakeholdt_opplysning",
  "vesentlig_darligere_stand",
  "offentligrettslige_krav",
  "annet",
] as const;
export const TVISTETEMA = [
  "om_det_er_mangel",
  "reklamasjon_for_sent",
  "utbedringskostnad",
  "retting_forsok",
  "heving_vesentlig",
  "prisavslag_storrelse",
  "erstatning_tap",
  "km_eller_historikk",
  "annet",
] as const;
export const DRIVSTOFF = ["bensin", "diesel", "elbil", "hybrid", "ladbar_hybrid", "gass", "hydrogen", "annet"] as const;
export const SELGERTYPER = ["forhandler", "privat", "formidling", "ukjent"] as const;
export const UTFALL = ["medhold", "delvis_medhold", "ikke_medhold", "avvist"] as const;
export const LOVER = ["forbrukerkjøpsloven", "kjøpsloven", "annet"] as const;
export const LOVVERSJONER = ["før_2024", "etter_2024", "ukjent"] as const;

// Fields that must be backed by a verbatim quote when they have a value.
export const SITATFELT = [
  "utfall",
  "selger_type",
  "kjopesum_nok",
  "utbedringskostnad_nok",
  "krevd_prisavslag_nok",
  "krevd_erstatning_nok",
  "krevd_totalt_nok",
  "tilkjent_prisavslag_nok",
  "tilkjent_erstatning_nok",
  "tilkjent_totalt_nok",
  "forbehold",
  "lovversjon",
] as const;

type Nullable<T> = T | null;
type Of<T extends readonly string[]> = T[number];

export type Klassifisering = {
  kategori: "brukt_kjoretoy" | "nytt_kjoretoy" | "verksted_tjeneste" | "leasing_leie" | "baat" | "annet";
  kjoretoytype: Nullable<Of<typeof KJORETOYTYPER>>;
  begrunnelse: string;
};

export type Tolkning = {
  kjoretoytype: Nullable<Of<typeof KJORETOYTYPER>>;
  vedtaksdato: Nullable<string>;
  selger_type: Of<typeof SELGERTYPER>;
  selger_navn: Nullable<string>;
  selger_orgnr: Nullable<string>;
  verksted_navn: Nullable<string>;
  klager_er_forbruker: Nullable<boolean>;
  merke: Nullable<string>;
  modell: Nullable<string>;
  arsmodell: Nullable<number>;
  drivstoff: Nullable<Of<typeof DRIVSTOFF>>;
  km_ved_kjop: Nullable<number>;
  kjopesum_nok: Nullable<number>;
  bruktimport: Nullable<boolean>;
  kjopsdato: Nullable<string>;
  overtakelsesdato: Nullable<string>;
  forste_reklamasjon_dato: Nullable<string>;
  forbehold: Of<typeof FORBEHOLD>[];
  forbehold_tekst: Nullable<string>;
  feiltyper: Of<typeof FEILTYPER>[];
  feil_beskrivelse: Nullable<string>;
  utbedringskostnad_nok: Nullable<number>;
  bevistyper: Of<typeof BEVISTYPER>[];
  bevis_vektlagt: Nullable<string>;
  kravtyper: Of<typeof KRAVTYPER>[];
  prinsipalt_krav: Nullable<Of<typeof KRAVTYPER>>;
  mangelsgrunnlag: Of<typeof MANGELSGRUNNLAG>[];
  tvistetema: Of<typeof TVISTETEMA>[];
  krevd_prisavslag_nok: Nullable<number>;
  krevd_erstatning_nok: Nullable<number>;
  krevd_totalt_nok: Nullable<number>;
  utfall: Of<typeof UTFALL>;
  tilkjent_prisavslag_nok: Nullable<number>;
  tilkjent_erstatning_nok: Nullable<number>;
  tilkjent_totalt_nok: Nullable<number>;
  gebyr_tilkjent: Nullable<boolean>;
  enstemmig: Nullable<boolean>;
  dissens: Nullable<boolean>;
  lov: Nullable<Of<typeof LOVER>>;
  lovversjon: Of<typeof LOVVERSJONER>;
  paragrafer: string[];
  sammendrag: string;
  utvalgets_nokkelmomenter: string[];
  sitater: Record<Of<typeof SITATFELT>, Nullable<string>>;
  konfidens: number;
  tolkningsmerknad: Nullable<string>;
  personopplysninger: { klager: string[]; personer: string[]; adresser: string[]; andre: string[] };
};

// Strict schemas allow at most 16 union-typed fields, so only numbers and booleans are
// nullable. Strings and dates use "" and optional enums use "ukjent" for "not stated";
// `fraModell` turns those back into null.
const nullbar = (skjema: Record<string, unknown>, description: string) => ({
  anyOf: [skjema, { type: "null" }],
  description,
});
const str = (description: string) => ({ type: "string", description: `${description} Tom streng hvis det ikke står i vedtaket.` });
const int = (description: string) => nullbar({ type: "integer" }, description);
const bool = (description: string) => nullbar({ type: "boolean" }, description);
const dato = (description: string) => ({ type: "string", description: `${description} Format ÅÅÅÅ-MM-DD, tom streng hvis ukjent.` });
const enumNull = (verdier: readonly string[], description: string) => ({
  type: "string",
  enum: [...verdier, "ukjent"],
  description: `${description} «ukjent» hvis det ikke fremgår.`,
});
const enumListe = (verdier: readonly string[], description: string) => ({
  type: "array",
  items: { type: "string", enum: [...verdier] },
  description,
});
const strListe = (description: string) => ({ type: "array", items: { type: "string" }, description });

function objekt(properties: Record<string, unknown>) {
  return { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
}

export const KLASSIFISERING_SKJEMA = objekt({
  kategori: {
    type: "string",
    enum: ["brukt_kjoretoy", "nytt_kjoretoy", "verksted_tjeneste", "leasing_leie", "baat", "annet"],
    description:
      "brukt_kjoretoy = forbrukerens KJØP av et brukt kjøretøy (bil, varebil, bobil, campingvogn, MC/moped, ATV o.l.). Nytt kjøretøy, reparasjon/service, leasing/leie, båt og alt annet får sin egen kategori.",
  },
  kjoretoytype: enumNull(KJORETOYTYPER, "Typen kjøretøy saken gjelder, eller null hvis ingen."),
  begrunnelse: {
    type: "string",
    description: "Én kort setning om hvorfor. Ikke nevn personnavn.",
  },
});

export const TOLKNING_SKJEMA = objekt({
  kjoretoytype: enumNull(KJORETOYTYPER, "Kjøretøyets type."),
  vedtaksdato: dato("Datoen vedtaket ble truffet (møtedato), ÅÅÅÅ-MM-DD."),
  selger_type: {
    type: "string",
    enum: [...SELGERTYPER],
    description:
      "forhandler = næringsdrivende selger; privat = privatperson; formidling = salg via mellommann/kommisjon (f.eks. forhandler som formidler privat bil); ukjent hvis det ikke fremgår.",
  },
  selger_navn: str("Selgerens firmanavn slik det står. null hvis selger er privatperson."),
  selger_orgnr: str("Selgerens organisasjonsnummer (9 siffer) hvis det står i vedtaket."),
  verksted_navn: str("Firmanavn på verksted som er innklaget eller sentralt omtalt (ikke personnavn)."),
  klager_er_forbruker: bool("Om klageren kjøpte som forbruker (ikke i næring)."),
  merke: str("Kjøretøyets merke."),
  modell: str("Modell, uten merke."),
  arsmodell: int("Årsmodell."),
  drivstoff: enumNull(DRIVSTOFF, "Drivstoff/drivlinje."),
  km_ved_kjop: int("Kilometerstand ved kjøp, i hele km."),
  kjopesum_nok: int("Kjøpesum i hele kroner."),
  bruktimport: bool("Om kjøretøyet er bruktimportert."),
  kjopsdato: dato("Kjøpsdato."),
  overtakelsesdato: dato("Dato for overtakelse/levering."),
  forste_reklamasjon_dato: dato("Dato for første reklamasjon til selger."),
  forbehold: enumListe(FORBEHOLD, "Forbehold i avtalen/annonsen."),
  forbehold_tekst: str("Forbeholdet slik det er formulert, kort."),
  feiltyper: enumListe(FEILTYPER, "Feil klageren gjør gjeldende."),
  feil_beskrivelse: str("Kort beskrivelse av feilene (1–2 setninger)."),
  utbedringskostnad_nok: int("Dokumentert eller anslått kostnad for å utbedre feilene, i hele kroner (verksted/takst)."),
  bevistyper: enumListe(BEVISTYPER, "Bevis som er fremlagt."),
  bevis_vektlagt: str("Hvilke bevis utvalget la vekt på, kort."),
  kravtyper: enumListe(KRAVTYPER, "Krav klageren fremsatte (også subsidiære)."),
  prinsipalt_krav: enumNull(KRAVTYPER, "Klagerens hovedkrav (det prinsipale), ikke de subsidiære."),
  mangelsgrunnlag: enumListe(
    MANGELSGRUNNLAG,
    "Grunnlaget klageren bygger mangelen på: avvik_fra_avtale (ikke som avtalt, fkjl § 15 / kjl § 17); feil_opplysninger (selger ga uriktige opplysninger, fkjl § 16 b / kjl § 18); tilbakeholdt_opplysning (selger unnlot å opplyse om noe kjent, fkjl § 16 a / kjl § 19 b); vesentlig_darligere_stand (solgt «som den er», men i vesentlig dårligere stand, fkjl § 16 c / kjl § 19 c); offentligrettslige_krav (EU-kontroll, registrering o.l.).",
  ),
  tvistetema: enumListe(
    TVISTETEMA,
    "Hva partene var uenige om og utvalget måtte ta stilling til: om det er en mangel, om det er reklamert for sent, utbedringskostnaden, rettingsforsøk (antall/avslag), om mangelen er vesentlig nok for heving, størrelsen på prisavslaget, om tapet er dokumentert, km-stand eller servicehistorikk.",
  ),
  krevd_prisavslag_nok: int("Krevd prisavslag, hele kroner."),
  krevd_erstatning_nok: int("Krevd erstatning, hele kroner."),
  krevd_totalt_nok: int("Samlet krevd beløp, hele kroner (ved heving: beløpet som kreves tilbakebetalt, hvis oppgitt)."),
  utfall: {
    type: "string",
    enum: [...UTFALL],
    description:
      "medhold = klager fikk medhold fullt ut; delvis_medhold = klager fikk medhold i noe; ikke_medhold = klager fikk ikke medhold; avvist = saken ble avvist uten realitetsbehandling.",
  },
  tilkjent_prisavslag_nok: int("Tilkjent prisavslag, hele kroner."),
  tilkjent_erstatning_nok: int("Tilkjent erstatning, hele kroner."),
  tilkjent_totalt_nok: int("Samlet beløp selger pålegges å betale, hele kroner (ved heving: tilbakebetalingen)."),
  gebyr_tilkjent: bool("Om klageren fikk tilbake klagegebyret/behandlingsgebyret."),
  enstemmig: bool("Om vedtaket var enstemmig."),
  dissens: bool("Om det var dissens."),
  lov: enumNull(LOVER, "Loven kjøpet ble vurdert etter."),
  lovversjon: {
    type: "string",
    enum: [...LOVVERSJONER],
    description:
      "Bare slik vedtaket selv angir: før_2024 hvis vedtaket sier at loven slik den lød før 1. januar 2024 gjelder, etter_2024 hvis det sier at endringene fra 2024 gjelder, ellers ukjent.",
  },
  paragrafer: strListe("Paragrafer utvalget viser til, f.eks. «forbrukerkjøpsloven § 16»."),
  sammendrag: {
    type: "string",
    description: "Nøytralt sammendrag på 3–5 setninger. Bruk [KLAGER] og [PERSON] i stedet for navn.",
  },
  utvalgets_nokkelmomenter: strListe("3–6 korte punkter med momentene som avgjorde saken. Ingen personnavn."),
  sitater: objekt(
    Object.fromEntries(
      SITATFELT.map((f) => [f, str(`Kort ordrett sitat (maks ca. 25 ord) fra vedtaket som underbygger ${f}, eller tom streng hvis feltet er tomt.`)]),
    ),
  ),
  konfidens: { type: "number", description: "Din samlede sikkerhet på uttrekket, 0–1." },
  tolkningsmerknad: str("Kort merknad om uklarheter i uttrekket (f.eks. uklare beløp), ellers null. Ingen personnavn."),
  personopplysninger: objekt({
    klager: strListe("Klagerens (og medklagers) navn i alle former de forekommer: fullt navn, etternavn, fornavn."),
    personer: strListe(
      "ALLE andre personnavn i vedtaket: privat selger, advokater/fullmektiger, ansatte, vitner, utvalgets medlemmer og sekretariat. Alle former.",
    ),
    adresser: strListe("Gateadresser og postadresser til privatpersoner, slik de står."),
    andre: strListe("Andre identifiserende opplysninger om privatpersoner: personlige skilt, telefon, e-post, kontonummer o.l."),
  }),
});

const UKJENT_ER_NULL = new Set(["kjoretoytype", "drivstoff", "lov", "prinsipalt_krav"]);
const LISTEFELT = new Set([
  "forbehold",
  "feiltyper",
  "bevistyper",
  "kravtyper",
  "mangelsgrunnlag",
  "tvistetema",
  "paragrafer",
  "utvalgets_nokkelmomenter",
]);
// Values outside the fixed vocabulary are dropped instead of failing the whole decision.
const LISTEVERDIER: Record<string, readonly string[]> = {
  forbehold: FORBEHOLD,
  feiltyper: FEILTYPER,
  bevistyper: BEVISTYPER,
  kravtyper: KRAVTYPER,
  mangelsgrunnlag: MANGELSGRUNNLAG,
  tvistetema: TVISTETEMA,
};

function tomTilNull<T extends Record<string, unknown>>(o: T, toppniva: boolean): T {
  return Object.fromEntries(
    Object.entries(o).map(([k, v]) => {
      if (toppniva && LISTEFELT.has(k)) {
        const liste = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
        const lov = LISTEVERDIER[k];
        return [k, liste.filter((x) => x !== "" && x != null && (!lov || lov.includes(x as string)))];
      }
      return [k, v === "" || (v === "ukjent" && UKJENT_ER_NULL.has(k)) ? null : v];
    }),
  ) as T;
}

// Converts the model's "" / "ukjent" placeholders to null.
export function fraModell<T extends object>(input: T): T {
  const ut = tomTilNull(input as Record<string, unknown>, true) as T & { sitater?: unknown };
  // Quote keys share names with list fields (e.g. forbehold) but are always strings.
  if ("sitater" in input && input.sitater) ut.sitater = tomTilNull(input.sitater as Record<string, unknown>, false);
  return ut;
}

export const KONTROLL_SKJEMA = objekt({
  funn: {
    type: "array",
    items: objekt({
      tekst: { type: "string", description: "Opplysningen nøyaktig slik den står i teksten." },
      type: { type: "string", enum: ["personnavn", "adresse", "regnr", "telefon", "epost", "annet"] },
    }),
    description: "Alle gjenværende personopplysninger om fysiske personer. Tom liste hvis ingen.",
  },
});
