import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

export const kildeArkivEnum = pgEnum("kilde_arkiv", ["hist", "prod", "wp"]);
export const dokumentStatusEnum = pgEnum("dokument_status", [
  "hentet",
  "klassifisert",
  "tolket",
  "feilet",
]);
export const selgerTypeEnum = pgEnum("selger_type", [
  "forhandler",
  "privat",
  "formidling",
  "ukjent",
]);
export const utfallEnum = pgEnum("utfall", [
  "medhold",
  "delvis_medhold",
  "ikke_medhold",
  "avvist",
]);
export const lovEnum = pgEnum("lov", ["forbrukerkjøpsloven", "kjøpsloven", "annet"]);
export const lovversjonEnum = pgEnum("lovversjon", ["før_2024", "etter_2024", "ukjent"]);
export const qaStatusEnum = pgEnum("qa_status", ["ukontrollert", "riktig", "feil"]);
export const sakStatusEnum = pgEnum("sak_status", [
  "ny",
  "hentet",
  "duplikat",
  "ingen_dokument",
  "hoppet_over",
  "feilet",
]);

// Every document we have tried to download, car-related or not.
export const kildedokument = pgTable(
  "kildedokument",
  {
    id: serial("id").primaryKey(),
    kildeArkiv: kildeArkivEnum("kilde_arkiv").notNull(),
    kildeUrl: text("kilde_url").notNull().unique(),
    lokalSti: text("lokal_sti"),
    sha256: text("sha256").unique(),
    saksnummer: text("saksnummer"),
    // Year of the decision, from archive metadata; used for the 2013 cut-off and spreading samples.
    ar: integer("ar"),
    hentetTidspunkt: timestamp("hentet_tidspunkt", { withTimezone: true }),
    httpStatus: integer("http_status"),
    erBruktbil: boolean("er_bruktbil"),
    klassifiseringBegrunnelse: text("klassifisering_begrunnelse"),
    klassifiseringModell: text("klassifisering_modell"),
    kjoretoytype: text("kjoretoytype"),
    status: dokumentStatusEnum("status").notNull().default("hentet"),
    feilmelding: text("feilmelding"),
    tokensInn: integer("tokens_inn").notNull().default(0),
    tokensUt: integer("tokens_ut").notNull().default(0),
    kostnadUsd: doublePrecision("kostnad_usd").notNull().default(0),
  },
  (t) => [index("kildedokument_status_idx").on(t.status), index("kildedokument_ar_idx").on(t.ar)],
);

