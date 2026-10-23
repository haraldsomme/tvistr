import "server-only";
// «Lignende saker» for a buyer's answers: the counted figures and the three closest decisions, as
// fields only. Code and database only: this file must never reach the model (vurdering.test.ts checks
// the imports). Shared by vurderSaken and the preview of the letter (brevet-actions.ts).
import { lesStatistikk } from "@/lib/vurdering/statistikk-db";
import { type Lignende, lignende } from "@/lib/vurdering/vurdering";
import type { Svar } from "@/lib/vedtaksvalg/kjoper";
import { hentAlle, hentBilnavn } from "./vedtak-db";

let statistikk: ReturnType<typeof lesStatistikk> | null = null;

export async function lignendeFor(svar: Svar): Promise<Lignende> {
  statistikk ??= lesStatistikk().catch((e) => {
    statistikk = null;
    throw e;
  });
  const [alle, bilnavn, tall] = await Promise.all([hentAlle(), hentBilnavn(), statistikk]);
  return lignende({ svar, alle, statistikk: tall, bilnavn });
}
