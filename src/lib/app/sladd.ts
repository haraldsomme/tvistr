// The letter as the buyer sees it before payment: the structure, the headings and their own answers,
// with most of the template text replaced by its length. The browser gets only these blocks, so the
// hidden text never leaves the server. The rule is provisional and lives only here.
import type { Blokk, Del } from "./brevtyper";

// A sentence ends at . ! ? or » followed by space and a capital or an opening quote, unless the
// period closes one of these abbreviations.
const GRENSE = /[.!?»]\s+(?=[A-ZÆØÅ«])/g;
const FORKORTELSER = ["reg.nr.", "org.nr.", "nr.", "jf.", "fkjl.", "bl.a.", "f.eks.", "pkt.", "att."];

// The end of the first sentence in `t` (after the space that follows it), or -1 when there is none.
function forsteGrense(t: string): number {
  for (const m of t.matchAll(GRENSE)) {
    const foran = t.slice(0, m.index + 1).toLowerCase();
    const forkortet = FORKORTELSER.some((f) => foran.endsWith(f) && !/\p{L}/u.test(foran.at(-f.length - 1) ?? ""));
    if (!forkortet) return m.index + m[0].length;
  }
  return -1;
}

// The first `n` words of `t` with the space after them, as a length; all of `t` when it has no more.
function ordLengde(t: string, n: number): number {
  for (const m of t.matchAll(/\S+\s*/g)) if (n-- <= 0) return m.index;
  return t.length;
}

// One paragraph: the first sentence stays and the plain text after it is hidden; a paragraph of one
// sentence keeps the first half of its words. Answers and placeholders always stay.
function sladdDeler(inn: Del[]): Del[] {
  // Neighbouring strings are one text, so that a sentence can end across them.
  const deler = inn.reduce<Del[]>((acc, d) => {
    const forrige = acc.at(-1);
    if (typeof d === "string" && typeof forrige === "string") acc[acc.length - 1] = forrige + d;
    else acc.push(d);
    return acc;
  }, []);
  const ut: Del[] = [];
  let skjul = false;
  for (const d of deler) {
    if (typeof d !== "string") ut.push(d);
    else if (skjul) ut.push({ skjult: d.length });
    else {
      const g = forsteGrense(d);
      if (g < 0) ut.push(d);
      else {
        ut.push(d.slice(0, g), { skjult: d.length - g });
        skjul = true;
      }
    }
  }
  if (!skjul) {
    const ord = deler.reduce((n, d) => n + (typeof d === "string" ? (d.match(/\S+/g)?.length ?? 0) : 0), 0);
    let igjen = Math.ceil(ord / 2);
    ut.length = 0;
    for (const d of deler) {
      if (typeof d !== "string") ut.push(d);
      else {
        const behold = igjen > 0 ? ordLengde(d, igjen) : 0;
        igjen -= d.slice(0, behold).match(/\S+/g)?.length ?? 0;
        ut.push(d.slice(0, behold), { skjult: d.length - behold });
      }
    }
  }
  // Drop the empty pieces and merge neighbouring hidden runs, then send each run's length only roughly
  // (up to the nearest ten), so the exact length of the hidden text does not leave the server either.
  return ut
    .reduce<Del[]>((acc, d) => {
      const forrige = acc.at(-1);
      if (typeof d === "string" ? d === "" : "skjult" in d && d.skjult === 0) return acc;
      if (typeof d === "object" && "skjult" in d && typeof forrige === "object" && "skjult" in forrige) acc[acc.length - 1] = { skjult: forrige.skjult + d.skjult };
      else acc.push(d);
      return acc;
    }, [])
    .map((d) => (typeof d === "object" && "skjult" in d ? { skjult: Math.ceil(d.skjult / 10) * 10 } : d));
}

// Block for block, so an index means the same block before and after.
export function sladd(blokker: Blokk[]): Blokk[] {
  return blokker.map((b) => {
    if (b.t === "p") return { ...b, tekst: sladdDeler(b.tekst) };
    return b;
  });
}
