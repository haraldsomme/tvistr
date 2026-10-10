// What identifies the buyer never goes to the model (ported from master's saksmodell.ts): the name,
// address and e-mail from the form, and anything that looks like an e-mail address, a phone number or a plate.
import type { Skjema } from "@/lib/skjema/skjema";

// A value that identifies the buyer. Whole values match in any case; a part of the name only as
// written, since «Per» or «Strøm» is also an ordinary word («500 kr per dag»).
export type Kjent = { tekst: string; somSkrevet: boolean };

const somMonster = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export const kjentMonster = (k: Kjent) => new RegExp(`(?<!\\p{L})${somMonster(k.tekst)}(?!\\p{L})`, k.somSkrevet ? "u" : "iu");

export const EPOST = /[^\s@]+@[^\s@]+\.[^\s@]+/g;
export const MOBIL = /(?:\+47\s?)?(?<!\d)[49]\d{2}\s?\d{2}\s?\d{3}(?!\d)/g;
export const REGNR = /(?<![\p{L}\d])[A-ZÆØÅ]{2}\s?\d{4,5}(?!\d)/gu;

export function kjenteOpplysninger(s: Skjema): Kjent[] {
  const k = s.del7_onske_og_kontakt.kjoper;
  const gyldig = (x: string | null | undefined): x is string => typeof x === "string" && x.trim().length >= 3;
  return [
    ...[k.navn, k.adresse, k.epost].filter(gyldig).map((tekst) => ({ tekst: tekst.trim(), somSkrevet: false })),
    ...k.navn.split(/\s+/).filter(gyldig).map((tekst) => ({ tekst, somSkrevet: true })),
  ];
}

// Replaces what identifies the buyer with «…»: the known values, longest first, then the patterns.
export function rensTekst(t: string, kjente: Kjent[]): string {
  let r = t;
  for (const k of [...kjente].sort((a, b) => b.tekst.length - a.tekst.length)) {
    const m = kjentMonster(k);
    r = r.replace(new RegExp(m.source, `${m.flags}g`), "…");
  }
  return r.replace(EPOST, "…").replace(MOBIL, "…").replace(REGNR, "…");
}

// True when the text still names the buyer or holds a contact detail or a plate.
export const harPersonopplysning = (t: string, kjente: Kjent[]) => rensTekst(t, kjente) !== t || /\[(KLAGER|PERSON)/.test(t);
