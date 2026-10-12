import type { Brukersak, Kandidat } from "./typer";

// The legal points a decision can be cited for even when its defect is a different one (step 5).
// Which points matter follows from the buyer's answers; whether a decision decided one follows from
// fields already extracted from it. `mangelsgrunnlag` is what the buyer pleaded, so the points built
// on it ask for more than that field alone where they can.
export const RETTSLIGE_POENG = [
  {
    id: "formodning",
    tekst: "formodningsregelen (fkjl. § 18 annet ledd)",
    aktuell: (s: Brukersak) => s.kategorier.some((c) => c.niva === 1),
    har: (k: Kandidat) => k.feil.some((f) => f.utfall === "medhold" && f.formodning === "anvendt"),
  },
  {
    id: "som_den_er",
    tekst: "«som den er» fritar ikke selgeren (fkjl. § 17)",
    aktuell: (s: Brukersak) => s.somDenEr === true,
    har: (k: Kandidat) => k.somDenEr === true && !!k.paragrafer?.includes("fkjl § 17"),
  },
  {
    id: "sen_feil",
    tekst: "en feil som viser seg etter to år kan være en mangel (fkjl. § 27)",
    aktuell: (s: Brukersak) => s.kategorier.some((c) => c.niva === 3),
    har: (k: Kandidat) => k.feil.some((f) => f.utfall === "medhold" && f.tidsniva === 3 && !f.samlet),
  },
  {
    id: "uriktig_opplysning",
    tekst: "uriktig opplysning fra selgeren (fkjl. § 16 første ledd bokstav c)",
    aktuell: (s: Brukersak) => s.kategorier.some((c) => c.opplysning === true),
    har: (k: Kandidat) => !!k.mangelsgrunnlag?.includes("feil_opplysninger"),
  },
  {
    id: "tilbakeholdt_opplysning",
    tekst: "selgeren holdt tilbake opplysninger (fkjl. § 16 første ledd bokstav b)",
    aktuell: (s: Brukersak) => s.kategorier.some((c) => c.opplysning === false),
    har: (k: Kandidat) => !!k.mangelsgrunnlag?.includes("tilbakeholdt_opplysning"),
  },
  {
    id: "tapt_retting",
    tekst: "selgeren har tapt retten til å rette etter mislykkede forsøk (fkjl. § 30)",
    aktuell: (s: Brukersak) => (s.forsok ?? 0) >= 2,
    har: (k: Kandidat) => !!k.tvistetema?.includes("retting_forsok") && !!k.sanksjoner?.some((x) => x === "heving" || x === "prisavslag"),
  },
  {
    id: "palagt_retting",
    tekst: "selgeren plikter å rette mangelen (fkjl. § 29)",
    aktuell: (s: Brukersak) => s.krav === "retting",
    har: (k: Kandidat) => !!k.sanksjoner?.includes("retting"),
  },
  {
    id: "heving",
    tekst: "vilkåret for heving: mangelen er ikke uvesentlig (fkjl. § 32)",
    aktuell: (s: Brukersak) => s.krav === "heving",
    har: (k: Kandidat) => !!k.sanksjoner?.includes("heving") && !!k.tvistetema?.includes("heving_vesentlig"),
  },
  {
    id: "prisavslag",
    tekst: "utmåling av prisavslag (fkjl. § 31)",
    aktuell: (s: Brukersak) => s.krav === "prisavslag",
    har: (k: Kandidat) => !!k.sanksjoner?.includes("prisavslag") && !!k.tvistetema?.includes("prisavslag_storrelse"),
  },
] as const;

export type RettsligPoeng = (typeof RETTSLIGE_POENG)[number]["id"];

export const rettsligePoeng = (k: Kandidat, sak: Brukersak): RettsligPoeng[] =>
  RETTSLIGE_POENG.filter((p) => p.aktuell(sak) && p.har(k)).map((p) => p.id);

export const poengtekst = (id: RettsligPoeng) => RETTSLIGE_POENG.find((p) => p.id === id)!.tekst;
