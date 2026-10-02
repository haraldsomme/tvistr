import { finnEksempel, type ValgtEksempel } from "./eksempler";
import { beregnFaktorer, iDag, type Faktorer } from "./faktorer";
import { byggGrunnlag, fkjl, NAAR, type Grunnlag } from "./grunnlag";
import { foreslaTiltak, type Tiltak } from "./tiltak";
import type { HentStatistikk, Statistikk } from "./statistikk";
import type { KlageInput, Niva } from "./typer";

export type Vurdering = {
  niva: Niva;
  // One sentence: what the buyer most likely can claim.
  tittel: string;
  // One or two sentences: the facts the level rests on.
  begrunnelse: string;
  // The same facts point by point, each with the rule it triggers and a reference to the law.
  grunnlag: Grunnlag[];
  // A similar decision: one the buyer won, or one the buyer lost when the case is weak. null only
  // when the case is not assessed.
  eksempel: ValgtEksempel | null;
  // What the user can do to strengthen the case; empty when there is nothing to suggest. Not part
  // of the free assessment: it is meant for the paid step.
  tiltak: Tiltak[];
  // Kept for tests and the script; not shown to the user.
  faktorer: Faktorer;
  statistikk: Statistikk | null;
  poeng: number;
};

export type Avhengigheter = {
  hentStatistikk: HentStatistikk;
  idag?: string;
};

// The level is a score card. The decisions show that cases are won or lost on the burden of proof
// (whether the defect was there at delivery), so that carries the most weight. The share of
// similar decisions is background: across defect types it only ranges from about 55 to 72 %, and
// it only counts when the interval lies clearly above or below the share for all dealer decisions
// with the same timing. Measured that way it says something about the defect, not about the timing
// (which the presumption already counts), the size of the sample or how old the decisions are.
export const POENG = {
  presumsjon: 2,
  rapportUtenforPresumsjon: 2,
  rapportInnenforPresumsjon: 1,
  ingenStotteUtenforPresumsjon: -1,
  rettingForsokt: 2, // 89 % medhold when repair attempts were a topic, against 58–66 % otherwise, whatever the timing
  feilOpplysninger: 1, // 70 % medhold with feil_opplysninger as the basis
  statistikk: 1,
} as const;
export const STERK_FRA = 3;
export const MIDDELS_FRA = 1;

function ikkeAktuell(f: Faktorer, tittel: string, begrunnelse: string, grunnlag: Grunnlag[] = []): Vurdering {
  return { niva: "ikke_aktuell", tittel, begrunnelse, grunnlag, eksempel: null, tiltak: [], faktorer: f, statistikk: null, poeng: 0 };
}

function poengFor(f: Faktorer, s: Statistikk | null): number {
  let poeng = 0;
  if (s?.spesifikk) poeng += s.lav > s.basis ? POENG.statistikk : s.hoy < s.basis ? -POENG.statistikk : 0;
  if (f.presumsjon) {
    poeng += POENG.presumsjon;
    if (f.rapportSierForKjop === true) poeng += POENG.rapportInnenforPresumsjon;
  } else {
    poeng += f.rapportSierForKjop === true ? POENG.rapportUtenforPresumsjon : POENG.ingenStotteUtenforPresumsjon;
  }
  if (f.kontakt === "forsokt") poeng += POENG.rettingForsokt;
  if (f.feilOpplysningerDokumentert) poeng += POENG.feilOpplysninger;
  return poeng;
}

// The dealer may try to repair first (fkjl § 29); once they have tried or refused, the buyer can
// go on to a price reduction or cancelling the purchase (§§ 31 and 32). Which of the two depends on
// how serious the defect is, which the form does not ask about.
function tittelFor(niva: Niva, f: Faktorer): string {
  if (niva === "svak") return "Det blir vanskelig å nå fram med et krav slik saken står nå.";
  const krav = f.kontakt === "forsokt" || f.kontakt === "avvist" ? "prisavslag eller heving" : "at forhandleren retter feilen";
  return niva === "sterk" ? `Du har etter alt å dømme krav på ${krav}.` : `Du kan ha krav på ${krav}.`;
}

