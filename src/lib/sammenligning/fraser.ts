// Phrase tables for the practice paragraph. Data, not logic: every word the letter uses comes from here
// or from the index.

export const FORM_BESTEMT: Record<string, string> = {
  annonse: "annonsen",
  kontrakt: "kontrakten",
  melding: "en skriftlig melding fra selger",
  salgsoppgave: "salgsoppgaven",
  tilstandsrapport_fra_selger: "selgers tilstandsrapport",
};

// Where the written statement stood, strongest first (kontrakt > annonse > melding).
export const FORM_RANG: Record<string, number> = {
  kontrakt: 3,
  tilstandsrapport_fra_selger: 3,
  annonse: 2,
  salgsoppgave: 2,
  melding: 1,
};

// The form's "hvor_sto_det" answers mapped to pass 2's opplysning.form.
export const HVOR_STO_DET: Record<string, string> = {
  annonse: "annonse",
  kontrakt: "kontrakt",
  sms_epost_chat: "melding",
  salgsoppgave: "salgsoppgave",
  tilstandsrapport: "tilstandsrapport_fra_selger",
};

export const KATEGORI_FRASE: Record<string, string> = {
  motor: "feil på motoren",
  girkasse: "feil på girkassen",
  clutch: "feil på clutchen",
  elektrisk: "en elektrisk feil",
  batteri_elbil: "feil på høyvoltbatteriet",
  bremser: "feil på bremsene",
  understell_hjuloppheng: "feil på understell og hjuloppheng",
  rust: "rust",
  klimaanlegg: "feil på klimaanlegget",
  kollisjonsskade: "en tidligere kollisjonsskade",
  km_avvik: "avvik i kilometerstanden",
  servicehistorikk: "mangelfull servicehistorikk",
  bruktimport_opplysning: "uriktige opplysninger om bruktimport",
  fukt_lekkasje: "fukt og lekkasje",
  ramme_chassis: "skade på ramme og chassis",
  karosseri_lakk_glass: "skader på karosseri, lakk eller glass",
  dekk_felger: "feil ved dekk og felger",
  utstyr_mangler: "manglende utstyr",
  eksos_utslipp: "feil ved eksos og utslipp",
  eu_kontroll_registrering: "feil ved EU-kontroll eller registrering",
  interior_lukt: "feil ved interiøret",
  drivlinje: "feil i drivlinjen",
  garanti_vilkar: "garantivilkår",
  ombygging_tuning: "ombygging",
  arsmodell_identitet: "uriktig årsmodell",
  heftelse_pant: "heftelser",
  annet: "en feil ved bilen",
};

// "uriktig opplysning om …" / "unnlatt å opplyse om …", per pass 2 category of the decided defect.
export const OPPLYSNING_OM: Record<string, string> = {
  motor: "motoren",
  girkasse: "girkassen",
  clutch: "clutchen",
  elektrisk: "det elektriske utstyret",
  batteri_elbil: "høyvoltbatteriet",
  bremser: "bremsene",
  understell_hjuloppheng: "understellet",
  rust: "rust",
  klimaanlegg: "klimaanlegget",
  kollisjonsskade: "skadehistorikken",
  km_avvik: "kilometerstanden",
  servicehistorikk: "servicehistorikken",
  bruktimport_opplysning: "bruktimport",
  fukt_lekkasje: "fukt og lekkasje",
  ramme_chassis: "rammen",
  karosseri_lakk_glass: "karosseriet",
  dekk_felger: "dekkene",
  utstyr_mangler: "bilens utstyr",
  eksos_utslipp: "eksosanlegget",
  eu_kontroll_registrering: "EU-kontroll og registrering",
  interior_lukt: "interiøret",
  drivlinje: "drivlinjen",
  garanti_vilkar: "garantien",
  ombygging_tuning: "ombygging",
  arsmodell_identitet: "årsmodellen",
  heftelse_pant: "heftelser",
  annet: "bilens tilstand",
};

export const BEVIS_FRASE: Record<string, string> = {
  verkstedrapport: "Verkstedet",
  NAF_test: "NAF",
  takst: "Takstmannen",
  sakkyndig_uttalelse: "Den sakkyndige",
  tilstandsrapport: "Tilstandsrapporten",
};

const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];

// "2026-02-18" → "18. februar 2026"
export function datoLang(iso: string): string {
  const [a, m, d] = iso.split("-").map(Number);
  return `${d}. ${MANEDER[m - 1]} ${a}`;
}

// 16066 → "16 066"
export function tall(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}

// 0.0803 → "8", 0.0045 → "0,5"
export function prosent(andel: number): string {
  const p = andel * 100;
  return p >= 1 ? String(Math.round(p)) : p.toFixed(1).replace(".", ",");
}

// Quotes inside a quote: «… «gode dekk» …» → «… 'gode dekk' …».
export function indreAnforsel(t: string): string {
  return t.replace(/[«“]/g, "'").replace(/[»”]/g, "'");
}
