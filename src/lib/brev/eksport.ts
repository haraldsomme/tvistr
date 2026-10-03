import { Document, Packer, Paragraph, TextRun } from "docx";
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import { type Brev } from "./brev";

export { harPlassholder } from "./brev";

// The letter as a file. Both formats are built from the same blocks as the page shows. Placeholders
// in square brackets stay in the file; the page warns about them (`harPlassholder`).

type Blokk = { linjer: string[]; fet?: boolean };

function blokker(b: Brev): Blokk[] {
  return [
    { linjer: b.avsender },
    { linjer: b.mottaker },
    { linjer: [b.stedDato] },
    { linjer: [b.emne], fet: true },
    ...b.avsnitt.map((a) => ({ linjer: [a] })),
    { linjer: [b.hilsen, b.underskrift] },
  ];
}

export async function tilDocx(b: Brev): Promise<Uint8Array> {
  const children = blokker(b).map(
    (bl) =>
      new Paragraph({
        spacing: { after: 240 },
        children: bl.linjer.map((l, n) => new TextRun({ text: l, bold: bl.fet, break: n > 0 ? 1 : 0 })),
      }),
  );
  const doc = new Document({
    styles: { default: { document: { run: { font: "Calibri", size: 23 } } } },
    sections: [{ properties: { page: { margin: { top: 1134, bottom: 1134, left: 1304, right: 1304 } } }, children }],
  });
  return new Uint8Array(await Packer.toBuffer(doc));
}

// The standard PDF fonts cover Latin-1 and a few typographic marks; anything else becomes «?».
const UTENFOR_FONT = /[^ -~ -ÿ–—‘’“”•…]/g;
// Digit groups and units stay together on a line: «250 000 kr» must not break after «250».
const limTall = (t: string) => t.replace(/(\d) (?=\d{3}\b)/g, "$1\u00a0").replace(/(\d) (?=kr\b|km\b)/g, "$1\u00a0");
const trygg = (t: string) => limTall(t).replace(UTENFOR_FONT, "?");

function brytLinjer(tekst: string, font: PDFFont, storrelse: number, bredde: number): string[] {
  const ut: string[] = [];
  let linje = "";
  const legg = (ord: string) => {
    const prov = linje ? `${linje} ${ord}` : ord;
    if (linje && font.widthOfTextAtSize(prov, storrelse) > bredde) {
      ut.push(linje);
      linje = ord;
    } else linje = prov;
  };
  for (const ord of trygg(tekst).split(/[ \t\r\n]+/).filter(Boolean)) {
    // A word wider than the line is cut at the line's width.
    let rest = ord;
    while (font.widthOfTextAtSize(rest, storrelse) > bredde) {
      let n = rest.length - 1;
      while (n > 1 && font.widthOfTextAtSize(rest.slice(0, n), storrelse) > bredde) n--;
      legg(rest.slice(0, n));
      ut.push(linje);
      linje = "";
      rest = rest.slice(n);
    }
    legg(rest);
  }
  if (linje) ut.push(linje);
  return ut;
}

export async function tilPdf(b: Brev): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [BREDDE_SIDE, HOYDE_SIDE, MARG, STR, HOYDE] = [595.28, 841.89, 64, 11, 15.5];
  const bredde = BREDDE_SIDE - 2 * MARG;
  let side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
  let y = HOYDE_SIDE - MARG;
  const skriv = (linje: string, font: PDFFont) => {
    if (y < MARG) {
      side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
      y = HOYDE_SIDE - MARG;
    }
    side.drawText(linje, { x: MARG, y, size: STR, font, color: rgb(0.09, 0.15, 0.24) });
    y -= HOYDE;
  };
  for (const bl of blokker(b)) {
    const font = bl.fet ? fet : normal;
    for (const l of bl.linjer) for (const del of brytLinjer(l, font, STR, bredde)) skriv(del, font);
    y -= HOYDE * 0.6;
  }
  return pdf.save();
}