// Only decisions about buying a used car.
export const vedtak = pgTable(
  "vedtak",
  {
    id: serial("id").primaryKey(),
    kildedokumentId: integer("kildedokument_id")
      .notNull()
      .unique()
      .references(() => kildedokument.id, { onDelete: "cascade" }),
    saksnummer: text("saksnummer"),
    vedtaksdato: date("vedtaksdato"),
    kildeUrl: text("kilde_url").notNull(),

    selgerType: selgerTypeEnum("selger_type"),
    selgerNavn: text("selger_navn"),
    // Lowercased, without legal form and punctuation; used to group cases per dealer.
    selgerNavnNorm: text("selger_navn_norm"),
    selgerOrgnr: text("selger_orgnr"),
    verkstedNavn: text("verksted_navn"),
    klagerErForbruker: boolean("klager_er_forbruker"),

    kjoretoytype: text("kjoretoytype"),
    merke: text("merke"),
    modell: text("modell"),
    arsmodell: integer("arsmodell"),
    drivstoff: text("drivstoff"),
    kmVedKjop: integer("km_ved_kjop"),
    kjopesumNok: integer("kjopesum_nok"),
    alderVedKjop: integer("alder_ved_kjop"),
    bruktimport: boolean("bruktimport"),

    kjopsdato: date("kjopsdato"),
    overtakelsesdato: date("overtakelsesdato"),
    forsteReklamasjonDato: date("forste_reklamasjon_dato"),
    dagerTilReklamasjon: integer("dager_til_reklamasjon"),

    forbehold: text("forbehold").array(),
    forbeholdTekst: text("forbehold_tekst"),

    feiltyper: text("feiltyper").array(),
    feilBeskrivelse: text("feil_beskrivelse"),
    utbedringskostnadNok: integer("utbedringskostnad_nok"),

    bevistyper: text("bevistyper").array(),
    bevisVektlagt: text("bevis_vektlagt"),

    kravtyper: text("kravtyper").array(),
    prinsipaltKrav: text("prinsipalt_krav"),
    mangelsgrunnlag: text("mangelsgrunnlag").array(),
    tvistetema: text("tvistetema").array(),
    krevdPrisavslagNok: integer("krevd_prisavslag_nok"),
    krevdErstatningNok: integer("krevd_erstatning_nok"),
    krevdTotaltNok: integer("krevd_totalt_nok"),

    utfall: utfallEnum("utfall"),
    tilkjentPrisavslagNok: integer("tilkjent_prisavslag_nok"),
    tilkjentErstatningNok: integer("tilkjent_erstatning_nok"),
    tilkjentTotaltNok: integer("tilkjent_totalt_nok"),
    gebyrTilkjent: boolean("gebyr_tilkjent"),
    enstemmig: boolean("enstemmig"),
    dissens: boolean("dissens"),

    lov: lovEnum("lov"),
    lovversjon: lovversjonEnum("lovversjon"),
    paragrafer: text("paragrafer").array(),

    sammendrag: text("sammendrag"),
    utvalgetsNokkelmomenter: text("utvalgets_nokkelmomenter").array(),
    fulltekstRenset: text("fulltekst_renset"),

    sitater: jsonb("sitater").$type<Record<string, string>>(),
    konfidens: doublePrecision("konfidens"),
    trengerKontroll: boolean("trenger_kontroll").notNull().default(false),
    kontrollArsaker: text("kontroll_arsaker").array(),
    aiModell: text("ai_modell"),
    promptVersjon: text("prompt_versjon"),
    tolketTidspunkt: timestamp("tolket_tidspunkt", { withTimezone: true }),
    tokensInn: integer("tokens_inn"),
    tokensUt: integer("tokens_ut"),
    varighetMs: integer("varighet_ms"),
    kostnadUsd: doublePrecision("kostnad_usd"),

    qaStatus: qaStatusEnum("qa_status").notNull().default("ukontrollert"),
    qaKommentar: text("qa_kommentar"),
    qaTidspunkt: timestamp("qa_tidspunkt", { withTimezone: true }),
  },
  (t) => [
    index("vedtak_utfall_idx").on(t.utfall),
    index("vedtak_vedtaksdato_idx").on(t.vedtaksdato),
    index("vedtak_selger_orgnr_idx").on(t.selgerOrgnr),
    index("vedtak_selger_navn_norm_idx").on(t.selgerNavnNorm),
    index("vedtak_merke_idx").on(t.merke),
  ],
);

// Crawl state per case in the source archives, so an interrupted `hent` can resume.
export const kildesak = pgTable(
  "kildesak",
  {
    id: serial("id").primaryKey(),
    kildeArkiv: kildeArkivEnum("kilde_arkiv").notNull(),
    eksternId: text("ekstern_id").notNull(),
    filter: text("filter").notNull(),
    // Non-personal archive metadata only (dates, file names); never titles or party names.
    meta: jsonb("meta").$type<Record<string, string | null>>(),
    status: sakStatusEnum("status").notNull().default("ny"),
    grunn: text("grunn"),
    forsok: integer("forsok").notNull().default(0),
    kildedokumentId: integer("kildedokument_id").references(() => kildedokument.id, { onDelete: "set null" }),
    oppdatert: timestamp("oppdatert", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("kildesak_arkiv_id_uq").on(t.kildeArkiv, t.eksternId), index("kildesak_status_idx").on(t.status)],
);

export type Kildedokument = typeof kildedokument.$inferSelect;
export type Vedtak = typeof vedtak.$inferSelect;
export type NyttVedtak = typeof vedtak.$inferInsert;
