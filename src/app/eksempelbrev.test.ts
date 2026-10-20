import { describe, expect, it } from "vitest";
import { deler, eksempelRader, synligTekst, TEKST } from "./eksempelbrev";

// The landing page's sheet is the text in eksempelbrev.ts, with the runs of n-words drawn as grey bars.
const rader = eksempelRader();

describe("eksempelbrevet på forsiden", () => {
  it("alle rader, i rekkefølge: adresser, dato, emne og så seksjonene", () => {
    expect(rader.slice(0, 3).map((r) => r.rad)).toEqual(["adresser", "dato", "emne"]);
    expect(rader.at(-1)?.rad).toBe("avsnitt");
    expect(rader.filter((r) => r.rad === "overskrift").map((r) => synligTekst([r])[0])).toEqual(["Mangelen", "Rettslig grunnlag", "Praksis fra Forbrukerklageutvalget", "Krav", "Vedlegg"]);
    expect(rader.filter((r) => r.rad === "hilsen")).toHaveLength(1);
  });
  it("punktene 1–6 sitter én gang hver, i rekkefølge", () => {
    const merker = rader.map((r) => r.merke).filter(Boolean);
    expect(merker).toEqual([1, 2, 3, 4, 5, 6]);
    expect(rader[0].merke).toBe(1);
    const start = (m: number) => rader.find((r) => r.merke === m)!;
    expect(synligTekst([start(2)])[0]).toBe("Mangelen");
    expect(synligTekst([start(4)])[0]).toMatch(/^Praksis fra/);
    expect(synligTekst([start(6)])[0]).toMatch(/^Jeg ber om en skriftlig tilbakemelding innen 30\. oktober 2026/);
  });
  it("sladden er bare n-ord, og brevets egne ord står aldri i den", () => {
    const sladd = rader.flatMap((r) => (r.rad === "adresser" ? [] : r.deler.filter((d) => d.sladd).map((d) => d.t)));
    expect(sladd).toHaveLength(10);
    sladd.forEach((t) => expect(t).toMatch(/^n{2,6}( n{2,6})*$/));
  });
  it("sladden og det lesbare gir tilbake hele teksten", () => {
    const igjen = rader.flatMap((r) => (r.rad === "adresser" ? [...r.a, ...r.b] : [r.deler.map((d) => d.t).join("")]));
    expect(igjen.join("\n")).toBe(TEKST.replace(/\*\*/g, "").replace(/\n\n/g, "\n"));
  });
  it("sladd kan stå midt i en setning, og det som følger etter blir lesbart", () => {
    expect(deler("I tillegg krever jeg nnnnnn nnnnnn nn, jf. § 33.")).toEqual([
      { sladd: false, t: "I tillegg krever jeg " },
      { sladd: true, t: "nnnnnn nnnnnn nn" },
      { sladd: false, t: ", jf. § 33." },
    ]);
  });
  it("ord med n i seg blir ikke sladdet", () => expect(deler("en nnn nøkkel nn ann").map((d) => d.sladd)).toEqual([false, true, false, true, false]));
  it("vedtaket er et ekte: 22/10322, Golf 2017 ved 35 500 km, oppdaget fem måneder etter kjøpet (vedtak.id 1869)", () => {
    const t = synligTekst(rader).find((x) => x.startsWith("I Forbrukerklageutvalgets vedtak"))!;
    expect(t).toContain("vedtak i sak 22/10322 av 1. juni 2023");
    expect(t).toContain("prisavslag tilsvarende hele utbedringskostnaden for defekte sensorer i klimaanlegget på en Volkswagen Golf 2017-modell");
    expect(t).toContain("Bilen hadde gått 35 500 km ved kjøpet, og feilen ble oppdaget fem måneder etter overtakelsen");
    expect(TEKST).not.toContain("48213");
  });
  it("sammenligningen med vedtaket stemmer med eksempelsaken: nyere bil, feilen viste seg tidligere, men ikke lavere km", () => {
    expect(TEKST).toContain("Min bil er nyere, og feilen viste seg tidligere.");
    expect(TEKST).not.toContain("gått mindre"); // 39 800 km against the decision's 35 500
    expect(TEKST).toContain("årsmodell 2022");
    expect(TEKST).toContain("Feilen viste seg tre måneder etter leveringen");
  });
  it("ingen plassholdere er synlige", () => expect(synligTekst(rader).join("\n")).not.toMatch(/\[[^\]]+\]/));
  it("lesbar andel: noe er sladdet, men mesteparten kan leses", () => {
    const tegn = (x: string) => x.replace(/\s/g, "").length;
    const alt = tegn(TEKST);
    const lesbar = tegn(synligTekst(rader).join(""));
    expect(lesbar / alt).toBeGreaterThan(0.5);
    expect(lesbar / alt).toBeLessThan(0.9);
  });
});
