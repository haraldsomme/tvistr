"use server";

import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ordre, sak } from "@/db/schema";
import { type Kjopt, kjopt } from "@/lib/app/saken";
import { mottaker } from "@/lib/epost/kvittering";
import { lagGrense } from "@/lib/rategrense";
import { erId } from "@/lib/sak/id";
import { avstem } from "@/lib/vipps/avstem";
import { hentBetaling } from "@/lib/vipps/klient";
import { maskerEpost } from "@/lib/vipps/kjoper";

// What the confirmation shows. The address the receipt went to is masked: the page opens for anyone
// with the reference.
export type Bekreftelse = { sak: Kjopt; belopOre: number; betalt: string; bil: string; reg: string; sendtTil: string | null };
export type Betalingsstatus = { status: "betalt"; bekreftelse: Bekreftelse } | { status: "venter" } | { status: "avbrutt" } | { status: "ukjent" };

const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });

// The return page asks this until Vipps has an answer. A Vipps order is brought in line with Vipps
// (avstem); one from development is paid already. A paid case gives the confirmation and what the
// browser keeps of it (tvistr-sak); the link to it is the access.
export async function sjekkBetaling(ref: unknown): Promise<Betalingsstatus> {
  if (!erId(ref)) return { status: "ukjent" };
  if (forMange((await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() || "ukjent")) return { status: "venter" };
  try {
    const [o] = await db.select().from(ordre).where(eq(ordre.id, ref)).limit(1);
    if (!o) return { status: "ukjent" };
    const vipps = o.leverandor === "vipps";
    const a = vipps ? await avstem(ref) : o.status === "betalt" ? ({ status: "betalt", sakId: o.sakId } as const) : ({ status: "avbrutt" } as const);
    if (a.status !== "betalt") return a;
    const [[s], [etter]] = await Promise.all([
      db.select({ skjema: sak.skjema }).from(sak).where(eq(sak.id, a.sakId)).limit(1),
      db.select({ betalt: ordre.betalt, kvitteringSendt: ordre.kvitteringSendt }).from(ordre).where(eq(ordre.id, ref)).limit(1),
    ]);
    if (!s) return { status: "ukjent" };
    const epost = vipps && etter?.kvitteringSendt ? mottaker(await hentBetaling(ref).then((b) => b.userDetails?.email, () => undefined)) : undefined;
    return {
      status: "betalt",
      bekreftelse: {
        sak: kjopt(a.sakId, s.skjema),
        belopOre: o.belopOre,
        betalt: (etter?.betalt ?? new Date()).toISOString(),
        bil: [s.skjema.c_make, s.skjema.c_model].filter(Boolean).join(" "),
        reg: s.skjema.c_reg,
        sendtTil: epost ? maskerEpost(epost) : null,
      },
    };
  } catch (e) {
    console.error("betalingssjekken feilet", e);
    return { status: "venter" };
  }
}
