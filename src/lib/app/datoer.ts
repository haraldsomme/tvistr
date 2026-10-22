// Dates in the writer that cannot all be right: shown in the checklist so the buyer fixes them before
// sending. The letter itself never states a date it has not been given.
import { plussManeder } from "@/lib/brev/tidslinje";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import type { Skjema } from "./skjema";

const navn = (c: string) => HOVEDKATEGORIER.find((h) => h.id === c)?.navn ?? c;

export function datoavvik(s: Skjema, idag: string): string[] {
  const ut: string[] = [];
  const funnet = s.f_cats.map((c) => ({ c, d: s.f_area[c]?.found ?? "" })).filter((x) => x.d);
  const forste = funnet.map((x) => x.d).sort()[0];
  if (s.c_purchase && s.c_delivery && s.c_purchase > s.c_delivery) ut.push("Kjøpsdatoen er etter overtakelsesdatoen.");
  const fremtid = [
    ["Kjøpsdatoen", s.c_purchase],
    ["Overtakelsesdatoen", s.c_delivery],
    ["Datoen du sa fra", s.f_prior ? s.f_prior_date : ""],
    ...funnet.map((x) => [`Datoen feilen (${navn(x.c).toLowerCase()}) ble oppdaget`, x.d]),
  ].filter(([, d]) => d && d > idag);
  for (const [hva] of fremtid) ut.push(`${hva} er frem i tid.`);
  for (const x of funnet) if (s.c_delivery && x.d < s.c_delivery) ut.push(`Feilen (${navn(x.c).toLowerCase()}) er oppdaget før du overtok bilen.`);
  if (s.f_prior && s.f_prior_date && forste && s.f_prior_date < forste) ut.push("Du har oppgitt at du sa fra før du oppdaget feilen.");
  if (s.f_prior && s.f_prior_date && s.l_date && s.l_date < s.f_prior_date) ut.push("Brevet er datert før du sa fra første gang.");
  const levert = s.c_delivery || s.c_purchase;
  const reklamert = (s.f_prior && s.f_prior_date) || s.l_date;
  if (levert && reklamert && reklamert > plussManeder(levert, 60)) ut.push("Det er mer enn fem år siden du overtok bilen. Fristen for å reklamere kan være ute.");
  return ut;
}
