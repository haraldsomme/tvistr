// Starts a Vipps Login: stores state, nonce and the PKCE verifier, and sends the user to Vipps.
// /logg-inn?til=<path> brings them back to that path in the app afterwards.
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { innloggingStart } from "@/db/schema";
import { opprinnelse, START, START_MINUTTER, trygtMal } from "@/lib/innlogging/flyt";
import { innlogget } from "@/lib/innlogging/okt";
import { innloggingsUrl, pkce } from "@/lib/innlogging/vipps-login";

export async function GET(request: Request) {
  const base = opprinnelse(request);
  const til = trygtMal(new URL(request.url).searchParams.get("til") ?? undefined);
  if (await innlogget()) return NextResponse.redirect(new URL(til, base), 302);
  try {
    const state = randomBytes(32).toString("base64url");
    const nonce = randomBytes(32).toString("base64url");
    const { verifier, utfordring } = pkce();
    await db.insert(innloggingStart).values({ state, nonce, verifier, til });
    const url = await innloggingsUrl({ state, nonce, utfordring, redirectUri: `${base}/logg-inn/vipps` });
    (await cookies()).set(START, state, {
      httpOnly: true,
      maxAge: START_MINUTTER * 60,
      path: "/", // cookies().delete(name) clears Path=/, so the callback can remove it
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    return NextResponse.redirect(url, 302);
  } catch (e) {
    console.error("innlogging-feil", JSON.stringify({ steg: "start", feil: e instanceof Error ? e.message : "ukjent" }));
    return NextResponse.redirect(new URL("/logg-inn/feil", base), 302);
  }
}
