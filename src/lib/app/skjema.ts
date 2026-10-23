// The letter writer's answers (the artifact's `S`), their defaults, the sample case, and the fixed
// lists the form and the letter share. Text fields are strings, "" when empty.
import { addDays, iso, parseD } from "./dato";

export type Omrade = { found: string };
export type Utgift = { t: string; a: number };

export type Skjema = {
  b_name: string; b_addr: string; b_zip: string; b_city: string; b_phone: string; b_email: string;
  d_name: string; d_org: string; d_addr: string; d_zip: string; d_city: string;
  c_make: string; c_model: string; c_year: string; c_reg: string;
  // The purchase date only when it is not the handover date (it decides the law version).
  c_purchase: string; c_delivery: string; c_price: string; c_km: string; c_asis: boolean; c_lastreg: string;
  // Past five years from the handover: the buyer says the dealer held something back, or a warranty
  // gives a longer limit (fkjl. § 27). Without it the verdict stops at «frist».
  c_unntak: boolean;
  // Fault areas are Tvistr's main categories, the parts their subcategories (src/lib/feil/kategorier.ts).
  f_cats: string[]; f_parts: Record<string, string[]>; f_area: Record<string, Omrade>; f_catdesc: Record<string, string>;
  // How the faults affect the buyer, once for all of them (IMPACT).
  f_impact: string[];
  f_docs: string[];
  // Derived by syncAreas.
  f_found: string; f_sev: number; f_drivable: string;
  ws: string; ws_name: string; ws_says: string[]; ws_quote: string;
  seller_said: string; seller_txt: string;
  f_prior: boolean; f_prior_date: string;
  // What the seller answered, as SVAR ids: each common objection gets its answer in the letter.
  f_prior_svar: string[];
  k_main: string; k_alt: string; k_amount: string; k_exp: boolean; exp: Utgift[];
  // Optional, for whether the seller may still repair and that the defect is not insignificant: how many
  // times the seller has tried to repair («0», «1», «2+»; older cases «2», «3+»; "" when not answered)
  // and the estimated repair cost (asked for heving).
  k_forsok: string; k_cost: string;
  // The letter's date, set when the case is bought.
  l_date: string;
  prec_id: number | null;
  // The buyer picked the decision themselves instead of following the recommendation.
  prec_selv: boolean;
};

export const standard = (idag: string): Skjema => ({
  b_name: "", b_addr: "", b_zip: "", b_city: "", b_phone: "", b_email: "",
  d_name: "", d_org: "", d_addr: "", d_zip: "", d_city: "",
  c_make: "", c_model: "", c_year: "", c_reg: "", c_purchase: "", c_delivery: "", c_price: "", c_km: "", c_asis: false, c_lastreg: "", c_unntak: false,
  f_cats: [], f_parts: {}, f_area: {}, f_catdesc: {}, f_impact: [], f_docs: [],
  f_found: "", f_sev: 0, f_drivable: "",
  ws: "", ws_name: "", ws_says: [], ws_quote: "", seller_said: "", seller_txt: "",
  f_prior: false, f_prior_date: "", f_prior_svar: [],
  k_main: "", k_alt: "ingen", k_amount: "", k_exp: false, exp: [], k_forsok: "", k_cost: "",
  l_date: idag, prec_id: null, prec_selv: false,
});

export function eksempel(idag: string): Skjema {
  const t = parseD(idag)!;
  const d = (n: number) => iso(addDays(t, -n));
  return {
    ...standard(idag),
    b_name: "Kari Nordmann", b_addr: "Storgata 12", b_zip: "0155", b_city: "Oslo", b_phone: "912 34 567", b_email: "kari.nordmann@eksempel.no",
    d_name: "Bilhuset Vest AS", d_org: "923 456 783", d_addr: "Industriveien 4", d_zip: "1337", d_city: "Sandvika",
    c_make: "Volkswagen", c_model: "ID.4", c_year: "2022", c_reg: "EL 48213",
    c_purchase: d(118), c_delivery: d(114), c_price: "329 900", c_km: "38 500",
    f_cats: ["hoyvolt"], f_parts: { hoyvolt: ["kapasitet", "lading"] },
    f_area: { hoyvolt: { found: d(16) } },
    f_catdesc: { hoyvolt: "Bilen lader ikke raskere enn 40 kW på hurtiglader, selv med varmt batteri, og rekkevidden har falt fra rundt 400 km til under 290 km med samme kjøremønster. Instrumentpanelet har tre ganger vist meldingen «Høyvoltsystem: oppsøk verksted»" },
    f_impact: ["palitelig", "bruk"],
    ws: "rapport", ws_name: "Volkswagen Sandvika", ws_says: ["bekrefter", "aarsak", "ikke_slitasje"],
    seller_said: "lovet", seller_txt: "Batteriet har full kapasitet",
    f_prior: true, f_prior_date: d(12), f_prior_svar: ["se_an"],
    f_docs: ["kontrakt", "verksted", "bilder"],
    k_main: "retting", k_alt: "heving", k_exp: true, exp: [{ t: "Feilsøking hos merkeverksted", a: 1890 }, { t: "Leiebil i tre dager", a: 2850 }],
  };
}

