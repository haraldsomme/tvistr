// The letter's practice section (docs/praksis.md), in this order:
//   1. a specific paragraph for each defect in valgt_til_brev (the filter's candidates, at most two);
//   2. when fewer than two came through: for the one defect with a track and no specific paragraph that
//      costs the most, a general paragraph written from the jurist's block and examples;
//   3. when that cannot be supported either: the jurist's block itself, with the buyer's facts.
// Then the amendment sentence once, when a cited decision predates 2024 and the purchase does not.
import type { Modell } from "@/lib/ai/klient";
import { kandidaterForFeil, sammenlign } from "@/lib/sammenligning";
import { avledFeil, avledSak } from "@/lib/sammenligning/avled";
import type { HentKandidater, Spor, VedtakFeil } from "@/lib/sammenligning/typer";
import type { Skjema } from "@/lib/skjema/skjema";
import { brukbar, fastBlokk, PRAKSIS_FAST } from "./fast";
import { lovendring } from "./lovendring";
import { type Kall, skrivPraksis } from "./skriv";
import type { HentFulltekst, Praksis } from "./typer";

export const MAKS_AVSNITT = 2;

export type VedtakRef = { vedtak_id: number; saksnummer: string; vedtaksdato: string; kilde_url: string };
export type Avsnitt = { feil_id: string; modus: "spesifikk" | "generell" | "fast"; avsnitt: string; vedtak: VedtakRef[]; versjon: string };
// One model call and what came of it, for the log and the test run.
export type Forsok = { feil_id: string } & Praksis & { bruker: string | null };
export type Praksisdel = { avsnitt: Avsnitt[]; lovendring: string | null; forsok: Forsok[] };

export type Deps = {
  hentKandidater: HentKandidater;
  hentFulltekst: HentFulltekst;
  hentEksempler: (eksempler: Array<{ vedtak_id: number; feil_id: string }>, spor: Spor) => Promise<VedtakFeil[]>;
  kall?: Kall;
  modell?: Modell;
  // Use the jurist's blocks before they are approved (tests and the test run, never production).
  utkast?: boolean;
};

// A model call that failed (no credit, overload, a refusal) is not an answer: the section fails and the
// buyer is asked to try again, rather than getting the fixed block in place of a paragraph that was never tried.
export class ModellFeil extends Error {}
const sjekkKall = (p: Praksis) => {
  if (p.feil) throw new ModellFeil(p.grunn ?? "modellkallet feilet");
};

const ref = (v: VedtakFeil): VedtakRef => ({ vedtak_id: v.vedtak_id, saksnummer: v.saksnummer, vedtaksdato: v.vedtaksdato, kilde_url: v.kilde_url });

export async function skrivPraksisdel(skjema: Skjema, idag: string, deps: Deps): Promise<Praksisdel> {
  const r = await sammenlign(skjema, deps.hentKandidater, idag);
  if (r.stopp) return { avsnitt: [], lovendring: null, forsok: [] };
  const forsok: Forsok[] = [];
  const skriv = { hentFulltekst: deps.hentFulltekst, kall: deps.kall, modell: deps.modell };

  // 1. Specific paragraphs, in parallel. One decision is cited once.
  const spesifikke = await Promise.all(
    r.valgt_til_brev.map(async (feil_id) => {
      const kandidater = await kandidaterForFeil(skjema, feil_id, deps.hentKandidater, idag);
      const p = await skrivPraksis({ skjema, feil_id, modus: "spesifikk", kandidater, idag }, skriv);
      forsok.push({ feil_id, ...p });
      sjekkKall(p);
      return { feil_id, p, v: kandidater.find((x) => x.vedtak.vedtak_id === p.vedtak_id)?.vedtak ?? null };
    }),
  );
  const brukt = new Set<number>();
  const avsnitt: Avsnitt[] = [];
  const sitert: VedtakFeil[] = [];
  for (const { feil_id, p, v } of spesifikke) {
    if (!p.avsnitt || !v || brukt.has(v.vedtak_id)) continue;
    brukt.add(v.vedtak_id);
    avsnitt.push({ feil_id, modus: "spesifikk", avsnitt: p.avsnitt, vedtak: [ref(v)], versjon: p.versjon });
    sitert.push(v);
  }

  // 2–3. One general paragraph or fixed block, for the costliest defect with a track and no paragraph.
  const sak = avledSak(skjema, idag);
  const uten = r.feil
    .filter((f) => !f.forlik && f.spor_primar && !avsnitt.some((a) => a.feil_id === f.feil_id))
    .map((f) => ({ f, sf: skjema.del3_feil.find((x) => x.id === f.feil_id)! }))
    .sort((a, b) => (b.sf.kostnad_kr ?? 0) - (a.sf.kostnad_kr ?? 0));
  const neste = avsnitt.length < MAKS_AVSNITT ? uten[0] : undefined;
  if (neste) {
    const feil = avledFeil(sak, neste.sf);
    const spor = feil.spor_primar!;
    const blokk = PRAKSIS_FAST[spor];
    if (brukbar(blokk, !!deps.utkast)) {
      const eksempler = await deps.hentEksempler(blokk.eksempler, spor);
      const kandidater = eksempler.map((vedtak) => ({ vedtak, kriterier: [], antall_sterkere: 0, svakhet: null }));
      const p = await skrivPraksis({ skjema, feil_id: feil.feil_id, modus: "generell", kandidater, idag, fast: { tekst: blokk.tekst, spor } }, skriv);
      forsok.push({ feil_id: feil.feil_id, ...p });
      sjekkKall(p);
      if (p.avsnitt) {
        const brukte = eksempler.filter((v) => p.eksempel_vedtak_ids.includes(v.vedtak_id));
        avsnitt.push({ feil_id: feil.feil_id, modus: "generell", avsnitt: p.avsnitt, vedtak: brukte.map(ref), versjon: p.versjon });
        sitert.push(...brukte);
      } else {
        const fast = fastBlokk(sak, feil, !!deps.utkast);
        if (fast) {
          avsnitt.push({ feil_id: feil.feil_id, modus: "fast", avsnitt: fast.tekst, vedtak: fast.eksempler.map((e) => ({ vedtak_id: e.vedtak_id, saksnummer: e.saksnummer, vedtaksdato: e.vedtaksdato, kilde_url: e.kilde_url })), versjon: fast.versjon });
          sitert.push(...eksempler);
        }
      }
    }
  }
  return { avsnitt, lovendring: lovendring(sak.lov, sitert), forsok };
}
