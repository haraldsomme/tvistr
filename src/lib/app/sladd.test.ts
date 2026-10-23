import { describe, expect, it } from "vitest";
import { byggBrev } from "./brev";
import { feilposter } from "./feil";
import type { Presedens } from "./brevtyper";
import { sladd } from "./sladd";
import { eksempel, syncAreas } from "./skjema";

const idag = "2026-10-16";
const PRES: Presedens = {
  id: 1,
  saksnummer: "52074",
  vedtaksdato: "2025-11-24",
  bil: "Peugeot 308 fra 2014",
  utfall: ["heving"],
  avsnitt: "Forbrukerklageutvalget kom i sak 52074 til at bilen hadde en mangel.",
  kildeUrl: "https://example.org/v.pdf",
  utvalg: "Forbrukerklageutvalget",
  anbefalt: true,
  niva: "A",
  gjaldt: "turbo",
  km: 150000,
  alder: 9,
  somDenEr: false,
  likhet: 80,
  treff: {} as Presedens["treff"],
};

describe("sladd", () => {
  const B0 = byggBrev(syncAreas(eksempel(idag)), Object.fromEntries(feilposter(eksempel(idag)).map((p) => [p.nokkel, PRES])), idag);
  const B = sladd(B0);
  const json = JSON.stringify(B);

  // «Bilen kan stilles til rådighet …» is a one-sentence paragraph, so its first half stays; the rest
  // («… etter nærmere avtale») is what must not be sent.
  it("skjult tekst sendes ikke", () => {
    for (const t of ["Det er derfor dere som må bevise", "formodes å ha eksistert", "etter nærmere avtale"]) expect(json).not.toContain(t);
  });

  it("overskrifter og svar vises", () => {
    for (const t of ["Mangelen", "Rettslig grunnlag", "Krav", "38 500", "EL 48213"]) expect(json).toContain(t);
  });

  it("hvert avsnitt mangler noe", () => {
    expect(B).toHaveLength(B0.length);
    B0.forEach((b, i) => {
      const ord = b.t === "p" ? b.tekst.filter((d) => typeof d === "string").join(" ").split(/\s+/).filter((w) => /\p{L}/u.test(w)).length : 0;
      if (ord >= 4) expect(JSON.stringify(B[i])).toContain("skjult");
    });
  });

  it("skjult lengde er omtrentlig: rundet opp til nærmeste ti", () => {
    const lengder = [...json.matchAll(/"skjult":(\d+)/g)].map((m) => Number(m[1]));
    expect(lengder.length).toBeGreaterThan(0);
    for (const n of lengder) expect(n % 10).toBe(0);
  });

  it("forkortelser deler ikke setninger", () => {
    const [p] = sladd([{ t: "p", tekst: ["Jeg krever retting, jf. § 29 første ledd. Rettingen skal skje uten kostnad."] }]);
    expect(p.t === "p" && p.tekst[0]).toBe("Jeg krever retting, jf. § 29 første ledd. ");
    const [q] = sladd([{ t: "p", tekst: ["Bilen ble kjøpt 20. august 2025 med reg.nr. EL 1 for kr 10. Mer tekst her."] }]);
    expect(q.t === "p" && q.tekst[0]).toBe("Bilen ble kjøpt 20. august 2025 med reg.nr. EL 1 for kr 10. ");
  });

  it("senere setninger skjules, svarene i dem står", () => {
    const [p] = sladd([{ t: "p", tekst: ["Første setning her. Andre ", { felt: "c_reg", tekst: "EL 1" }, " setning. Tredje."] }]);
    expect(p).toEqual({ t: "p", tekst: ["Første setning her. ", { skjult: 10 }, { felt: "c_reg", tekst: "EL 1" }, { skjult: 20 }] });
  });

  it("én setning: første halvdel av ordene står", () => {
    const [p] = sladd([{ t: "p", tekst: ["en to tre fire fem"] }]);
    expect(p).toEqual({ t: "p", tekst: ["en to tre ", { skjult: 10 }] });
  });

  it("bare svar og plassholdere er uendret, og andre blokker går rett gjennom", () => {
    const inn = [
      { t: "p" as const, tekst: [{ felt: "c_reg", tekst: "EL 1" }, { ph: "kjøpesum" }] },
      { t: "h" as const, tekst: ["Mangelen ved bilen. Krav og frister"] },
      { t: "ol" as const, punkter: [["Lang tekst i et punkt. Med to setninger."]] },
    ];
    expect(sladd(inn)).toEqual(inn);
  });

  it("praksisavsnittet: kursivordet og feltmerket står, lenken skjules", () => {
    const p = B.find((b) => b.t === "p" && b.tekst.some((d) => typeof d === "object" && "felt" in d && d.felt.startsWith("vedtak.avsnitt")));
    expect(p?.t === "p" && p.tekst[0]).toEqual({ kursiv: "Praksis fra Forbrukerklageutvalget." });
    expect(JSON.stringify(p)).not.toContain("offentlig tilgjengelig");
  });
});

describe("underoverskrift og kursivt innledningsord", () => {
  it("h2 går gjennom, kursivordet står og teksten etter første setning sladdes", () => {
    const ut = sladd([{ t: "h2", tekst: ["1. Feil ved turboen"] }, { t: "p", tekst: [{ kursiv: "Reklamasjonen er rettidig." }, " Første setning her. Andre setning."] }]);
    expect(ut[0]).toEqual({ t: "h2", tekst: ["1. Feil ved turboen"] });
    expect(ut[1]).toEqual({ t: "p", tekst: [{ kursiv: "Reklamasjonen er rettidig." }, " Første setning her. ", { skjult: 20 }] });
  });
});
