import type { Faktorer } from "./faktorer";
import type { Oppdaget } from "./typer";

// vekt: whether the point speaks for or against the case, or only informs; the page colours it.
export type Vekt = "for" | "mot" | "noytral";
export type Grunnlag = { tekst: string; vekt: Vekt; paragraf?: string; lenke?: string };

export const NAAR: Record<Oppdaget, string> = {
  innen_6_mnd: "innen seks måneder",
  "6_mnd_til_2_ar": "mellom seks måneder og to år",
  over_2_ar: "mer enn to år",
};

// Forbrukerkjøpsloven. A point only gets a reference when the rule sits in one section; check
// them against the current text on Lovdata when the law changes.
const LOV_URL = "https://lovdata.no/lov/2002-06-21-34";
export const fkjl = (nr: number, visning = `§ ${nr}`) => ({ paragraf: `forbrukerkjøpsloven ${visning}`, lenke: `${LOV_URL}/§${nr}` });

// The facts the assessment rests on, each with the rule it triggers: timing, evidence, what was
// said before the purchase, and the dealer. Only rules that follow from the answers are included.
export function byggGrunnlag(f: Faktorer): Grunnlag[] {
  const punkter: Grunnlag[] = [];
  const viste = `Feilen viste seg ${NAAR[f.oppdaget]} etter kjøpet.`;

  if (f.presumsjon) {
    const periode = f.presumsjonManeder === 24 ? "to år" : "seks måneder";
    punkter.push({
      tekst: `${viste} En feil som viser seg innen ${periode}, antas å ha vært der da du fikk bilen, og forhandleren må bevise noe annet.`,
      vekt: "for",
      ...fkjl(18),
    });
  } else {
    punkter.push({ tekst: `${viste} Da er det du som må vise at den var der da du fikk bilen.`, vekt: "mot", ...fkjl(18) });
  }

  if (f.rapportSierForKjop === true) {
    punkter.push({ tekst: "Verkstedrapporten din sier at feilen sannsynligvis var der før kjøpet. Det er ofte avgjørende i lignende saker.", vekt: "for" });
  } else if (!f.presumsjon) {
    punkter.push({ tekst: "Du har ikke en rapport som sier at feilen var der før kjøpet. Uten det er det vanskelig å nå fram.", vekt: "mot" });
  } else if (!f.verkstedrapport && !f.bilder) {
    punkter.push({ tekst: "Du har foreløpig ikke dokumentert selve feilen. Antakelsen gjelder når feilen oppsto, ikke at den finnes.", vekt: "mot" });
  }

  if (f.opplystTakSvak) {
    punkter.push({ tekst: "Du ble fortalt om feilen før kjøpet. Det du kjente til da du kjøpte, kan du normalt ikke klage på.", vekt: "mot" });
  } else if (f.feilOpplysningerDokumentert) {
    punkter.push({
      tekst: "Du kan dokumentere at opplysningene du fikk om bilen var uriktige. En bil som ikke svarer til det forhandleren har opplyst, har en mangel.",
      vekt: "for",
      ...fkjl(16),
    });
  } else if (f.opplystTakMiddels) {
    punkter.push({ tekst: "Du mener opplysningene du fikk var misvisende, men kan ikke dokumentere det. Da står påstand mot påstand.", vekt: "mot" });
  }

  if (f.kontakt === "forsokt" || f.kontakt === "avvist") {
    const hendt = f.kontakt === "forsokt" ? "forsøkt å rette feilen uten å lykkes" : "avvist å rette feilen";
    punkter.push({ tekst: `Forhandleren har ${hendt}. Da kan du gå videre til prisavslag eller heving.`, vekt: "for", ...fkjl(31, "§§ 31 og 32") });
  } else if (f.kontakt === "nei") {
    punkter.push({ tekst: "Du har ikke klaget til forhandleren ennå. Du må gjøre det innen rimelig tid etter at du oppdaget feilen.", vekt: "mot", ...fkjl(27) });
  }

  return punkter;
}
