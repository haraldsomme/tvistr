ALTER TABLE "statistikk_kategori" ADD COLUMN "fullt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "statistikk_kategori" ADD COLUMN "avslag" text;--> statement-breakpoint
ALTER TABLE "statistikk_kategori" ADD COLUMN "avslag_antall" integer DEFAULT 0 NOT NULL;