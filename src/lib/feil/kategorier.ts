// The buyer's defect choices: 13 main categories, each with subcategories the buyer can tick. The
// same ids are what the feilvurdering agents file each accepted defect under (src/lib/feilvurdering).
import type { Tidsniva } from "@/lib/feilvurdering/skjema";

export type Underkategori = { id: string; navn: string };
export type Hovedkategori = {
  id: string;
  kode: string;
  navn: string;
  under: Underkategori[];
};

export const HOVEDKATEGORIER: Hovedkategori[] = [
  {
    id: "motor",
    kode: "01",
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
    kode: "02",
    navn: "Girkasse, clutch og drivlinje",
    under: [
      { id: "girkasse", navn: "Girkasse" },
      { id: "clutch", navn: "Clutch" },
      { id: "firehjul", navn: "Firehjulstrekk, drivaksler, differensial" },
    ],
  },
  {
    id: "understell",
    kode: "03",
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
    kode: "04",
    navn: "Rust, lakk og karosseri",
    under: [
      { id: "rust", navn: "Rust" },
      { id: "lakk", navn: "Lakk og bulker" },
      { id: "ruter", navn: "Ruter og speil" },
    ],
  },
  {
    id: "fukt",
    kode: "05",
    navn: "Fukt og interiør",
    under: [
      { id: "fukt", navn: "Fukt og vannlekkasje" },
      { id: "lukt", navn: "Lukt" },
      { id: "interior", navn: "Seter og interiør" },
    ],
  },
  {
    id: "elektrisk",
    kode: "06",
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
    kode: "07",
    navn: "Klimaanlegg og varme",
    under: [
      { id: "ac", navn: "AC" },
      { id: "varme", navn: "Varmepumpe og varmeapparat" },
      { id: "parkeringsvarmer", navn: "Parkeringsvarmer" },
    ],
  },
  {
    id: "hoyvolt",
    kode: "08",
    navn: "Høyvoltbatteri og lading (elbil og hybrid)",
    under: [
      { id: "kapasitet", navn: "Kapasitet og rekkevidde" },
      { id: "lading", navn: "Lading og ladeutstyr" },
      { id: "hybrid", navn: "Hybridsystem" },
    ],
  },
  {
    id: "utstyr",
    kode: "09",
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
    kode: "10",
    navn: "Service ikke utført som opplyst",
    under: [
      { id: "service", navn: "Service ikke utført" },
      { id: "servicehefte", navn: "Servicehefte mangler" },
    ],
  },
  {
    id: "historikk",
    kode: "11",
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
    kode: "12",
    navn: "Garanti ikke som lovet",
    under: [],
  },
  {
    id: "vet_ikke",
    kode: "13",
    navn: "Vet ikke ennå",
    under: [
      { id: "varsellampe", navn: "Varsellampe" },
      { id: "nodmodus", navn: "Nødmodus" },
      { id: "lyd", navn: "Lyd" },
      { id: "vibrasjon", navn: "Vibrasjon" },
    ],
  },
];

// What kind of part a subcategory is. The committee reasons alike about parts of one kind (wear
// parts, expensive main parts, safety systems), so a decision about one may be carried over to
// another of the same kind (src/lib/matching/ranger.ts, step 3). «Vet ikke ennå» names symptoms,
// not parts, and has no kind.
export const KOMPONENTTYPER = {
  slitedel: ["drivlinje.clutch", "understell.bremser", "understell.demping", "understell.hjullager", "elektrisk.startbatteri", "utstyr.dekk", "motor.eksos", "motor.registerreim", "karosseri.rust"],
  forbrenning: ["motor.turbo", "drivlinje.girkasse", "drivlinje.firehjul", "motor.drivstoff", "motor.olje", "motor.kjoling", "motor.utslipp", "motor.annet_motor"],
  hoyvolt: ["hoyvolt.kapasitet", "hoyvolt.lading", "hoyvolt.hybrid"],
  sikkerhet: ["elektrisk.sikkerhet", "understell.styring"],
  klima: ["klima.ac", "klima.varme", "klima.parkeringsvarmer"],
  karosseri: ["karosseri.lakk", "karosseri.ruter", "fukt.fukt", "fukt.lukt", "fukt.interior"],
  elektronikk: ["elektrisk.infotainment", "elektrisk.lys", "elektrisk.annet_el"],
  // Decided on what the seller said or kept back, not on what wear the buyer must expect.
  opplysning: [
    ...["skade", "km", "bruk", "import", "ombygging", "eu", "pant"].map((u) => `historikk.${u}`),
    "service.service",
    "service.servicehefte",
    "utstyr.utstyr",
    "utstyr.nokler",
    "utstyr.utstyrsniva",
    "garanti",
  ],
} as const;
export type Komponenttype = keyof typeof KOMPONENTTYPER;
const TYPE_AV = new Map(Object.entries(KOMPONENTTYPER).flatMap(([t, ider]) => ider.map((i) => [i, t as Komponenttype] as const)));

