ALTER TABLE "vedtak" ADD COLUMN "godtatte_niva" text[];--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "prisavslag_prosent" double precision;--> statement-breakpoint
CREATE INDEX "vedtak_godtatte_niva_idx" ON "vedtak" USING gin ("godtatte_niva");