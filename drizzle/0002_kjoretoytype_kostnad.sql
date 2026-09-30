ALTER TABLE "kildedokument" ADD COLUMN "kjoretoytype" text;--> statement-breakpoint
ALTER TABLE "kildedokument" ADD COLUMN "kostnad_usd" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "kjoretoytype" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "kostnad_usd" double precision;