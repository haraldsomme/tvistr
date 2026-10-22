// The twelve simulated buyer cases for scripts/simuler.ts: what the buyer answers in the form.
// Every name and number is fictitious.
import type { RapportPunkt } from "../src/lib/brev/rapport";
import type { Kilde } from "../src/lib/vedtaksvalg/kjoper";
import type { Krav } from "../src/lib/matching/typer";

export type Sim = {
  navn: string;
  kjopsdato: string;
  km: number;
  ar: number;
  somDenEr: "ja" | "nei" | "vet_ikke";
  krav: Krav;
  forsok: number;
  // `oppdaget` is the day the defect was discovered; `rapport` what the workshop's report says.
  feil: { hoved: string; under: string[]; oppdaget: string; beskrivelse: string; opplysning: Kilde; verksted: Kilde; rapport?: { punkter: RapportPunkt[] } }[];
};

export const SAKER: Sim[] = [
  { navn: "Turbo kort etter kjøp", kjopsdato: "2025-03-10", km: 142_000, ar: 2017, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "motor", under: ["turbo"], oppdaget: "2025-04-01", beskrivelse: "Bilen mistet kraft og ga feilmelding etter tre uker. Verkstedet fant defekt turbo.", opplysning: "nei", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter", "arsak", "ikke_slitasje", "overslag"] } }] },
  { navn: "Girkasse, kjøpt 2023", kjopsdato: "2023-05-02", km: 188_000, ar: 2012, somDenEr: "ja", krav: "heving", forsok: 2,
    feil: [{ hoved: "drivlinje", under: ["girkasse"], oppdaget: "2024-02-01", beskrivelse: "Automatgirkassen rykker og slipper ved giring. Selger har forsøkt å rette to ganger uten hell.", opplysning: "nei", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter", "arsak", "til_stede"] } }] },
  { navn: "Rust etter over to år, som den er", kjopsdato: "2023-01-20", km: 245_000, ar: 2008, somDenEr: "ja", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "karosseri", under: ["rust"], oppdaget: "2025-08-25", beskrivelse: "Gjennomrust i bærende deler ble funnet på EU-kontroll. Bilen ble underkjent.", opplysning: "nei", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter", "til_stede", "frarader", "overslag"] } }] },
  { navn: "Servicehefte lovet i annonsen", kjopsdato: "2025-06-14", km: 160_000, ar: 2015, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "service", under: ["servicehefte"], oppdaget: "2025-08-20", beskrivelse: "Annonsen lovet full servicehistorikk, men det mangler service for fire år.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Tilbakestilt kilometerstand", kjopsdato: "2024-09-01", km: 120_000, ar: 2014, somDenEr: "nei", krav: "heving", forsok: 0,
    feil: [{ hoved: "historikk", under: ["km"], oppdaget: "2025-03-15", beskrivelse: "Vegvesenets historikk viser 60 000 km mer enn telleren og kontrakten.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Elbil med lav batterikapasitet", kjopsdato: "2024-11-15", km: 70_000, ar: 2019, somDenEr: "nei", krav: "prisavslag", forsok: 1,
    feil: [{ hoved: "hoyvolt", under: ["kapasitet"], oppdaget: "2025-05-16", beskrivelse: "Rekkevidden har falt til halvparten. Batteritest viser 68 % helse.", opplysning: "muntlig", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter", "ikke_slitasje", "overslag"] } }] },
  { navn: "Varsellampe, vet ikke årsak", kjopsdato: "2025-07-01", km: 95_000, ar: 2018, somDenEr: "vet_ikke", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["varsellampe"], oppdaget: "2025-08-20", beskrivelse: "Motorlampen lyser og bilen går ujevnt på tomgang.", opplysning: "nei", verksted: "nei" }] },
  { navn: "Klima, bare hovedkategori", kjopsdato: "2024-04-10", km: 210_000, ar: 2011, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "klima", under: [], oppdaget: "2025-06-01", beskrivelse: "AC blåser bare varm luft.", opplysning: "nei", verksted: "muntlig" }] },
  { navn: "Bremser på eldre bil", kjopsdato: "2025-02-20", km: 230_000, ar: 2009, somDenEr: "ja", krav: "retting", forsok: 0,
    feil: [{ hoved: "understell", under: ["bremser"], oppdaget: "2025-03-01", beskrivelse: "Bremsene trekker skjevt og kalipperen henger. Verkstedet sier den er rustet fast.", opplysning: "nei", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter", "arsak", "frarader"] } }] },
  { navn: "Oljeforbruk og lys, to kategorier", kjopsdato: "2024-08-05", km: 175_000, ar: 2013, somDenEr: "nei", krav: "heving", forsok: 2,
    feil: [
      { hoved: "motor", under: ["olje"], oppdaget: "2025-02-10", beskrivelse: "Motoren bruker en liter olje per 1000 km.", opplysning: "nei", verksted: "skriftlig",
        rapport: { punkter: ["bekrefter", "arsak"] } },
      { hoved: "elektrisk", under: ["lys"], oppdaget: "2025-01-10", beskrivelse: "Fjernlyset virker ikke.", opplysning: "nei", verksted: "nei" },
    ] },
  { navn: "Garanti ikke som lovet", kjopsdato: "2025-01-05", km: 60_000, ar: 2020, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "garanti", under: [], oppdaget: "2025-03-20", beskrivelse: "Forhandleren lovet 12 måneders bruktbilgaranti, men garantien ble aldri tegnet.", opplysning: "skriftlig", verksted: "nei" }] },
  { navn: "Nødmodus etter over to år", kjopsdato: "2023-03-01", km: 150_000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["nodmodus"], oppdaget: "2025-11-01", beskrivelse: "Bilen går i nødmodus i motorbakker.", opplysning: "nei", verksted: "skriftlig",
      rapport: { punkter: ["bekrefter"] } }] },
];

