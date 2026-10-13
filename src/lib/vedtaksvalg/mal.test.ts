import { describe, expect, it } from "vitest";
import { avsnittA, avsnittB, type Kjoperbil, type Malvedtak, sammenligning, visDato, visSaksnummer } from "./mal";

const vedtak = (v: Partial<Malvedtak> = {}): Malvedtak => ({
  utvalg: "Forbrukerklageutvalget",
  saksnummer: "22/2868",
  vedtaksdato: "2023-03-22",
  bil: null,
  merke: "Ford",
  modell: "S-Max",
  arsmodell: 2010,
  km: 106_500,
  alder: 10,
  somDenEr: false,
  ...v,
});
const kjoper = (k: Partial<Kjoperbil> = {}): Kjoperbil => ({ km: null, alder: null, somDenEr: null, ...k });
const S1 = "Klageren hadde grunn til å regne med at bilen hadde fulgt serviceprogrammet.";
const S2 = "Det foreligger en mangel";

describe("sammenligning", () => {
  it("utelates når ingen akse går i kjøperens favør", () => {
    expect(sammenligning(kjoper({ km: 200_000, alder: 12, somDenEr: true }), vedtak())).toBeNull();
    expect(sammenligning(kjoper(), vedtak())).toBeNull();
  });

  it("nevner bare akser i kjøperens favør, aldri en som går mot", () => {
    const s = sammenligning(kjoper({ km: 50_000, alder: 12, somDenEr: false }), vedtak({ somDenEr: true }));
    expect(s).toBe("Bilen i foreliggende sak hadde gått kortere (50\u00a0000 mot 106\u00a0500 km) og var ikke solgt «som den er».");
    expect(s).not.toMatch(/yngre|eldre/);
  });

  it("krever en tydelig forskjell, siden vedtakets alder er regnet fra årsmodell", () => {
    expect(sammenligning(kjoper({ alder: 9 }), vedtak())).toBeNull();
    expect(sammenligning(kjoper({ alder: 8 }), vedtak())).toBe("Bilen i foreliggende sak var yngre (8 mot 10 år).");
    expect(sammenligning(kjoper({ km: 100_000 }), vedtak())).toBeNull();
  });
});

describe("avsnittA", () => {
  it("inneholder bare feltene og sitatene", () => {
    const tekst = avsnittA(vedtak(), "manglende servicehistorikk", [S1, S2], ["prisavslag"], kjoper({ alder: 7 }));
    expect(tekst).toBe(
      "Det vises til Forbrukerklageutvalgets vedtak i sak 22/2868 av 22.3.2023. Saken gjaldt manglende servicehistorikk på en Ford S-Max av årsmodell 2010 som hadde gått 106 500 km ved kjøpet. " +
        `Utvalget uttalte: «${S1}» Utvalget uttalte videre: «${S2}». Kjøperen fikk medhold i krav om prisavslag. Bilen i foreliggende sak var yngre (7 mot 10 år).`,
    );
  });

  it("bruker bilen slik vedtaket skriver den", () => {
    expect(avsnittA(vedtak({ bil: "Range Rover Sport 2014-modell", km: null }), "turbo", [S1], [], kjoper())).toContain("Saken gjaldt turbo på en Range Rover Sport 2014-modell.");
  });

  it("utelater det som mangler i feltene", () => {
    const tekst = avsnittA(vedtak({ merke: null, modell: null, km: null, vedtaksdato: null, somDenEr: true }), "turbo", [S1], [], kjoper());
    expect(tekst).toBe(`Det vises til Forbrukerklageutvalgets vedtak i sak 22/2868. Saken gjaldt turbo på en bil av årsmodell 2010, solgt «som den er». Utvalget uttalte: «${S1}»`);
  });
});

describe("avsnittB", () => {
  it("navngir feilen vedtaket gjaldt og siterer utvalget", () => {
    expect(avsnittB(vedtak({ saksnummer: "FKU-2026-117158" }), "lakk", S1)).toBe(`Det vises til Forbrukerklageutvalgets vedtak i sak 117158 av 22.3.2023, som gjaldt lakk. Utvalget uttalte: «${S1}»`);
  });
});

describe("visning", () => {
  it("viser saksnummer og dato slik vedtaket gjør", () => {
    expect([visSaksnummer("FKU-2025-55355-2"), visSaksnummer("15/1211"), visSaksnummer(null)]).toEqual(["55355", "15/1211", null]);
    expect([visDato("2020-01-05"), visDato(null), visDato("2020")]).toEqual(["5.1.2020", null, null]);
  });
});
