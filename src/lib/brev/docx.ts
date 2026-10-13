// The letter as a Word file. It is built from tilDokument, the same lines the screen and «Kopier
// tekst» use, so there is no text of its own here. The link to the decision becomes a footnote.
import { AlignmentType, Document, ExternalHyperlink, FootnoteReferenceRun, Packer, Paragraph, TextRun } from "docx";
import { type Linje, tilDokument } from "./brev";
import type { Brev } from "./typer";

const FONT = "Calibri";
// Sizes are in half points, spacing in twentieths of a point.
const STR = 22;
const AVSTAND = 240;

const BOLD: Partial<Record<Linje["stil"], true>> = { tittel: true, overskrift: true, vedleggOverskrift: true };

export function byggDocx(brev: Brev): Document {
  const fotnoter: Record<number, { children: Paragraph[] }> = {};
  const avsnitt = tilDokument(brev).flatMap((gruppe) =>
    gruppe
      .filter((l) => l.skjult === undefined)
      .map((l, i, ls) => {
        const slutt = i === ls.length - 1;
        const children: (TextRun | FootnoteReferenceRun)[] = [new TextRun({ text: l.tekst, bold: BOLD[l.stil], font: FONT, size: STR })];
        if (l.lenke) {
          const id = Object.keys(fotnoter).length + 1;
          fotnoter[id] = {
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: "Vedtaket kan leses her: ", font: FONT, size: 18 }),
                  new ExternalHyperlink({ link: l.lenke, children: [new TextRun({ text: l.lenke, style: "Hyperlink", font: FONT, size: 18 })] }),
                ],
              }),
            ],
          };
          children.push(new FootnoteReferenceRun(id));
        }
        return new Paragraph({
          children,
          alignment: l.stil === "stedDato" ? AlignmentType.RIGHT : AlignmentType.LEFT,
          spacing: { after: slutt ? AVSTAND : 0, ...(l.stil === "overskrift" && { before: 120, after: 80 }) },
          keepNext: l.stil === "overskrift" || l.stil === "tittel",
        });
      }),
  );
  return new Document({
    creator: "tvistr",
    title: brev.tittel.tekst,
    footnotes: fotnoter,
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1304, right: 1304 } } }, children: avsnitt }],
  });
}

// In the browser, for the download.
export const tilDocxBlob = (brev: Brev): Promise<Blob> => Packer.toBlob(byggDocx(brev));

// In Node, for the tests.
export const tilDocxBuffer = (brev: Brev): Promise<Buffer> => Packer.toBuffer(byggDocx(brev));
