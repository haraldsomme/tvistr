CREATE TABLE "hendelse" (
	"id" serial PRIMARY KEY NOT NULL,
	"okt" text NOT NULL,
	"hendelse" text NOT NULL,
	"status" text,
	"kategorier" text[],
	"tidspunkt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statistikk_kategori" (
	"nokkel" text PRIMARY KEY NOT NULL,
	"antall_saker" integer NOT NULL,
	"antall_medhold" integer NOT NULL,
	"heving" integer NOT NULL,
	"prisavslag" integer NOT NULL,
	"retting" integer NOT NULL,
	"erstatning" integer NOT NULL,
	"prisavslag_median_prosent" double precision,
	"alder_median" double precision,
	"km_median" double precision,
	"bygget" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "hendelse_okt_idx" ON "hendelse" USING btree ("okt");--> statement-breakpoint
CREATE INDEX "hendelse_hendelse_idx" ON "hendelse" USING btree ("hendelse");