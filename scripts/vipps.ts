// Support for Vipps payments, through the API as Vipps asks (the business portal is not for this).
// The reference is the order's id (ordre.id).
//
//   npm run vipps -- webhook https://tvistr.no/api/vipps   registers the webhook; put the secret in VIPPS_WEBHOOK_SECRET
//   npm run vipps -- webhooker                             lists the registered webhooks
//   npm run vipps -- siste                                 the last ten Vipps orders, with the state at Vipps
//   npm run vipps -- status <ref>                          the payment and its event log
//   npm run vipps -- avstem <ref>                          brings the order in line with Vipps
//   npm run vipps -- refunder <ref>                        refunds the whole amount; the order becomes «refundert»
//   npm run vipps -- kanseller <ref>                       cancels a payment not captured
import { desc, eq } from "drizzle-orm";
import { db } from "../src/db";
import { ordre } from "../src/db/schema";
import { avstem } from "../src/lib/vipps/avstem";
import { hendelser, hentBetaling, kall, kanseller, refunder } from "../src/lib/vipps/klient";

const HENDELSER = ["authorized", "aborted", "expired", "terminated", "captured", "cancelled", "refunded"].map((h) => `epayments.payment.${h}.v1`);

const vis = (x: unknown) => console.log(JSON.stringify(x, null, 2));

async function main(kommando: string | undefined, arg: string | undefined) {
  if (kommando === "webhooker") return vis(await kall("GET", "/webhooks/v1/webhooks"));
  if (kommando === "siste") {
    const rader = await db.select().from(ordre).where(eq(ordre.leverandor, "vipps")).orderBy(desc(ordre.opprettet)).limit(10);
    for (const r of rader) {
      const b = await hentBetaling(r.id).catch((e: Error) => e.message);
      const vipps = typeof b === "string" ? b : `${b.state} fanget ${b.aggregate.capturedAmount.value}`;
      console.log(`${r.id}  ${r.opprettet.toISOString()}  ${r.status.padEnd(9)}  vipps: ${vipps}`);
    }
    return;
  }
  if (!arg) throw new Error("Bruk: npm run vipps -- webhook <url> | webhooker | siste | status|avstem|refunder|kanseller <ref>");
  if (kommando === "webhook") return vis(await kall("POST", "/webhooks/v1/webhooks", { body: { url: arg, events: HENDELSER } }));
  if (kommando === "status") return vis({ betaling: await hentBetaling(arg), hendelser: await hendelser(arg) });
  if (kommando === "avstem") return vis(await avstem(arg));
  if (kommando === "kanseller") return vis((await kanseller(arg)).aggregate);
  if (kommando === "refunder") {
    const [o] = await db.select().from(ordre).where(eq(ordre.id, arg)).limit(1);
    if (!o || o.status !== "betalt") throw new Error(`Ordren ${arg} er ikke betalt (${o?.status ?? "finnes ikke"})`);
    const b = await refunder(arg, o.belopOre);
    await db.update(ordre).set({ status: "refundert", oppdatert: new Date() }).where(eq(ordre.id, arg));
    return vis(b.aggregate);
  }
  throw new Error(`Ukjent kommando: ${kommando}`);
}

main(process.argv[2], process.argv[3]).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
