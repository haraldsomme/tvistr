// The screens before payment (mockup «Sjekk saken»), one per screen: who sold and how, then every
// answer that shapes the letter, in the letter's order. A screen is done when it has what the letter
// and the verdict need; «Neste» waits for it and says what is missing (`mangler`). The car never blocks:
// the purchase asks for it instead (manglerISkjema). Private sales, leasing and purchases through a
// company are not covered: their screen stays undone.
import { seksjon } from "@/app/sak/skjema/steg";
import type { Utkast } from "@/lib/app/utkast";

export type Skjerm = {
  id: string;
  gruppe: "Kjøpet" | "Feilen" | "Kontrakten" | "Kravet";
  tittel: string;
  hint?: string;
  vis?: (u: Utkast) => boolean;
  ferdig: (u: Utkast) => boolean;
  // One line under the buttons when «Neste» is pressed on a screen that is not done.
  mangler?: (u: Utkast) => string;
};

// The question of a screen that edits one of the form's sections, as the section asks it (steg.ts).
const som = (id: string) => {
  const { tittel, hint } = seksjon(id);
  return { tittel, hint };
};

export const SKJERMER: Skjerm[] = [
  {
    id: "selger",
    gruppe: "Kjøpet",
    tittel: "Hvem kjøpte du bilen av?",
    hint: "Hvem som solgte bilen, avgjør hvilken lov som gjelder.",
    ferdig: (u) => u.seller === "forhandler" && u.buyer === "privat",
    mangler: (u) => (u.seller ? "Brevet gjelder bare kjøp fra en forhandler." : "Velg hvem du kjøpte bilen av."),
  },
  // Never blocks: the purchase needs the reg.nr. and the make, and the result says so with a link back.
  { id: "bilen", gruppe: "Kjøpet", ...som("bilen"), ferdig: () => true },
  { id: "kjopet", gruppe: "Kjøpet", ...som("kjopet"), ferdig: (u) => !!(u.skjema.c_purchase || u.skjema.c_delivery), mangler: () => "Legg inn når du kjøpte bilen." },
  { id: "forbehold", gruppe: "Kontrakten", tittel: "Står det «som den er» i kontrakten?", hint: "Se etter formuleringer som «solgt som den er» eller «som besiktiget».", ferdig: (u) => u.asis !== undefined, mangler: () => "Velg et svar." },
  { id: "feil", gruppe: "Feilen", ...som("feilen"), ferdig: (u) => u.skjema.f_cats.length > 0, mangler: () => "Velg minst én feil." },
  {
    id: "omrader",
    gruppe: "Feilen",
    ...som("omrader"),
    ferdig: (u) => u.skjema.f_cats.length > 0 && u.skjema.f_cats.every((c) => !!u.skjema.f_area[c]?.found),
    mangler: (u) => (u.skjema.f_cats.length ? "Legg inn når du oppdaget feilen for hver feil." : "Velg minst én feil først."),
  },
  { id: "virkning", gruppe: "Feilen", ...som("virkning"), ferdig: (u) => u.skjema.f_impact.length > 0, mangler: () => "Velg minst ett svar." },
  { id: "verksted", gruppe: "Feilen", ...som("verksted"), ferdig: (u) => !!u.skjema.ws, mangler: () => "Velg om feilen er undersøkt av et verksted." },
  { id: "selger_sa", gruppe: "Kontrakten", ...som("selger_sa"), ferdig: (u) => !!u.skjema.seller_said, mangler: () => "Velg hva selgeren sa." },
  // Nothing is required, but the date once the buyer says they have complained.
  { id: "sagt_fra", gruppe: "Kontrakten", ...som("sagt_fra"), ferdig: (u) => !u.skjema.f_prior || !!u.skjema.f_prior_date, mangler: () => "Legg inn når du sa fra." },
  { id: "kravet", gruppe: "Kravet", ...som("kravet"), ferdig: (u) => !!u.skjema.k_main, mangler: () => "Velg et krav." },
];

export const synlige = (u: Utkast) => SKJERMER.filter((s) => !s.vis || s.vis(u));

export type Valg = readonly [verdi: string, tittel: string, tekst?: string];

// The screens answered with one choice: the choices, the answer, and the draft with a new answer.
// They go on by themselves once answered.
export const ENKELTVALG: Record<string, { valg: readonly Valg[]; verdi: (u: Utkast) => string | undefined; sett: (u: Utkast, v: string) => Utkast }> = {
  // The buyer is taken to have bought for private use: the flow does not ask.
  selger: {
    valg: [
      ["forhandler", "En bilforhandler", "Merkeforhandler, bilforretning eller bruktbilforhandler"],
      ["privat", "En privatperson", "For eksempel via en annonse på nett"],
    ],
    verdi: (u) => (u.seller === "forhandler" || u.seller === "privat" ? u.seller : undefined),
    sett: (u, v) => ({ ...u, seller: v as Utkast["seller"], buyer: v === "forhandler" ? "privat" : undefined }),
  },
  // «Vet ikke» is kept beside the form, which only knows yes or no.
  forbehold: {
    valg: [["ja", "Ja"], ["nei", "Nei"], ["vetikke", "Vet ikke"]],
    verdi: (u) => u.asis,
    sett: (u, v) => ({ ...u, asis: v as Utkast["asis"], skjema: { ...u.skjema, c_asis: v === "ja" } }),
  },
};
