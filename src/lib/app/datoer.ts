// Dates in the writer that cannot all be right: shown in the checklist so the buyer fixes them before
// sending. The letter itself never states a date it has not been given.
import { plussManeder } from "@/lib/brev/tidslinje";
import { HOVEDKATEGORIER } from "@/lib/feil/kategorier";
import { type Feilpost, feilposter } from "./feil";
import type { Skjema } from "./skjema";

// «motor og eksos», or «motor og eksos: turbo» for a subcategory dated on its own.
const navn = (p: Feilpost) => {
  const h = HOVEDKATEGORIER.find((x) => x.id === p.hoved);
  const u = p.felt.startsWith("f_under.") ? h?.under.find((x) => x.id === p.under[0])?.navn : null;
  return (u ? `${h!.navn}: ${u}` : (h?.navn ?? p.hoved)).toLowerCase();
};

export function datoavvik(s: Skjema, idag: string): string[] {
  const ut: string[] = [];
  const funnet = feilposter(s).filter((p) => p.found).map((p) => ({ p, d: p.found }));
  const forste = funnet.map((x) => x.d).sort()[0];
  if (s.c_purchase && s.c_delivery && s.c_purchase > s.c_delivery) ut.push("Kjøpsdatoen er etter overtakelsesdatoen.");
  const fremtid = [
    ["Kjøpsdatoen", s.c_purchase],
    ["Overtakelsesdatoen", s.c_delivery],
    ["Datoen du sa fra", s.f_prior ? s.f_prior_date : ""],
    ...funnet.map((x) => [`Datoen feilen (${navn(x.p)}) ble oppdaget`, x.d]),
  ].filter(([, d]) => d && d > idag);
  for (const [hva] of fremtid) ut.push(`${hva} er frem i tid.`);
  for (const x of funnet) if (s.c_delivery && x.d < s.c_delivery) ut.push(`Feilen (${navn(x.p)}) er oppdaget før du overtok bilen.`);
  if (s.f_prior && s.f_prior_date && forste && s.f_prior_date < forste) ut.push("Du har oppgitt at du sa fra før du oppdaget feilen.");
  if (s.f_prior && s.f_prior_date && s.l_date && s.l_date < s.f_prior_date) ut.push("Brevet er datert før du sa fra første gang.");
  const levert = s.c_delivery || s.c_purchase;
  const reklamert = (s.f_prior && s.f_prior_date) || s.l_date;
  if (levert && reklamert && reklamert > plussManeder(levert, 60)) ut.push("Det er mer enn fem år siden du overtok bilen. Fristen for å reklamere kan være ute.");
  return ut;
}
