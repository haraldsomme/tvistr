import { afterEach, describe, expect, it, vi } from "vitest";
import { hentForhandler, orgnrFra, sokForhandler, tilForhandler } from "./brreg";

const enhet = (o: Record<string, unknown> = {}) => ({
  organisasjonsnummer: "999888777",
  navn: "TESTBIL AS",
  organisasjonsform: { kode: "AS" },
  naeringskode1: { beskrivelse: "Detaljhandel med biler" },
  forretningsadresse: { adresse: ["Industriveien 3"], postnummer: "0184", poststed: "OSLO", kommune: "OSLO" },
  ...o,
});

const ADRESSE = { linjer: ["Industriveien 3"], postnummer: "0184", poststed: "Oslo" };

const svar = (status: number, json: unknown) => vi.fn(async () => new Response(JSON.stringify(json), { status }));
afterEach(() => vi.unstubAllGlobals());

describe("orgnrFra", () => {
  it("godtar ni siffer, også med mellomrom", () => {
    expect(orgnrFra("999888777")).toBe("999888777");
    expect(orgnrFra(" 999 888 777 ")).toBe("999888777");
  });

  it("avviser alt annet", () => {
    for (const s of ["", "99988877", "9998887777", "999 888 77x", "Testbil 999888777", "Testbil"]) expect(orgnrFra(s)).toBeNull();
  });
});

describe("sokForhandler", () => {
  it("søker på navn fra tre tegn, uten enkeltpersonforetak", async () => {
    const f = svar(200, { _embedded: { enheter: [enhet()] } });
    vi.stubGlobal("fetch", f);
    const r = await sokForhandler("testbil");
    expect(r).toEqual({ forslag: [{ orgnr: "999888777", navn: "TESTBIL AS", kommune: "OSLO", bransje: "Detaljhandel med biler", status: null, adresse: ADRESSE }] });
    const url = new URL((f.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("navn")).toBe("testbil");
    expect(url.searchParams.get("organisasjonsform")).not.toContain("ENK");
  });

  it("gir tomt svar for under tre tegn uten å kalle Brreg", async () => {
    const f = svar(200, {});
    vi.stubGlobal("fetch", f);
    expect(await sokForhandler("te")).toEqual({ forslag: [] });
    expect(f).not.toHaveBeenCalled();
  });

  it("slår opp org.nr direkte når søket er ni siffer", async () => {
    const f = svar(200, enhet({ konkurs: true }));
    vi.stubGlobal("fetch", f);
    const r = await sokForhandler("999 888 777");
    expect(r.forslag).toEqual([{ orgnr: "999888777", navn: "TESTBIL AS", kommune: "OSLO", bransje: "Detaljhandel med biler", status: "konkurs", adresse: ADRESSE }]);
    expect((f.mock.calls[0] as unknown as [string])[0]).toMatch(/\/enheter\/999888777$/);
  });

  it("gir tomt svar for ukjent org.nr og for enkeltpersonforetak", async () => {
    vi.stubGlobal("fetch", svar(404, {}));
    expect(await sokForhandler("999888777")).toEqual({ forslag: [] });
    vi.stubGlobal("fetch", svar(200, enhet({ organisasjonsform: { kode: "ENK" } })));
    expect(await sokForhandler("999888777")).toEqual({ forslag: [] });
  });

  it("melder feil når Brreg ikke svarer", async () => {
    vi.stubGlobal("fetch", svar(500, {}));
    expect(await sokForhandler("testbil")).toEqual({ forslag: [], feil: true });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("nett"); }));
    expect(await sokForhandler("999888777")).toEqual({ forslag: [], feil: true });
  });
});

describe("adresse", () => {
  const adresseFor = async (o: Record<string, unknown>) => {
    vi.stubGlobal("fetch", svar(200, enhet(o)));
    return (await hentForhandler("999888777"))?.adresse;
  };

  it("bruker postadressen når firmaet har en, ellers forretningsadressen", async () => {
    expect(await adresseFor({})).toEqual(ADRESSE);
    expect(await adresseFor({ postadresse: { adresse: ["Postboks 119"], postnummer: "1401", poststed: "SKI" } })).toEqual({
      linjer: ["Postboks 119"],
      postnummer: "1401",
      poststed: "Ski",
    });
  });

  it("faller tilbake på forretningsadressen når postadressen er ufullstendig", async () => {
    expect(await adresseFor({ postadresse: { adresse: ["Postboks 1"] } })).toEqual(ADRESSE);
  });

  it("gir null når ingen adresse er brukbar", async () => {
    expect(await adresseFor({ forretningsadresse: { adresse: ["Gata 1"] } })).toBeNull();
    expect(await adresseFor({ forretningsadresse: undefined })).toBeNull();
  });

  it("tilForhandler gir pent navn og tar med adressen bare når den finnes", () => {
    const f = { orgnr: "999888777", navn: "TESTBIL AS", kommune: null, bransje: null, status: null };
    expect(tilForhandler({ ...f, adresse: ADRESSE })).toEqual({ type: "brreg", orgnr: "999888777", navn: "Testbil AS", adresse: ADRESSE });
    expect(tilForhandler({ ...f, adresse: null })).toEqual({ type: "brreg", orgnr: "999888777", navn: "Testbil AS" });
  });
});

describe("hentForhandler", () => {
  it("gir forslaget for org.nr, ellers null", async () => {
    vi.stubGlobal("fetch", svar(200, enhet()));
    expect((await hentForhandler("999888777"))?.navn).toBe("TESTBIL AS");
    expect(await hentForhandler("abc")).toBeNull();
    vi.stubGlobal("fetch", svar(404, {}));
    expect(await hentForhandler("999888777")).toBeNull();
  });
});
