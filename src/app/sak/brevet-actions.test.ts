import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sak } from "@/db/schema";
import type { Presedens } from "@/lib/app/brevtyper";
import { eksempel } from "@/lib/app/skjema";

const hentEgenSak = vi.fn<(id: unknown) => Promise<Sak | null>>(async () => null);
const lignendeFor = vi.fn(async () => ({ tall: [], kort: [kort], sammenligning: null }));
const grense = vi.hoisted(() => ({ full: false }));
vi.mock("next/headers", () => ({ headers: async () => new Map([["x-forwarded-for", "10.0.0.1"]]) }));
vi.mock("@/lib/sak/db", () => ({ hentEgenSak }));
vi.mock("@/app/sak/lignende-db", () => ({ lignendeFor }));
vi.mock("@/lib/rategrense", () => ({ lagGrense: () => () => grense.full, ipFra: () => "10.0.0.1" }));

const { forhandsvis, fulltBrev } = await import("./brevet-actions");
const { idag } = await import("@/lib/app/dato");

const dag = idag();
const kort = { id: 1, saksnummer: "22/3390", ar: "2022", bil: "Toyota RAV4 2019", km: 54000, somDenEr: false, fikk: ["retting"], feil: "Automatgir" };
const skjema = eksempel(dag);
const betaltSak: Sak = { id: "abcdefghijkm", vippsSub: "sub", sjekk: {}, skjema, betalt: new Date(), vedtaksvalg: null, modellkall: 0, opprettet: new Date(), endret: new Date() };
const presedens: Presedens = {
  id: 7,
  saksnummer: "22/3390",
  vedtaksdato: "2022-05-01",
  bil: "Toyota RAV4 2019",
  utfall: ["retting"],
  avsnitt: "I sak 22/3390 fikk kjøperen medhold.",
  kildeUrl: "https://www.forbrukerradet.no/vedtak/22-3390",
  utvalg: "Forbrukerklageutvalget",
  anbefalt: true,
  niva: "A",
  gjaldt: "Automatgir",
  km: 54000,
  alder: 3,
  somDenEr: false,
  likhet: 80,
  treff: { underkategori: "likt", tidsniva: "likt", km: "mildere", alder: "likt", som_den_er: "likt", krav: "likt", egen_vurdering: "likt", grunnlag: "ukjent" },
};

beforeEach(() => {
  vi.clearAllMocks();
  grense.full = false;
  hentEgenSak.mockResolvedValue(null);
});

