CREATE TABLE "brevsak" (
	"id" text PRIMARY KEY NOT NULL,
	"svar" jsonb NOT NULL,
	"utfylling" jsonb NOT NULL,
	"opprettet" timestamp with time zone DEFAULT now() NOT NULL,
	"endret" timestamp with time zone DEFAULT now() NOT NULL,
	"utloper" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "brevsak_utloper_idx" ON "brevsak" USING btree ("utloper");