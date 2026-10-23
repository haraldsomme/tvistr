// The cron's fallback for when neither the return page nor the webhook got Vipps' answer: every Vipps
// order still «opprettet» after 15 minutes (a payment expires after ten) is brought in line. Then the
// receipts that were never sent: the address is asked from Vipps again (shared for 7 days), so it is
// not stored for this.
import { and, eq, gt, isNull, lt } from "drizzle-orm";
import { db } from "@/db";
import { ordre } from "@/db/schema";
import { sendKvittering } from "@/lib/epost/kvittering";
import { UFULLFORT_DAGER } from "@/lib/sak/lagringstid";
import { avstem } from "./avstem";
import { hentBetaling } from "./klient";
import { feiltekst } from "@/lib/logg";

export async function avstemUavklarte(na = new Date()): Promise<{ antall: number; feilet: number; kvitteringer: number }> {
  const siden = (ms: number) => new Date(na.getTime() - ms);
  const rader = await db
    .select({ id: ordre.id })
    .from(ordre)
    .where(and(eq(ordre.leverandor, "vipps"), eq(ordre.status, "opprettet"), lt(ordre.opprettet, siden(15 * 60_000)), gt(ordre.opprettet, siden(UFULLFORT_DAGER * 86_400_000))))
    .limit(500);
  let feilet = 0;
  for (const r of rader) await avstem(r.id).catch((e) => (feilet++, console.error("avstemming feilet", r.id, feiltekst(e))));

  const uten = await db
    .select({ id: ordre.id })
    .from(ordre)
    .where(and(eq(ordre.leverandor, "vipps"), eq(ordre.status, "betalt"), isNull(ordre.kvitteringSendt), gt(ordre.betalt, siden(7 * 86_400_000))))
    .limit(500);
  let kvitteringer = 0;
  for (const r of uten) {
    const epost = await hentBetaling(r.id).then((b) => b.userDetails?.email, () => undefined);
    if ((await sendKvittering(r.id, epost).catch(() => "feilet")) === "sendt") kvitteringer++;
  }
  return { antall: rader.length, feilet, kvitteringer };
}
