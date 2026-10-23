import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvledetFeil } from "@/lib/feilvurdering/skjema";
import type { Rangert } from "@/lib/matching/ranger";
import type { Brukersak, Kandidat } from "@/lib/matching/typer";
import type { Kjoper } from "./kjoper";

const kallVerktoy = vi.fn();
vi.mock("@/lib/ai/klient", () => ({ kallVerktoy }));
const { alternativer, byggValg, endringMot, erLagretSvar, fraLagret, grunnlagFor, sitaterFor, sporModellen, tilLagret, tolkSvar, VEDTAKSVALG_VERSJON } = await import("./valg");
type Sitatvalg = import("./valg").Sitatvalg;
type Valggrunnlag = import("./valg").Valggrunnlag;

const feil = { id: "f1", hovedkategori: "motor", underkategori: "turbo", komponent: "turbo" } as AvledetFeil;
const rangert = (id: number, niva: "A" | "B"): Rangert => ({ id, niva, feil: niva === "A" ? feil : null, hoved: null, rett: [], poengsum: 0, treff: {} as Rangert["treff"] });
const sitater = (n: number): Sitatvalg[] => Array.from({ length: n }, (_, i) => ({ id: `s${i + 1}`, tekst: `Sitat ${i + 1} fra utvalgets vurdering.`, feil }));

const kandidater = [rangert(1, "A"), rangert(2, "B")];
const alle = new Map([
  [1, sitater(3)],
  [2, sitater(3)],
]);

describe("tolkSvar", () => {
  it("bruker modellens valg og sitater i modellens rekkefølge", () => {
    const t = tolkSvar({ vedtak_id: 1, sitater: ["s3", "s1"] }, kandidater, alle);
    expect([t.r.id, t.valgte.map((s) => s.id), t.fulgt]).toEqual([1, ["s3", "s1"], true]);
  });

  it("tar to sitater på nivå A og ett på nivå B", () => {
    expect(tolkSvar({ vedtak_id: 1, sitater: ["s1", "s2", "s3"] }, kandidater, alle).valgte).toHaveLength(2);
    expect(tolkSvar({ vedtak_id: 2, sitater: ["s1", "s2"] }, kandidater, alle).valgte).toHaveLength(1);
  });

  it("velger høyeste poeng uten nytt forsøk når vedtaket er ukjent eller svaret mangler", () => {
    for (const svar of [{ vedtak_id: 99, sitater: ["s1"] }, null]) {
      const t = tolkSvar(svar, kandidater, alle);
      expect([t.r.id, t.valgte.map((s) => s.id), t.fulgt]).toEqual([1, ["s1", "s2"], false]);
    }
  });

  it("godtar ikke sitat-id-er vedtaket ikke har", () => {
    expect(tolkSvar({ vedtak_id: 2, sitater: ["s9"] }, kandidater, alle).fulgt).toBe(false);
  });
});

describe("alternativer", () => {
  const fire = [rangert(1, "A"), rangert(2, "A"), rangert(3, "B"), rangert(4, "A")];
  const s = new Map(fire.map((r) => [r.id, sitater(3)]));

  it("er resten av rangeringen, i rekkefølge, med sine første sitater", () => {
    const a = alternativer(fire, 2, s);
    expect(a.map((x) => x.r.id)).toEqual([1, 3, 4]);
    expect(a.map((x) => x.valgte.map((v) => v.id))).toEqual([["s1", "s2"], ["s1"], ["s1", "s2"]]);
  });

  it("er tom med én kandidat", () => expect(alternativer([rangert(1, "A")], 1, s)).toEqual([]));

  it("hopper over kandidater uten sitater", () => expect(alternativer(fire, 1, new Map([[2, []], [3, sitater(1)], [4, sitater(2)]])).map((x) => x.r.id)).toEqual([3, 4]));
});

