import { slettGamleSaker } from "@/lib/sak/sletting";

// Deletes the cases kept longer than the privacy statement says (src/lib/sak/sletting.ts). Vercel Cron
// calls it once a day (vercel.json) with CRON_SECRET as a bearer token; without the secret it does nothing.
export async function GET(request: Request) {
  const hemmelig = process.env.CRON_SECRET;
  if (!hemmelig || request.headers.get("authorization") !== `Bearer ${hemmelig}`) return new Response(null, { status: 401 });
  try {
    const antall = await slettGamleSaker();
    console.info("sletting", JSON.stringify({ antall }));
    return Response.json({ antall });
  } catch (e) {
    console.error("sletting feilet", e);
    return new Response(null, { status: 500 });
  }
}
