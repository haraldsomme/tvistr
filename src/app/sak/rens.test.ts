import { describe, expect, it } from "vitest";
import { idagOslo, rensBrevsvar, rensVedtakssvar } from "./rens";

const idag = idagOslo();
const aarSiden = (n: number) => `${Number(idag.slice(0, 4)) - n}${idag.slice(4)}`;

const SVAR = {
  valg: { elektrisk: ["lys"], motor: ["turbo", "finnes_ikke"] },
  tid: { motor: "innen_6_mnd", elektrisk: "6_til_24_mnd" },
  detaljer: {
    motor: { beskrivelse: "  Mistet kraft  ", opplysning: "nei", verksted: "skriftlig" },
    elektrisk: { opplysning: "muntlig", verksted: "nei" },
  },
  kjopsdato: aarSiden(1),
  km: 120_000,
  kjopesum: 150_000,
  ar: 2016,
  somDenEr: "ja",
  krav: "prisavslag",
  forsok: 1,
  bil: { regnr: "AB 12345", merke: "Volkswagen", modell: "Golf", ar: 2016 },
  selgerOrgnr: "999 999 999",
  tidligere: null,
  overslag: 12_000,
  utlegg: [],
};
const med = (endring: Record<string, unknown>) => ({ ...SVAR, ...endring });

describe("rensVedtakssvar", () => {
  it("beholder kategoriene i kategoriorden for rangeringen og kjøperens rekkefølge for brevet", () => {
    const r = rensVedtakssvar(SVAR);
    if (!r.ok) throw new Error(r.melding);
    expect(r.svar.valgte.map((h) => h.id)).toEqual(["motor", "elektrisk"]);
    expect(r.svar.rekkefolge).toEqual(["elektrisk", "motor"]);
    expect(r.svar.rent.motor).toEqual(["turbo"]);
    expect(r.svar.detaljer.motor.beskrivelse).toBe("Mistet kraft");
  });

  it("avviser tom feilvalg, manglende tid og kjøp eldre enn fem år", () => {
    expect(rensVedtakssvar({ ...SVAR, valg: {} })).toEqual({ ok: false, melding: "Velg minst én feil." });
    expect(rensVedtakssvar({ ...SVAR, tid: { motor: "innen_6_mnd" } })).toEqual({ ok: false, melding: "Velg når hver feil viste seg." });
    const r = rensVedtakssvar({ ...SVAR, kjopsdato: aarSiden(6) });
    expect(r.ok).toBe(false);
  });
});

describe("rensBrevsvar", () => {
  it("renser et fullt svar", () => {
    const r = rensBrevsvar(SVAR);
    if (!r.ok) throw new Error(r.melding);
    expect(r.svar.feil.map((f) => f.hoved)).toEqual(["elektrisk", "motor"]);
    expect(r.svar.selgerOrgnr).toBe("999999999");
    expect(r.svar.overslag).toBe(12_000);
    expect(r.svar.somDenEr).toBe("ja");
  });

  it("godtar «vet ikke» for «som den er»", () => {
    const r = rensBrevsvar(med({ somDenEr: "vet_ikke" }));
    expect(r.ok && r.svar.somDenEr).toBe("vet_ikke");
  });

  it("avviser manglende felt og gir en melding", () => {
    for (const endring of [{ kjopesum: 0 }, { km: null }, { krav: "noe" }, { bil: {} }, { bil: { regnr: "!", merke: "A", modell: "B" } }, { selgerOrgnr: "123" }, { selgerOrgnr: undefined }, { kjopsdato: "i går" }]) {
      const r = rensBrevsvar(med(endring));
      expect(r.ok, JSON.stringify(endring)).toBe(false);
      if (!r.ok) expect(r.melding).toBeTruthy();
    }
  });

  it("krever svar på verksted og selgers opplysning for hver feil", () => {
    const r = rensBrevsvar(med({ detaljer: { motor: { verksted: "nei" }, elektrisk: { opplysning: "nei", verksted: "nei" } } }));
    expect(r.ok).toBe(false);
  });

  it("tar bare med kostnadsoverslaget når et verksted har skrevet en vurdering", () => {
    const uten = rensBrevsvar(med({ detaljer: { motor: { opplysning: "nei", verksted: "muntlig" }, elektrisk: { opplysning: "nei", verksted: "nei" } } }));
    expect(uten.ok && uten.svar.overslag).toBeNull();
  });

  it("sjekker datoen for tidligere reklamasjon mot kjøpsdato og i dag", () => {
    const ok = rensBrevsvar(med({ tidligere: { dato: aarSiden(0), form: "skriftlig" } }));
    expect(ok.ok && ok.svar.tidligere).toEqual({ dato: aarSiden(0), form: "skriftlig" });
    for (const tidligere of [{ dato: aarSiden(3), form: "skriftlig" }, { dato: "2999-01-01", form: "muntlig" }, { dato: aarSiden(0), form: "epost" }]) expect(rensBrevsvar(med({ tidligere })).ok).toBe(false);
  });

  it("renser utlegg og avviser linjer uten beskrivelse eller beløp", () => {
    const ok = rensBrevsvar(med({ utlegg: [{ beskrivelse: " Tauing ", belop: 1200 }] }));
    expect(ok.ok && ok.svar.utlegg).toEqual([{ beskrivelse: "Tauing", belop: 1200 }]);
    for (const utlegg of [[{ beskrivelse: "", belop: 100 }], [{ beskrivelse: "Tauing", belop: 0 }], [{ beskrivelse: "Tauing", belop: "100" }]]) expect(rensBrevsvar(med({ utlegg })).ok).toBe(false);
  });

  it("tåler søppel", () => {
    expect(rensBrevsvar({}).ok).toBe(false);
    expect(rensBrevsvar({ valg: "motor", detaljer: 5 }).ok).toBe(false);
  });
});
