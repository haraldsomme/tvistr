// The letter writer's answers (the artifact's `S`), their defaults, the sample case, and the fixed
// lists the form and the letter share. Text fields are strings, "" when empty.
import { addDays, iso, parseD } from "./dato";

export type Omrade = { found: string; impact: string[]; known: string };
export type Utgift = { t: string; a: number };

export type Skjema = {
  b_name: string; b_addr: string; b_zip: string; b_city: string; b_phone: string; b_email: string;
  d_name: string; d_org: string; d_contact: string; d_addr: string; d_zip: string; d_city: string; d_email: string;
  c_make: string; c_model: string; c_year: string; c_reg: string;
  c_purchase: string; c_delivery: string; c_price: string; c_km: string; c_asis: boolean; c_warranty: boolean; c_lastreg: string;
  // Fault areas are Tvistr's main categories, the parts their subcategories (src/lib/feil/kategorier.ts).
  f_cats: string[]; f_parts: Record<string, string[]>; f_area: Record<string, Omrade>; f_catdesc: Record<string, string>;
  f_desc: string; f_docs: string[]; files: string[];
  // Derived from the areas by syncAreas.
  f_found: string; f_impact: string[]; f_known: string; f_cause: string; f_cause_check: string; f_sev: number; f_drivable: string;
  ws: string; ws_who: string; ws_name: string; ws_date: string; ws_says: string[]; ws_quote: string;
  seller_said: string; seller_txt: string;
  f_prior: boolean; f_prior_date: string; f_prior_how: string; f_prior_resp: string;
  k_main: string; k_alt: string; k_amount: string; k_basis: string; k_loaner: boolean; k_exp: boolean; exp: Utgift[];
  // Optional, for the argument that the defect is not insignificant: how many times the seller has tried
  // to repair («0»–«3+», "" when not answered) and the estimated repair cost.
  k_forsok: string; k_cost: string;
  k_hold: boolean; k_hold_amt: string; k_days: string;
  l_place: string; l_date: string; l_tone: string;
  prec_on: boolean; prec_id: number | null;
};

export const standard = (idag: string): Skjema => ({
  b_name: "", b_addr: "", b_zip: "", b_city: "", b_phone: "", b_email: "",
  d_name: "", d_org: "", d_contact: "", d_addr: "", d_zip: "", d_city: "", d_email: "",
  c_make: "", c_model: "", c_year: "", c_reg: "", c_purchase: "", c_delivery: "", c_price: "", c_km: "", c_asis: false, c_warranty: false, c_lastreg: "",
  f_cats: [], f_parts: {}, f_area: {}, f_catdesc: {}, f_desc: "", f_docs: [], files: [],
  f_found: "", f_impact: [], f_known: "", f_cause: "", f_cause_check: "", f_sev: 0, f_drivable: "",
  ws: "", ws_who: "", ws_name: "", ws_date: "", ws_says: [], ws_quote: "", seller_said: "", seller_txt: "",
  f_prior: false, f_prior_date: "", f_prior_how: "", f_prior_resp: "",
  k_main: "", k_alt: "ingen", k_amount: "", k_basis: "", k_loaner: false, k_exp: false, exp: [], k_forsok: "", k_cost: "", k_hold: false, k_hold_amt: "", k_days: "14",
  l_place: "", l_date: idag, l_tone: "saklig", prec_on: true, prec_id: null,
});

export function eksempel(idag: string): Skjema {
  const t = parseD(idag)!;
  const d = (n: number) => iso(addDays(t, -n));
  return {
    ...standard(idag),
    b_name: "Kari Nordmann", b_addr: "Storgata 12", b_zip: "0155", b_city: "Oslo", b_phone: "912 34 567", b_email: "kari.nordmann@eksempel.no",
    d_name: "Bilhuset Vest AS", d_org: "923 456 783", d_contact: "Ola Hansen, selger", d_addr: "Industriveien 4", d_zip: "1337", d_city: "Sandvika", d_email: "kundeservice@bilhusetvest.no",
    c_make: "Volkswagen", c_model: "ID.4", c_year: "2022", c_reg: "EL 48213",
    c_purchase: d(118), c_delivery: d(114), c_price: "329 900", c_km: "38 500", c_warranty: true,
    f_cats: ["hoyvolt"], f_parts: { hoyvolt: ["kapasitet", "lading"] },
    f_area: { hoyvolt: { found: d(16), impact: ["palitelig", "bruk"], known: "nei" } },
    f_catdesc: { hoyvolt: "Bilen lader ikke raskere enn 40 kW på hurtiglader, selv med varmt batteri, og rekkevidden har falt fra rundt 400 km til under 290 km med samme kjøremønster" },
    f_desc: "Instrumentpanelet har tre ganger vist meldingen «Høyvoltsystem: oppsøk verksted». Merkeverkstedet har lest ut feilkoder som peker på en defekt batterimodul",
    ws: "rapport", ws_who: "merke", ws_name: "Volkswagen Sandvika", ws_date: d(9), ws_says: ["bekrefter", "aarsak", "ikke_slitasje"],
    seller_said: "lovet", seller_txt: "Batteriet har full kapasitet",
    f_prior: true, f_prior_date: d(12), f_prior_how: "telefon", f_prior_resp: "de ville se an utviklingen",
    f_docs: ["kontrakt", "verksted", "bilder"],
    k_main: "retting", k_alt: "heving", k_loaner: true, k_exp: true, exp: [{ t: "Feilsøking hos merkeverksted", a: 1890 }, { t: "Leiebil i tre dager", a: 2850 }],
    l_place: "Oslo",
  };
}

