import { iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import { byggBrev, type Brev } from "./brev";
import { byggPurring } from "./purring";
import type { Sak } from "./sak";

// The letter for a stored case, or null when its answers no longer give one.
export async function brevForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  if (!lest.ok) return null;
  return byggBrev(lest.input, idag, sak.utfylling);
}

// The reminder for a stored case, or null when its answers no longer give a letter.
export async function purringForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  return lest.ok ? byggPurring(lest.input, idag, sak.utfylling) : null;
}
