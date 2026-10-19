// Checks that a webhook came from Vipps (developer.vippsmobilepay.com/docs/APIs/webhooks-api/request-authentication):
// the body's SHA-256 must match x-ms-content-sha256, and Authorization must carry the HMAC-SHA256 of
// "POST\n<path and query>\n<x-ms-date>;<host>;<hash>" with the secret Vipps gave at registration.
// A replayed message does no harm: the handler asks Vipps for the payment's state anyway.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export function gyldigSignatur(p: { sti: string; headers: Headers; body: string; hemmelighet: string }): boolean {
  const h = p.headers;
  const hash = createHash("sha256").update(p.body, "utf8").digest("base64");
  if (h.get("x-ms-content-sha256") !== hash) return false;
  const signatur = createHmac("sha256", p.hemmelighet).update(`POST\n${p.sti}\n${h.get("x-ms-date")};${h.get("host")};${hash}`, "utf8").digest("base64");
  const ventet = Buffer.from(`HMAC-SHA256 SignedHeaders=x-ms-date;host;x-ms-content-sha256&Signature=${signatur}`);
  const fikk = Buffer.from(h.get("authorization") ?? "");
  return ventet.length === fikk.length && timingSafeEqual(ventet, fikk);
}
