import { expect, it } from "vitest";
import { oppsettsfeil } from "./instrumentation";

const prod = Object.fromEntries(
  ["DATABASE_URL", "ANTHROPIC_API_KEY", "VEGVESEN_API_KEY", "VIPPS_CLIENT_ID", "VIPPS_CLIENT_SECRET", "VIPPS_SUBSCRIPTION_KEY", "VIPPS_MERCHANT_SERIAL_NUMBER", "VIPPS_WEBHOOK_SECRET", "CRON_SECRET", "RESEND_API_KEY", "TVISTR_URL"].map((k) => [k, "x"]),
);
const ok = { ...prod, VERCEL_ENV: "production", VIPPS_BASE_URL: "https://api.vipps.no" };

it("full produksjon: ingen feil", () => expect(oppsettsfeil(ok)).toEqual([]));
it("manglende hemmelighet og testmiljøet til Vipps", () =>
  expect(oppsettsfeil({ ...ok, CRON_SECRET: undefined, VIPPS_BASE_URL: "https://apitest.vipps.no" })).toEqual(["CRON_SECRET mangler", "VIPPS_BASE_URL må være https://api.vipps.no"]));
it("utviklingsflagg i produksjon", () => expect(oppsettsfeil({ ...ok, TVISTR_HELT_BREV_UTEN_BETALING: "1" })).toEqual(["TVISTR_HELT_BREV_UTEN_BETALING må ikke være satt"]));
it("forhåndsvisning og lokalt: ingen sjekk", () => {
  expect(oppsettsfeil({ VERCEL_ENV: "preview" })).toEqual([]);
  expect(oppsettsfeil({})).toEqual([]);
});
