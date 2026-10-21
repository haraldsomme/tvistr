// The screens before payment (mockup «Sjekk saken»), one per screen: who sold and bought, then every
// answer that shapes the letter, in the letter's order. A screen is done when it has what the letter
// and the verdict need; «Neste» waits for it. Private sales, leasing and purchases through a company are
// not covered: their screen stays undone.
import { seksjon } from "@/app/sak/skjema/steg";
import { manglerISkjema } from "@/lib/app/saken";
import type { Utkast } from "@/lib/app/utkast";

export type Skjerm = {
  id: string;
  gruppe: "Kjøpet" | "Feilen" | "Kontrakten" | "Kravet";
  tittel: string;
  hint?: string;
  vis?: (u: Utkast) => boolean;
  ferdig: (u: Utkast) => boolean;
};

// The question of a screen that edits one of the form's sections, as the section asks it (steg.ts).
const som = (id: string) => {
  const { tittel, hint } = seksjon(id);
  return { tittel, hint };
};

export const SKJERMER: Skjerm[] = [
  { id: "selger", gruppe: "Kjøpet", tittel: "Hvem kjøpte du bilen av?", hint: "Hvem som solgte bilen, avgjør hvilken lov som gjelder.", ferdig: (u) => u.seller === "forhandler" },
  { id: "kjoper", gruppe: "Kjøpet", tittel: "Kjøpte du bilen privat eller gjennom firma?", hint: "Som privatperson har du sterkere rettigheter.", vis: (u) => u.seller === "forhandler", ferdig: (u) => u.buyer === "privat" },
  {
    id: "bilen",
    gruppe: "Kjøpet",
    ...som("bilen"),
    ferdig: (u) => {
      const m = manglerISkjema(u.skjema);
      return m !== "reg" && m !== "bil";
    },
  },
  { id: "kjopet", gruppe: "Kjøpet", ...som("kjopet"), ferdig: (u) => !!(u.skjema.c_purchase || u.skjema.c_delivery) },
  { id: "forbehold", gruppe: "Kontrakten", tittel: "Står det «som den er» i kontrakten?", hint: "Se etter formuleringer som «solgt som den er» eller «som besiktiget».", ferdig: (u) => u.asis !== undefined },
  { id: "feil", gruppe: "Feilen", ...som("feilen"), ferdig: (u) => u.skjema.f_cats.length > 0 },
  { id: "omrader", gruppe: "Feilen", ...som("omrader"), ferdig: (u) => u.skjema.f_cats.length > 0 && u.skjema.f_cats.every((c) => !!u.skjema.f_area[c]?.found) },
  { id: "arsak", gruppe: "Feilen", tittel: "Kan feilen skyldes noe annet enn bilen selv?", ferdig: (u) => !!u.skjema.f_cause_check },
  { id: "verksted", gruppe: "Feilen", ...som("verksted"), ferdig: (u) => !!u.skjema.ws },
  { id: "selger_sa", gruppe: "Kontrakten", ...som("selger_sa"), ferdig: (u) => !!u.skjema.seller_said },
  // Nothing is required, but the date once the buyer says they have complained.
  { id: "sagt_fra", gruppe: "Kontrakten", ...som("sagt_fra"), ferdig: (u) => !u.skjema.f_prior || !!u.skjema.f_prior_date },
  { id: "kravet", gruppe: "Kravet", ...som("kravet"), ferdig: (u) => !!u.skjema.k_main },
];

export const synlige = (u: Utkast) => SKJERMER.filter((s) => !s.vis || s.vis(u));

export type Valg = readonly [verdi: string, tittel: string, tekst?: string];

// The screens answered with one choice: the choices, the answer, and the draft with a new answer.
// They go on by themselves once answered.
export const ENKELTVALG: Record<string, { valg: readonly Valg[]; verdi: (u: Utkast) => string | undefined; sett: (u: Utkast, v: string) => Utkast }> = {
  selger: {
    valg: [
      ["forhandler", "En bilforhandler", "Merkeforhandler, bilforretning eller bruktbilforhandler"],
      ["privat", "En privatperson", "For eksempel via en annonse på nett"],
      ["leasing", "Bilen er leaset", "Du betaler leie og eier ikke bilen"],
    ],
    verdi: (u) => u.seller,
    sett: (u, v) => ({ ...u, seller: v as Utkast["seller"] }),
  },
  kjoper: {
    valg: [
      ["privat", "Privat", "Jeg kjøpte bilen til eget bruk"],
      ["naering", "Gjennom firma", "Bilen står på et firma eller ble kjøpt i næring"],
    ],
    verdi: (u) => u.buyer,
    sett: (u, v) => ({ ...u, buyer: v as Utkast["buyer"] }),
  },
  // «Vet ikke» is kept beside the form, which only knows yes or no.
  forbehold: {
    valg: [["ja", "Ja"], ["nei", "Nei"], ["vetikke", "Vet ikke"]],
    verdi: (u) => u.asis,
    sett: (u, v) => ({ ...u, asis: v as Utkast["asis"], skjema: { ...u.skjema, c_asis: v === "ja" } }),
  },
  arsak: {
    valg: [
      ["nei", "Nei, den bare oppsto", "Uten uhell eller feil bruk"],
      ["slitasje", "Det kan være vanlig slitasje", "For eksempel bremseklosser eller dekk"],
      ["uhell", "Uhell, skade eller feil bruk", "For eksempel en kollisjon eller feil drivstoff"],
      ["vetikke", "Vet ikke"],
    ],
    verdi: (u) => u.skjema.f_cause_check || undefined,
    sett: (u, v) => ({ ...u, skjema: { ...u.skjema, f_cause_check: v } }),
  },
};
