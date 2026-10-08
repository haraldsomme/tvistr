import { brevhode, norskDato, plussDager, SVARFRIST_DAGER, utenSluttegn, type Brev, type Brevdel } from "../brev";
import { kontonummerGruppert, type Utfylling } from "../utfylling";
import type { Innsending } from "@/lib/vurdering/innsending";
import { delFor, DELER, OVERSKRIFT, planlegg, type Brevplan, type Del } from "./brevplan";
import { lagSaksmodell, type Saksmodell } from "./saksmodell";
import type { Utkast } from "./typer";

// The written letter as it is shown and sent: each mark replaced by its value, computed from the
// letter's own date (the deadline) or taken from the case (the account, the e-mail), and each quote put
// in «» as written. A mark without a value is left as it is, so the check and the page can see it. The
// paragraphs are grouped in the letter's parts by the arguments they cover (`DEL_FOR_ARGUMENT`); a
// paragraph without arguments stays in the part before it, and a part never comes back after a later
// one, so an older letter that mixes them still gets each heading once. The link to the cited decision
// stands on a line of its own under «Vedlegg».

export function fyllInn(utkast: Utkast, plan: Brevplan, m: Saksmodell, brevdato: string): Brevdel[] {
  const sitater = new Map(utkast.sitater.map((s) => [s.id, s.tekst.trim()]));
  const av = m.utfylling.avsender;
  const verdier = new Map<string, string>([["dato:svarfrist", norskDato(plussDager(brevdato, SVARFRIST_DAGER))]]);
  if (plan.henvisning) verdier.set("henvisning", `${plan.henvisning.ref} av ${norskDato(plan.henvisning.dato)}`);
  if (av?.kontonummer) verdier.set("kontonummer", kontonummerGruppert(av.kontonummer));
  if (av?.epost) verdier.set("epost", av.epost);
  const fyll = (t: string) =>
    t.replace(/\{\{([^{}]+)\}\}/g, (hel, navn: string) => {
      if (!navn.startsWith("sitat:")) return verdier.get(navn) ?? hel;
      const sitat = sitater.get(navn.slice("sitat:".length));
      return sitat === undefined ? hel : `«${utenSluttegn(sitat)}»`;
    });
  // A quote loses its own end mark; when it ends the sentence, the sentence gets one.
  const setning = (t: string) => {
    const fylt = fyll(t.trim());
    return fylt.endsWith("»") ? `${fylt}.` : fylt;
  };
  const deler: (Brevdel & { del: Del })[] = [];
  const legg = (del: Del, tekst: string) => {
    const siste = deler.at(-1);
    if (siste?.del === del) siste.avsnitt.push(tekst);
    else deler.push({ del, overskrift: OVERSKRIFT[del], avsnitt: [tekst] });
  };
  let gjeldende = 0;
  for (const a of utkast.avsnitt) {
    const tekst = a.setninger.map((s) => setning(s.tekst)).join(" ");
    if (!tekst) continue;
    const del = delFor(a.setninger.flatMap((s) => s.argumenter));
    if (del) gjeldende = Math.max(gjeldende, DELER.indexOf(del));
    legg(DELER[gjeldende], tekst);
  }
  if (plan.henvisning) legg("vedlegg", `Vedtaket ${plan.henvisning.ref} er tilgjengelig på ${plan.henvisning.kildeUrl}.`);
  return deler.map(({ overskrift, avsnitt }) => ({ overskrift, avsnitt }));
}

// The letter body as plain text, for the reviewer and the eval judge: each heading on a line of its own.
export const brevTekst = (deler: Brevdel[]) => deler.map((d) => [d.overskrift, ...d.avsnitt].filter(Boolean).join("\n\n")).join("\n\n");

export function skrevetBrev(utkast: Utkast, plan: Brevplan, m: Saksmodell, brevdato: string): Brev {
  return { ...brevhode(m.utfylling, brevdato), deler: fyllInn(utkast, plan, m, brevdato) };
}

// The stored letter of a case as it is shown and sent, dated `idag`: null before it is written, or when
// the answers no longer give a letter. The page and the files use this, so they show the same.
export function brevFraSak(sak: { svar: Innsending; utfylling: Utfylling }, idag: string): Brev | null {
  if (!sak.utfylling.brev) return null;
  const lest = lagSaksmodell({ svar: sak.svar, utfylling: sak.utfylling }, idag);
  if (!lest.ok) return null;
  return skrevetBrev(sak.utfylling.brev.utkast, planlegg(lest.modell), lest.modell, idag);
}
