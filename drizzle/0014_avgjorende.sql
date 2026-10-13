ALTER TABLE "vedtak" ADD COLUMN "avgjorende" jsonb;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "avgjorende_versjon" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "avgjorende_tidspunkt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "avgjorende_kontroll" text[];