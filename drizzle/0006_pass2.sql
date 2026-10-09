CREATE TABLE "vedtak_analyse" (
	"vedtak_id" integer PRIMARY KEY NOT NULL,
	"instruks_versjon" text NOT NULL,
	"ai_modell" text NOT NULL,
	"analysert_tidspunkt" timestamp with time zone DEFAULT now() NOT NULL,
	"fulltekst_sha256" text NOT NULL,
	"raasvar_sha256" text NOT NULL,
	"ikke_mangelssak" boolean NOT NULL,
	"ikke_mangelssak_grunn" text,
	"lovversjon" "lovversjon" NOT NULL,
	"spor" text[] NOT NULL,
	"spor_vunnet" text[] NOT NULL,
	"formodning_anvendt" boolean NOT NULL,
	"dager_til_feil" integer,
	"forste_henvendelse_dato" date,
	"forste_henvendelse_form" text,
	"grunnlag" text[] NOT NULL,
	"opplysning_skriftlig_for_klager" boolean NOT NULL,
	"selger_bevis_finnes" boolean NOT NULL,
	"bevis_utover_paregnelig" boolean NOT NULL,
	"paragrafer_med_ledd" text[] NOT NULL,
	"feil" jsonb NOT NULL,
	"opplysninger" jsonb NOT NULL,
	"bevis" jsonb NOT NULL,
	"begrunnelse_sitater" jsonb NOT NULL,
	"usikkerhet" text,
	"kontroll_arsaker" text[] DEFAULT '{}'::text[] NOT NULL,
	"qa_status" "qa_status" DEFAULT 'ukontrollert' NOT NULL,
	"qa_kommentar" text,
	"qa_tidspunkt" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "vedtak_feil" (
	"vedtak_id" integer NOT NULL,
	"feil_id" text NOT NULL,
	"kategori" text NOT NULL,
	"komponent" text,
	"vurdering" text NOT NULL,
	"samlet_utfall" text,
	"grunn" text,
	"grunnlag" text,
	"bevisgrunnlag" text,
	"spor" text[] NOT NULL,
	"spor_vunnet" text[] NOT NULL,
	"alvor" text[] NOT NULL,
	"dager_etter_levering" integer,
	"viste_seg_presisjon" text NOT NULL,
	"innen_formodningsfrist" boolean,
	"formodning" text NOT NULL,
	"belop_tilkjent_nok" integer,
	"har_skriftlig_opplysning" boolean NOT NULL,
	"har_sakkyndig_bevis" boolean NOT NULL,
	CONSTRAINT "vedtak_feil_vedtak_id_feil_id_pk" PRIMARY KEY("vedtak_id","feil_id")
);
--> statement-breakpoint
ALTER TABLE "vedtak_analyse" ADD CONSTRAINT "vedtak_analyse_vedtak_id_vedtak_id_fk" FOREIGN KEY ("vedtak_id") REFERENCES "public"."vedtak"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vedtak_feil" ADD CONSTRAINT "vedtak_feil_vedtak_id_vedtak_analyse_vedtak_id_fk" FOREIGN KEY ("vedtak_id") REFERENCES "public"."vedtak_analyse"("vedtak_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vedtak_analyse_spor_idx" ON "vedtak_analyse" USING gin ("spor");--> statement-breakpoint
CREATE INDEX "vedtak_analyse_grunnlag_idx" ON "vedtak_analyse" USING gin ("grunnlag");--> statement-breakpoint
CREATE INDEX "vedtak_analyse_lovversjon_idx" ON "vedtak_analyse" USING btree ("lovversjon");--> statement-breakpoint
CREATE INDEX "vedtak_analyse_ikke_mangelssak_idx" ON "vedtak_analyse" USING btree ("ikke_mangelssak");--> statement-breakpoint
CREATE INDEX "vedtak_feil_kategori_idx" ON "vedtak_feil" USING btree ("kategori");--> statement-breakpoint
CREATE INDEX "vedtak_feil_vurdering_idx" ON "vedtak_feil" USING btree ("vurdering");--> statement-breakpoint
CREATE INDEX "vedtak_feil_spor_idx" ON "vedtak_feil" USING gin ("spor");--> statement-breakpoint
CREATE INDEX "vedtak_feil_spor_vunnet_idx" ON "vedtak_feil" USING gin ("spor_vunnet");