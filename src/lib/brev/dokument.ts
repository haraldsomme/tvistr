import { iDag } from "@/lib/vurdering/faktorer";
import { tilKlageInput } from "@/lib/vurdering/innsending";
import type { Brev } from "./brev";
import { byggPurring } from "./purring";
import type { Sak } from "./sak";
import { brevFraSak } from "./skriving/render";

// The written letter of a stored case, as the page shows it; null before it is written, or when the
// answers no longer give a letter.
export async function brevForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  return brevFraSak(sak, idag);
}

// The reminder for a stored case, or null when its answers no longer give a letter.
export async function purringForSak(sak: Sak, idag = iDag()): Promise<Brev | null> {
  const lest = tilKlageInput(sak.svar, idag);
  return lest.ok ? byggPurring(lest.input, idag, sak.utfylling) : null;
}
