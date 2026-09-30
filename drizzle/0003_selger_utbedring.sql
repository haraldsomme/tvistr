ALTER TABLE "vedtak" ADD COLUMN "selger_navn_norm" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "selger_orgnr" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "verksted_navn" text;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "alder_ved_kjop" integer;--> statement-breakpoint
ALTER TABLE "vedtak" ADD COLUMN "utbedringskostnad_nok" integer;--> statement-breakpoint
CREATE INDEX "vedtak_selger_orgnr_idx" ON "vedtak" USING btree ("selger_orgnr");--> statement-breakpoint
CREATE INDEX "vedtak_selger_navn_norm_idx" ON "vedtak" USING btree ("selger_navn_norm");--> statement-breakpoint
CREATE INDEX "vedtak_merke_idx" ON "vedtak" USING btree ("merke");