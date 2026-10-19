// Brings one order in line with Vipps. The return page, the webhook and the nightly cron all call
// this, and only this changes an order's status. It never trusts what the browser or the webhook says:
// it asks Vipps (GET payment). It may run many times at once: the capture has a fixed Idempotency-Key,
// and the updates are conditional, in one batch (neon-http has no transactions).
//
// The letter is digital content delivered at once, so an approved payment is captured straight away
// (ePayment has no direct capture), and the case opens only when the capture went through. A failed
// capture leaves the order «opprettet» for the next call to try again. The call that makes the order
// paid fills the buyer's details from Vipps into the form, makes the paying Vipps account the case's
// owner (sak.vippsSub) and sends the receipt with the link.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ordre, sak } from "@/db/schema";
import { sendKvittering } from "@/lib/epost/kvittering";
import { capture, hentBetaling } from "./klient";
import { fyllKjoper } from "./kjoper";

export type Avstemt = { status: "betalt"; sakId: string } | { status: "venter" } | { status: "avbrutt" } | { status: "ukjent" };

export async function avstem(ref: string): Promise<Avstemt> {
  const [o] = await db
    .select({ sakId: ordre.sakId, status: ordre.status, belopOre: ordre.belopOre })
    .from(ordre)
    .where(and(eq(ordre.id, ref), eq(ordre.leverandor, "vipps")))
    .limit(1);
  if (!o) return { status: "ukjent" };
  if (o.status === "betalt") return { status: "betalt", sakId: o.sakId };
  if (o.status !== "opprettet") return { status: "avbrutt" };

  const b = await hentBetaling(ref);
  if (b.state === "CREATED") return { status: "venter" };
  if (b.state !== "AUTHORIZED" || b.aggregate.cancelledAmount.value > 0) {
    await db
      .update(ordre)
      .set({ status: "avbrutt", oppdatert: new Date() })
      .where(and(eq(ordre.id, ref), eq(ordre.status, "opprettet")));
    console.info("vipps: avbrutt", JSON.stringify({ ref, tilstand: b.state }));
    return { status: "avbrutt" };
  }

  if (b.aggregate.capturedAmount.value < o.belopOre) {
    try {
      await capture(ref, o.belopOre);
    } catch {
      return { status: "venter" };
    }
  }
  // The buyer's details from Vipps go into the form as it opens; the buyer cannot edit it before then.
  const [s] = await db.select({ skjema: sak.skjema }).from(sak).where(eq(sak.id, o.sakId)).limit(1);
  const na = new Date();
  const [vant] = await db.batch([
    db
      .update(ordre)
      .set({ status: "betalt", transaksjonId: b.pspReference, betalt: na, oppdatert: na })
      .where(and(eq(ordre.id, ref), eq(ordre.status, "opprettet")))
      .returning({ id: ordre.id }),
    db
      .update(sak)
      .set({ betalt: na, vippsSub: b.profile?.sub ?? null, ...(s && { skjema: fyllKjoper(s.skjema, b.userDetails) }) })
      .where(and(eq(sak.id, o.sakId), isNull(sak.betalt))),
  ]);
  console.info("vipps: betalt", JSON.stringify({ ref }));
  // Only the call that made the order paid sends the receipt; the cron sends any that failed.
  if (vant.length) await sendKvittering(ref, b.userDetails?.email).catch((e) => console.error("kvitteringen feilet", ref, e));
  return { status: "betalt", sakId: o.sakId };
}
