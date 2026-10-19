// Vipps Login (OpenID Connect, authorization code flow with PKCE) for the same sales unit as the payment.
// Discovery gives the endpoints; the id_token is verified with jose against the keys at jwks_uri.
// Errors are logged with the endpoint and status, never a code, token or secret.
import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

type Oppdagelse = { authorization_endpoint: string; token_endpoint: string; jwks_uri: string; issuer: string };

function oppsett() {
  const e = process.env;
  const base = (e.VIPPS_BASE_URL || "https://apitest.vipps.no").replace(/\/$/, "");
  if (!e.VIPPS_CLIENT_ID || !e.VIPPS_CLIENT_SECRET) throw new Error("Vipps er ikke satt opp (VIPPS_* i miljøet)");
  return { base, id: e.VIPPS_CLIENT_ID, hemmelig: e.VIPPS_CLIENT_SECRET };
}

// Kept in the instance for an hour, per base URL.
let lagret: { base: string; d: Oppdagelse; utloper: number } | null = null;
const jwks = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

export async function oppdag(): Promise<Oppdagelse> {
  const { base } = oppsett();
  if (lagret && lagret.base === base && Date.now() < lagret.utloper) return lagret.d;
  const r = await fetch(`${base}/access-management-1.0/access/.well-known/openid-configuration`);
  if (!r.ok) {
    console.error("vipps-login-feil", JSON.stringify({ endepunkt: "discovery", status: r.status }));
    throw new Error(`Vipps Login discovery: ${r.status}`);
  }
  const j = (await r.json()) as Oppdagelse;
  const d = { authorization_endpoint: j.authorization_endpoint, token_endpoint: j.token_endpoint, jwks_uri: j.jwks_uri, issuer: j.issuer };
  lagret = { base, d, utloper: Date.now() + 3_600_000 };
  return d;
}

export async function innloggingsUrl(p: { state: string; nonce: string; utfordring: string; redirectUri: string }): Promise<string> {
  const d = await oppdag();
  const u = new URL(d.authorization_endpoint);
  u.search = new URLSearchParams({
    client_id: oppsett().id,
    response_type: "code",
    scope: "openid",
    state: p.state,
    nonce: p.nonce,
    redirect_uri: p.redirectUri,
    code_challenge: p.utfordring,
    code_challenge_method: "S256",
    market: "NO",
  }).toString();
  return u.toString();
}

// Exchanges the code for tokens and verifies the id_token; throws on any failure.
export async function byttKode(p: { kode: string; redirectUri: string; verifier: string; nonce: string }): Promise<{ sub: string }> {
  const o = oppsett();
  const d = await oppdag();
  const r = await fetch(d.token_endpoint, {
    method: "POST",
    headers: { Authorization: `Basic ${Buffer.from(`${o.id}:${o.hemmelig}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code: p.kode, redirect_uri: p.redirectUri, code_verifier: p.verifier }).toString(),
  });
  if (!r.ok) {
    console.error("vipps-login-feil", JSON.stringify({ endepunkt: "token", status: r.status }));
    throw new Error(`Vipps Login token: ${r.status}`);
  }
  const { id_token } = (await r.json()) as { id_token?: string };
  if (!id_token) throw new Error("Vipps Login: id_token mangler");
  let sett = jwks.get(d.jwks_uri);
  if (!sett) jwks.set(d.jwks_uri, (sett = createRemoteJWKSet(new URL(d.jwks_uri))));
  try {
    const { payload } = await jwtVerify(id_token, sett, { issuer: d.issuer, audience: o.id, algorithms: ["RS256"] });
    if (payload.nonce !== p.nonce) throw new Error("nonce stemmer ikke");
    if (!payload.sub) throw new Error("sub mangler");
    return { sub: payload.sub };
  } catch (e) {
    console.error("vipps-login-feil", JSON.stringify({ endepunkt: "id_token", feil: e instanceof Error ? e.message : "ukjent" }));
    throw e;
  }
}

export function pkce(): { verifier: string; utfordring: string } {
  const verifier = randomBytes(32).toString("base64url");
  return { verifier, utfordring: createHash("sha256").update(verifier).digest("base64url") };
}
