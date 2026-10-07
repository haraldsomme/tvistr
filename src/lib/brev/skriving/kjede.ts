import { BREVSKRIV_VERSJON, RUBRIKK_SKRIVES_OM } from "@/lib/ai/prompter";
import { planlegg, type Brevplan } from "./brevplan";
import { forfatt } from "./forfatter";
import { grunnlagFor } from "./grunnlag";
import { gjennomse } from "./gjennomsyn";
import { kontroller } from "./kontroll";
import type { Saksmodell } from "./saksmodell";
import type { Avvik, Funn, Utkast } from "./typer";

// The whole round: plan, write, check in code, and one more round with what the check found; then the
// review, and one more round with what it found. A new draft is kept only when the check finds no more
// than before. What is left is returned for the page to show as warnings.

export type Fremdrift = "skriver" | "kontrollerer" | "leser" | "retter";
export type SkrevetUtkast = { plan: Brevplan; utkast: Utkast; avvik: Avvik[]; funn: Funn[]; grunnlag: string; versjon: string; skrevet: string; kall: number; kostnadUsd: number };

const merknader = (avvik: Avvik[], funn: Funn[]) => [
  ...avvik.map((a) => `${a.tekst}${a.setning ? ` Setning: ${a.setning}` : ""}`),
  ...funn.map((f) => `${f.punkt}: ${f.hvorfor}${f.setning ? ` Setning: ${f.setning}` : ""}`),
];

// Only a finding on a point that matters and that names the sentence sends the letter back.
const skalRettes = (f: Funn) => (RUBRIKK_SKRIVES_OM as readonly string[]).includes(f.punkt) && f.setning.trim() !== "";

export async function skrivBrevFor(m: Saksmodell, fremdrift: (f: Fremdrift) => void = () => {}): Promise<SkrevetUtkast> {
  const plan = planlegg(m);
  let kall = 0;
  let kostnadUsd = 0;
  const skriv = async (revisjon?: { forrige: Utkast; merknader: string[] }) => {
    kall++;
    const r = await forfatt(m, plan, revisjon);
    kostnadUsd += r.forbruk.kostnadUsd;
    return r.utkast;
  };
  const les = async (u: Utkast) => {
    kall++;
    const r = await gjennomse(m, plan, u);
    kostnadUsd += r.forbruk.kostnadUsd;
    return r.funn;
  };

  fremdrift("skriver");
  let utkast = await skriv();
  fremdrift("kontrollerer");
  let avvik = kontroller(utkast, plan, m);
  if (avvik.length) {
    fremdrift("retter");
    const ny = await skriv({ forrige: utkast, merknader: merknader(avvik, []) });
    const nyeAvvik = kontroller(ny, plan, m);
    if (nyeAvvik.length <= avvik.length) [utkast, avvik] = [ny, nyeAvvik];
  }
  fremdrift("leser");
  let funn = await les(utkast);
  if (funn.some(skalRettes)) {
    fremdrift("retter");
    const ny = await skriv({ forrige: utkast, merknader: merknader(avvik, funn.filter(skalRettes)) });
    const nyeAvvik = kontroller(ny, plan, m);
    if (nyeAvvik.length <= avvik.length) {
      [utkast, avvik] = [ny, nyeAvvik];
      fremdrift("leser");
      funn = await les(utkast);
    }
  }
  return { plan, utkast, avvik, funn, grunnlag: grunnlagFor(m, plan), versjon: BREVSKRIV_VERSJON, skrevet: new Date().toISOString(), kall, kostnadUsd };
}
