import type { Faktorer } from "./faktorer";
import type { Niva, Oppdaget } from "./typer";

// vekt: whether the point speaks for or against the case, or only informs; the page colours it.
export type Vekt = "for" | "mot" | "noytral";
export type Grunnlag = { tekst: string; vekt: Vekt; paragraf?: string; lenke?: string };

export const NAAR: Record<Oppdaget, string> = {
  innen_6_mnd: "innen seks måneder",
  "6_mnd_til_2_ar": "mellom seks måneder og to år",
  over_2_ar: "mer enn to år",
};

const LAV_FORVENTNING: Record<NonNullable<Faktorer["lavForventning"]>, string> = {
  pris: "Bilen kostet under 50 000 kr.",
  km: "Bilen hadde gått over 200 000 km da du kjøpte den.",
  begge: "Bilen kostet under 50 000 kr og hadde gått over 200 000 km da du kjøpte den.",
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
    punkter.push({ tekst: "Verkstedrapporten din sier at feilen sannsynligvis var der før kjøpet. Det er ofte avgjørende i lignende saker.", vekt: "for", ...fkjl(18) });
  } else if (f.presumsjon) {
    punkter.push({ tekst: "Du har ikke en rapport som sier at feilen var der før kjøpet. Forhandleren kan prøve å vise at den kom etter kjøpet, og uten rapport har du lite å svare med.", vekt: "mot" });
  } else {
    punkter.push({ tekst: "Du har ikke en rapport som sier at feilen var der før kjøpet. Uten det er det vanskelig å nå fram.", vekt: "mot" });
  }

  // Wear the buyer had to expect is named in about 6 of 10 lost dealer decisions, also inside the
  // presumption period. It does not apply to wrong mileage or history, or to earlier collision damage.
  if (f.slitasjeAktuelt && f.lavForventning) {
    punkter.push({
      tekst: `${LAV_FORVENTNING[f.lavForventning]} Da kan du forvente mindre av den, og forhandleren kan innvende at feilen er vanlig slitasje.`,
      vekt: "mot",
      ...fkjl(15),
    });
  } else if (f.slitasjeAktuelt && f.presumsjon) {
    punkter.push({
      tekst: "Forhandleren kan likevel innvende at feilen er vanlig slitasje for bilens alder og kjørelengde. Det er en vanlig grunn til at kjøpere taper.",
      vekt: "noytral",
      ...fkjl(15),
    });
  }

  if (f.opplystTakSvak) {
    punkter.push({
      tekst:
        "Du visste om feilen da du kjøpte bilen. Det du kjente til, kan du normalt ikke klage på (forbrukerkjøpsloven § 16 tredje ledd, slik den lød før 2024).",
      vekt: "mot",
    });
  } else if (f.opplystEtter2024) {
    punkter.push({
      tekst:
        "Du visste om feilen da du kjøpte bilen. Det stenger bare for kravet hvis du ble spesielt opplyst om akkurat denne feilen og uttrykkelig godtok den. Forhandleren kan likevel hevde at du kjente til feilen.",
      vekt: "mot",
      ...fkjl(15),
    });
  } else if (f.feilOpplysningerDokumentert) {
    punkter.push({
      tekst: "Du kan dokumentere at opplysningene du fikk om bilen var uriktige. En bil som ikke svarer til det forhandleren har opplyst, har en mangel.",
      vekt: "for",
      ...fkjl(16),
    });
  }

  // What the dealer has done is asked on the letter page, so the assessment only says what the buyer can
  // claim: repair first, then price reduction or cancelling if the dealer does not succeed. Purchases
  // before 2024 follow the old rule: the dealer normally had two attempts at the same defect.
  punkter.push({
    tekst: `Har bilen en mangel, kan du kreve at forhandleren retter den uten kostnad for deg. Retter de ikke, eller lykkes de ikke, kan du kreve prisavslag eller heving.${
      f.presumsjonManeder === 6 ? " For kjøp før 2024 har forhandleren normalt rett til to forsøk før du kan kreve det." : ""
    }`,
    vekt: "for",
    ...fkjl(29, "§§ 29–32"),
  });
  if (f.venterOverEttAr) {
    punkter.push({
      tekst:
        "Du har ikke tatt opp feilen med forhandleren, og ut fra svarene dine har du kjent til den i over ett år. Du må reklamere innen rimelig tid etter at du oppdaget feilen, og forhandleren kan hevde at du har ventet for lenge.",
      vekt: "mot",
      ...fkjl(27),
    });
  }

  if (f.femAarGatt && !f.fristUte) {
    punkter.push({ tekst: "Det er mer enn fem år siden du fikk bilen, men du tok det opp med forhandleren innen fem år, så den ytterste fristen for å reklamere er overholdt.", vekt: "for", ...fkjl(27) });
  } else if (!f.fristUte) {
    punkter.push({ tekst: "Det er under fem år siden du fikk bilen, så den ytterste fristen for å reklamere er ikke ute.", vekt: "for", ...fkjl(27) });
  }

  return punkter;
}

// Rules that hold for every purchase from a dealer; they fill the list when the answers give fewer than
// three points. A «solgt som den er» clause works differently before and after 1 January 2024.
function generelle(f: Faktorer): Grunnlag[] {
  return [
    f.presumsjonManeder === 24
      ? {
          tekst:
            "Et generelt forbehold som «solgt som den er» kan ikke gjøres gjeldende mot deg.",
          vekt: "for",
          ...fkjl(3, "§§ 3 og 15"),
        }
      : {
          tekst:
            "Et forbehold som «solgt som den er» hindrer ikke krav når bilen er i dårligere stand enn du hadde grunn til å regne med, eller ikke stemmer med opplysningene du fikk (forbrukerkjøpsloven § 17, slik den lød før 2024).",
          vekt: "for",
        },
    {
      tekst:
        "Forhandleren kan ikke avtale seg bort fra rettighetene loven gir deg.",
      vekt: "for",
      ...fkjl(3),
    },
  ];
}
export const ANTALL_STYRKER = 3;

// What the page shows in two lists. Strengths: for a good case exactly three points that speak for it,
// in the order of byggGrunnlag (filled up with the rules that hold for every purchase); for a weak case
// only the ones that really do. Weaknesses: what speaks against it, and what the dealer may object.
export function synligGrunnlag(
  niva: Niva,
  punkter: Grunnlag[],
  f: Faktorer,
): { styrker: Grunnlag[]; svakheter: Grunnlag[] } {
  const for_ = punkter.filter((p) => p.vekt === "for");
  return {
    styrker:
      niva === "god"
        ? [...for_, ...generelle(f)].slice(0, ANTALL_STYRKER)
        : for_,
    svakheter: punkter.filter((p) => p.vekt !== "for"),
  };
}
