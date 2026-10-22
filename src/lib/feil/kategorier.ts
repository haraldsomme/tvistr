// The buyer's defect choices: 13 main categories, each with subcategories the buyer can tick. The
// same ids are what the feilvurdering agents file each accepted defect under (src/lib/feilvurdering).

export type Underkategori = { id: string; navn: string };

export const HOVEDKATEGORIER: { id: string; navn: string; under: Underkategori[] }[] = [
  {
    id: "motor",
    navn: "Motor og eksos",
    under: [
      { id: "turbo", navn: "Turbo" },
      { id: "registerreim", navn: "Registerreim eller kjede" },
      { id: "olje", navn: "Oljeforbruk og oljelekkasje" },
      { id: "kjoling", navn: "Kjøling og topplokk" },
      { id: "drivstoff", navn: "Drivstoff og injektorer" },
      { id: "eksos", navn: "Eksosanlegg og katalysator" },
      { id: "utslipp", navn: "EGR, partikkelfilter, AdBlue" },
      { id: "annet_motor", navn: "Annet ved motoren" },
    ],
  },
  {
    id: "drivlinje",
    navn: "Girkasse, clutch og drivlinje",
    under: [
      { id: "girkasse", navn: "Girkasse" },
      { id: "clutch", navn: "Clutch" },
      { id: "firehjul", navn: "Firehjulstrekk, drivaksler, differensial" },
    ],
  },
  {
    id: "understell",
    navn: "Bremser, understell og styring",
    under: [
      { id: "bremser", navn: "Bremser" },
      { id: "demping", navn: "Støtdempere og hjuloppheng" },
      { id: "styring", navn: "Styring" },
      { id: "hjullager", navn: "Hjullager" },
    ],
  },
  {
    id: "karosseri",
    navn: "Rust, lakk og karosseri",
    under: [
      { id: "rust", navn: "Rust" },
      { id: "lakk", navn: "Lakk og bulker" },
      { id: "ruter", navn: "Ruter og speil" },
    ],
  },
  {
    id: "fukt",
    navn: "Fukt og interiør",
    under: [
      { id: "fukt", navn: "Fukt og vannlekkasje" },
      { id: "lukt", navn: "Lukt" },
      { id: "interior", navn: "Seter og interiør" },
    ],
  },
  {
    id: "elektrisk",
    navn: "Elektrisk og elektronikk",
    under: [
      { id: "infotainment", navn: "Infotainment, navigasjon, kamera" },
      {
        id: "sikkerhet",
        navn: "Airbag, setebelter, ABS, sensorer, førerassistent",
      },
      { id: "lys", navn: "Lys" },
      { id: "startbatteri", navn: "Startbatteri, dynamo, startmotor" },
      { id: "annet_el", navn: "Annet elektrisk" },
    ],
  },
  {
    id: "klima",
    navn: "Klimaanlegg og varme",
    under: [
      { id: "ac", navn: "AC" },
      { id: "varme", navn: "Varmepumpe og varmeapparat" },
      { id: "parkeringsvarmer", navn: "Parkeringsvarmer" },
    ],
  },
  {
    id: "hoyvolt",
    navn: "Høyvoltbatteri og lading (elbil og hybrid)",
    under: [
      { id: "kapasitet", navn: "Kapasitet og rekkevidde" },
      { id: "lading", navn: "Lading og ladeutstyr" },
      { id: "hybrid", navn: "Hybridsystem" },
    ],
  },
  {
    id: "utstyr",
    navn: "Utstyr ikke som lovet",
    under: [
      { id: "utstyr", navn: "Utstyr mangler eller virker ikke" },
      { id: "dekk", navn: "Dekk og felger" },
      { id: "nokler", navn: "Nøkler og tilbehør" },
      { id: "utstyrsniva", navn: "Feil utstyrsnivå" },
    ],
  },
  {
    id: "service",
    navn: "Service ikke utført som opplyst",
    under: [
      { id: "service", navn: "Service ikke utført" },
      { id: "servicehefte", navn: "Servicehefte mangler" },
    ],
  },
  {
    id: "historikk",
    navn: "Bilens historikk",
    under: [
      { id: "skade", navn: "Skade og kollisjon" },
      { id: "km", navn: "Kilometerstand" },
      {
        id: "bruk",
        navn: "Tidligere bruk (taxi, leie, kjøreskole) og antall eiere",
      },
      { id: "import", navn: "Import, årsmodell, identitet" },
      { id: "ombygging", navn: "Ombygging og tuning" },
      { id: "eu", navn: "EU-kontroll og registrering" },
      { id: "pant", navn: "Pant og heftelse" },
    ],
  },
  {
    id: "garanti",
    navn: "Garanti ikke som lovet",
    under: [],
  },
  {
    id: "vet_ikke",
    navn: "Vet ikke ennå",
    under: [
      { id: "varsellampe", navn: "Varsellampe" },
      { id: "nodmodus", navn: "Nødmodus" },
      { id: "lyd", navn: "Lyd" },
      { id: "vibrasjon", navn: "Vibrasjon" },
    ],
  },
];

