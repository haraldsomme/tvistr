import { beregnFaktorer, iDag, type Faktorer } from "./faktorer";
import { byggGrunnlag, fkjl, type Grunnlag } from "./grunnlag";
import type { HentStatistikk, Statistikk } from "./statistikk";
import type { KlageInput, Niva } from "./typer";

export type Vurdering = {
  niva: Niva;
  tittel: string;
  // Stopped: why. Otherwise the warnings in one paragraph.
  begrunnelse: string;
  // Stopped: the one point shown, with the rule and a reference to the law. Otherwise the facts the case
  // rests on (`byggGrunnlag`), kept for the letter page's save dialog and not shown before purchase.
  grunnlag: Grunnlag[];
  // What the buyer must know before buying the letter: who has the burden of proof, and that the letter
  // builds on the difference when the buyer knew of the defect. Empty when stopped.
  varsler: string[];
  // Kept for tests and the script; not shown to the user.
  faktorer: Faktorer;
  statistikk: Statistikk | null;
};

export type Avhengigheter = {
  hentStatistikk: HentStatistikk;
  idag?: string;
};

// The same title for every case the law does not stop: the warning says what the buyer must know, and the
// buyer decides from that whether to buy the letter.
const TITTEL = "Du kan ha en sak mot forhandleren.";

// Inside the presumption period the dealer must prove the defect was not there; outside it the buyer must
// prove it was, which takes a workshop's assessment (§ 18). Then, when the buyer knew of the defect but it is
// worse or other than told, that the letter builds on the difference.
function varslerFor(f: Faktorer): string[] {
  const periode = f.presumsjonManeder === 24 ? "2 år" : "6 måneder";
  return [
    f.presumsjon
      ? `Feilen viste seg innen ${periode} etter kjøpet. Da er det forhandleren som må vise at den ikke var der da du kjøpte bilen.`
      : `Feilen viste seg mer enn ${periode} etter kjøpet. Da må du vise at den var der da du kjøpte bilen, og du trenger en vurdering fra verksted. Etter kjøpet sier vi nøyaktig hva den må inneholde.`,
    ...(f.opplyst === "ja_verre" ? ["Du visste om feilen, men den er verre eller annerledes enn du fikk vite. Brevet bygger på forskjellen."] : []),
  ];
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
  // The text the spec gives; § 16 third paragraph as it read before 2024 has no current text to link to.
  kjent: {
    tittel: "Du kan ikke klage på en feil du kjente til da du kjøpte bilen.",
    begrunnelse:
      "Du kjøpte bilen før 1. januar 2024 og visste om feilen, slik den er. Etter forbrukerkjøpsloven § 16 tredje ledd, slik den gjaldt da, kan du ikke gjøre gjeldende som mangel noe du kjente til ved kjøpet. Er feilen verre eller annerledes enn du fikk vite, kan du gå tilbake og endre svaret.",
    grunnlag: {
      tekst: "Det du kjente til da du kjøpte bilen, kan du ikke klage på (forbrukerkjøpsloven § 16 tredje ledd, slik den lød før 2024).",
      vekt: "mot",
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
      varsler: [],
      faktorer: f,
      statistikk: null,
    };
  }

  // Before purchase the assessment only says whether the claim is stopped. How strong it is turns on what
  // is asked after purchase (the defect, contact, the report), where the steps, the score and the check
  // before sending take it. The share of decisions is shown, but decides nothing.
  const varsler = varslerFor(f);
  return {
    niva: "sak",
    tittel: TITTEL,
    begrunnelse: varsler.join(" "),
    grunnlag: byggGrunnlag(f),
    varsler,
    faktorer: f,
    statistikk: s,
  };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const faktorer = beregnFaktorer(input, dep.idag ?? iDag());
  if (faktorer.stopp) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
