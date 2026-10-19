import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  pgView,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import type { Lagret as Avgjorende } from "../lib/avgjorende/skjema";
import type { Lagret as Feilvurdering } from "../lib/feilvurdering/skjema";
import type { Sjekk } from "../lib/app/saken";
import type { Skjema } from "../lib/app/skjema";
import type { LagretSvar } from "../lib/vedtaksvalg/valg";

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

    // The agents' assessment per claimed defect (src/lib/feilvurdering), with the quotes checked
    // against fulltekst_renset. The columns below it are derived from it at import.
    feilvurdering: jsonb("feilvurdering").$type<Feilvurdering>(),
    feilvurderingVersjon: text("feilvurdering_versjon"),
    feilvurderingTidspunkt: timestamp("feilvurdering_tidspunkt", { withTimezone: true }),
    feilvurderingKontroll: text("feilvurdering_kontroll").array(),
    // Main categories (src/lib/feil/kategorier.ts) the committee gave medhold for, and the
    // subcategories as "hoved.under".
    godtatteKategorier: text("godtatte_kategorier").array(),
    godtatteUnderkategorier: text("godtatte_underkategorier").array(),
    // The same defects with their time level (1–3), as "hoved:n" and "hoved.under:n", so a filter on
    // category and level hits the same defect.
    godtatteNiva: text("godtatte_niva").array(),
    sanksjoner: text("sanksjoner").array(),
    // tilkjent_prisavslag_nok as a share of kjopesum_nok, when the buyer got a price reduction.
    prisavslagProsent: doublePrecision("prisavslag_prosent"),
    rettingsforsok: integer("rettingsforsok"),
    // From the full text (feilvurdering); tolk's `forbehold` sometimes files equivalent wording under «annet».
    somDenEr: boolean("som_den_er"),
    dagerTilFeil: integer("dager_til_feil"),
    // From the purchase date; tolk's `lovversjon` is nearly always «ukjent».
    lovversjonAvledet: lovversjonEnum("lovversjon_avledet"),

    // What the committee rested each accepted defect on (src/lib/avgjorende), read by the letter so
    // it need not read the full text. Defect ids are the feilvurdering's.
    avgjorende: jsonb("avgjorende").$type<Avgjorende>(),
    avgjorendeVersjon: text("avgjorende_versjon"),
    avgjorendeTidspunkt: timestamp("avgjorende_tidspunkt", { withTimezone: true }),
    avgjorendeKontroll: text("avgjorende_kontroll").array(),
  },
  (t) => [
    index("vedtak_godtatte_kategorier_idx").using("gin", t.godtatteKategorier),
    index("vedtak_godtatte_underkategorier_idx").using("gin", t.godtatteUnderkategorier),
    index("vedtak_godtatte_niva_idx").using("gin", t.godtatteNiva),
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

// Pass 2: one row per decision with the agents' facts and the derived filter columns. The code that
// filled it was removed 2026-10-10 (last on branch pass2, 9cc4dc9); the tables are kept as data.
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
    // What the buyer got (src/lib/analyse/avled.ts avledSanksjon): rescission from the conclusion,
    // otherwise from the amounts. Null without medhold.
    sanksjon: text("sanksjon"),
    bevisUtoverParegnelig: boolean("bevis_utover_paregnelig").notNull(),
    paragraferMedLedd: text("paragrafer_med_ledd").array().notNull(),
    feil: jsonb("feil").$type<unknown[]>().notNull(),
    opplysninger: jsonb("opplysninger").$type<unknown[]>().notNull(),
    bevis: jsonb("bevis").$type<unknown[]>().notNull(),
    begrunnelseSitater: jsonb("begrunnelse_sitater").$type<unknown[]>().notNull(),
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
    komponenter: text("komponenter").array().notNull(),
    vurdering: text("vurdering").notNull(),
    samletUtfall: text("samlet_utfall"),
    grunn: text("grunn"),
    grunnlag: text("grunnlag"),
    bevisgrunnlag: text("bevisgrunnlag"),
    spor: text("spor").array().notNull(),
    sporVunnet: text("spor_vunnet").array().notNull(),
    aVariant: text("a_variant"),
    alvor: text("alvor").array().notNull(),
    dagerEtterLevering: integer("dager_etter_levering"),
    visteSegPresisjon: text("viste_seg_presisjon").notNull(),
    visteSegKilde: text("viste_seg_kilde"),
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
  komponenter: text("komponenter").array().notNull(),
  vurdering: text("vurdering").notNull(),
  samletUtfall: text("samlet_utfall"),
  grunn: text("grunn"),
  grunnlag: text("grunnlag"),
  bevisgrunnlag: text("bevisgrunnlag"),
  spor: text("spor").array().notNull(),
  sporVunnet: text("spor_vunnet").array().notNull(),
  aVariant: text("a_variant"),
  alvor: text("alvor").array().notNull(),
  dagerEtterLevering: integer("dager_etter_levering"),
  visteSegPresisjon: text("viste_seg_presisjon").notNull(),
  visteSegKilde: text("viste_seg_kilde"),
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

// What the safety net in the letter's choice of decision found against the full text
// (src/lib/vedtaksvalg/funn.ts): a defect not named or not judged on its own (`samlet` is set on it),
// or a quote that is not the committee's standpoint (the quote is removed). The imports apply the
// findings that are not undone, so a re-import does not bring the error back.
export const kontrollfunn = pgTable("kontrollfunn", {
  id: serial("id").primaryKey(),
  vedtakId: integer("vedtak_id")
    .notNull()
    .references(() => vedtak.id),
  feilId: text("feil_id"),
  // "nevnt" | "for_seg" | "sitat"
  sporsmal: text("sporsmal").notNull(),
  sitat: text("sitat"),
  begrunnelse: text("begrunnelse"),
  tidspunkt: timestamp("tidspunkt", { withTimezone: true }).notNull().defaultNow(),
  // Set to undo the finding; the imports then leave it out.
  angret: timestamp("angret", { withTimezone: true }),
});

// The figures the free assessment (step 4) shows, built once at import (scripts/statistikk.ts), not
// per request. One row per main category («motor»), per subcategory («motor.turbo») and one for the
// whole set («alle»). Counted over the decisions the committee made on a dealer sale of a car or van
// under the consumer purchase act, medhold or not (src/lib/vurdering/statistikk.ts).
export const statistikkKategori = pgTable("statistikk_kategori", {
  nokkel: text("nokkel").primaryKey(),
  // Decisions where the committee assessed a defect in the category, and those where it found for the buyer.
  antallSaker: integer("antall_saker").notNull(),
  antallMedhold: integer("antall_medhold").notNull(),
  // Of the decisions with medhold: what the buyer got for this defect.
  heving: integer("heving").notNull(),
  prisavslag: integer("prisavslag").notNull(),
  retting: integer("retting").notNull(),
  erstatning: integer("erstatning").notNull(),
  // Median price reduction as a share of the price, null under ten decisions.
  prisavslagMedianProsent: doublePrecision("prisavslag_median_prosent"),
  alderMedian: doublePrecision("alder_median"),
  kmMedian: doublePrecision("km_median"),
  bygget: timestamp("bygget", { withTimezone: true }).notNull().defaultNow(),
});

// The steps of the flow, per session, without personal data: the event, the status of the assessment
// and the categories chosen, never a registration number or a name (src/app/api/hendelse).
export const hendelse = pgTable(
  "hendelse",
  {
    id: serial("id").primaryKey(),
    okt: text("okt").notNull(),
    hendelse: text("hendelse").notNull(),
    status: text("status"),
    kategorier: text("kategorier").array(),
    tidspunkt: timestamp("tidspunkt", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("hendelse_okt_idx").on(t.okt), index("hendelse_hendelse_idx").on(t.hendelse)],
);

// A paid case: the check as it was at purchase and the letter writer's form, saved on every change
// after. The owner is the Vipps account that paid (`vippsSub`); the id (src/lib/sak/id.ts) is
// random but is no longer the access. Personal data, so left out of backups (scripts/backup-format.ts).
export const sak = pgTable(
  "sak",
  {
    id: text("id").primaryKey(),
    // The Vipps `sub` of the owner; null until a logged-in buyer pays for the case.
    vippsSub: text("vipps_sub"),
    sjekk: jsonb("sjekk").$type<Sjekk>().notNull(),
    skjema: jsonb("skjema").$type<Skjema>().notNull(),
    // Null until an order for the case is paid.
    betalt: timestamp("betalt", { withTimezone: true }),
    // The decision choice (finnVedtak): the list the buyer last got, the recommended first, and the
    // last model answers by what the model read, so the same answers never cost a second call.
    vedtaksvalg: jsonb("vedtaksvalg").$type<{ liste: number[]; svar: LagretSvar[] }>(),
    // Model calls made for the case, against MAKS_MODELLKALL_PER_SAK.
    modellkall: integer("modellkall").notNull().default(0),
    opprettet: timestamp("opprettet", { withTimezone: true }).notNull().defaultNow(),
    endret: timestamp("endret", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sak_vipps_sub_idx").on(t.vippsSub)],
);

// One payment attempt for a case; Vipps gives each attempt its own reference, so a case may have
// several. `id` is the reference sent to the payment provider (Vipps: 8–64 of [A-Za-z0-9-]).
export const ordre = pgTable(
  "ordre",
  {
    id: text("id").primaryKey(),
    sakId: text("sak_id")
      .notNull()
      .references(() => sak.id, { onDelete: "cascade" }),
    belopOre: integer("belop_ore").notNull(),
    // "gratis" (the trial, GRATIS in src/lib/pris.ts) | "utvikling" (TVISTR_HELT_BREV_UTEN_BETALING) | "vipps"
    leverandor: text("leverandor").notNull(),
    // "opprettet" | "betalt" | "avbrutt" | "feilet" | "refundert"; only src/lib/vipps/avstem.ts moves a Vipps order on from «opprettet»
    status: text("status").notNull(),
    // The provider's id for the payment (Vipps pspReference), once there is one.
    transaksjonId: text("transaksjon_id"),
    opprettet: timestamp("opprettet", { withTimezone: true }).notNull().defaultNow(),
    oppdatert: timestamp("oppdatert", { withTimezone: true }).notNull().defaultNow(),
    betalt: timestamp("betalt", { withTimezone: true }),
    // When the receipt with the link went to the buyer (src/lib/epost/kvittering.ts); null until then.
    kvitteringSendt: timestamp("kvittering_sendt", { withTimezone: true }),
    // SHA-256 (hex) of the one-time secret on the return page.
    innloggingHash: text("innlogging_hash"),
  },
  (t) => [index("ordre_sak_idx").on(t.sakId)],
);

// A login session: the cookie holds the token, only its SHA-256 (hex) is stored.
export const innlogging = pgTable(
  "innlogging",
  {
    tokenHash: text("token_hash").primaryKey(),
    sub: text("sub").notNull(),
    opprettet: timestamp("opprettet", { withTimezone: true }).notNull().defaultNow(),
    utloper: timestamp("utloper", { withTimezone: true }).notNull(),
  },
  (t) => [index("innlogging_sub_idx").on(t.sub)],
);

// The state of a login in progress with Vipps, until the callback.
export const innloggingStart = pgTable("innlogging_start", {
  state: text("state").primaryKey(),
  nonce: text("nonce").notNull(),
  verifier: text("verifier").notNull(),
  til: text("til").notNull(),
  opprettet: timestamp("opprettet", { withTimezone: true }).notNull().defaultNow(),
});

export type Kildedokument = typeof kildedokument.$inferSelect;
export type Vedtak = typeof vedtak.$inferSelect;
export type NyttVedtak = typeof vedtak.$inferInsert;
export type NyVedtakAnalyse = typeof vedtakAnalyse.$inferInsert;
export type NyVedtakFeil = typeof vedtakFeil.$inferInsert;
export type Sak = typeof sak.$inferSelect;
export type Innlogging = typeof innlogging.$inferSelect;
export type InnloggingStart = typeof innloggingStart.$inferSelect;
