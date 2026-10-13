import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { byggBrev, tilDokument } from "./brev";
import { tilDocxBuffer } from "./docx";
import { FEILSETT, kontakt, lagSak } from "./testsak";

const xml = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");

// The paragraphs of word/document.xml as plain text, one string per paragraph.
async function avsnitt(buf: Buffer, del = "word/document.xml"): Promise<string[]> {
  const fil = await (await JSZip.loadAsync(buf)).file(del)?.async("string");
  if (!fil) throw new Error(`Mangler ${del}`);
  return [...fil.matchAll(/<w:p[ >][\s\S]*?<\/w:p>/g)].map((p) => xml([...p[0].matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map((t) => t[1]).join("")));
}

describe("Word-eksport", () => {
  const brev = byggBrev(
    lagSak("etter_2024", {
      somDenEr: "ja",
      krav: "heving",
      kontakt: kontakt("etter_2024", { forsok: 2, svar: "avviste" }),
      utlegg: [{ beskrivelse: "Tauing & leiebil", belop: 4200 }],
      feil: [...FEILSETT.teknisk("innen_6_mnd", "nei", "skriftlig", "Bilen mistet «kraft» <etter> tre uker.").map((f) => ({ ...f, rapport: { ...f.rapport!, konklusjon: "Turbo & <lader> er defekt", punkter: ["bekrefter", "frarader", "overslag"] as never[], overslag: 38_000 } })), ...FEILSETT.opplysning("innen_6_mnd", "skriftlig", "nei")],
    }),
  );

  it("har samme tekst som visningen, avsnitt for avsnitt", async () => {
    const forventet = tilDokument(brev).flat().map((l) => l.tekst);
    expect(await avsnitt(await tilDocxBuffer(brev))).toEqual(forventet);
  });

  it("legger lenken til vedtaket i en fotnote, ikke i brødteksten", async () => {
    const buf = await tilDocxBuffer(brev);
    const url = brev.avsnitt[2].blokker.flatMap((b) => ("setninger" in b ? b.setninger : [])).find((s) => s.lenke)!.lenke!;
    expect((await avsnitt(buf)).join("\n")).not.toContain(url);
    expect((await avsnitt(buf, "word/footnotes.xml")).join("\n")).toContain("Vedtaket kan leses her:");
    const rels = await (await JSZip.loadAsync(buf)).file("word/_rels/footnotes.xml.rels")?.async("string");
    expect(rels).toContain(url);
  });

  it("lager et brev uten fotnote når det ikke finnes noe vedtak", async () => {
    const uten = byggBrev(lagSak("etter_2024", { praksis: null, feil: FEILSETT.teknisk("innen_6_mnd", "nei", "nei") }));
    expect(await avsnitt(await tilDocxBuffer(uten))).toEqual(tilDokument(uten).flat().map((l) => l.tekst));
  });
});
