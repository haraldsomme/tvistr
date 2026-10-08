import { type Kjopsalder, type Kjopsform, type Kontakt, type Oppdaget, type Opplyst } from "@/lib/vurdering/typer";
import { FEILTYPER_KNAPPER } from "@/lib/vurdering/innsending";

// The wording of the questions and the answers in the assessment, and of the questions the letter page
// asks after purchase. The letter page lets the buyer correct the answers, and asks with the same words.

export const SPORSMAL = {
  kjopAlder: "Når kjøpte du bilen?",
  kjopsform: "Hvem kjøpte du bilen av?",
  kjopsdato: "Kjøpsdato",
  kjopesum: "Hva kostet bilen?",
  kmVedKjop: "Kilometerstand ved kjøpet",
  feiltype: "Hva gjelder feilen?",
  oppdaget: "Hvor lenge etter kjøpet viste feilen seg?",
  opplyst: "Visste du om feilen da du kjøpte bilen?",
  feilopplysning: "Ble du feilaktig informert av selger eller annonse?",
  dokumentert: "Har du det skriftlig?",
  kontakt: "Har du tatt opp feilen med forhandleren?",
  reklamert: "Tok du opp feilen med forhandleren innen fem år etter kjøpet?",
  rapport: "Har du en verksted- eller tilstandsrapport?",
  rapportSier: "Sier rapporten at feilen sannsynligvis var til stede før kjøpet?",
  bilder: "Har du bilder eller video av feilen?",
} as const;

export const KJOPSALDER_TEKST: Record<Kjopsalder, string> = {
  under_2: "Mindre enn 2 år siden",
  "2_5": "2–5 år siden",
  over_5: "Mer enn 5 år siden",
};

export const FEILTYPE_TEKST: Record<(typeof FEILTYPER_KNAPPER)[number], string> = {
  motor: "Motor",
  girkasse: "Girkasse og clutch",
  elektrisk: "Elektrisk",
  batteri: "Batteri (elbil)",
  understell: "Understell og hjul",
  bremser: "Bremser",
  rust: "Rust",
  fukt: "Fukt og lekkasje",
  klimaanlegg: "Klimaanlegg",
  km_service: "Kilometer og servicehistorikk",
  skade: "Kollisjonsskade",
  annet: "Annet",
};
export const OPPLYST_TEKST: Record<Opplyst, string> = {
  nei: "Nei",
  ja_verre: "Ja, men den er verre eller annerledes enn jeg fikk vite",
  ja_som_opplyst: "Ja, og den er slik jeg fikk vite",
};
export const KONTAKT_TEKST: Record<Kontakt, string> = { nei: "Nei", ja: "Ja" };
export const KJOPSFORM_TEKST: Record<Kjopsform, string> = { forhandler: "Bilforhandler", privatperson: "Privatperson", firma: "Kjøpt gjennom firma" };
export const OPPDAGET_TEKST: Record<Oppdaget, string> = {
  innen_6_mnd: "Innen 6 måneder",
  "6_mnd_til_2_ar": "6 måneder til 2 år",
  over_2_ar: "Mer enn 2 år",
};
export const JA_NEI_TEKST = { ja: "Ja", nei: "Nei" } as const;
export const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
