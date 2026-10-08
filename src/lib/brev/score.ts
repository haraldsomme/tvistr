import type { Advarsel } from "./sjekk";

// How well the letter is supported by what the committee has relied on in similar cases (spec 2026-10-08,
// section 8). Only what the buyer can improve counts; what cannot be changed is listed without a deduction.
// Not the chance of winning.
export type Trekk = { id: string; poeng: number; tekst: string; steg: string | null; ma: boolean };
export type Score = { prosent: number; trekk: Trekk[]; faste: Advarsel[] };

const POENG = { hard: 20, gult: 10, skriv: 10, myk: 5, ubesvart: 3 } as const;
const VERKSTED_TITTEL = "Få en vurdering fra verksted av når feilen oppsto og om den er mer enn normal slitasje.";

export function scoreFor(a: {
  advarsler: Advarsel[];
  gule: { tekst: string; steg: string | null }[];
  skrevet: boolean;
  utdatert: boolean;
  ubesvarte: { id: string; steg: string | null }[];
}): Score {
  const faste = a.advarsler.filter((x) => x.fast);
  const alle: (Trekk & { handling: string })[] = [
    ...a.advarsler
      .filter((x) => !x.fast)
      .map((x) => {
        // A decisive moment the cited decision was won on counts as much as a hard warning.
        const ma = x.alvor === "hard" || x.id.startsWith("moment_mangler_");
        return { id: x.id, handling: x.handling ?? x.id, tekst: x.tekst, steg: x.steg, poeng: ma ? POENG.hard : POENG.myk, ma };
      }),
    ...a.gule.map((g, n) => ({ id: `gult-${n}`, handling: `gult-${n}`, tekst: `Fyll ut: ${g.tekst}.`, steg: g.steg, poeng: POENG.gult, ma: false })),
    ...(!a.skrevet || a.utdatert
      ? [{ id: "skriv", handling: "skriv", tekst: a.skrevet ? "Skriv brevet på nytt, så endringene kommer med." : "Skriv brevet.", steg: null, poeng: POENG.skriv, ma: false }]
      : []),
    ...a.ubesvarte.map((u) => ({ id: `ubesvart-${u.id}`, handling: `moment:${u.id}`, tekst: "Svar på spørsmålet i steget.", steg: u.steg, poeng: POENG.ubesvart, ma: false })),
  ];
  // One action, one deduction: the largest of those it would fix.
  const per = new Map<string, Trekk & { handling: string }>();
  for (const t of alle) {
    const f = per.get(t.handling);
    if (!f || t.poeng > f.poeng) per.set(t.handling, { ...t, ma: t.ma || Boolean(f?.ma) });
    else if (t.ma) f.ma = true;
  }
  const trekk = [...per.values()]
    .map(({ handling, ...t }) => ({ ...t, tekst: handling === "verksted" ? VERKSTED_TITTEL : t.tekst }))
    .sort((x, y) => y.poeng - x.poeng);
  const prosent = Math.max(0, 100 - trekk.reduce((s, t) => s + t.poeng, 0));
  return { prosent, trekk, faste };
}
