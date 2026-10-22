import { db } from "@/db";
import { hendelse } from "@/db/schema";
import { rensMaling } from "@/lib/maling";
import { ipFra, lagGrense, lesJson } from "@/lib/rategrense";

const forMange = lagGrense({ antall: 120, vinduMs: 60_000 });

// One step of the flow (src/lib/maling.ts). Nothing but the event, the status and the categories is
// kept, and the address is only used for the limit.
export async function POST(request: Request) {
  if (forMange(ipFra(request.headers))) return new Response(null, { status: 429 });
  const m = rensMaling(await lesJson(request, 2_000));
  if (!m) return new Response(null, { status: 400 });
  try {
    await db.insert(hendelse).values(m);
  } catch (e) {
    console.error("hendelse ble ikke lagret", e);
    return new Response(null, { status: 500 });
  }
  return new Response(null, { status: 204 });
}
