import { KONTAKT_VALG, type Kontakt, type Oppdaget } from "@/lib/vurdering/typer";
import { FEILTYPER_KNAPPER } from "@/lib/vurdering/innsending";

// The wording of the questions and the answers in the assessment. The letter page lets the buyer
// correct the answers, and asks with the same words.

export const SPORSMAL = {
  kjopsdato: "Når kjøpte du bilen?",
  kjopesum: "Hva kostet bilen?",
  kmVedKjop: "Kilometerstand ved kjøpet",
  feiltype: "Hva gjelder feilen?",
  oppdaget: "Hvor lenge etter kjøpet oppdaget du feilen?",
  opplyst: "Ble du fortalt om feilen før kjøpet?",
  feilopplysning: "Ble du feilaktig informert av selger eller annonse?",
  dokumentert: "Har du det skriftlig?",
  kontakt: "Har du tatt opp feilen med forhandleren?",
  kontaktSvar: "Hva har skjedd siden?",
  reklamert: "Når tok du første gang opp feilen med forhandleren?",
  rapport: "Har du en verksted- eller tilstandsrapport?",
  rapportSier: "Sier rapporten at feilen sannsynligvis var til stede før kjøpet?",
  bilder: "Har du bilder eller video av feilen?",
} as const;

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
export const OPPLYST_TEKST = { ja: "Ja", nei: "Nei", usikker: "Usikker" } as const;
export const KONTAKTET_TEKST = { nei: "Nei, ikke ennå", ja: "Ja" } as const;
// The follow-up when the dealer has been contacted.
export const SVAR_VALG = KONTAKT_VALG.filter((k): k is Exclude<Kontakt, "nei"> => k !== "nei");
export const SVAR_TEKST: Record<Exclude<Kontakt, "nei">, string> = {
  venter: "Venter på svar eller reparasjon",
  avvist: "Forhandleren avviste",
  forsokt: "Forsøkt rettet, uten hell",
};
export const OPPDAGET_TEKST: Record<Oppdaget, string> = {
  innen_6_mnd: "Innen 6 måneder",
  "6_mnd_til_2_ar": "6 måneder til 2 år",
  over_2_ar: "Mer enn 2 år",
};
export const JA_NEI_TEKST = { ja: "Ja", nei: "Nei" } as const;
export const MANEDER = ["januar", "februar", "mars", "april", "mai", "juni", "juli", "august", "september", "oktober", "november", "desember"];
