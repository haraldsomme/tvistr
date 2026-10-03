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
  // when there is no decision to show.
  eksempel: ValgtEksempel | null;
  // What the user can do to strengthen the case; empty when there is nothing to suggest. Not part
  // of the free assessment: it is meant for the paid step.
  tiltak: Tiltak[];
  // Kept for tests and the script; not shown to the user.
  faktorer: Faktorer;
  statistikk: Statistikk | null;
};

export type Avhengigheter = {
  hentStatistikk: HentStatistikk;
  idag?: string;
};

// The dealer may try to repair first (fkjl § 29); once they have tried or refused, the buyer can
// go on to a price reduction or cancelling the purchase (§§ 31 and 32). Which of the two depends on
// how serious the defect is, which the form does not ask about.
function tittelFor(niva: Niva, f: Faktorer): string {
  if (niva === "svak") return "Det blir vanskelig å nå fram med et krav slik saken står nå.";
  const krav = f.kontakt === "forsokt" || f.kontakt === "avvist" ? "prisavslag eller heving" : "at forhandleren retter feilen";
  return `Du har etter alt å dømme krav på ${krav}.`;
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
  else if (f.verkstedrapport === false) ledd.push("du har ingen verkstedrapport");

  if (ledd.length === 1) return `${ledd[0]}.`;
  return `${ledd.slice(0, -1).join(", ")}, og ${ledd[ledd.length - 1]}.`;
}

const FRISTUTE: Grunnlag = {
  tekst: "Reklamasjon må senest skje fem år etter at du fikk bilen. Unntak gjelder hvis forhandleren har gitt en garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt.",
  vekt: "mot",
  ...fkjl(27),
};

export function vurderFraFaktorer(f: Faktorer, s: Statistikk | null): Vurdering {
  // The level is a short list of reasons for a weak case; everything else is a good case. The
  // decisions show that cases are won or lost on the burden of proof (was the defect there at
  // delivery?). Inside the presumption the dealer has that burden. Outside it the buyer has, which
  // takes a report that points back to before the purchase, or a failed repair attempt (89 % medhold
  // when repair attempts were a topic, against 58–66 % otherwise). No contact with the dealer yet
  // does not count against the case: the letter is how the buyer asks for repair. The share of
  // similar decisions is shown, but does not decide the level.
  let niva: Niva = "god";
  if (!f.presumsjon && f.rapportSierForKjop !== true && f.kontakt !== "forsokt") niva = "svak";
  // Told about the defect and made no objection, for purchases before 2024.
  if (f.opplystTakSvak) niva = "svak";
  // Past the five-year limit the dealer can reject the claim as too late, but exceptions exist
  // (longer guarantee, fraud or gross negligence), so it is a weak case, not a case outside the service.
  if (f.fristUte) niva = "svak";

  const grunnlag = byggGrunnlag(f);
  if (f.fristUte) grunnlag.unshift(FRISTUTE);
  const begrunnelse = f.fristUte ? `Det har gått mer enn fem år siden kjøpet. ${begrunnelseFor(f)}` : begrunnelseFor(f);

  return { niva, tittel: tittelFor(niva, f), begrunnelse, grunnlag, eksempel: finnEksempel(f, niva), tiltak: foreslaTiltak(f), faktorer: f, statistikk: s };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const faktorer = beregnFaktorer(input, dep.idag ?? iDag());
  if (faktorer.fristUte) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
