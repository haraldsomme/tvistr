// The form's sections: those answered before payment (FOR, they shape the letter's content) and after
// (ETTER: sender, recipient and the letter's settings), the fields each needs, and what is missing.
import type { Skjema } from "@/lib/app/skjema";
import { feilposter, virkningFor } from "@/lib/app/feil";

type Nokkel = keyof Skjema | "f_any_desc";
// `navn` names the section in lists, `tittel` and `hint` ask it: the question before payment
// (sporsmal.ts) and the open row after (svarene.tsx) share them.
export type Seksjon = { id: string; navn: string; tittel: string; hint?: string; felt: Nokkel[] };

export const FOR: Seksjon[] = [
  { id: "bilen", navn: "Bilen", tittel: "Hvilken bil gjelder det?", hint: "Vi henter merke, modell og når bilen sist ble registrert.", felt: ["c_make", "c_model", "c_year", "c_reg", "c_km"] },
  { id: "kjopet", navn: "Kjøpet", tittel: "Kjøpet", hint: "Hent opplysningene fra kjøpekontrakten. Kjøpsdatoen er utgangspunktet for alle fristene.", felt: ["c_delivery", "c_price"] },
  { id: "feilen", navn: "Feilen", tittel: "Hva gjelder reklamasjonen?", hint: "Velg alle områdene der du har funnet feil. Du kan velge flere.", felt: ["f_cats"] },
  { id: "omrader", navn: "Om feilen", tittel: "Hva er feil med bilen?", hint: "Vær konkret og hold deg til fakta. En presis beskrivelse gjør det vanskeligere å avvise saken.", felt: ["f_found", "f_any_desc"] },
  { id: "virkning", navn: "Hvordan feilen påvirker deg", tittel: "Hvordan påvirker feilene deg?", hint: "Velg alt som passer for hver feil. Er en feil bare kosmetisk, velger du det, og eventuelt at bilen er mindre verdt.", felt: ["f_virkning"] },
  { id: "verksted", navn: "Verksted", tittel: "Er feilen undersøkt av et verksted?", hint: "En verkstedrapport gjør saken mye sterkere. Alt du krysser av for, føres opp i brevet.", felt: ["ws"] },
  { id: "selger_sa", navn: "Hva selgeren sa", tittel: "Sa selger noe om denne feilen før kjøpet?", hint: "For eksempel i annonsen, kontrakten eller en melding.", felt: ["seller_said"] },
  // No hint: the switch's own text says the date counts.
  { id: "sagt_fra", navn: "Sagt fra før", tittel: "Har du sagt fra til forhandleren?", felt: [] },
  {
    id: "kravet",
    navn: "Kravet",
    tittel: "Hva krever du?",
    hint: "Forhandleren har normalt rett til å forsøke å rette feilen først. Prisavslag og heving blir aktuelt når retting ikke skjer, ikke lykkes eller ikke er mulig.",
    felt: ["k_main"],
  },
];
export const ETTER: Seksjon[] = [
  { id: "deg", navn: "Deg", tittel: "Deg", hint: "Du er avsender av brevet.", felt: ["b_name", "b_addr", "b_zip", "b_city", "b_phone", "b_email"] },
  { id: "forhandleren", navn: "Forhandleren", tittel: "Forhandleren", hint: "Brevet går til forhandleren du kjøpte bilen av, også når feilen kommer fra fabrikken.", felt: ["d_name", "d_org", "d_addr", "d_zip", "d_city"] },
  { id: "brevet", navn: "Vedlegg", tittel: "Hva legger du ved brevet?", hint: "Verkstedrapporten er krysset av når du har en. Fjern krysset hvis du ikke legger den ved. Kvitteringene for utgiftene føres opp av seg selv.", felt: [] },
];
// All sections in the letter's order: sender and recipient, the content, then the letter's settings.
export const ALLE: Seksjon[] = [...ETTER.slice(0, 2), ...FOR, ...ETTER.slice(2)];
export const seksjon = (id: string): Seksjon => ALLE.find((s) => s.id === id)!;

export const ETIKETT: Record<string, string> = {
  b_name: "Navn", b_addr: "Adresse", b_zip: "Postnr.", b_city: "Poststed", b_phone: "Telefon", b_email: "E-post",
  d_name: "Firmanavn", d_org: "Org.nr.", d_addr: "Adresse", d_zip: "Postnr.", d_city: "Poststed",
  c_make: "Merke", c_model: "Modell", c_year: "Årsmodell", c_reg: "Reg.nr.", c_purchase: "Kjøpsdato", c_delivery: "Kjøpsdato", c_price: "Kjøpesum", c_km: "Km-stand",
  f_cats: "Deler", f_found: "Dato oppdaget", f_any_desc: "Beskrivelse av feilen", f_virkning: "Hvordan feilen påvirker deg", ws: "Verkstedundersøkelse", seller_said: "Hva selger sa før kjøpet", k_main: "Hovedkrav", k_forsok: "Rettingsforsøk", k_cost: "Utbedringskostnad",
};

export function har(s: Skjema, k: Nokkel): boolean {
  if (k === "f_any_desc") return feilposter(s).some((p) => p.desc);
  if (k === "f_virkning") {
    const p = feilposter(s);
    return p.length ? p.every((x) => virkningFor(s, x).length > 0) : s.f_impact.length > 0;
  }
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
  [/^f_docs$/, "brevet"],
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
  [/^Slik gikk lignende saker|slitasje$|^Årsaken er ikke funnet/, "verksted"],
  [/^Forhandleren har ikke klart|^Ett rettingsforsøk/, "kravet"],
  [/^Brevet svarer på|^Forhandleren mener/, "sagt_fra"],
  [/^Forbrukerkjøpsloven gjelder/, "forhandleren"],
  [/verksted|rapport/i, "verksted"],
  [/^Du sa fra|^Du har sagt fra|^Du er i tide|^Det har gått mer enn to måneder/, "sagt_fra"],
  [/[Ss]elger/, "selger_sa"],
  [/^Alvorlig feil|^Kosmetisk feil/, "virkning"],
  [/som den er|^Fristen|^Datoene|^Sjekk datoene|^Mer enn .* etter overtakelsen|før overtakelsen/, "kjopet"],
];
export const stegFor = (tittel: string) => STEG_FOR.find(([re]) => re.test(tittel))?.[1] ?? "omrader";
