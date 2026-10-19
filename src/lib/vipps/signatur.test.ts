import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gyldigSignatur } from "./signatur";

const hemmelighet = "hemmelig";
const sti = "/api/vipps";

// Signed as Vipps signs (webhooks-api/request-authentication).
function signert(body: string, o: { hemmelighet?: string; hash?: string } = {}) {
  const hash = o.hash ?? createHash("sha256").update(body).digest("base64");
  const dato = "Mon, 19 Oct 2026 10:00:00 GMT";
  const signatur = createHmac("sha256", o.hemmelighet ?? hemmelighet).update(`POST\n${sti}\n${dato};tvistr.no;${hash}`).digest("base64");
  return new Headers({ host: "tvistr.no", "x-ms-date": dato, "x-ms-content-sha256": hash, authorization: `HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signatur}` });
}

describe("gyldigSignatur", () => {
  const body = JSON.stringify({ reference: "abcdefghijkm", name: "AUTHORIZED" });

  it("godtar en melding signert med hemmeligheten", () => {
    expect(gyldigSignatur({ sti, headers: signert(body), body, hemmelighet })).toBe(true);
  });

  it("avviser en endret melding, feil hemmelighet og feil sti", () => {
    expect(gyldigSignatur({ sti, headers: signert(body), body: body.replace("AUTHORIZED", "CAPTURED"), hemmelighet })).toBe(false);
    expect(gyldigSignatur({ sti, headers: signert(body, { hemmelighet: "annen" }), body, hemmelighet })).toBe(false);
    expect(gyldigSignatur({ sti: "/api/annen", headers: signert(body), body, hemmelighet })).toBe(false);
  });

  it("avviser en hash som ikke stemmer med meldingen, og en melding uten signatur", () => {
    expect(gyldigSignatur({ sti, headers: signert(body, { hash: "feil" }), body, hemmelighet })).toBe(false);
    expect(gyldigSignatur({ sti, headers: new Headers(), body, hemmelighet })).toBe(false);
  });
});
