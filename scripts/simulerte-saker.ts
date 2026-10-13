// The twelve simulated buyer cases: what the buyer answers in the form, and what the letter is built
// from beyond that (seller, car, price, earlier notice, estimate, expenses, the buyer's Vipps profile).
// No database here: the decision each case cites is stored once in
// src/lib/brev/__fixtures__/praksis.json (npm run brev:praksis), so the letters can be built offline.
// Every name and number is fictitious.
//
// Used by scripts/simuler.ts (the decision paragraph), the golden letters (src/lib/brev/gylne.test.ts)
// and scripts/brev-jurist.ts.
import type { Rapport, SelgerSvar } from "../src/lib/brev/rapport";
import type { Brevsak } from "../src/lib/brev/typer";
import type { VisteSegValg } from "../src/lib/feil/kategorier";
import type { Krav } from "../src/lib/matching/typer";
import { STUB_PROFIL, type Vippsprofil } from "../src/lib/vipps/profil";

type Kilde = "skriftlig" | "muntlig" | "nei";
export type Feilsvar = { hoved: string; under: string[]; tid: VisteSegValg; beskrivelse: string; opplysning: Kilde; verksted: Kilde; rapport?: Rapport };
export type Sim = {
  navn: string;
  kjopsdato: string;
  km: number;
  ar: number;
  somDenEr: "ja" | "nei" | "vet_ikke";
  krav: Krav;
  forsok: number;
  feil: Feilsvar[];
  // What the letter needs beyond the decision search.
  kjopesum: number;
  bil: { regnr: string; merke: string; modell: string };
  selger: 0 | 1 | 2;
  // Complained to the seller before: when, how and what the seller answered. `forsok` above is then
  // how many repairs the seller has tried; it is 0 without this.
  kontakt?: { dato: string; form: "skriftlig" | "muntlig"; svar: SelgerSvar };
  utlegg?: { beskrivelse: string; belop: number }[];
  // The buyer's Vipps profile: complete, without address, or without address and e-mail.
  kjoper: "full" | "uten_adresse" | "uten_adresse_og_epost";
};

export const SELGERE = [
  { navn: "Testbil AS", orgnr: "999999999", adresse: { linjer: ["Verkstedveien 2"], postnummer: "0585", poststed: "Oslo" } },
  { navn: "Bruktbilhuset Nord AS", orgnr: "999999998", adresse: { linjer: ["Industrivegen 14"], postnummer: "9014", poststed: "Tromsø" } },
  { navn: "Vestlandsbil AS", orgnr: "999999997", adresse: null },
] as const;

