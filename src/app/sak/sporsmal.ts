// The free check's questions (artifact QS), one per screen. Used cars only: no «ny eller brukt».
import type { Sjekk } from "@/lib/app/saken";

export type Valg = [verdi: string, tittel: string, tekst?: string];
export type Sporsmal = {
  id: keyof Sjekk;
  type: "single" | "car" | "date" | "faults";
  title: string;
  hint?: string;
  opts?: Valg[];
  // Shown only when this holds; `dep` is the answer it depends on, for the count of questions ahead.
  show?: (a: Sjekk) => boolean;
  dep?: keyof Sjekk;
  // An answer that ends the check with an «utenfor» result.
  terminal?: (v: unknown) => boolean;
};

export const SPORSMAL: Sporsmal[] = [
  {
    id: "seller",
    type: "single",
    title: "Hvem kjøpte du bilen av?",
    hint: "Hvem som solgte bilen, avgjør hvilken lov som gjelder.",
    opts: [
      ["forhandler", "En bilforhandler", "Merkeforhandler, bilforretning eller bruktbilforhandler"],
      ["privat", "En privatperson", "For eksempel via en annonse på nett"],
      ["leasing", "Bilen er leaset", "Du betaler leie og eier ikke bilen"],
    ],
    terminal: (v) => v === "privat" || v === "leasing",
  },
  {
    id: "buyer",
    type: "single",
    dep: "seller",
    show: (a) => a.seller === "forhandler",
    title: "Kjøpte du bilen privat eller gjennom firma?",
    hint: "Som privatperson har du sterkere rettigheter.",
    opts: [
      ["privat", "Privat", "Jeg kjøpte bilen til eget bruk"],
      ["naering", "Gjennom firma", "Bilen står på et firma eller ble kjøpt i næring"],
    ],
    terminal: (v) => v === "naering",
  },
  {
    id: "asis",
    type: "single",
    title: "Står det «som den er» i kontrakten?",
    hint: "Se etter formuleringer som «solgt som den er» eller «som besiktiget».",
    opts: [["nei", "Nei"], ["ja", "Ja"], ["vetikke", "Vet ikke"]],
  },
  { id: "reg", type: "car", title: "Hvilken bil gjelder det?", hint: "Vi henter merke, modell og når bilen sist ble registrert. Har du ikke registreringsnummeret for hånden, kan du hoppe over." },
  { id: "cats", type: "faults", title: "Hva gjelder reklamasjonen?", hint: "Velg alle områdene der du har funnet feil. Du kan velge flere." },
  {
    id: "known",
    type: "single",
    title: "Visste du om feilen da du kjøpte bilen?",
    opts: [
      ["nei", "Nei", "Feilen var ukjent for meg"],
      ["opplyst", "Ja, forhandleren opplyste om den", "Det sto i kontrakten eller ble sagt muntlig"],
      ["synlig", "Den var lett å se", "Jeg burde ha oppdaget den ved kjøpet"],
    ],
  },
  {
    id: "cause",
    type: "single",
    title: "Kan feilen skyldes noe annet enn bilen selv?",
    opts: [
      ["nei", "Nei, den bare oppsto", "Uten uhell eller feil bruk"],
      ["slitasje", "Det kan være vanlig slitasje", "For eksempel bremseklosser eller dekk"],
      ["uhell", "Uhell, skade eller feil bruk", "For eksempel en kollisjon eller feil drivstoff"],
      ["vetikke", "Vet ikke"],
    ],
  },
  { id: "notified", type: "single", title: "Har du sagt fra til forhandleren?", opts: [["nei", "Ikke ennå"], ["ja", "Ja, jeg har sagt fra"]] },
  { id: "notifiedDate", type: "date", dep: "notified", show: (a) => a.notified === "ja", title: "Når sa du fra første gang?", hint: "Datoen for første reklamasjon er den som teller." },
];

export const synlige = (a: Sjekk) => SPORSMAL.filter((q) => !q.show || q.show(a));
// Questions possibly ahead: a conditional one counts until its answer rules it out, so the total only shrinks.
export const anslag = (a: Sjekk) => SPORSMAL.filter((q) => !q.show || q.show(a) || a[q.dep!] === undefined).length;
