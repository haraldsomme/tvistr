// The general paragraph (decided 2026-10-10): when a defect has a track but no won decision the
// buyer's case is at least as strong as (the EV battery on C), the letter states the rule the
// committee applies, with two decisions as examples OF THE RULE, not as comparisons, the buyer's own
// facts, and an answer to the most common reason such cases are lost when the form shows the buyer
// has it. No «minst like sterkt» (there is no one to be stronger than) and never a number from the
// index. Only C and B: on A the information-group fallback covers it.
import { datoLang } from "./fraser";
import { velgSitat } from "./argumenter";
import type { FeilProfil, Sak, Spor, VedtakFeil } from "./typer";

// Won decisions on the track, from 2021 on, counted across categories. Below this there is no
// general paragraph, and the examples come from these.
export const MIN_PRAKSIS = 20;
export const GENERELLE_SPOR: Spor[] = ["C", "B"];

// A loss for want of something the user's report has, is no loss on the user's facts (also used for
// the contradicting loss in index.ts).
export const BESVART: Record<string, (sak: Sak, f: FeilProfil) => boolean> = {
  paregnelig_slitasje: (_, f) => f.rapport_paregnelig,
  ikke_dokumentert: (_, f) => f.rapport_ok,
  ikke_sannsynliggjort_ved_levering: (_, f) => f.rapport_levering,
  oppstatt_etter_levering: (_, f) => f.rapport_levering,
  forbehold: (sak) => sak.uten_forbehold === true,
};

// The objection and the answer the user's own facts give, per ground of loss.
const SVAR: Record<string, string> = {
  paregnelig_slitasje:
    "Den vanligste innvendingen i slike saker er at feilen er vanlig slitasje. Verkstedet har vurdert nettopp det, og konkludert med at feilen går ut over det som er påregnelig for bilens alder og kjørelengde.",
  ikke_dokumentert: "Den vanligste innvendingen i slike saker er at feilen ikke er dokumentert. Feilen i min sak er dokumentert skriftlig av verkstedet.",
  ikke_sannsynliggjort_ved_levering:
    "Den vanligste innvendingen i slike saker er at det ikke er vist at feilen var der ved leveringen. Verkstedet har konkludert med at den var der da jeg overtok bilen.",
  oppstatt_etter_levering:
    "Den vanligste innvendingen i slike saker er at feilen oppsto etter leveringen. Verkstedet har konkludert med at den var der da jeg overtok bilen.",
  forbehold: "Den vanligste innvendingen i slike saker er et forbehold i kontrakten. Min bil ble solgt uten forbehold.",
};

// On C the paragraph states the rule as «documented beyond the expected AND there at delivery», so an
// example must have an expert statement from the buyer that says both; a decision won on C needs only
// the first (FKU-2026-77525 and 66298 each had one half).
const SAKKYNDIGE = ["verkstedrapport", "NAF_test", "takst", "sakkyndig_uttalelse", "tilstandsrapport"];
const visesRegelen = (v: VedtakFeil) =>
  v.spor !== "C" ||
  v.bevis.some(
    (b) =>
      b.fremlagt_av === "klager" &&
      SAKKYNDIGE.includes(b.type) &&
      b.paregnelig === "utover" &&
      b.ved_levering === "ja" &&
      (b.gjelder_feil.length === 0 || b.gjelder_feil.includes(v.feil_id)),
  );

// The two newest won decisions on the track that show the rule as stated, with a quote the letter
// could use (whole sentence, verified), from the counted ones.
// Two different decisions: one decision can have several won defects (FKU-2026-11234).
export function eksempler(vunne: VedtakFeil[]): VedtakFeil[] {
  const ut: VedtakFeil[] = [];
  for (const v of vunne) {
    if (ut.length === 2) break;
    if (visesRegelen(v) && velgSitat(v) != null && !ut.some((x) => x.vedtak_id === v.vedtak_id)) ut.push(v);
  }
  return ut;
}

// The most common ground among the losses on the track, and only if the user's form answers it.
function besvartInnvending(sak: Sak, f: FeilProfil, tapte: VedtakFeil[]): string | null {
  const telling = new Map<string, number>();
  for (const v of tapte) if (v.grunn) telling.set(v.grunn, (telling.get(v.grunn) ?? 0) + 1);
  const vanligst = [...telling].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];
  return vanligst && BESVART[vanligst]?.(sak, f) && SVAR[vanligst] ? SVAR[vanligst] : null;
}

// The workshop's own words: a stub completion («varmepumpekompressor er defekt …») reads after «at»,
// anything else is quoted as the buyer copied it.
function verkstedetSkriver(t: string): string {
  const s = t.trim().replace(/[.\s]+$/, "");
  return /^[a-zæøå]/.test(s) ? `Verkstedet skriver at ${s}.` : `Verkstedet skriver: «${s}».`;
}

const se = (x: VedtakFeil[]) => `se for eksempel ${x.map((v) => `vedtak ${v.saksnummer} av ${datoLang(v.vedtaksdato)}`).join(" og ")}`;

export function generelltAvsnitt(sak: Sak, f: FeilProfil, spor: Spor, vunne: VedtakFeil[], tapte: VedtakFeil[]): string | null {
  if (vunne.length < MIN_PRAKSIS) return null;
  const eks = eksempler(vunne);
  if (eks.length < 2) return null;
  const svar = besvartInnvending(sak, f, tapte);
  if (spor === "C") {
    if (!f.rapport_paregnelig || !f.rapport_levering) return null;
    return [
      "Om bilen har en mangel, avgjøres ut fra tilstanden ved leveringen, jf. forbrukerkjøpsloven § 18 første ledd.",
      `Forbrukerklageutvalget legger til grunn at en feil er en mangel når en sakkyndig har dokumentert at den går ut over det som er påregnelig for bilens alder og kjørelengde, og at den var til stede ved leveringen; ${se(eks)}.`,
      `Det er dokumentert i min sak. ${f.avskrift_verksted ? `${verkstedetSkriver(f.avskrift_verksted)} ` : ""}Verkstedet konkluderer med at feilen er mer enn normal slitasje og var der da jeg overtok bilen.`,
      svar,
    ]
      .filter(Boolean)
      .join(" ");
  }
  if (spor === "B") {
    // A wear part goes on B only against a decision on the same wear part (the slitedel rule); a rule
    // across categories would get round it, and «mangelens art» is exactly the seller's objection (S01).
    if (!f.innen_frist || !f.rapport_ok || f.slitedel) return null;
    const frist = sak.lov === "etter_2024" ? "to år" : "seks måneder";
    return [
      `Etter forbrukerkjøpsloven § 18 annet ledd skal en mangel som viser seg innen ${frist} etter leveringen, antas å ha vært der ved leveringen, med mindre noe annet blir godtgjort eller er uforenlig med varens eller mangelens art.`,
      `Forbrukerklageutvalget anvender regelen slik; ${se(eks)}.`,
      `Feilen i min sak viste seg ${f.dager_til_feil === 0 ? "samme dag som bilen ble levert" : f.dager_til_feil === 1 ? "dagen etter leveringen" : `${f.dager_til_feil} dager etter leveringen`}, og verkstedet har dokumentert den skriftlig.${sak.selger_motbevis ? "" : " Selger har ikke lagt frem bevis for at den oppsto senere."}`,
      svar,
    ]
      .filter(Boolean)
      .join(" ");
  }
  return null;
}
