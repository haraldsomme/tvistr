-- Search view for the letter engine: one row per defect with the decision fields joined in.
CREATE VIEW "vedtak_feil_sok" AS
SELECT
  f.vedtak_id, f.feil_id, f.kategori, f.komponent, f.vurdering, f.samlet_utfall, f.grunn, f.grunnlag, f.bevisgrunnlag,
  f.spor, f.spor_vunnet, f.alvor, f.dager_etter_levering, f.viste_seg_presisjon, f.innen_formodningsfrist,
  f.formodning, f.belop_tilkjent_nok, f.har_skriftlig_opplysning, f.har_sakkyndig_bevis,
  v.saksnummer, v.vedtaksdato, v.kilde_url, v.selger_type, v.alder_ved_kjop, v.km_ved_kjop, v.kjopesum_nok, v.utfall,
  a.lovversjon, a.ikke_mangelssak
FROM vedtak_feil f
JOIN vedtak_analyse a ON a.vedtak_id = f.vedtak_id
JOIN vedtak v ON v.id = f.vedtak_id;
