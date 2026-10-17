ALTER TABLE "sak" ADD COLUMN "vedtaksvalg" jsonb;--> statement-breakpoint
ALTER TABLE "sak" ADD COLUMN "modellkall" integer DEFAULT 0 NOT NULL;