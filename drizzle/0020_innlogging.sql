CREATE TABLE "innlogging" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"sub" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL,
	"utloper" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "innlogging_start" (
	"state" text PRIMARY KEY NOT NULL,
	"nonce" text NOT NULL,
	"verifier" text NOT NULL,
	"til" text NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordre" ADD COLUMN "innlogging_hash" text;--> statement-breakpoint
ALTER TABLE "sak" ADD COLUMN "vipps_sub" text;--> statement-breakpoint
CREATE INDEX "innlogging_sub_idx" ON "innlogging" USING btree ("sub");--> statement-breakpoint
CREATE INDEX "sak_vipps_sub_idx" ON "sak" USING btree ("vipps_sub");
--> statement-breakpoint
-- The free trial (17–18 October 2026): cases whose every order is «gratis» are deleted (orders cascade).
DELETE FROM "sak" WHERE "id" IN (SELECT "sak_id" FROM "ordre" GROUP BY "sak_id" HAVING bool_and("leverandor" = 'gratis'));
