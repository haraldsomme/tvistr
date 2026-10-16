import { describe, expect, it } from "vitest";
import { HENDELSER, rensMaling } from "./maling";

describe("målingen", () => {
  const okt = "a1b2c3d4-0000-4000-8000-000000000000";
  it("har alle hendelsene fra planen", () =>
    expect(HENDELSER).toEqual(["landing", "sjekk_startet", "resultat_vist", "kjop_klikket", "betaling_fullfort", "brev_kopiert"]));
  it("beholder bare hendelse, status og kjente kategorier", () =>
    expect(rensMaling({ okt, hendelse: "resultat_vist", status: "mulig", kategorier: ["motor", "motor.turbo", "EK 48213", "Kari"], regnr: "EK 48213", navn: "Kari" })).toEqual({
      okt,
      hendelse: "resultat_vist",
      status: "mulig",
      kategorier: ["motor", "motor.turbo"],
    }));
  it("avviser ukjente hendelser, statuser og økt-id-er", () => {
    expect(rensMaling({ okt, hendelse: "noe_annet" })).toBeNull();
    expect(rensMaling({ okt, hendelse: "steg7_vist" })).toBeNull();
    expect(rensMaling({ okt, hendelse: "resultat_vist", status: "sak" })).toBeNull();
    expect(rensMaling({ okt, hendelse: "landing", status: "kanskje" })).toBeNull();
    expect(rensMaling({ okt: "EK 48213", hendelse: "landing" })).toBeNull();
    expect(rensMaling(null)).toBeNull();
  });
});
