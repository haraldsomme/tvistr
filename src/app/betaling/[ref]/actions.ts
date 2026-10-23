"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { ordre, sak } from "@/db/schema";
import { type Kjopt, kjopt } from "@/lib/app/saken";
import { mottaker } from "@/lib/epost/kvittering";
import { innlogget, lagOkt, sha256hex } from "@/lib/innlogging/okt";
import { ipFra, lagGrense } from "@/lib/rategrense";
import { erId } from "@/lib/sak/id";
import { avstem } from "@/lib/vipps/avstem";
import { hentBetaling } from "@/lib/vipps/klient";
import { maskerEpost } from "@/lib/vipps/kjoper";
import { HELT_BREV_UTEN_BETALING, UTVIKLINGSEIER } from "@/lib/vipps/profil";
import { feiltekst } from "@/lib/logg";

// What the confirmation shows. The page opens for anyone with the reference, which the receipt prints
// as «Ordrenummer», so only the browser logged in as the case's owner (`innlogget`) gets the case: its
// car, its faults (kept in the browser as tvistr-sak) and the masked address the receipt went to.
// Anyone else gets the payment and the case id, for «Logg inn med Vipps» to the case.
type Betalt = { sakId: string; belopOre: number; betalt: string };
export type Bekreftelse = (Betalt & { innlogget: false }) | (Betalt & { innlogget: true; sak: Kjopt; bil: string; reg: string; sendtTil: string | null });
export type Betalingsstatus = { status: "betalt"; bekreftelse: Bekreftelse } | { status: "venter" } | { status: "avbrutt" } | { status: "ukjent" };

const forMange = lagGrense({ antall: 60, vinduMs: 60_000 });
// How long after payment the secret from the return address still logs in.
const INNLOGGING_MS = 60 * 60_000;

// Logs the payer in as the case's owner when `n` is the secret kjop put in the return address, the
// order was paid within the hour, and no earlier call has used it. The secret is cleared in one
// conditional statement, so of the polls that arrive together only one logs in. Never logs `n`.
// The development owner is never logged in outside development.
async function loggInnEier(ref: string, n: unknown, o: { betalt: Date | null; innloggingHash: string | null } | undefined, eier: string | null): Promise<boolean> {
  if (!eier || (eier === UTVIKLINGSEIER && !HELT_BREV_UTEN_BETALING())) return false;
  if (typeof n === "string" && o?.innloggingHash && o.betalt && Date.now() - o.betalt.getTime() < INNLOGGING_MS) {
    const hash = sha256hex(n);
    if (hash === o.innloggingHash) {
      const brukt = await db
        .update(ordre)
        .set({ innloggingHash: null })
        .where(and(eq(ordre.id, ref), eq(ordre.innloggingHash, hash)))
        .returning({ id: ordre.id });
      if (brukt.length) {
        await lagOkt(eier);
        return true;
      }
    }
  }
  return (await innlogget()) === eier;
}

// The return page asks this until Vipps has an answer. A Vipps order is brought in line with Vipps
// (avstem); one from development is paid already. A paid case gives the confirmation (the whole of it
// only to the owner, see Bekreftelse); with the secret `n` from the return address it also logs the payer in.
export async function sjekkBetaling(ref: unknown, n: unknown): Promise<Betalingsstatus> {
  if (!erId(ref)) return { status: "ukjent" };
  if (forMange(ipFra(await headers()))) return { status: "venter" };
  try {
    const [o] = await db.select().from(ordre).where(eq(ordre.id, ref)).limit(1);
    if (!o) return { status: "ukjent" };
    const vipps = o.leverandor === "vipps";
    const a = vipps ? await avstem(ref) : o.status === "betalt" ? ({ status: "betalt", sakId: o.sakId } as const) : ({ status: "avbrutt" } as const);
    if (a.status !== "betalt") return a;
    const [[s], [etter]] = await Promise.all([
      db.select({ skjema: sak.skjema, vippsSub: sak.vippsSub }).from(sak).where(eq(sak.id, a.sakId)).limit(1),
      db.select({ betalt: ordre.betalt, kvitteringSendt: ordre.kvitteringSendt, innloggingHash: ordre.innloggingHash }).from(ordre).where(eq(ordre.id, ref)).limit(1),
    ]);
    if (!s) return { status: "ukjent" };
    const betalt: Betalt = { sakId: a.sakId, belopOre: o.belopOre, betalt: (etter?.betalt ?? new Date()).toISOString() };
    if (!(await loggInnEier(ref, n, etter, s.vippsSub))) return { status: "betalt", bekreftelse: { ...betalt, innlogget: false } };
    const epost = vipps && etter?.kvitteringSendt ? mottaker(await hentBetaling(ref).then((b) => b.userDetails?.email, () => undefined)) : undefined;
    return {
      status: "betalt",
      bekreftelse: {
        ...betalt,
        innlogget: true,
        sak: kjopt(a.sakId, s.skjema),
        bil: [s.skjema.c_make, s.skjema.c_model].filter(Boolean).join(" "),
        reg: s.skjema.c_reg,
        sendtTil: epost ? maskerEpost(epost) : null,
      },
    };
  } catch (e) {
    console.error("betalingssjekken feilet", feiltekst(e));
    return { status: "venter" };
  }
}
