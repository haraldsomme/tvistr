import { Document, ExternalHyperlink, Packer, Paragraph, TextRun } from "docx";
import { PDFArray, PDFDocument, PDFName, PDFString, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
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

const LENKE = /(https:\/\/[^\s)]+)/;

// One line of a block as runs: plain text, and the link to the cited decision as a real hyperlink.
function kjoringer(linje: string, fet: boolean | undefined, nyLinje: boolean) {
  return linje.split(LENKE).map((del, n) => {
    const brudd = nyLinje && n === 0 ? 1 : 0;
    return n % 2 === 0
      ? new TextRun({ text: del, bold: fet, break: brudd })
      : new ExternalHyperlink({ link: del, children: [new TextRun({ text: del, color: "1F3A5F", underline: {}, break: brudd })] });
  });
}

export async function tilDocx(b: Brev): Promise<Uint8Array> {
  const children = blokker(b).map(
    (bl) =>
      new Paragraph({
        spacing: { after: 240 },
        children: bl.linjer.flatMap((l, n) => kjoringer(l, bl.fet, n > 0)),
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
      // A link breaks after a / ? & or =, so each piece still reads as part of the address.
      const naturlig = Math.max(...["/", "?", "&", "="].map((t) => rest.lastIndexOf(t, n - 1)));
      if (naturlig > 0) n = naturlig + 1;
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

// A clickable area over a piece of a link in the PDF.
function lenke(pdf: PDFDocument, side: PDFPage, x: number, y: number, bredde: number, hoyde: number, url: string) {
  const ref = pdf.context.register(
    pdf.context.obj({ Type: "Annot", Subtype: "Link", Rect: [x, y - 2, x + bredde, y + hoyde], Border: [0, 0, 0], A: { Type: "Action", S: "URI", URI: PDFString.of(url) } }),
  );
  const annots = side.node.lookup(PDFName.of("Annots"));
  if (annots instanceof PDFArray) annots.push(ref);
  else side.node.set(PDFName.of("Annots"), pdf.context.obj([ref]));
}

export async function tilPdf(b: Brev): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const fet = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [BREDDE_SIDE, HOYDE_SIDE, MARG, STR, HOYDE] = [595.28, 841.89, 64, 11, 15.5];
  const bredde = BREDDE_SIDE - 2 * MARG;
  let side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
  let y = HOYDE_SIDE - MARG;
  const skriv = (linje: string, font: PDFFont, urler: string[]) => {
    if (y < MARG) {
      side = pdf.addPage([BREDDE_SIDE, HOYDE_SIDE]);
      y = HOYDE_SIDE - MARG;
    }
    side.drawText(linje, { x: MARG, y, size: STR, font, color: rgb(0.09, 0.15, 0.24) });
    // Every word on the line that is a piece of a link in the paragraph gets a link to the whole address.
    let x = MARG;
    for (const ord of linje.split(" ")) {
      const bit = ord.replace(/^\(/, "").replace(/\)?[.,]?$/, "");
      const url = bit.length > 8 ? urler.find((u) => u.includes(bit)) : undefined;
      if (url) lenke(pdf, side, x + font.widthOfTextAtSize(ord.startsWith("(") ? "(" : "", STR), y, font.widthOfTextAtSize(bit, STR), STR, url);
      x += font.widthOfTextAtSize(`${ord} `, STR);
    }
    y -= HOYDE;
  };
  for (const bl of blokker(b)) {
    const font = bl.fet ? fet : normal;
    for (const l of bl.linjer) {
      const urler = l.match(/https:\/\/[^\s)]+/g) ?? [];
      for (const del of brytLinjer(l, font, STR, bredde)) skriv(del, font, urler);
    }
    y -= HOYDE * 0.6;
  }
  return pdf.save();
}