export const SAKER: Sim[] = [
  { navn: "Turbo kort etter kjøp", kjopsdato: "2025-03-10", km: 142_000, ar: 2017, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "motor", under: ["turbo"], tid: "innen_6_mnd", beskrivelse: "Bilen mistet kraft og ga feilmelding etter tre uker. Verkstedet fant defekt turbo.", opplysning: "nei", verksted: "skriftlig",
      rapport: { hvem: "merke", navn: "Skoda Senter Oslo", dato: "2025-04-02", punkter: ["bekrefter", "arsak", "ikke_slitasje", "overslag"], konklusjon: "Turbolader defekt og må skiftes. Feilen er ikke normal slitasje for bilens alder.", overslag: 38_000 } }],
    kjopesum: 215_000, bil: { regnr: "XY 10001", merke: "Skoda", modell: "Octavia" }, selger: 0, kjoper: "full" },
  { navn: "Girkasse, kjøpt 2023", kjopsdato: "2023-05-02", km: 188_000, ar: 2012, somDenEr: "ja", krav: "heving", forsok: 2,
    feil: [{ hoved: "drivlinje", under: ["girkasse"], tid: "6_til_24_mnd", beskrivelse: "Automatgirkassen rykker og slipper ved giring. Selger har forsøkt å rette to ganger uten hell.", opplysning: "nei", verksted: "skriftlig",
      rapport: { hvem: "uavhengig", navn: "Girkasseservice AS", dato: "2024-03-05", punkter: ["bekrefter", "arsak", "til_stede"], konklusjon: "Slitasje i koplingspakken som må ha utviklet seg over lang tid.", overslag: null } }],
    kjopesum: 89_000, bil: { regnr: "XY 10002", merke: "Volvo", modell: "V70" }, selger: 1, kontakt: { dato: "2024-02-14", form: "skriftlig", svar: "tilbod_retting" },
    utlegg: [{ beskrivelse: "Tauing", belop: 2_400 }, { beskrivelse: "Leiebil", belop: 6_800 }], kjoper: "full" },
  { navn: "Rust etter over to år, som den er", kjopsdato: "2023-01-20", km: 245_000, ar: 2008, somDenEr: "ja", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "karosseri", under: ["rust"], tid: "over_24_mnd", beskrivelse: "Gjennomrust i bærende deler ble funnet på EU-kontroll. Bilen ble underkjent.", opplysning: "nei", verksted: "skriftlig",
      rapport: { hvem: "selgers", navn: "Vestlandsbil AS verksted", dato: "2025-09-10", punkter: ["bekrefter", "til_stede", "frarader", "overslag"], konklusjon: null, overslag: 22_000 } }],
    kjopesum: 45_000, bil: { regnr: "XY 10003", merke: "Toyota", modell: "Corolla" }, selger: 2, kjoper: "uten_adresse" },
  { navn: "Servicehefte lovet i annonsen", kjopsdato: "2025-06-14", km: 160_000, ar: 2015, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "service", under: ["servicehefte"], tid: "innen_6_mnd", beskrivelse: "Annonsen sa «full servicehistorikk», men det mangler service for fire år.", opplysning: "skriftlig", verksted: "nei" }],
    kjopesum: 119_000, bil: { regnr: "XY 10004", merke: "Ford", modell: "Focus" }, selger: 0, kontakt: { dato: "2025-09-02", form: "muntlig", svar: "ikke_svart" }, kjoper: "uten_adresse_og_epost" },
  { navn: "Tilbakestilt kilometerstand", kjopsdato: "2024-09-01", km: 120_000, ar: 2014, somDenEr: "nei", krav: "heving", forsok: 0,
    feil: [{ hoved: "historikk", under: ["km"], tid: "6_til_24_mnd", beskrivelse: "Vegvesenets historikk viser 60 000 km mer enn telleren og kontrakten.", opplysning: "skriftlig", verksted: "nei" }],
    kjopesum: 145_000, bil: { regnr: "XY 10005", merke: "Audi", modell: "A4" }, selger: 1, kontakt: { dato: "2025-04-11", form: "skriftlig", svar: "avviste" }, kjoper: "full" },
  { navn: "Elbil med lav batterikapasitet", kjopsdato: "2024-11-15", km: 70_000, ar: 2019, somDenEr: "nei", krav: "prisavslag", forsok: 1,
    feil: [{ hoved: "hoyvolt", under: ["kapasitet"], tid: "6_til_24_mnd", beskrivelse: "Rekkevidden har falt til halvparten. Batteritest viser 68 % helse.", opplysning: "muntlig", verksted: "skriftlig",
      rapport: { hvem: "merke", navn: "Nissan Forhandler Nord", dato: "2025-05-20", punkter: ["bekrefter", "ikke_slitasje", "overslag"], konklusjon: "Batteriets kapasitet er 68 % av nytt, som er lavere enn forventet for bilens alder.", overslag: 55_000 } }],
    kjopesum: 189_000, bil: { regnr: "XY 10006", merke: "Nissan", modell: "Leaf" }, selger: 0, kontakt: { dato: "2025-04-15", form: "muntlig", svar: "tilbod_retting" }, kjoper: "full" },
  { navn: "Varsellampe, vet ikke årsak", kjopsdato: "2025-07-01", km: 95_000, ar: 2018, somDenEr: "vet_ikke", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["varsellampe"], tid: "innen_6_mnd", beskrivelse: "Motorlampen lyser og bilen går ujevnt på tomgang.", opplysning: "nei", verksted: "nei" }],
    kjopesum: 159_000, bil: { regnr: "XY 10007", merke: "Hyundai", modell: "i30" }, selger: 2, kjoper: "uten_adresse" },
  { navn: "Klima, bare hovedkategori", kjopsdato: "2024-04-10", km: 210_000, ar: 2011, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "klima", under: [], tid: "6_til_24_mnd", beskrivelse: "AC blåser bare varm luft.", opplysning: "nei", verksted: "muntlig" }],
    kjopesum: 59_000, bil: { regnr: "XY 10008", merke: "Opel", modell: "Insignia" }, selger: 1, kjoper: "full" },
  { navn: "Bremser på eldre bil", kjopsdato: "2025-02-20", km: 230_000, ar: 2009, somDenEr: "ja", krav: "retting", forsok: 0,
    feil: [{ hoved: "understell", under: ["bremser"], tid: "innen_6_mnd", beskrivelse: "Bremsene trekker skjevt og kalipperen henger. Verkstedet sier den er rustet fast.", opplysning: "nei", verksted: "skriftlig",
      rapport: { hvem: "uavhengig", navn: "Bremsespesialisten AS", dato: "2025-03-05", punkter: ["bekrefter", "arsak", "frarader"], konklusjon: null, overslag: null } }],
    kjopesum: 49_000, bil: { regnr: "XY 10009", merke: "Mercedes-Benz", modell: "C-klasse" }, selger: 0, kjoper: "full" },
  { navn: "Oljeforbruk og lys, to kategorier", kjopsdato: "2024-08-05", km: 175_000, ar: 2013, somDenEr: "nei", krav: "heving", forsok: 2,
    feil: [
      { hoved: "motor", under: ["olje"], tid: "6_til_24_mnd", beskrivelse: "Motoren bruker en liter olje per 1000 km.", opplysning: "nei", verksted: "skriftlig",
        rapport: { hvem: "uavhengig", navn: "Motorverkstedet Bergen", dato: "2025-03-01", punkter: ["bekrefter", "arsak"], konklusjon: "Oljeforbruket overstiger produsentens grenseverdi.", overslag: null } },
      { hoved: "elektrisk", under: ["lys"], tid: "innen_6_mnd", beskrivelse: "Fjernlyset virker ikke.", opplysning: "nei", verksted: "nei" },
    ],
    kjopesum: 125_000, bil: { regnr: "XY 10010", merke: "BMW", modell: "320d" }, selger: 1, kontakt: { dato: "2025-02-20", form: "skriftlig", svar: "annet" }, utlegg: [{ beskrivelse: "Feilsøking", belop: 3_500 }], kjoper: "full" },
  { navn: "Garanti ikke som lovet", kjopsdato: "2025-01-05", km: 60_000, ar: 2020, somDenEr: "nei", krav: "prisavslag", forsok: 0,
    feil: [{ hoved: "garanti", under: [], tid: "innen_6_mnd", beskrivelse: "Forhandleren lovet 12 måneders bruktbilgaranti, men garantien ble aldri tegnet.", opplysning: "skriftlig", verksted: "nei" }],
    kjopesum: 249_000, bil: { regnr: "XY 10011", merke: "Kia", modell: "Niro" }, selger: 0, kontakt: { dato: "2025-04-07", form: "skriftlig", svar: "avviste" }, kjoper: "uten_adresse_og_epost" },
  { navn: "Nødmodus etter over to år", kjopsdato: "2023-03-01", km: 150_000, ar: 2017, somDenEr: "nei", krav: "retting", forsok: 0,
    feil: [{ hoved: "vet_ikke", under: ["nodmodus"], tid: "over_24_mnd", beskrivelse: "Bilen går i nødmodus i motorbakker.", opplysning: "nei", verksted: "skriftlig",
      rapport: { hvem: "uavhengig", navn: "Diagnoseverkstedet AS", dato: "2025-11-12", punkter: ["bekrefter"], konklusjon: null, overslag: null } }],
    kjopesum: 119_000, bil: { regnr: "XY 10012", merke: "Peugeot", modell: "308" }, selger: 2, kjoper: "full" },
];