// The subcategories decided on what the seller said or kept back, not on what wear the buyer must
// expect: the car's profile and the presumption do not count for them (src/lib/matching/ranger.ts,
// src/lib/brev/feiltype.ts). The warranty has no subcategories and is one itself.
const OPPLYSNING = new Set([
  ...["skade", "km", "bruk", "import", "ombygging", "eu", "pant"].map((u) => `historikk.${u}`),
  "service.service",
  "service.servicehefte",
  "utstyr.utstyr",
  "utstyr.nokler",
  "utstyr.utstyrsniva",
  "garanti",
]);

// Whether a subcategory is about what the seller said, or, without one, a main category whose
// subcategories all are.
export function erOpplysning(hoved: string, under: string | null): boolean {
  if (under) return OPPLYSNING.has(`${hoved}.${under}`);
  const h = HOVEDKATEGORIER.find((x) => x.id === hoved);
  if (!h) return false;
  return h.under.length ? h.under.every((u) => OPPLYSNING.has(`${hoved}.${u.id}`)) : OPPLYSNING.has(hoved);
}

// What the buyer ticked: main category id → subcategory ids (possibly none).
export type Feilvalg = Record<string, string[]>;

// The three intervals the buyer used to choose from. The form now asks for the day the defect was
// discovered (src/lib/brev/tidslinje.ts works out the time level from it); the intervals remain only
// as the words the choice of decision reads (kjoper.ts), so its input is the same as before.
export const VISTE_SEG_VALG = [
  { id: "innen_6_mnd", navn: "Innen 6 måneder" },
  { id: "6_til_24_mnd", navn: "Mellom 6 måneder og 2 år" },
  { id: "over_24_mnd", navn: "Mer enn 2 år" },
] as const;
export type VisteSegValg = (typeof VISTE_SEG_VALG)[number]["id"];

// A decision's defect by name: the component the decision was about (feilvurdering), else our
// subcategory or category. Used by the letter's paragraph and the cards on the verdict page.
export function komponentnavn(f: { komponent: string | null; hovedkategori: string; underkategori: string | null }): string {
  if (f.komponent) return f.komponent;
  const h = HOVEDKATEGORIER.find((x) => x.id === f.hovedkategori);
  const u = h?.under.find((x) => x.id === f.underkategori);
  return (u?.navn ?? h?.navn ?? f.hovedkategori).toLowerCase();
}

// A case's faults by name: the chosen subcategories, else the category («Girkasse, Rust»). Used where
// the owner's letters are listed (/min-side, the account menu).
export function feilnavn(cats: string[], parts: Record<string, string[]>): string {
  return cats
    .flatMap((c) => {
      const h = HOVEDKATEGORIER.find((x) => x.id === c);
      if (!h) return [];
      const valgt = (parts[c] ?? []).map((u) => h.under.find((x) => x.id === u)?.navn).filter((n): n is string => !!n);
      return valgt.length ? valgt : [h.navn];
    })
    .join(", ");
}