// [id, chip label, hint, severity 1–5, the letter's words]
export const IMPACT = [
  ["kosmetisk", "Bare kosmetisk", "Synlig, men påvirker ikke bruken", 1, "feilen er synlig"],
  ["plagsom", "Plagsom", "Lyd, lukt, vibrasjoner eller annet som irriterer", 2, "feilen er plagsom i daglig bruk"],
  ["bruk", "Påvirker bruken", "Du merker det når du kjører, eller må unngå noe", 3, "feilen merkes under kjøring og begrenser hvordan bilen kan brukes"],
  ["palitelig", "Ikke til å stole på", "Svikter av og til, for eksempel ved start eller rekkevidde", 4, "bilen ikke er til å stole på"],
  ["sikkerhet", "Går ut over sikkerheten", "For eksempel bremser, styring eller varsellamper", 4, "feilen går ut over sikkerheten"],
  ["stopp", "Kan ikke brukes", "Den står, eller er ikke trygg å kjøre", 5, "bilen ikke kan brukes"],
] as const;
// «Bare kosmetisk» rules out the other choices.
export const IMPACT_SOLO = "kosmetisk";
export function impactToggle(list: string[], v: string, on: boolean): string[] {
  const out = list.filter((x) => x !== v);
  return on ? (v === IMPACT_SOLO ? [v] : [...out.filter((x) => x !== IMPACT_SOLO), v]) : out;
}
export const KNOWN = [["nei", "Nei"], ["opplyst", "Ble opplyst"], ["synlig", "Lett å se"]] as const;
export const DOCS = [["kontrakt", "Kjøpekontrakt"], ["verksted", "Verkstedrapport"], ["tilstand", "Tilstandsrapport"], ["bilder", "Bilder og video"], ["korr", "Korrespondanse"], ["kvitt", "Kvitteringer"], ["annonse", "Salgsannonse"]] as const;
export const WS_WHO: Record<string, string> = { uavhengig: "et uavhengig verksted", selger: "deres eget verksted", merke: "et merkeverksted" };
export const WS_SAYS: Record<string, string> = {
  bekrefter: "bekrefter feilen",
  aarsak: "angir årsaken til feilen",
  levering: "konkluderer med at feilen har utviklet seg over tid og var til stede ved leveringen",
  ikke_slitasje: "fastslår at feilen ikke skyldes normal slitasje",
  frarader: "fraråder videre bruk av bilen",
  kostnad: "inneholder et kostnadsoverslag for utbedring",
};

const sevOf = (arr: string[]) => Math.max(0, ...arr.map((k) => IMPACT.find((x) => x[0] === k)?.[3] ?? 0));
const drivableOf = (arr: string[]) => (arr.includes("stopp") ? "nei" : arr.includes("palitelig") ? "delvis" : arr.length ? "ja" : "");

// The answers given per area, rolled up for the verdict and the letter (artifact syncAreas).
export function syncAreas(s: Skjema): Skjema {
  const ar = s.f_cats.map((c) => s.f_area[c] ?? { found: "", impact: [], known: "" });
  const founds = ar.map((a) => a.found).filter(Boolean).sort();
  let imp = [...new Set(ar.flatMap((a) => a.impact))];
  if (imp.length > 1) imp = imp.filter((x) => x !== IMPACT_SOLO);
  const kn = ar.map((a) => a.known).filter(Boolean);
  return {
    ...s,
    f_found: founds[0] ?? "",
    f_impact: imp,
    f_known: kn.includes("nei") ? "nei" : kn.includes("synlig") ? "synlig" : (kn[0] ?? ""),
    // The check's answer carries over; a workshop report that rules out wear overrides it.
    f_cause: s.ws === "rapport" && s.ws_says.includes("ikke_slitasje") ? "nei" : s.f_cause_check,
    f_sev: sevOf(imp),
    f_drivable: drivableOf(imp),
  };
}