// The facts that decided the level, as one sentence: timing, what was said, the dealer, evidence.
function begrunnelseFor(f: Faktorer): string {
  const ledd = [`Feilen ble oppdaget ${NAAR[f.oppdaget]} etter kjøpet`];

  if (f.opplystForKjop === "ja" && f.feilOpplysninger) {
    ledd.push(
      f.feilOpplysningerDokumentert
        ? "du ble fortalt om feilen, men du kan dokumentere at opplysningene var misvisende"
        : "du ble fortalt om feilen, men mener opplysningene var misvisende",
    );
  } else if (f.feilOpplysningerDokumentert) ledd.push("du kan dokumentere at du fikk uriktige opplysninger om bilen");
  else if (f.opplystForKjop === "ja") ledd.push("du ble informert om den før kjøpet");
  else if (f.opplystForKjop === "nei") ledd.push("du ble ikke informert om den");

  if (f.kontakt === "forsokt") ledd.push("forhandleren har forsøkt å rette den uten å lykkes");
  else if (f.kontakt === "avvist") ledd.push("forhandleren har avvist å rette den");

  if (f.rapportSierForKjop === true) ledd.push("verkstedrapporten peker på en feil som sannsynligvis var til stede ved levering");
  else if (f.rapportSierForKjop === false) ledd.push("verkstedrapporten sier ikke om feilen var til stede ved levering");
  else if (f.bilder) ledd.push("du har bilder av feilen, men ingen verkstedrapport");
  else ledd.push("du har foreløpig ingen dokumentasjon av feilen");

  return `${ledd.slice(0, -1).join(", ")}, og ${ledd[ledd.length - 1]}.`;
}

export function vurderFraFaktorer(f: Faktorer, s: Statistikk | null): Vurdering {
  if (f.utenforTjenesten === "privat_selger") {
    return ikkeAktuell(f, "Vi kan ikke vurdere kjøp fra en privatperson.", "Slike kjøp følger kjøpsloven og behandles ikke på samme måte som kjøp fra forhandler.");
  }
  if (f.utenforTjenesten === "ikke_privat_bruk") {
    return ikkeAktuell(f, "Vi kan bare vurdere kjøp til privat bruk.", "Forbrukerkjøpsloven gjelder ikke når bilen er kjøpt til bruk i næring.");
  }
  if (f.fristUte) {
    return ikkeAktuell(f, "Fristen for å klage er dessverre ute.", "Det har gått mer enn fem år siden kjøpet, og etter forbrukerkjøpsloven må du reklamere innen fem år.", [
      {
        tekst: "Reklamasjon må senest skje fem år etter at du fikk bilen. Unntak gjelder hvis forhandleren har gitt en garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt.",
        vekt: "mot",
        ...fkjl(27),
      },
    ]);
  }

  const poeng = poengFor(f, s);
  let niva: Niva = poeng >= STERK_FRA ? "sterk" : poeng >= MIDDELS_FRA ? "middels" : "svak";

  // Caps: facts that limit the case whatever else speaks for it.
  if (f.opplystTakSvak) niva = "svak";
  // Purchases from 2024: the dealer must show that the buyer expressly accepted the deviation.
  if (f.opplystEtter2024 && niva === "sterk") niva = "middels";
  // A cheap or far-driven car: the dealer can argue that the defect is wear the buyer had to expect.
  if (niva === "sterk" && f.lavForventning && f.slitasjeAktuelt) niva = "middels";
  // Word against word: a claim of misleading information that cannot be shown does not lift the case.
  if (f.opplystTakMiddels && niva === "sterk") niva = "middels";
  // Inside the presumption period a silent report still gives the dealer something to argue with.
  if (niva === "sterk" && f.presumsjon && f.rapportSierForKjop === false) niva = "middels";
  // The presumption covers when the defect arose, not that it exists. Without a report or pictures
  // the defect itself is undocumented.
  if (niva === "sterk" && !f.verkstedrapport && !f.bilder) niva = "middels";

  return { niva, tittel: tittelFor(niva, f), begrunnelse: begrunnelseFor(f), grunnlag: byggGrunnlag(f), eksempel: finnEksempel(f, niva), tiltak: foreslaTiltak(f), faktorer: f, statistikk: s, poeng };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const faktorer = beregnFaktorer(input, dep.idag ?? iDag());
  if (faktorer.utenforTjenesten || faktorer.fristUte) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
