import { describe, expect, it } from "vitest";
import { byggBrev, forhandsvisning, somTekst, tilDokument } from "./brev";
import { FEILSETT, lagSak } from "./testsak";

const sak = (kjoper: Parameters<typeof lagSak>[1] = {}) =>
  lagSak("etter_2024", {
    somDenEr: "ja",
    krav: "heving",
    forsok: 2,
    overslag: 12_500,
    utlegg: [{ beskrivelse: "Tauing", belop: 1200 }],
    tidligere: { dato: "2025-06-01", form: "skriftlig" },
    feil: FEILSETT.teknisk("6_til_24_mnd", "nei", "skriftlig", "Bilen mistet kraft etter tre uker."),
    ...kjoper,
  });

describe("forhåndsvisning", () => {
  const brev = byggBrev(sak({ kjoper: null }));
  const visning = forhandsvisning(brev);
  const json = JSON.stringify(visning);

  it("viser sakens bakgrunn og avsnittet som viser til vedtaket", () => {
    const tekst = somTekst(visning);
    expect(tekst).toContain("Jeg viser til kjøp av Volkswagen Golf");
    expect(tekst).toContain("Det vises til Forbrukerklageutvalgets vedtak i sak 22/2868");
    expect(tilDokument(visning).flat().some((l) => l.lenke === "https://example.org/vedtak/22-2868")).toBe(true);
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
    expect(tekst.endsWith("Vedlegg:\n– Verkstedets skriftlige vurdering\n– Kvitteringer for utlegg\n– Tidligere reklamasjon")).toBe(true);
  });

  it("utelater vedlegg når det ikke finnes noen", () => {
    const brev = byggBrev(sak({ utlegg: [], tidligere: null, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") }));
    expect(brev.vedlegg).toBeNull();
    expect(somTekst(brev)).not.toContain("Vedlegg");
  });
});
