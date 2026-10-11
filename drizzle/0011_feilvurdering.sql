ALTER TABLE "vedtak" ADD COLUMN "feilvurdering" jsonb;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "feilvurdering_versjon" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "feilvurdering_tidspunkt" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "feilvurdering_kontroll" text[];--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "godtatte_kategorier" text[];--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "godtatte_underkategorier" text[];--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "sanksjoner" text[];--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "rettingsforsok" integer;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "dager_til_feil" integer;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "lovversjon_avledet" "lovversjon";--> statement-breakpoint
CREATE INDEX "vedtak_godtatte_kategorier_idx" ON "vedtak" USING gin ("godtatte_kategorier");--> statement-breakpoint
CREATE INDEX "vedtak_godtatte_underkategorier_idx" ON "vedtak" USING gin ("godtatte_underkategorier");