const PROFILER: Record<Sim["kjoper"], Vippsprofil> = {
  full: STUB_PROFIL,
  uten_adresse: { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon, epost: STUB_PROFIL.epost },
  uten_adresse_og_epost: { navn: STUB_PROFIL.navn, telefon: STUB_PROFIL.telefon },
};

// The letter's date is fixed, so the golden letters do not change from day to day.
export const BREVDATO = "2026-10-13";

export function tilBrevsak(x: Sim, praksis: Brevsak["praksis"]): Brevsak {
  const s = SELGERE[x.selger];
  return {
    dato: BREVDATO,
    kjoper: PROFILER[x.kjoper],
    selger: { navn: s.navn, orgnr: s.orgnr, adresse: s.adresse ? { ...s.adresse, linjer: [...s.adresse.linjer] } : null },
    bil: { ...x.bil, forsteRegistrert: x.ar },
    kjopsdato: x.kjopsdato,
    km: x.km,
    kjopesum: x.kjopesum,
    somDenEr: x.somDenEr,
    feil: x.feil.map((f) => ({ ...f, under: [...f.under], rapport: f.verksted === "skriftlig" ? (f.rapport ?? null) : null })),
    krav: x.krav,
    utlegg: x.utlegg ?? [],
    kontakt: x.kontakt ? { ...x.kontakt, forsok: x.forsok } : null,
    praksis,
  };
}
