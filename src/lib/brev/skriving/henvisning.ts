import { HENVISNINGER, velgHenvisning, vurderHenvisning, type ValgtHenvisning } from "@/lib/vurdering/henvisninger";
import type { LagretBrev } from "../utfylling";
import { kjoperFor, type Saksmodell } from "./saksmodell";

// The decision the letter cites, from the buyer's moments as well as the answers; never one newer than the letter.
export function henvisningFor(m: Saksmodell): ValgtHenvisning | null {
  return velgHenvisning(m.faktorer, kjoperFor(m), HENVISNINGER.filter((h) => h.dato <= m.idag));
}

// The decision the saksmappe shows: the one the written letter cites, set against the case as it is now
// (`annet` when the case would now give another), or, when the letter does not cite the one the case
// gives (written before the decision was stored with it), that one (`ikke_i_brevet`).
export type MappeHenvisning = { valgt: ValgtHenvisning; status: "samme" | "annet" | "ikke_i_brevet" };
export function henvisningIMappen(m: Saksmodell, brev: LagretBrev | undefined, valgt: ValgtHenvisning | null): MappeHenvisning | null {
  const lagret = brev?.henvisning;
  if (!brev || (lagret && lagret.ref === valgt?.henvisning.ref)) return valgt && { valgt, status: "samme" };
  const iBrevet = lagret && HENVISNINGER.find((h) => h.ref === lagret.ref);
  if (iBrevet) return { valgt: vurderHenvisning(iBrevet, m.faktorer, kjoperFor(m)), status: "annet" };
  return valgt && { valgt, status: "ikke_i_brevet" };
}
