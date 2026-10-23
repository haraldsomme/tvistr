// Production refuses to start with a setup that would take money without delivering, skip deleting
// cases, or send receipts to the developer. Only on Vercel's production; previews and `next start`
// on a laptop run with test keys.
const MA_HA = ["DATABASE_URL", "ANTHROPIC_API_KEY", "VEGVESEN_API_KEY", "VIPPS_CLIENT_ID", "VIPPS_CLIENT_SECRET", "VIPPS_SUBSCRIPTION_KEY", "VIPPS_MERCHANT_SERIAL_NUMBER", "VIPPS_WEBHOOK_SECRET", "CRON_SECRET", "RESEND_API_KEY", "TVISTR_URL"];

export function oppsettsfeil(env: Record<string, string | undefined>): string[] {
  if (env.VERCEL_ENV !== "production") return [];
  return [
    ...MA_HA.filter((k) => !env[k]).map((k) => `${k} mangler`),
    ...(env.VIPPS_BASE_URL?.replace(/\/$/, "") === "https://api.vipps.no" ? [] : ["VIPPS_BASE_URL må være https://api.vipps.no"]),
    ...["TVISTR_HELT_BREV_UTEN_BETALING", "EPOST_TEST_TIL"].filter((k) => env[k]).map((k) => `${k} må ikke være satt`),
  ];
}

export function register() {
  const feil = oppsettsfeil(process.env);
  if (feil.length) throw new Error(`Produksjonen er ikke satt opp: ${feil.join("; ")}`);
}