// Decisions on the turbo, each with three verified quotes «Vedtak {id}: sitat {n}.».
const turbo = (id: number) => ({ id: `f${id}`, hovedkategori: "motor", underkategori: "turbo", komponent: "turbo", utfall: "medhold", samlet: false, tidsniva: 1 }) as AvledetFeil;
const kandidat = (id: number): Kandidat => ({
  id, saksnummer: `${id}/1`, vedtaksdato: null, km: 150000, alder: 10, somDenEr: false, sanksjoner: ["retting"], mangelsgrunnlag: null, paragrafer: null, tvistetema: null, feil: [turbo(id)],
  avgjorende: { selger_svarte: true, feil: [{ id: `f${id}`, avgjorende: "", hjemmel: [], bevis: [], samlet_med: [], under_tvil: false, sanksjoner: ["retting"], sitater: [1, 2, 3].map((n) => `Vedtak ${id}: sitat ${n}.`) }] },
});
const a = (id: number): Rangert => ({ id, niva: "A", feil: turbo(id), hoved: "motor", rett: [], poengsum: 10 - id, treff: {} as Rangert["treff"] });
const brukersak: Brukersak = { kategorier: [{ hoved: "motor", under: ["turbo"], niva: 1, opplysning: null, verksted: null }], km: 50000, alder: 3, somDenEr: false, krav: "retting", forsok: null };
const grunnlag = (kandidater: Rangert[][]): Valggrunnlag => ({
  kjoper: { feil: [] } as unknown as Kjoper,
  sak: brukersak,
  kandidater,
  alle: new Map([1, 2, 3, 4].map((id) => [id, kandidat(id)])),
  detaljer: new Map([1, 2, 3, 4].map((id) => [id, { kildeUrl: `https://example.org/${id}.pdf`, utvalg: "Forbrukerklageutvalget", merke: "Volkswagen", modell: "Golf", arsmodell: 2014 }])),
});

describe("byggValg per feil", () => {
  it("ett valg per feil: modellens der det holder, rangeringens førstevalg ellers, null uten kandidater", () => {
    const o = grunnlag([[a(1), a(2)], [a(3), a(4)], []]);
    const v = byggValg({ valg: [{ feil_nr: 1, vedtak_id: 2, sitater: ["s2"] }, { feil_nr: 2, vedtak_id: 99, sitater: ["s1"] }] }, o);
    expect(v.feil.map((f) => f && [f.r.id, f.fulgt])).toEqual([[2, true], [3, false], null]);
    expect(v.feil[0]!.sitater).toEqual(["Vedtak 2: sitat 2."]);
    expect(v.feil[0]!.alternativer.map((x) => x.r.id)).toEqual([1]);
    expect(v.feil[1]!.avsnitt).toContain("Vedtak 3: sitat 1.");
  });
  it("det samme vedtaket kan velges for to feil", () => {
    const v = byggValg({ valg: [{ feil_nr: 1, vedtak_id: 1, sitater: ["s1"] }, { feil_nr: 2, vedtak_id: 1, sitater: ["s3"] }] }, grunnlag([[a(1)], [a(1)]]));
    expect(v.feil.map((f) => [f!.r.id, f!.sitater])).toEqual([[1, ["Vedtak 1: sitat 1."]], [1, ["Vedtak 1: sitat 3."]]]);
  });
});

describe("sporModellen per feil", () => {
  beforeEach(() => kallVerktoy.mockReset());
  it("spør ikke når ingen feil har kandidater", async () => {
    expect((await sporModellen(grunnlag([[], []]))).svar).toBeNull();
    expect(kallVerktoy).not.toHaveBeenCalled();
  });
  it("ett kall med kandidatene gruppert per feil", async () => {
    kallVerktoy.mockResolvedValue({ input: { valg: [{ feil_nr: 1, vedtak_id: 1, sitater: ["s1"] }] }, modell: "m", forbruk: { tokensInn: 1, tokensUt: 1, kostnadUsd: 0.01 } });
    const r = await sporModellen(grunnlag([[a(1)], [], [a(3)]]));
    expect(kallVerktoy).toHaveBeenCalledTimes(1);
    const bruker: string = kallVerktoy.mock.calls[0][0].bruker;
    expect(bruker).toContain('"feil_nr":1');
    expect(bruker).toContain('"feil_nr":3');
    expect(bruker).not.toContain('"feil_nr":2');
    expect(r.svar).toEqual({ valg: [{ feil_nr: 1, vedtak_id: 1, sitater: ["s1"] }] });
  });
});

