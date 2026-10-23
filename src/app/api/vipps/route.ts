import { avstem } from "@/lib/vipps/avstem";
import { gyldigSignatur } from "@/lib/vipps/signatur";
import { erId } from "@/lib/sak/id";
import { ipFra, lagGrense } from "@/lib/rategrense";
import { feiltekst } from "@/lib/logg";

const forMange = lagGrense({ antall: 300, vinduMs: 60_000 });

// Vipps' webhooks for ePayment (registered with `npm run vipps -- webhook`). Only the reference is read
// from the message; the state comes from Vipps itself (src/lib/vipps/avstem.ts). An error answer makes
// Vipps try again later.
export async function POST(request: Request) {
  if (forMange(ipFra(request.headers))) return new Response(null, { status: 429 });
  const hemmelighet = process.env.VIPPS_WEBHOOK_SECRET;
  const body = await request.text();
  const url = new URL(request.url);
  if (!hemmelighet || body.length > 20_000 || !gyldigSignatur({ sti: url.pathname + url.search, headers: request.headers, body, hemmelighet })) return new Response(null, { status: 401 });
  let ref: unknown;
  try {
    ref = (JSON.parse(body) as { reference?: unknown }).reference;
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!erId(ref)) return new Response(null, { status: 200 });
  try {
    await avstem(ref);
    return new Response(null, { status: 200 });
  } catch (e) {
    console.error("vipps-webhook feilet", feiltekst(e));
    return new Response(null, { status: 500 });
  }
}
