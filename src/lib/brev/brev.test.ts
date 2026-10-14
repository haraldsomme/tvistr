import { describe, expect, it } from "vitest";
import { byggBrev, forhandsvisning, somTekst, tilDokument } from "./brev";
import { FEILSETT, kontakt, lagSak } from "./testsak";

const sak = (kjoper: Parameters<typeof lagSak>[1] = {}) =>
  lagSak("etter_2024", {
    somDenEr: "ja",
    krav: "heving",
    utlegg: [{ beskrivelse: "Tauing", belop: 1200 }],
    kontakt: kontakt("etter_2024", { forsok: 2, svar: "forsokt" }),
    feil: FEILSETT.teknisk("6_til_24_mnd", "nei", "skriftlig", "Bilen mistet kraft etter tre uker."),
    ...kjoper,
  });

describe("forhåndsvisning", () => {
  const brev = byggBrev(sak({ kjoper: null }));
  const visning = forhandsvisning(brev);
  const json = JSON.stringify(visning);

  it("viser sakens bakgrunn og bare første setning av avsnittet som viser til vedtaket", () => {
    const tekst = somTekst(visning);
    expect(tekst).toContain("Jeg viser til kjøp av Volkswagen Golf");
    expect(tekst).toContain("Det vises til Forbrukerklageutvalgets vedtak i sak 22/2868");
    // No quote, no link and nothing of the paragraph after its first sentence before payment.
    expect(JSON.stringify(visning.avsnitt[2])).not.toMatch(/[«»]/);
    expect(json).not.toContain("Det foreligger en mangel");
    expect(json).not.toContain("Saken gjaldt");
    expect(json).not.toContain("example.org");
    expect(tilDokument(visning).flat().some((l) => l.lenke)).toBe(false);
    const praksis = visning.avsnitt[2].blokker.filter((b) => "setninger" in b);
    expect(praksis).toHaveLength(1);
    expect("setninger" in praksis[0] && praksis[0].setninger.map((s) => s.tekst)).toEqual([expect.stringMatching(/^Det vises til .*22\/2868[^.]*\.$|^Det vises til .*\.$/)]);
    expect(visning.avsnitt[2].blokker.at(-1)).toEqual({ skjult: expect.any(Number) });
  });

  it("sender aldri den skjulte teksten til nettleseren", () => {
    const synlig = new Set(visning.avsnitt.flatMap((a) => a.blokker.flatMap((b) => ("setninger" in b ? b.setninger.map((s) => s.tekst) : []))));
    // The heading and the address are shown on purpose; what is checked is the text of the sections.
    const skjult = brev.avsnitt
      .flatMap((a) => a.blokker.flatMap((b) => ("setninger" in b ? b.setninger.map((s) => s.tekst) : [])))
      .filter((t) => !synlig.has(t) && t.length > 25);
    expect(skjult.length).toBeGreaterThan(5);
    for (const t of skjult) expect(json, t).not.toContain(t);
    for (const ord of ["Bilen mistet kraft", "Tauing", "hever jeg kjøpet", "avtalt unntak", "Vedlegg"]) expect(json).not.toContain(ord);
  });

  it("erstatter hvert skjult avsnitt med en lengde, og beholder overskriftene", () => {
    expect(visning.avsnitt.map((a) => a.overskrift.tekst)).toEqual(brev.avsnitt.map((a) => a.overskrift.tekst));
    expect(visning.avsnitt[1].blokker.every((b) => "skjult" in b && b.skjult > 0)).toBe(true);
    expect(visning.hilsen).toEqual([]);
    expect(visning.vedlegg).toBeNull();
  });

  it("har ingen avsender før betaling", () => {
    expect(visning.avsender).toEqual([]);
    expect(JSON.stringify(visning)).not.toContain("Kari Testesen");
  });
});

describe("dokumentet", () => {
  it("gir samme tekst som setningene, avsnitt for avsnitt", () => {
    const brev = byggBrev(sak());
    const tekst = somTekst(brev);
    for (const a of brev.avsnitt) for (const b of a.blokker) if ("setninger" in b) expect(tekst).toContain(b.setninger.map((s) => s.tekst).join(" "));
    expect(tekst.startsWith("Kari Testesen\nTestveien 1\n0150 Oslo\n\nOslo, 13. oktober 2026\n\nTestbil AS")).toBe(true);
    expect(tekst.endsWith("Vedlegg:\n– Rapport fra Nordre Bil og Verksted AS av 10. april 2025\n– Kvitteringer for utlegg\n– Tidligere reklamasjon")).toBe(true);
  });

  it("utelater vedlegg når det ikke finnes noen", () => {
    const brev = byggBrev(sak({ utlegg: [], kontakt: null, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") }));
    expect(brev.vedlegg).toBeNull();
    expect(somTekst(brev)).not.toContain("Vedlegg");
  });
});