describe("tilLagret og fraLagret per feil", () => {
  const o = grunnlag([[a(1), a(2)], [a(3)]]);
  const sit = sitaterFor(o);
  it("lagrer sitatene som tekst per feil og finner dem igjen", () => {
    const lagret = tilLagret("g", { valg: [{ feil_nr: 1, vedtak_id: 2, sitater: ["s3", "s1"] }, { feil_nr: 2, vedtak_id: 3, sitater: ["s2"] }] }, sit);
    expect(lagret).toEqual({ grunnlag: "g", valg: [{ vedtakId: 2, sitater: ["Vedtak 2: sitat 3.", "Vedtak 2: sitat 1."] }, { vedtakId: 3, sitater: ["Vedtak 3: sitat 2."] }] });
    expect(fraLagret(lagret, o.kandidater, sit)).toEqual({ valg: [{ feil_nr: 1, vedtak_id: 2, sitater: ["s3", "s1"] }, { feil_nr: 2, vedtak_id: 3, sitater: ["s2"] }] });
  });
  it("et vedtak som er borte for én feil, faller bort bare for den", () => {
    const lagret = { grunnlag: "g", valg: [{ vedtakId: 9, sitater: [] }, { vedtakId: 3, sitater: ["Vedtak 3: sitat 1."] }] };
    expect(fraLagret(lagret, o.kandidater, sit)).toEqual({ valg: [{ feil_nr: 2, vedtak_id: 3, sitater: ["s1"] }] });
    expect(fraLagret({ grunnlag: "g", valg: [{ vedtakId: 9, sitater: [] }, null] }, o.kandidater, sit)).toBeNull();
    expect(fraLagret(undefined, o.kandidater, sit)).toBeNull();
  });
  it("et lagret svar i den gamle formen (ett vedtak for saken) regnes som tomt", () => {
    expect(erLagretSvar({ grunnlag: "g", vedtakId: 1, sitater: [] })).toBe(false);
    expect(fraLagret({ grunnlag: "g", vedtakId: 1, sitater: [] }, o.kandidater, sit)).toBeNull();
  });
});

describe("grunnlagFor", () => {
  const k = { feil: [] } as unknown as Kjoper;
  it("endres med listene per feil og med versjonen", () => {
    expect(grunnlagFor(k, [[a(1)], [a(2)]])).not.toBe(grunnlagFor(k, [[a(1), a(2)]]));
    expect(grunnlagFor(k, [[a(1)], [a(2)]])).toBe(grunnlagFor(k, [[a(1)], [a(2)]]));
    expect(VEDTAKSVALG_VERSJON).toBe("vedtaksvalg-v11");
  });
});

describe("endringMot", () => {
  const nr = (id: number) => `${id}`;
  it("er null første gang og når listen er den samme", () => {
    expect(endringMot(undefined, [1, 2], nr)).toBeNull();
    expect(endringMot([1, 2, 3], [1, 3, 2], nr)).toBeNull();
  });
  it("nevner det forrige anbefalte bare når det er byttet", () => {
    expect(endringMot([1, 2, 3], [1, 2, 4], nr)).toEqual({ forrigeAnbefalt: null, nye: [4] });
    expect(endringMot([1, 2, 3], [2, 1, 3], nr)).toEqual({ forrigeAnbefalt: { id: 1, saksnummer: "1" }, nye: [] });
  });
});
