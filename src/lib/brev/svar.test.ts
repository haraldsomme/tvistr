import { describe, expect, it } from "vitest";
import { TOM_INNSENDING, type Innsending } from "@/lib/vurdering/innsending";
import { lesSvar } from "./svar";

const IDAG = "2026-10-02";

const gyldig: Innsending = {
  ...TOM_INNSENDING,
  kjopsdato: "2026-03-12",
  kjopesum: "250000",
  kmVedKjop: "80000",
  feiltyper: ["motor"],
  oppdaget: "innen_6_mnd",
  opplystForKjop: "nei",
  feilOpplysning: "nei",
  kontakt: "nei",
  verkstedrapport: "nei",
  bilder: "nei",
};

describe("lesSvar", () => {
  it("godtar et komplett svar og gir det tilbake slik det skal lagres", () => {
    expect(lesSvar(gyldig, IDAG)).toEqual({ ok: true, svar: gyldig, fristUte: false });
  });

  it("dropper felt som ikke hører til skjemaet", () => {
    const r = lesSvar({ ...gyldig, regnr: "ZZ 99999", sak: "x" }, IDAG);
    expect(r).toEqual({ ok: true, svar: gyldig, fristUte: false });
  });

  it("avviser ufullstendige og ugyldige svar med meldingen fra skjemaet", () => {
    expect(lesSvar({ ...gyldig, kontakt: "" }, IDAG)).toEqual({ ok: false, feil: "Svar på om du har kontaktet forhandleren." });
    expect(lesSvar({ ...gyldig, kjopsdato: "2026-10-03" }, IDAG)).toEqual({ ok: false, feil: "Kjøpet kan ikke være i fremtiden." });
    expect(lesSvar({ ...gyldig, kjopesum: "0" }, IDAG).ok).toBe(false);
  });

  it("avviser alt som ikke er et objekt", () => {
    for (const raw of [null, "x", [], 1]) expect(lesSvar(raw, IDAG).ok).toBe(false);
  });

  it("godtar et svar som gjør at fristen er ute, men sier fra", () => {
    // Over fem år siden kjøpet, og forhandleren er ikke kontaktet.
    const r = lesSvar({ ...gyldig, kjopsdato: "2021-03-12", oppdaget: "over_2_ar" }, IDAG);
    expect(r).toEqual({ ok: true, svar: { ...gyldig, kjopsdato: "2021-03-12", oppdaget: "over_2_ar" }, fristUte: true });
  });

  it("avgjør fristen ut fra når forhandleren først ble kontaktet, når kjøpet er over fem år gammelt", () => {
    // Fristen gikk ut 12. mars 2026; måneden regnes som dens siste dag.
    const svar = { ...gyldig, kjopsdato: "2021-03-12", oppdaget: "over_2_ar" as const, kontakt: "venter" as const };
    const reklamert = (ar: string, maned: string) => lesSvar({ ...svar, reklamasjonAr: ar, reklamasjonManed: maned }, IDAG);
    expect(reklamert("2025", "11")).toMatchObject({ ok: true, fristUte: false });
    expect(reklamert("2026", "2")).toMatchObject({ ok: true, fristUte: false });
    expect(reklamert("2026", "3")).toMatchObject({ ok: true, fristUte: true });
    expect(reklamert("2026", "9")).toMatchObject({ ok: true, fristUte: true });
    // Uten dato spør skjemaet, og svaret avvises.
    expect(lesSvar(svar, IDAG).ok).toBe(false);
  });
});