// The kind of a subcategory, or of a main category whose subcategories all share one kind.
export function komponenttype(hoved: string, under: string | null): Komponenttype | null {
  if (under) return TYPE_AV.get(`${hoved}.${under}`) ?? null;
  const h = HOVEDKATEGORIER.find((x) => x.id === hoved);
  if (!h) return null;
  if (!h.under.length) return TYPE_AV.get(hoved) ?? null;
  const typer = new Set(h.under.map((u) => TYPE_AV.get(`${hoved}.${u.id}`)));
  return typer.size === 1 ? ([...typer][0] ?? null) : null;
}

// A subcategory in the definite form, for the letter's «Før kjøpet opplyste dere om servicehistorikken».
// Only subcategories of the type «opplysning» need one: they are the ones the seller said or promised
// something about. The main-category entries are for a choice without a subcategory.
export const BESTEMT_FORM: Record<string, string> = {
  "historikk.skade": "skadehistorikken",
  "historikk.km": "kilometerstanden",
  "historikk.bruk": "tidligere bruk og antall eiere",
  "historikk.import": "importen, årsmodellen og identiteten",
  "historikk.ombygging": "ombyggingen og tuningen",
  "historikk.eu": "EU-kontrollen og registreringen",
  "historikk.pant": "pantet og heftelsen",
  "service.service": "servicehistorikken",
  "service.servicehefte": "serviceheftet",
  "utstyr.utstyr": "utstyret",
  "utstyr.nokler": "nøklene og tilbehøret",
  "utstyr.utstyrsniva": "utstyrsnivået",
  garanti: "garantien",
  historikk: "bilens historikk",
  service: "servicehistorikken",
  utstyr: "utstyret",
};

// The definite form of a subcategory, or of the main category when no subcategory is ticked. null when
// the category is not one the seller says things about.
export const bestemtForm = (hoved: string, under: string | null): string | null => BESTEMT_FORM[under ? `${hoved}.${under}` : hoved] ?? null;

// What the buyer ticked: main category id → subcategory ids (possibly none).
export type Feilvalg = Record<string, string[]>;

// Drops ids that are not in the list, so a request from outside the form cannot inject anything.
export function rensFeilvalg(valg: unknown): Feilvalg {
  if (!valg || typeof valg !== "object") return {};
  const ut: Feilvalg = {};
  for (const h of HOVEDKATEGORIER) {
    const under = (valg as Record<string, unknown>)[h.id];
    if (!Array.isArray(under)) continue;
    ut[h.id] = h.under.filter((u) => under.includes(u.id)).map((u) => u.id);
  }
  return ut;
}

// When the buyer says the defect showed itself, per main category. The decisions carry a time level
// per accepted defect (src/lib/feilvurdering/avled.ts); brukerNiva puts the buyer on the same scale.
export const VISTE_SEG_VALG = [
  { id: "innen_6_mnd", navn: "Innen 6 måneder" },
  { id: "6_til_24_mnd", navn: "Mellom 6 måneder og 2 år" },
  { id: "over_24_mnd", navn: "Mer enn 2 år" },
] as const;
export type VisteSegValg = (typeof VISTE_SEG_VALG)[number]["id"];

// Main category id → when it showed itself.
export type Tidsvalg = Record<string, VisteSegValg>;

export function rensTidsvalg(tid: unknown): Partial<Tidsvalg> {
  if (!tid || typeof tid !== "object") return {};
  const ut: Partial<Tidsvalg> = {};
  for (const [k, v] of Object.entries(tid)) {
    const t = VISTE_SEG_VALG.find((x) => x.id === v);
    if (t) ut[k] = t.id;
  }
  return ut;
}

// The presumption period is six months for purchases before 2024 and two years after. Without a
// purchase date the 2024 law is assumed: a buyer complaining now has nearly always bought since.
// The decisions' «near the deadline» (from 22 months) is not asked; past two years is level 3.
export function brukerNiva(valg: VisteSegValg, kjopsdato: string | null): Tidsniva {
  if (valg === "innen_6_mnd") return 1;
  if (valg === "over_24_mnd") return 3;
  return kjopsdato && kjopsdato < "2024-01-01" ? 2 : 1;
}
