-- pass2-v2: a defect lists the components it covers (komponenter) and records where the time it
-- showed itself came from (viste_seg_kilde). The search view depends on the columns, so it is
-- dropped and recreated around the change. The pass2-v1 rows were removed before this migration.
DROP VIEW IF EXISTS "vedtak_feil_sok";--> statement-breakpoint
ALTER TABLE "vedtak_feil" ADD COLUMN "komponenter" text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "vedtak_feil" ADD COLUMN "viste_seg_kilde" text;--> statement-breakpoint
ALTER TABLE "vedtak_feil" DROP COLUMN "komponent";--> statement-breakpoint
CREATE VIEW "vedtak_feil_sok" AS
SELECT
  f.vedtak_id, f.feil_id, f.kategori, f.komponenter, f.vurdering, f.samlet_utfall, f.grunn, f.grunnlag, f.bevisgrunnlag,
  f.spor, f.spor_vunnet, f.alvor, f.dager_etter_levering, f.viste_seg_presisjon, f.viste_seg_kilde, f.innen_formodningsfrist,
  f.formodning, f.belop_tilkjent_nok, f.har_skriftlig_opplysning, f.har_sakkyndig_bevis,
  v.saksnummer, v.vedtaksdato, v.kilde_url, v.selger_type, v.alder_ved_kjop, v.km_ved_kjop, v.kjopesum_nok, v.utfall,
  a.lovversjon, a.ikke_mangelssak
FROM vedtak_feil f
JOIN vedtak_analyse a ON a.vedtak_id = f.vedtak_id
JOIN vedtak v ON v.id = f.vedtak_id;
