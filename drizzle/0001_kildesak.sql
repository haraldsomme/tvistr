CREATE TYPE "public"."sak_status" AS ENUM('ny', 'hentet', 'duplikat', 'ingen_dokument', 'hoppet_over', 'feilet');--> statement-breakpoint
CREATE TABLE "kildesak" (
	"id" serial PRIMARY KEY NOT NULL,
	"kilde_arkiv" "kilde_arkiv" NOT NULL,
	"ekstern_id" text NOT NULL,
	"filter" text NOT NULL,
	"meta" jsonb,
	"status" "sak_status" DEFAULT 'ny' NOT NULL,
	"grunn" text,
	"forsok" integer DEFAULT 0 NOT NULL,
	"kildedokument_id" integer,
	"oppdatert" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "kildesak_arkiv_id_uq" UNIQUE("kilde_arkiv","ekstern_id")
);
--> statement-breakpoint
ALTER TABLE "kildesak" ADD CONSTRAINT "kildesak_kildedokument_id_kildedokument_id_fk" FOREIGN KEY ("kildedokument_id") REFERENCES "public"."kildedokument"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "kildesak_status_idx" ON "kildesak" USING btree ("status");