import { HENVISNINGER, velgHenvisning, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import { kjoperFor, type Saksmodell } from "./saksmodell";

// The decision the letter cites, from the buyer's moments as well as the answers; never one newer than the letter.
export function henvisningFor(m: Saksmodell): ValgtHenvisning | null {
  return velgHenvisning(m.faktorer, kjoperFor(m), HENVISNINGER.filter((h) => h.dato <= m.idag));
}
