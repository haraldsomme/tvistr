import { slettGamleSaker, slettUtlopteInnlogginger } from "@/lib/sak/sletting";
import { avstemUavklarte } from "@/lib/vipps/uavklart";
import { feiltekst } from "@/lib/logg";

// Brings Vipps orders still without an answer in line (src/lib/vipps/uavklart.ts), then deletes the cases
// kept longer than the privacy statement says and the expired login sessions (src/lib/sak/sletting.ts). Vercel Cron calls it once a day
// (vercel.json) with CRON_SECRET as a bearer token; without the secret it does nothing.
export async function GET(request: Request) {
  const hemmelig = process.env.CRON_SECRET;
  if (!hemmelig || request.headers.get("authorization") !== `Bearer ${hemmelig}`) return new Response(null, { status: 401 });
  try {
    const vipps = await avstemUavklarte();
    const antall = await slettGamleSaker();
    const innlogginger = await slettUtlopteInnlogginger();
    console.info("sletting", JSON.stringify({ antall, innlogginger, vipps }));
    return Response.json({ antall, innlogginger, vipps });
  } catch (e) {
    console.error("sletting feilet", feiltekst(e));
    return new Response(null, { status: 500 });
  }
}
