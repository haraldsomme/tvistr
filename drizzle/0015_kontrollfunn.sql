CREATE TABLE "kontrollfunn" (
	"id" serial PRIMARY KEY NOT NULL,
	"vedtak_id" integer NOT NULL,
	"feil_id" text,
	"sporsmal" text NOT NULL,
	"sitat" text,
	"begrunnelse" text,
	"tidspunkt" timestamp with time zone DEFAULT now() NOT NULL,
	"angret" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "kontrollfunn" ADD CONSTRAINT "kontrollfunn_vedtak_id_vedtak_id_fk" FOREIGN KEY ("vedtak_id") REFERENCES "public"."vedtak"("id") ON DELETE no action ON UPDATE no action;