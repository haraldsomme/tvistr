// The writer's four form steps, the fields each needs, and what is missing (rail, checklist).
import type { Skjema } from "@/lib/app/skjema";

type Nokkel = keyof Skjema | "f_any_desc";

export const STEG: { navn: string; kort: string; felt: Nokkel[] }[] = [
  { navn: "Partene", kort: "Partene", felt: ["b_name", "b_addr", "b_zip", "b_city", "b_phone", "b_email", "d_name", "d_org", "d_addr", "d_zip", "d_city"] },
  { navn: "Bilen", kort: "Bilen", felt: ["c_make", "c_model", "c_year", "c_reg", "c_purchase", "c_delivery", "c_price", "c_km"] },
  { navn: "Mangelen", kort: "Feilen", felt: ["f_cats", "f_found", "f_any_desc", "f_impact", "ws"] },
  { navn: "Krav", kort: "Krav", felt: ["k_main", "k_days"] },
];
export const ETIKETT: Record<string, string> = {
  b_name: "Navn", b_addr: "Adresse", b_zip: "Postnr.", b_city: "Poststed", b_phone: "Telefon", b_email: "E-post",
  d_name: "Firmanavn", d_org: "Org.nr.", d_addr: "Adresse", d_zip: "Postnr.", d_city: "Poststed",
  c_make: "Merke", c_model: "Modell", c_year: "Årsmodell", c_reg: "Reg.nr.", c_purchase: "Kjøpsdato", c_delivery: "Overtakelsesdato", c_price: "Kjøpesum", c_km: "Km-stand",
  f_cats: "Deler", f_found: "Dato oppdaget", f_any_desc: "Beskrivelse av feilen", f_impact: "Hvordan feilen påvirker deg", ws: "Verkstedundersøkelse", k_main: "Hovedkrav", k_days: "Svarfrist",
};

export function har(s: Skjema, k: Nokkel): boolean {
  if (k === "f_any_desc") return !!s.f_desc.trim() || s.f_cats.some((c) => (s.f_catdesc[c] ?? "").trim());
  const v = s[k];
  return Array.isArray(v) ? v.length > 0 : typeof v === "string" ? v.trim() !== "" : v !== false && v !== null && v !== undefined;
}
// The steps with what is missing in each, for the checklist in Brevet.
export const mangler = (s: Skjema) => STEG.map((st, i) => ({ i, navn: st.navn, felt: st.felt.filter((k) => !har(s, k)) })).filter((x) => x.felt.length);
