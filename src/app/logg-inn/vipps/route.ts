// Vipps sends the user back here (?code&state, or ?error). The start row is deleted in the same
// statement that reads it, so a state works once and only for 10 minutes. The START cookie is checked
// when present; it is missing when Vipps opens the return in another browser than the one that started.
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { innloggingStart } from "@/db/schema";
import { opprinnelse, START, START_MINUTTER, trygtMal } from "@/lib/innlogging/flyt";
import { lagOkt } from "@/lib/innlogging/okt";
import { byttKode } from "@/lib/innlogging/vipps-login";

export async function GET(request: Request) {
  const base = opprinnelse(request);
  const p = new URL(request.url).searchParams;
  const state = p.get("state");
  const kode = p.get("code");
  const k = await cookies();
  const kake = k.get(START)?.value;
  const feil = () => {
    k.delete(START);
    return NextResponse.redirect(new URL("/logg-inn/feil", base), 302);
  };

  if (!state) return feil();
  const [start] = await db
    .delete(innloggingStart)
    .where(and(eq(innloggingStart.state, state), gt(innloggingStart.opprettet, new Date(Date.now() - START_MINUTTER * 60_000))))
    .returning();
  if (!start || p.has("error") || !kode || (kake !== undefined && kake !== state)) return feil();

  try {
    const { sub } = await byttKode({ kode, redirectUri: `${base}/logg-inn/vipps`, verifier: start.verifier, nonce: start.nonce });
    await lagOkt(sub);
  } catch {
    // byttKode logs the endpoint and status itself.
    return feil();
  }
  k.delete(START);
  return NextResponse.redirect(new URL(trygtMal(start.til), base), 302);
}