describe("forhandsvis", () => {
  it("gir det sladdede brevet og de lignende sakene", async () => {
    const r = await forhandsvis({ utkast: { skjema } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(JSON.stringify(r)).not.toContain("Det er derfor dere som må bevise");
    // The letter cites the first card by its car, never its number (the card itself shows it, as today).
    const brev = JSON.stringify(r.blokker);
    expect(brev).toContain("Toyota RAV4 2019");
    expect(brev).not.toContain("22/3390");
    expect(r.lignende?.kort).toEqual([kort]);
  });

  it("avviser et utkast som ikke er et skjema", async () => {
    expect((await forhandsvis({ utkast: "x" })).ok).toBe(false);
    expect(lignendeFor).not.toHaveBeenCalled();
  });

  it("uten lignende saker for en sak brevet ikke dekker", async () => {
    const r = await forhandsvis({ utkast: { skjema, seller: "privat" } });
    expect(r.ok && r.lignende).toBeNull();
    expect(lignendeFor).not.toHaveBeenCalled();
  });

  it("stopper ved for mange forsøk", async () => {
    grense.full = true;
    expect(await forhandsvis({ utkast: { skjema } })).toEqual({ ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." });
  });

  it("gir brevet uten lignende saker når databasen feiler", async () => {
    const logg = vi.spyOn(console, "error").mockImplementation(() => {});
    lignendeFor.mockRejectedValueOnce(new Error("nede"));
    const r = await forhandsvis({ utkast: { skjema } });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.lignende).toBeNull();
    expect(r.blokker.length).toBeGreaterThan(0);
    // Without a card the letter has no decision to name.
    expect(JSON.stringify(r.blokker)).not.toContain("Toyota RAV4 2019");
    // Only the error's message is logged, never the answers.
    expect(logg).toHaveBeenCalledWith(expect.any(String), "nede");
    expect(JSON.stringify(logg.mock.calls)).not.toContain(skjema.c_reg);
    logg.mockRestore();
  });
});

describe("fulltBrev", () => {
  it("gir ingenting uten en egen betalt sak", async () => {
    expect(await fulltBrev({ id: betaltSak.id, skjema, presedenser: {} })).toEqual({ ok: false, melding: "Brevet er ikke betalt." });
  });

  it("bruker sakens bil, ikke den som sendes", async () => {
    hentEgenSak.mockResolvedValue(betaltSak);
    const r = await fulltBrev({ id: betaltSak.id, skjema: { ...skjema, c_reg: "ZZ 99999" }, presedenser: {} });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.tekst).toContain("EL 48213");
    expect(r.tekst).not.toContain("ZZ 99999");
    expect(r.tekst).toContain("Det er derfor dere som må bevise");
    expect(r.emne).toContain("EL 48213");
    expect(JSON.stringify(r.blokker)).not.toContain("skjult");
  });

  it("tar med vedtaket brevet viser til", async () => {
    hentEgenSak.mockResolvedValue(betaltSak);
    const r = await fulltBrev({ id: betaltSak.id, skjema, presedenser: { hoyvolt: presedens } });
    expect(r.ok && r.tekst).toContain("Vedtaket er offentlig tilgjengelig på https://www.forbrukerradet.no/vedtak/22-3390");
    const v = await fulltBrev({ id: betaltSak.id, skjema, presedenser: { hoyvolt: "venter" } });
    expect(v.ok && v.tekst).toContain("[lignende sak hentes]");
  });

  it("en nøkkel brevet ikke har, gir fortsatt brev med lovsetningen", async () => {
    hentEgenSak.mockResolvedValue(betaltSak);
    const r = await fulltBrev({ id: betaltSak.id, skjema, presedenser: { klima: presedens } });
    expect(r.ok && r.tekst).toContain("Kravet bygger på lovens vilkår.");
  });

  it.each([
    ["ikke et objekt", "vedtaket"],
    ["en liste", [presedens]],
    ["ugyldig nøkkel", { "motor; drop": presedens }],
    ["for mange nøkler", Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`k${"x".repeat(i)}`, null]))],
  ])("avviser vedtakene når de er %s", async (_, p) => {
    hentEgenSak.mockResolvedValue(betaltSak);
    expect((await fulltBrev({ id: betaltSak.id, skjema, presedenser: p })).ok).toBe(false);
  });

  it.each([
    ["for langt avsnitt", { id: 1, avsnitt: "x".repeat(5000) }],
    ["for langt avsnitt i et helt vedtak", { ...presedens, avsnitt: "x".repeat(4001) }],
    ["lenke uten https", { ...presedens, kildeUrl: "javascript:alert(1)" }],
    ["for lang lenke", { ...presedens, kildeUrl: `https://${"x".repeat(300)}` }],
    ["ukjent sanksjon", { ...presedens, utfall: ["hevn"] }],
    ["for mange sanksjoner", { ...presedens, utfall: ["retting", "retting", "retting", "retting", "retting", "retting"] }],
    ["ukjent nivå", { ...presedens, niva: "C" }],
    ["ukjent kriterium", { ...presedens, treff: { ...presedens.treff, farge: "likt" } }],
    ["ukjent treff", { ...presedens, treff: { ...presedens.treff, km: "bedre" } }],
    ["for lang bil", { ...presedens, bil: "x".repeat(201) }],
    ["id som tekst", { ...presedens, id: "7" }],
    ["tekst", "vedtaket"],
  ])("avviser et vedtak med %s", async (_, p) => {
    hentEgenSak.mockResolvedValue(betaltSak);
    expect((await fulltBrev({ id: betaltSak.id, skjema, presedenser: { hoyvolt: p } })).ok).toBe(false);
  });

  it("avviser et skjema som ikke er et skjema", async () => {
    hentEgenSak.mockResolvedValue(betaltSak);
    expect((await fulltBrev({ id: betaltSak.id, skjema: "x", presedenser: {} })).ok).toBe(false);
  });

  it("stopper ved for mange forsøk", async () => {
    grense.full = true;
    hentEgenSak.mockResolvedValue(betaltSak);
    expect(await fulltBrev({ id: betaltSak.id, skjema, presedenser: {} })).toEqual({ ok: false, melding: "For mange forsøk. Vent et minutt og prøv igjen." });
    expect(hentEgenSak).not.toHaveBeenCalled();
  });
});