// [id, chip label, hint, severity 1–5, the letter's words after «Feilen»]
export const IMPACT = [
  ["kosmetisk", "Bare kosmetisk", "Synlig, men påvirker ikke bruken", 1, "er synlig"],
  ["plagsom", "Plagsom", "Lyd, lukt, vibrasjoner eller annet som irriterer", 2, "er plagsom i daglig bruk"],
  ["bruk", "Påvirker bruken", "Du merker det når du kjører, eller må unngå noe", 3, "merkes under kjøring og begrenser hvordan bilen kan brukes"],
  ["palitelig", "Ikke til å stole på", "Svikter av og til, for eksempel ved start eller rekkevidde", 4, "gjør at bilen bare kan brukes i begrenset grad, og at jeg ikke kan stole på den i vanlig bruk"],
  ["sikkerhet", "Går ut over sikkerheten", "For eksempel bremser, styring eller varsellamper", 4, "går ut over sikkerheten"],
  ["stopp", "Kan ikke brukes", "Den står, eller er ikke trygg å kjøre", 5, "gjør at bilen ikke kan brukes"],
] as const;
// «Bare kosmetisk» rules out the other choices.
export const IMPACT_SOLO = "kosmetisk";
export function impactToggle(list: string[], v: string, on: boolean): string[] {
  const out = list.filter((x) => x !== v);
  return on ? (v === IMPACT_SOLO ? [v] : [...out.filter((x) => x !== IMPACT_SOLO), v]) : out;
}
export const DOCS = [["kontrakt", "Kjøpekontrakt"], ["verksted", "Verkstedrapport"], ["tilstand", "Tilstandsrapport"], ["bilder", "Bilder og video"], ["korr", "Korrespondanse"], ["kvitt", "Kvitteringer for utgifter"], ["annonse", "Salgsannonse"]] as const;
// The documents the buyer ticks: the workshop report only when they have one (ticked when they say so,
// see Verksted), the receipts are listed from the expense claim (vedlegg).
export const docsValg = (s: Skjema) => DOCS.filter(([id]) => id !== "kvitt" && (id !== "verksted" || s.ws === "rapport"));
// The letter says the report «følger vedlagt» only when the buyer has one and ticked it.
export const rapportVedlagt = (s: Skjema) => s.ws === "rapport" && s.f_docs.includes("verksted");
// The attachments, in the form's order, and the receipts behind an expense claim (Forbrukerrådet: keep
// the receipts).
export function vedlegg(s: Skjema): string[] {
  const ids = new Set(s.f_docs);
  if (!rapportVedlagt(s)) ids.delete("verksted");
  if (s.k_exp && s.exp.some((x) => x.t || x.a)) ids.add("kvitt");
  return DOCS.filter(([id]) => ids.has(id)).map(([, navn]) => navn);
}
// The seller's answer to an earlier complaint: [id, chip label, the letter's words after «svarte dere
// at»; «avvist» is written «avviste dere reklamasjonen»]. The common objections follow Forbrukerrådet's klageguide («Vanlige spørsmål og svar»);
// brev.ts answers each with the law (svarPaInnvendinger).
export const SVAR = [
  ["slitasje", "Slitasje eller feil bruk", "feilen skyldes slitasje eller feil bruk"],
  ["produsent", "Ta det med produsent, importør eller garanti", "jeg måtte ta saken med produsenten, importøren eller garantien"],
  ["betaling", "Reparasjon mot betaling", "feilen kunne repareres mot betaling"],
  ["garanti_ute", "Garantien er utløpt", "garantien er utløpt"],
  ["for_sent", "Klagen kom for sent", "reklamasjonen kom for sent"],
  ["som_den_er", "Bilen ble solgt «som den er»", "bilen ble solgt «som den er»"],
  ["avvist", "Avviste uten begrunnelse", "reklamasjonen ble avvist"],
  ["se_an", "Ville se an", "dere ville se an utviklingen"],
] as const;
// The dealer has not answered: rules out the answers in SVAR, and the letter says so.
export const IKKE_SVART = "ikke_svart";
export function svarToggle(list: string[], v: string, on: boolean): string[] {
  const out = list.filter((x) => x !== v);
  return on ? (v === IKKE_SVART ? [v] : [...out.filter((x) => x !== IKKE_SVART), v]) : out;
}
export const WS_SAYS: Record<string, string> = {
  bekrefter: "bekrefter feilen",
  aarsak: "angir årsaken til feilen",
  levering: "konkluderer med at feilen har utviklet seg over tid og var til stede ved leveringen",
  ikke_slitasje: "fastslår at feilen ikke skyldes normal slitasje",
  frarader: "fraråder videre bruk av bilen",
  kostnad: "inneholder et kostnadsoverslag for utbedring",
};
// What a workshop said without a report, after «Verkstedet har»; `opplyst` are joined after «opplyst meg om».
export const WS_SAGT: Record<string, { gjort?: string; opplyst?: string }> = {
  bekrefter: { gjort: "bekreftet feilen" },
  aarsak: { gjort: "funnet årsaken til den" },
  levering: { opplyst: "at feilen har utviklet seg over tid og var til stede ved leveringen" },
  ikke_slitasje: { opplyst: "at feilen ikke skyldes normal slitasje" },
  frarader: { gjort: "frarådet videre bruk av bilen" },
};

const sevOf = (arr: string[]) => Math.max(0, ...arr.map((k) => IMPACT.find((x) => x[0] === k)?.[3] ?? 0));
const drivableOf = (arr: string[]) => (arr.includes("stopp") ? "nei" : arr.includes("palitelig") ? "delvis" : arr.length ? "ja" : "");

// The first discovery and what the impact means, for the verdict and the letter (artifact syncAreas).
export function syncAreas(s: Skjema): Skjema {
  const founds = s.f_cats.map((c) => s.f_area[c]?.found).filter((d): d is string => !!d).sort();
  return { ...s, f_found: founds[0] ?? "", f_sev: sevOf(s.f_impact), f_drivable: drivableOf(s.f_impact) };
}
