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
  // A similar decision the buyer won, whatever the level. null when the law stops the claim, or when
  // there is no decision to show.
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

// The same title whatever the level: the page lists what speaks for and against the case, and the buyer
// decides from that whether to buy the letter.
const TITTEL = "Du kan ha en sak mot forhandleren.";

// The facts that decided the level, as one sentence: timing, what was said, the dealer, evidence.
function begrunnelseFor(f: Faktorer): string {
  const ledd = [`Feilen ble oppdaget ${NAAR[f.oppdaget]} etter kjøpet`];

  if (f.opplystForKjop === "ja" && f.feilOpplysninger) {
    ledd.push(
      f.feilOpplysningerDokumentert
        ? "du visste om feilen, men du kan dokumentere at opplysningene var misvisende"
        : "du visste om feilen, men mener opplysningene var misvisende",
    );
  } else if (f.feilOpplysningerDokumentert) ledd.push("du kan dokumentere at du fikk uriktige opplysninger om bilen");
  else if (f.opplystForKjop === "ja") ledd.push("du visste om feilen før kjøpet");
  else if (f.opplystForKjop === "nei") ledd.push("du visste ikke om den før kjøpet");

  if (f.venterOverEttAr) ledd.push("du har trolig ventet over ett år med å ta den opp med forhandleren");

  if (f.rapportSierForKjop === true) ledd.push("verkstedrapporten peker på en feil som sannsynligvis var til stede ved levering");
  else if (f.rapportSierForKjop === false) ledd.push("verkstedrapporten sier ikke om feilen var til stede ved levering");
  else if (f.verkstedrapport === false) ledd.push("du har ingen verkstedrapport");

  if (ledd.length === 1) return `${ledd[0]}.`;
  return `${ledd.slice(0, -1).join(", ")}, og ${ledd[ledd.length - 1]}.`;
}

// Where the law itself stops the claim: the title, the justification and the one point shown. The letter
// is not offered. Not reviewed by a lawyer yet.
const STOPP: Record<
  NonNullable<Faktorer["stopp"]>,
  { tittel: string; begrunnelse: string; grunnlag: Grunnlag }
> = {
  firma: {
    tittel: "Forbrukerkjøpsloven gjelder ikke for dette kjøpet.",
    begrunnelse:
      "Du kjøpte bilen gjennom et firma. Forbrukerkjøpsloven gjelder bare når en forbruker kjøper av en næringsdrivende. Ved kjøp gjennom firma gjelder kjøpsloven, der et «solgt som den er»-forbehold fortsatt er gyldig og rettighetene dine er langt svakere. Tvistr skriver reklamasjonsbrev etter forbrukerkjøpsloven, så vi kan ikke hjelpe deg i denne saken.",
    grunnlag: {
      tekst: "Kjøp gjennom et firma er ikke et forbrukerkjøp.",
      vekt: "mot",
      ...fkjl(1),
    },
  },
  privat: {
    tittel:
      "Forbrukerkjøpsloven gjelder ikke når du kjøper av en privatperson.",
    begrunnelse:
      "Kjøp mellom privatpersoner følger kjøpsloven, der et «solgt som den er»-forbehold fortsatt er gyldig og rettighetene dine er langt svakere. Tvistr skriver reklamasjonsbrev etter forbrukerkjøpsloven og bygger på saker mot forhandlere, så vi kan ikke hjelpe deg i denne saken. Forbrukerrådet gir veiledning om kjøp fra private.",
    grunnlag: {
      tekst:
        "Kjøp fra en privatperson er ikke et forbrukerkjøp fra en næringsdrivende.",
      vekt: "mot",
      ...fkjl(1),
    },
  },
  frist: {
    tittel: "Fristen for å reklamere er trolig ute.",
    begrunnelse:
      "Det har gått mer enn fem år siden kjøpet, og du har ikke tatt opp feilen med forhandleren innen fem år. Loven setter en ytterste frist på fem år, og forhandleren kan avvise kravet som for sent. Unntak gjelder hvis forhandleren har gitt en garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt. Har du grunn til å tro det, kan det lønne seg å få juridisk råd.",
    grunnlag: {
      tekst:
        "Reklamasjon må senest skje fem år etter at du fikk bilen. Unntak gjelder hvis forhandleren har gitt en garanti som varer lenger, eller har opptrådt uredelig eller grovt uaktsomt.",
      vekt: "mot",
      ...fkjl(27),
    },
  },
};

export function vurderFraFaktorer(
  f: Faktorer,
  s: Statistikk | null,
): Vurdering {
  if (f.stopp) {
    const stopp = STOPP[f.stopp];
    return {
      niva: "utenfor",
      tittel: stopp.tittel,
      begrunnelse: stopp.begrunnelse,
      grunnlag: [stopp.grunnlag],
      eksempel: null,
      tiltak: [],
      faktorer: f,
      statistikk: null,
    };
  }

  // The level is a short list of reasons for a weak case; everything else is a good case. The
  // decisions show that cases are won or lost on the burden of proof (was the defect there at
  // delivery?). Inside the presumption the dealer has that burden. Outside it the buyer has, which
  // takes a report that points back to before the purchase. The dealer's attempts at repair are asked
  // on the letter page and do not count here. The share of similar decisions is shown, but does not
  // decide the level.
  let niva: Niva = "god";
  if (!f.presumsjon && f.rapportSierForKjop !== true) niva = "svak";
  // Knew about the defect when buying, for purchases before 2024.
  if (f.opplystTakSvak) niva = "svak";
  // Has not told the dealer and found the defect over a year ago: probably not within reasonable time (§ 27).
  if (f.venterOverEttAr) niva = "svak";

  return {
    niva,
    tittel: TITTEL,
    begrunnelse: begrunnelseFor(f),
    grunnlag: byggGrunnlag(f),
    eksempel: finnEksempel(f),
    tiltak: foreslaTiltak(f),
    faktorer: f,
    statistikk: s,
  };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const faktorer = beregnFaktorer(input, dep.idag ?? iDag());
  if (faktorer.stopp) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
