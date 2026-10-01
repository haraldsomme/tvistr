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
// it only counts when the interval is clearly above or below the usual level (about 63 %).
export const POENG = {
  presumsjon: 2,
  rapportUtenforPresumsjon: 2,
  rapportInnenforPresumsjon: 1,
  ingenStotteUtenforPresumsjon: -1,
  rettingForsokt: 1, // 85 % medhold when a failed repair was a topic in the decision
  feilOpplysninger: 1, // 70 % medhold with feil_opplysninger as the basis
  statistikk: 1,
} as const;
export const STERK_FRA = 3;
export const MIDDELS_FRA = 1;
// Wilson bounds for the statistics to count: lower bound at least this for +1, upper bound below this for −1.
export const STAT_GOD_LAV = 0.6;
export const STAT_SVAK_HOY = 0.5;

function ikkeAktuell(f: Faktorer, tittel: string, begrunnelse: string, grunnlag: Grunnlag[] = []): Vurdering {
  return { niva: "ikke_aktuell", tittel, begrunnelse, grunnlag, tiltak: [], faktorer: f, statistikk: null, poeng: 0 };
}

function poengFor(f: Faktorer, s: Statistikk | null): number {
  let poeng = 0;
  if (s?.spesifikk) poeng += s.lav >= STAT_GOD_LAV ? POENG.statistikk : s.hoy < STAT_SVAK_HOY ? -POENG.statistikk : 0;
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
      { tekst: "Reklamasjon må senest skje fem år etter at du fikk bilen. Fristen gjelder uansett hva som ellers er riktig i saken.", vekt: "mot", ...fkjl(27) },
    ]);
  }

  const poeng = poengFor(f, s);
  let niva: Niva = poeng >= STERK_FRA ? "sterk" : poeng >= MIDDELS_FRA ? "middels" : "svak";

  // Caps: facts that limit the case whatever else speaks for it.
  if (f.opplystTakSvak) niva = "svak";
  // Word against word: a claim of misleading information that cannot be shown does not lift the case.
  if (f.opplystTakMiddels && niva === "sterk") niva = "middels";
  // Inside the presumption period a silent report still gives the dealer something to argue with.
  if (niva === "sterk" && f.presumsjon && f.rapportSierForKjop === false) niva = "middels";
  // The presumption covers when the defect arose, not that it exists. Without a report or pictures
  // the defect itself is undocumented.
  if (niva === "sterk" && !f.verkstedrapport && !f.bilder) niva = "middels";

  return { niva, tittel: tittelFor(niva, f), begrunnelse: begrunnelseFor(f), grunnlag: byggGrunnlag(f), tiltak: foreslaTiltak(f), faktorer: f, statistikk: s, poeng };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const faktorer = beregnFaktorer(input, dep.idag ?? iDag());
  if (faktorer.utenforTjenesten || faktorer.fristUte) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
