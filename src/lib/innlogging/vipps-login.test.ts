import { createHash } from "node:crypto";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { byttKode, innloggingsUrl, oppdag, pkce } from "./vipps-login";

const BASE = "https://apitest.vipps.no";
const ISSUER = "https://api.vipps.no/access-management-1.0/access/";
const disc = { issuer: ISSUER, authorization_endpoint: `${BASE}/access-management-1.0/access/oauth2/auth`, token_endpoint: `${BASE}/access-management-1.0/access/oauth2/token`, jwks_uri: `${BASE}/jwks.json` };

const fetchMock = vi.fn<typeof fetch>();
let nokkel: CryptoKeyPair;
let annen: CryptoKeyPair;
let idToken = "";

async function signer(nokler: CryptoKeyPair, over: { aud?: string; iss?: string; exp?: number | string; nonce?: string } = {}) {
  return new SignJWT({ nonce: over.nonce ?? "n-123" })
    .setProtectedHeader({ alg: "RS256", kid: "k1" })
    .setSubject("sub-abc")
    .setIssuer(over.iss ?? ISSUER)
    .setAudience(over.aud ?? "klient")
    .setIssuedAt()
    .setExpirationTime(over.exp ?? "5m")
    .sign(nokler.privateKey);
}

beforeEach(async () => {
  vi.clearAllMocks();
  process.env.VIPPS_CLIENT_ID = "klient";
  process.env.VIPPS_CLIENT_SECRET = "hemmelig";
  process.env.VIPPS_BASE_URL = BASE;
  nokkel = (await generateKeyPair("RS256")) as CryptoKeyPair;
  annen = (await generateKeyPair("RS256")) as CryptoKeyPair;
  const jwk = { ...(await exportJWK(nokkel.publicKey)), kid: "k1", alg: "RS256", use: "sig" };
  fetchMock.mockImplementation(async (url) => {
    const u = String(url);
    if (u.endsWith("openid-configuration")) return Response.json(disc);
    if (u === disc.jwks_uri) return Response.json({ keys: [jwk] });
    if (u === disc.token_endpoint) return Response.json({ id_token: idToken, access_token: "a" });
    return new Response("nei", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const bytt = () => byttKode({ kode: "kode1", redirectUri: "https://tvistr.no/cb", verifier: "ver", nonce: "n-123" });

describe("innloggingsUrl", () => {
  it("har alle parametrene", async () => {
    const u = new URL(await innloggingsUrl({ state: "state-1234", nonce: "n-123", utfordring: "utf", redirectUri: "https://tvistr.no/cb" }));
    const p = u.searchParams;
    expect(u.origin + u.pathname).toBe(disc.authorization_endpoint);
    expect(Object.fromEntries(p)).toEqual({ client_id: "klient", response_type: "code", scope: "openid", state: "state-1234", nonce: "n-123", redirect_uri: "https://tvistr.no/cb", code_challenge: "utf", code_challenge_method: "S256", market: "NO" });
  });
});

describe("oppdag", () => {
  it("henter konfigurasjonen", async () => {
    expect((await oppdag()).token_endpoint).toBe(disc.token_endpoint);
  });
});

describe("byttKode", () => {
  it("sender Basic-auth og code_verifier og gir sub", async () => {
    idToken = await signer(nokkel);
    expect(await bytt()).toEqual({ sub: "sub-abc" });
    const kall = fetchMock.mock.calls.find((c) => String(c[0]) === disc.token_endpoint)!;
    const init = kall[1]!;
    expect((init.headers as Record<string, string>).Authorization).toBe(`Basic ${Buffer.from("klient:hemmelig").toString("base64")}`);
    const body = new URLSearchParams(String(init.body));
    expect(Object.fromEntries(body)).toEqual({ grant_type: "authorization_code", code: "kode1", redirect_uri: "https://tvistr.no/cb", code_verifier: "ver" });
  });

  it.each([
    ["feil aud", () => signer(nokkel, { aud: "annen" })],
    ["feil iss", () => signer(nokkel, { iss: "https://ond.no/" })],
    ["utløpt exp", () => signer(nokkel, { exp: Math.floor(Date.now() / 1000) - 3600 })],
    ["annen nonce", () => signer(nokkel, { nonce: "annen" })],
    ["signatur fra annen nøkkel", () => signer(annen)],
  ])("avviser %s", async (_n, lag) => {
    idToken = await lag();
    await expect(bytt()).rejects.toThrow();
  });
});

describe("pkce", () => {
  it("utfordringen er base64url(SHA-256(verifier))", () => {
    const { verifier, utfordring } = pkce();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(utfordring).toBe(createHash("sha256").update(verifier).digest("base64url"));
  });
});
