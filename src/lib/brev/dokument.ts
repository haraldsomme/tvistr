import { iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { hentLignende } from "@/lib/mappe/hent";
import { byggBrev, type Brev, type LignendeRef } from "./brev";
import { byggPurring } from "./purring";
import type { Sak } from "./sak";

// The decisions the buyer cites. If the database cannot answer, the letter is still built, without them.
export async function lignendeFor(sak: Pick<Sak, "utfylling">): Promise<LignendeRef[]> {
  try {
    return await hentLignende(sak.utfylling.lignende ?? []);
  } catch {
    console.error("oppslag av siterte vedtak feilet");
    return [];
  }
}

// The letter for a stored case, or null when its answers no longer give one.
export async function brevForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) return null;
  return byggBrev(lest.input, idag, sak.utfylling, await lignendeFor(sak));
}

// The reminder for a stored case, or null when its answers no longer give a letter.
export async function purringForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  return lest.ok ? byggPurring(lest.input, idag, sak.utfylling) : null;
}
