// Login sessions. The cookie holds a random token; the database only holds its SHA-256, so a leaked
// table cannot be used to log in. INNE is a readable hint for the header, never proof of a login.
import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/db";
import { innlogging } from "@/db/schema";
import { HELT_BREV_UTEN_BETALING, UTVIKLINGSEIER } from "@/lib/vipps/profil";
import { INNE, OKT } from "./navn";

export const OKT_DAGER = 90;

export const sha256hex = (s: string) => createHash("sha256").update(s).digest("hex");

// Server functions and route handlers only (sets cookies).
export async function lagOkt(sub: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const maxAge = OKT_DAGER * 86400;
  await db.insert(innlogging).values({ tokenHash: sha256hex(token), sub, utloper: new Date(Date.now() + maxAge * 1000) });
  const k = await cookies();
  const felles = { maxAge, path: "/", sameSite: "lax" as const, secure: process.env.NODE_ENV === "production" };
  k.set(OKT, token, { ...felles, httpOnly: true });
  k.set(INNE, "1", felles);
}

// The sub of a live session, or null. Cached so one request asks the database once. A session for the
// development owner (a purchase without Vipps) counts only in development, so outside it it opens no
// case, lists none on Min side and gives no buyer details (hentEgenSak, /sak/[id], mineKjop, kjop).
export const innlogget = cache(async (): Promise<string | null> => {
  const sub = await oktensSub();
  return sub === UTVIKLINGSEIER && !HELT_BREV_UTEN_BETALING() ? null : sub;
});

async function oktensSub(): Promise<string | null> {
  const token = (await cookies()).get(OKT)?.value;
  if (!token) return null;
  const [r] = await db
    .select({ sub: innlogging.sub })
    .from(innlogging)
    .where(and(eq(innlogging.tokenHash, sha256hex(token)), gt(innlogging.utloper, new Date())))
    .limit(1);
  return r?.sub ?? null;
}

export async function loggUt(): Promise<void> {
  const k = await cookies();
  const token = k.get(OKT)?.value;
  if (token) await db.delete(innlogging).where(eq(innlogging.tokenHash, sha256hex(token)));
  k.delete(OKT);
  k.delete(INNE);
}
