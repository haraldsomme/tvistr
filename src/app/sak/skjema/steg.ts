// The form's sections: those answered before payment (FOR, they shape the letter's content) and after
// (ETTER: sender, recipient and the letter's settings), the fields each needs, and what is missing.
import type { Skjema } from "@/lib/app/skjema";

type Nokkel = keyof Skjema | "f_any_desc";
export type Seksjon = { id: string; navn: string; felt: Nokkel[] };

export const FOR: Seksjon[] = [
  { id: "bilen", navn: "Bilen", felt: ["c_make", "c_model", "c_year", "c_reg", "c_km"] },
  { id: "kjopet", navn: "Kjøpet", felt: ["c_purchase", "c_delivery", "c_price"] },
  { id: "feilen", navn: "Feilen", felt: ["f_cats"] },
  { id: "omrader", navn: "Om feilen", felt: ["f_found", "f_any_desc", "f_impact"] },
  { id: "verksted", navn: "Verksted", felt: ["ws"] },
  { id: "selger_sa", navn: "Hva selgeren sa", felt: ["seller_said"] },
  { id: "sagt_fra", navn: "Sagt fra før", felt: [] },
  { id: "kravet", navn: "Kravet", felt: ["k_main"] },
];
export const ETTER: Seksjon[] = [
  { id: "deg", navn: "Deg", felt: ["b_name", "b_addr", "b_zip", "b_city", "b_phone", "b_email"] },
  { id: "forhandleren", navn: "Forhandleren", felt: ["d_name", "d_org", "d_addr", "d_zip", "d_city"] },
  { id: "brevet", navn: "Brevet", felt: ["k_days"] },
];
// All sections in the letter's order: sender and recipient, the content, then the letter's settings.
export const ALLE: Seksjon[] = [...ETTER.slice(0, 2), ...FOR, ...ETTER.slice(2)];

export const ETIKETT: Record<string, string> = {
  b_name: "Navn", b_addr: "Adresse", b_zip: "Postnr.", b_city: "Poststed", b_phone: "Telefon", b_email: "E-post",
  d_name: "Firmanavn", d_org: "Org.nr.", d_addr: "Adresse", d_zip: "Postnr.", d_city: "Poststed",
  c_make: "Merke", c_model: "Modell", c_year: "Årsmodell", c_reg: "Reg.nr.", c_purchase: "Kjøpsdato", c_delivery: "Overtakelsesdato", c_price: "Kjøpesum", c_km: "Km-stand",
  f_cats: "Deler", f_found: "Dato oppdaget", f_any_desc: "Beskrivelse av feilen", f_impact: "Hvordan feilen påvirker deg", ws: "Verkstedundersøkelse", seller_said: "Hva selger sa før kjøpet", k_main: "Hovedkrav", k_days: "Svarfrist", k_forsok: "Rettingsforsøk", k_cost: "Utbedringskostnad",
};

export function har(s: Skjema, k: Nokkel): boolean {
  if (k === "f_any_desc") return !!s.f_desc.trim() || s.f_cats.some((c) => (s.f_catdesc[c] ?? "").trim());
  const v = s[k];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== false && v !== null && v !== undefined;
}
// The sections with what is missing in each, for the checklist.
export const mangler = (s: Skjema) => ALLE.map((st) => ({ id: st.id, navn: st.navn, felt: st.felt.filter((k) => !har(s, k)) })).filter((x) => x.felt.length);

// The fields no section counts, by prefix, for the section that edits them.
const ANDRE: [RegExp, string][] = [
  [/^b_/, "deg"],
  [/^d_/, "forhandleren"],
  [/^c_lastreg$/, "bilen"],
  [/^c_/, "kjopet"],
  [/^f_parts$/, "feilen"],
  [/^f_prior/, "sagt_fra"],
  [/^(f_docs|files)$/, "brevet"],
  [/^f_/, "omrader"],
  [/^ws/, "verksted"],
  [/^seller/, "selger_sa"],
  [/^(k_|exp$)/, "kravet"],
];
// The section that edits a field, from its key or a letter tag such as `f_catdesc.motor` or `exp.0`.
export function seksjonFor(felt: string): string {
  const k = felt.split(".")[0];
  return ALLE.find((st) => (st.felt as string[]).includes(k))?.id ?? ANDRE.find(([re]) => re.test(k))?.[1] ?? "brevet";
}

// The section whose answers a verdict row turns on, for its «Endre» link. The rest are about the
// answers per fault area.
const STEG_FOR: [RegExp, string][] = [
  [/^Forbrukerkjøpsloven gjelder/, "forhandleren"],
  [/verksted|rapport/i, "verksted"],
  [/^Du sa fra|^Du har sagt fra|^Du er i tide|^Det har gått mer enn to måneder/, "sagt_fra"],
  [/[Ss]elger/, "selger_sa"],
  [/som den er|^Fristen|^Datoene|^Sjekk datoene|^Mer enn .* etter overtakelsen|før overtakelsen/, "kjopet"],
];
export const stegFor = (tittel: string) => STEG_FOR.find(([re]) => re.test(tittel))?.[1] ?? "omrader";
