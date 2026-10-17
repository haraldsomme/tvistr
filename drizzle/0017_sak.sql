CREATE TABLE "ordre" (
	"id" text PRIMARY KEY NOT NULL,
	"sak_id" text NOT NULL,
	"belop_ore" integer NOT NULL,
	"leverandor" text NOT NULL,
	"status" text NOT NULL,
	"transaksjon_id" text,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL,
	"oppdatert" timestamp with time zone DEFAULT now() NOT NULL,
	"betalt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sak" (
	"id" text PRIMARY KEY NOT NULL,
	"sjekk" jsonb NOT NULL,
	"skjema" jsonb NOT NULL,
	"betalt" timestamp with time zone,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL,
	"endret" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ordre" ADD CONSTRAINT "ordre_sak_id_sak_id_fk" FOREIGN KEY ("sak_id") REFERENCES "public"."sak"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ordre_sak_idx" ON "ordre" USING btree ("sak_id");