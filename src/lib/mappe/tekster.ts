// Only themes that say something about the case. Themes that exist only once the committee has found
// a defect (heving_vesentlig, prisavslag_storrelse, erstatning_tap) and the catch-all «annet» are left out:
// they follow the outcome instead of explaining it.
export const TEMA_TEKST: Record<string, string> = {
  "tvistetema:reklamasjon_for_sent": "Om du reklamerte for sent",
  "tvistetema:retting_forsok": "Forsøk på retting",
  "tvistetema:km_eller_historikk": "Kilometerstand eller historikk",
  "tvistetema:utbedringskostnad": "Hva utbedringen koster",
  "bevistyper:verkstedrapport": "Verkstedrapport",
  "bevistyper:NAF_test": "NAF-test",
  "bevistyper:bilder": "Bilder",
  "bevistyper:takst": "Takst",
  "bevistyper:kvittering": "Kvitteringer",
  "bevistyper:EU_kontroll": "EU-kontroll",
  "mangelsgrunnlag:avvik_fra_avtale": "Bilen avvek fra avtalen",
  "mangelsgrunnlag:feil_opplysninger": "Feil opplysninger fra selger",
  "mangelsgrunnlag:vesentlig_darligere_stand": "Vesentlig dårligere stand enn forventet",
  "mangelsgrunnlag:tilbakeholdt_opplysning": "Tilbakeholdt opplysning",
};

export const FEILTYPE_TEKST: Record<string, string> = {
  motor: "motor",
  girkasse: "girkasse",
  clutch: "clutch",
  elektrisk: "elektrisk",
  understell_hjuloppheng: "understell og hjuloppheng",
  rust: "rust",
  bremser: "bremser",
  fukt_lekkasje: "fukt og lekkasje",
  klimaanlegg: "klimaanlegg",
  kollisjonsskade: "kollisjonsskade",
  batteri_elbil: "batteri (elbil)",
  servicehistorikk: "servicehistorikk",
  km_avvik: "kilometerstand",
  ramme_chassis: "ramme",
  bruktimport_opplysning: "bruktimport",
};
