CREATE TYPE "public"."dokument_status" AS ENUM('hentet', 'klassifisert', 'tolket', 'feilet');--> statement-breakpoint
CREATE TYPE "public"."kilde_arkiv" AS ENUM('hist', 'prod', 'wp');--> statement-breakpoint
CREATE TYPE "public"."lov" AS ENUM('forbrukerkjøpsloven', 'kjøpsloven', 'annet');--> statement-breakpoint
CREATE TYPE "public"."lovversjon" AS ENUM('før_2024', 'etter_2024', 'ukjent');--> statement-breakpoint
CREATE TYPE "public"."qa_status" AS ENUM('ukontrollert', 'riktig', 'feil');--> statement-breakpoint
CREATE TYPE "public"."selger_type" AS ENUM('forhandler', 'privat', 'formidling', 'ukjent');--> statement-breakpoint
CREATE TYPE "public"."utfall" AS ENUM('medhold', 'delvis_medhold', 'ikke_medhold', 'avvist');--> statement-breakpoint
CREATE TABLE "kildedokument" (
	"id" serial PRIMARY KEY NOT NULL,
	"kilde_arkiv" "kilde_arkiv" NOT NULL,
	"kilde_url" text NOT NULL,
	"lokal_sti" text,
	"sha256" text,
	"saksnummer" text,
	"ar" integer,
	"hentet_tidspunkt" timestamp with time zone,
	"http_status" integer,
	"er_bruktbil" boolean,
	"klassifisering_begrunnelse" text,
	"klassifisering_modell" text,
	"status" "dokument_status" DEFAULT 'hentet' NOT NULL,
	"feilmelding" text,
	"tokens_inn" integer DEFAULT 0 NOT NULL,
	"tokens_ut" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "kildedokument_kilde_url_unique" UNIQUE("kilde_url"),
	CONSTRAINT "kildedokument_sha256_unique" UNIQUE("sha256")
);
--> statement-breakpoint
CREATE TABLE "vedtak" (
	"id" serial PRIMARY KEY NOT NULL,
	"kildedokument_id" integer NOT NULL,
	"saksnummer" text,
	"vedtaksdato" date,
	"kilde_url" text NOT NULL,
	"selger_type" "selger_type",
	"selger_navn" text,
	"klager_er_forbruker" boolean,
	"merke" text,
	"modell" text,
	"arsmodell" integer,
	"drivstoff" text,
	"km_ved_kjop" integer,
	"kjopesum_nok" integer,
	"bruktimport" boolean,
	"kjopsdato" date,
	"overtakelsesdato" date,
	"forste_reklamasjon_dato" date,
	"dager_til_reklamasjon" integer,
	"forbehold" text[],
	"forbehold_tekst" text,
	"feiltyper" text[],
	"feil_beskrivelse" text,
	"bevistyper" text[],
	"bevis_vektlagt" text,
	"kravtyper" text[],
	"krevd_prisavslag_nok" integer,
	"krevd_erstatning_nok" integer,
	"krevd_totalt_nok" integer,
	"utfall" "utfall",
	"tilkjent_prisavslag_nok" integer,
	"tilkjent_erstatning_nok" integer,
	"tilkjent_totalt_nok" integer,
	"gebyr_tilkjent" boolean,
	"enstemmig" boolean,
	"dissens" boolean,
	"lov" "lov",
	"lovversjon" "lovversjon",
	"paragrafer" text[],
	"sammendrag" text,
	"utvalgets_nokkelmomenter" text[],
	"fulltekst_renset" text,
	"sitater" jsonb,
	"konfidens" double precision,
	"trenger_kontroll" boolean DEFAULT false NOT NULL,
	"kontroll_arsaker" text[],
	"ai_modell" text,
	"prompt_versjon" text,
	"tolket_tidspunkt" timestamp with time zone,
	"tokens_inn" integer,
	"tokens_ut" integer,
	"varighet_ms" integer,
	"qa_status" "qa_status" DEFAULT 'ukontrollert' NOT NULL,
	"qa_kommentar" text,
	"qa_tidspunkt" timestamp with time zone,
	CONSTRAINT "vedtak_kildedokument_id_unique" UNIQUE("kildedokument_id")
);
--> statement-breakpoint
ALTER TABLE "vedtak" ADD CONSTRAINT "vedtak_kildedokument_id_kildedokument_id_fk" FOREIGN KEY ("kildedokument_id") REFERENCES "public"."kildedokument"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kildedokument_status_idx" ON "kildedokument" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kildedokument_ar_idx" ON "kildedokument" USING btree ("ar");--> statement-breakpoint
CREATE INDEX "vedtak_utfall_idx" ON "vedtak" USING btree ("utfall");--> statement-breakpoint
CREATE INDEX "vedtak_vedtaksdato_idx" ON "vedtak" USING btree ("vedtaksdato");