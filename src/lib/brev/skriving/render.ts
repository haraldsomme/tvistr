import { brevhode, norskDato, plussDager, SVARFRIST_DAGER, utenSluttegn, type Brev } from "../brev";
import { kontonummerGruppert, type Utfylling } from "../utfylling";
import type { Innsending } from "@/lib/vurdering/innsending";
import { planlegg, type Brevplan } from "./brevplan";
import { lagSaksmodell, type Saksmodell } from "./saksmodell";
import type { Utkast } from "./typer";

// The written letter as it is shown and sent: each mark replaced by its value, computed from the
// letter's own date (the deadline) or taken from the case (the account, the e-mail), and each quote put
// in «» as written. A mark without a value is left as it is, so the check and the page can see it.

export function fyllInn(utkast: Utkast, plan: Brevplan, m: Saksmodell, brevdato: string): string[] {
  const sitater = new Map(utkast.sitater.map((s) => [s.id, s.tekst.trim()]));
  const av = m.utfylling.avsender;
  const verdier = new Map<string, string>([["dato:svarfrist", norskDato(plussDager(brevdato, SVARFRIST_DAGER))]]);
  if (plan.henvisning) verdier.set("henvisning", `(${plan.henvisning.ref}, ${norskDato(plan.henvisning.dato)}, ${plan.henvisning.kildeUrl})`);
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
  return utkast.avsnitt.map((a) => a.setninger.map((s) => setning(s.tekst)).join(" ")).filter(Boolean);
}

export function skrevetBrev(utkast: Utkast, plan: Brevplan, m: Saksmodell, brevdato: string): Brev {
  return { ...brevhode(m.utfylling, brevdato), avsnitt: fyllInn(utkast, plan, m, brevdato) };
}

// The stored letter of a case as it is shown and sent, dated `idag`: null before it is written, or when
// the answers no longer give a letter. The page and the files use this, so they show the same.
export function brevFraSak(sak: { svar: Innsending; utfylling: Utfylling }, idag: string): Brev | null {
  if (!sak.utfylling.brev) return null;
  const lest = lagSaksmodell({ svar: sak.svar, utfylling: sak.utfylling }, idag);
  if (!lest.ok) return null;
  return skrevetBrev(sak.utfylling.brev.utkast, planlegg(lest.modell), lest.modell, idag);
}
