import { beregnFaktorer, iDag, type Faktorer, type Tolkning } from "./faktorer";
import { alleKrav, type KravPerOnske } from "./krav";
import { foreslaTiltak, type Tiltak } from "./tiltak";
import type { HentStatistikk, Statistikk } from "./statistikk";
import type { KlageInput, Niva } from "./typer";

export type Vurdering = {
  niva: Niva;
  begrunnelse: string;
  // What the user can do to improve the case; empty when there is nothing to suggest.
  tiltak: Tiltak[];
  // Which claim to take to the letter, for each wish. Only for middels/sterk: for a weak case the
  // advice is to strengthen it first, and amounts would read as a promise.
  krav: KravPerOnske | null;
  // Kept for tests and a future UI; not shown to the user.
  faktorer: Faktorer;
  statistikk: Statistikk | null;
  poeng: number;
};

export type Avhengigheter = {
  tolk: (input: KlageInput) => Promise<Tolkning | null>;
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

const pst = (v: number) => `${Math.round(v * 100)} %`;
const NIVA_TEKST: Record<Niva, string> = { sterk: "sterk", middels: "middels sterk", svak: "svak", ikke_aktuell: "ikke aktuell" };

function varighet(dager: number): string {
  if (dager < 1) return "samme dag som du kjøpte bilen, altså";
  if (dager < 60) return `${dager} dager`;
  const maneder = Math.round(dager / 30.4);
  return maneder < 24 ? `omtrent ${maneder} måneder` : `omtrent ${Math.round((dager / 365) * 10) / 10} år`.replace(".", ",");
}

function ikkeAktuell(f: Faktorer, begrunnelse: string, s: Statistikk | null): Vurdering {
  return { niva: "ikke_aktuell", begrunnelse, tiltak: [], krav: null, faktorer: f, statistikk: s, poeng: 0 };
}

type Del = { poeng: number; tekst: string };

// The text explains the chain: what counted for and against, then any rule that capped the level.
export function vurderFraFaktorer(f: Faktorer, s: Statistikk | null): Vurdering {
  if (f.utenforTjenesten) {
    const grunn =
      f.utenforTjenesten === "privat_selger"
        ? "Kjøp fra en privatperson er omfattet av kjøpsloven og behandles ikke av Forbrukerklageutvalget på samme måte som kjøp fra forhandler."
        : "Forbrukerklageutvalget behandler bare kjøp til privat bruk.";
    return ikkeAktuell(f, `${grunn} Vi kan derfor ikke vurdere saken din.`, null);
  }
  if (f.fristUte) {
    return ikkeAktuell(
      f,
      "Det har gått mer enn fem år siden du kjøpte bilen. Etter forbrukerkjøpsloven må du reklamere innen fem år etter at du overtok bilen, så kravet er dessverre tapt.",
      null,
    );
  }

  const deler: Del[] = [];

  if (s) {
    const p = !s.spesifikk ? 0 : s.lav >= STAT_GOD_LAV ? POENG.statistikk : s.hoy < STAT_SVAK_HOY ? -POENG.statistikk : 0;
    const tillegg = p > 0 ? ", som er et godt utgangspunkt" : p < 0 ? ", som er lavere enn vanlig" : "";
    deler.push({ poeng: p, tekst: `Av ${s.n} lignende saker fikk klageren helt eller delvis medhold i ${pst(s.andel)} av sakene${tillegg}.` });
  }

  const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
  const naar = `Feilen viste seg ${varighet(f.dagerKjopTilOppdaget)} etter kjøpet.`;
  if (f.presumsjon) {
    deler.push({
      poeng: POENG.presumsjon,
      tekst: `${naar} Når en feil viser seg innen ${periode} etter at du overtok bilen, regner loven med at den var der ved kjøpet, med mindre forhandleren kan bevise noe annet. Det styrker saken din.`,
    });
    if (f.rapportSierForKjop === true) {
      deler.push({ poeng: POENG.rapportInnenforPresumsjon, tekst: "Rapporten din sier i tillegg at feilen sannsynligvis var til stede ved kjøpet." });
    }
  } else {
    const intro = `${naar} Det er etter fristen på ${periode} der loven regner med at feilen var der ved kjøpet, så du må selv kunne vise at den var det.`;
    if (f.rapportSierForKjop === true) {
      deler.push({ poeng: POENG.rapportUtenforPresumsjon, tekst: `${intro} Rapporten din sier at feilen sannsynligvis var til stede ved kjøpet, og det er nettopp det som trengs.` });
    } else if (f.rapportSierForKjop === false) {
      deler.push({ poeng: POENG.ingenStotteUtenforPresumsjon, tekst: `${intro} Rapporten din sier ikke noe om dette, og det svekker saken.` });
    } else {
      deler.push({ poeng: POENG.ingenStotteUtenforPresumsjon, tekst: `${intro} Uten en verksted- eller tilstandsrapport som sier det, står saken svakere.` });
    }
  }

  if (f.kontakt === "forsokt") {
    deler.push({
      poeng: POENG.rettingForsokt,
      tekst: "Forhandleren har forsøkt å rette feilen uten å lykkes. I tidligere saker der det var tilfellet, fikk klageren medhold langt oftere enn ellers.",
    });
  } else if (f.kontakt === "avvist") {
    deler.push({ poeng: 0, tekst: "Forhandleren har avvist å rette feilen. Da kan du gå videre med krav om prisavslag eller heving." });
  }

  if (f.feilOpplysningerDokumentert) {
    deler.push({
      poeng: POENG.feilOpplysninger,
      tekst: "Beskrivelsen din tyder på at forhandleren ga uriktige opplysninger, og du har dokumentasjon på hva som ble sagt. Slike saker får oftere medhold enn andre.",
    });
  }

  const poeng = deler.reduce((sum, d) => sum + d.poeng, 0);
  let niva: Niva = poeng >= STERK_FRA ? "sterk" : poeng >= MIDDELS_FRA ? "middels" : "svak";
  const setninger = deler.map((d) => d.tekst);

  // Caps: facts that limit the case whatever else speaks for it.
  if (f.beskrivelseKvalitet === "ubrukelig") {
    niva = "svak";
    setninger.push("Beskrivelsen din sier ikke hva som er galt med bilen. Uten det kan vi ikke vurdere saken som mer enn svak.");
  } else if (f.beskrivelseKvalitet === "tynn" && niva === "sterk") {
    niva = "middels";
    setninger.push("Beskrivelsen din sier hva som er galt, men lite om når og hvordan. Vi vurderer derfor saken som middels sterk. Med en mer utfyllende beskrivelse kan den bli sterk.");
  }

  if (f.opplystTakSvak) {
    const fra = niva;
    niva = "svak";
    setninger.push(
      fra === "svak"
        ? "Du ble opplyst om feilen før kjøpet, noe som svekker saken ytterligere."
        : "Du ble opplyst om feilen før kjøpet. Da er det normalt ikke en mangel, med mindre forhandleren ga villedende opplysninger, så vi vurderer saken som svak.",
    );
  }

  // Inside the presumption period a silent report still gives the dealer something to argue with.
  if (f.presumsjon && f.rapportSierForKjop === false) {
    if (niva === "sterk") {
      niva = "middels";
      setninger.push(
        "Rapporten din sier ikke om feilen var til stede ved kjøpet, og forhandleren kan bruke det til å bestride saken. Vi vurderer den derfor som middels sterk. Får du en rapport som sier dette, kan saken bli sterk.",
      );
    } else {
      setninger.push("Rapporten din sier ikke om feilen var til stede ved kjøpet, og forhandleren kan bruke det til å bestride saken.");
    }
  }

  // The presumption covers when the defect arose, not that it exists. Without a report or pictures
  // the defect itself is undocumented.
  if (niva === "sterk" && !f.bevisValgt.verkstedrapport && !f.bevisValgt.bilder) {
    niva = "middels";
    setninger.push(
      "Du har foreløpig ingen dokumentasjon av selve feilen, som en verkstedrapport eller bilder. Vi vurderer derfor saken som middels sterk til feilen er dokumentert.",
    );
  }

  return {
    niva,
    begrunnelse: `${setninger.join(" ")} Samlet vurdering: ${NIVA_TEKST[niva]} sak.`,
    tiltak: foreslaTiltak(f),
    krav: niva === "middels" || niva === "sterk" ? alleKrav(f) : null,
    faktorer: f,
    statistikk: s,
    poeng,
  };
}

export async function vurder(input: KlageInput, dep: Avhengigheter): Promise<Vurdering> {
  const tolkning = await dep.tolk(input);
  const faktorer = beregnFaktorer(input, tolkning, dep.idag ?? iDag());
  if (faktorer.utenforTjenesten || faktorer.fristUte) return vurderFraFaktorer(faktorer, null);
  return vurderFraFaktorer(faktorer, await dep.hentStatistikk(faktorer));
}
