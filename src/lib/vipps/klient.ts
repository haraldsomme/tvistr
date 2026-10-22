// Vipps MobilePay's ePayment API (developer.vippsmobilepay.com/docs/APIs/epayment-api), with plain fetch.
// The reference is the order's id (ordre.id). Every call sends the sales unit's keys and the
// Vipps-System headers; an error answer is logged with the endpoint, the status and the body, never a key.
import pakke from "../../../package.json";

const SYSTEM = { "Vipps-System-Name": "tvistr", "Vipps-System-Version": pakke.version, "Vipps-System-Plugin-Name": "tvistr-web", "Vipps-System-Plugin-Version": pakke.version };

type Belop = { currency: string; value: number };
export type Tilstand = "CREATED" | "AUTHORIZED" | "ABORTED" | "EXPIRED" | "TERMINATED";
export type Betaling = {
  reference: string;
  state: Tilstand;
  pspReference: string;
  amount: Belop;
  aggregate: { authorizedAmount: Belop; cancelledAmount: Belop; capturedAmount: Belop; refundedAmount: Belop };
  // What the buyer shared (PROFIL), once the payment is approved.
  userDetails?: Kjoperdata;
  // The buyer's Vipps id (the same `sub` as Vipps Login), once the payment is approved: the case's owner.
  profile?: { sub?: string };
};
export type Kjoperdata = {
  email?: string;
  firstName?: string;
  lastName?: string;
  mobileNumber?: string;
  addresses?: { addressLine1?: string; addressLine2?: string; postCode?: string; city?: string; country?: string }[];
};

// What the buyer shares from Vipps before paying: what the letter needs about them, and the address
// the receipt is sent to. The buyer consents in the app; without consent the payment fails.
export const PROFIL = "name email phoneNumber address";

// The test environment unless VIPPS_BASE_URL says otherwise; production keys do not work there.
export const vippsBase = () => (process.env.VIPPS_BASE_URL || "https://apitest.vipps.no").replace(/\/$/, "");

function oppsett() {
  const e = process.env;
  const v = { base: vippsBase(), id: e.VIPPS_CLIENT_ID, hemmelig: e.VIPPS_CLIENT_SECRET, nokkel: e.VIPPS_SUBSCRIPTION_KEY, msn: e.VIPPS_MERCHANT_SERIAL_NUMBER };
  if (!v.id || !v.hemmelig || !v.nokkel || !v.msn) throw new Error("Vipps er ikke satt opp (VIPPS_* i miljøet)");
  return v as { base: string; id: string; hemmelig: string; nokkel: string; msn: string };
}

export const vippsSattOpp = () => {
  try {
    oppsett();
    return true;
  } catch {
    return false;
  }
};

// The access token lives an hour in test and a day in production; kept in the instance until a minute before.
let lagret: { token: string; utloper: number } | null = null;

async function token(): Promise<string> {
  if (lagret && Date.now() < lagret.utloper) return lagret.token;
  const o = oppsett();
  const r = await fetch(`${o.base}/accesstoken/get`, {
    method: "POST",
    headers: { client_id: o.id, client_secret: o.hemmelig, "Ocp-Apim-Subscription-Key": o.nokkel, "Merchant-Serial-Number": o.msn, ...SYSTEM },
  });
  if (!r.ok) throw await feil("accesstoken", r);
  const t = (await r.json()) as { access_token: string; expires_in: string | number };
  lagret = { token: t.access_token, utloper: Date.now() + (Number(t.expires_in) - 60) * 1000 };
  return t.access_token;
}

async function feil(endepunkt: string, r: Response): Promise<Error> {
  const svar = (await r.text().catch(() => "")).slice(0, 2_000);
  console.error("vipps-feil", JSON.stringify({ endepunkt, status: r.status, svar }));
  return new Error(`Vipps ${endepunkt}: ${r.status}`);
}

// One API call. `nokkel` is the Idempotency-Key: the same key gives Vipps' first answer again.
export async function kall<T>(metode: "GET" | "POST", sti: string, o: { body?: unknown; nokkel?: string } = {}): Promise<T> {
  const s = oppsett();
  const r = await fetch(`${s.base}${sti}`, {
    method: metode,
    headers: {
      Authorization: `Bearer ${await token()}`,
      "Ocp-Apim-Subscription-Key": s.nokkel,
      "Merchant-Serial-Number": s.msn,
      ...SYSTEM,
      ...(o.body !== undefined && { "Content-Type": "application/json" }),
      ...(o.nokkel && { "Idempotency-Key": o.nokkel }),
    },
    body: o.body === undefined ? undefined : JSON.stringify(o.body),
    cache: "no-store",
  });
  if (!r.ok) throw await feil(`${metode} ${sti.replace(/payments\/[^/]+/, "payments/{ref}")}`, r);
  return (await r.json()) as T;
}

const nok = (ore: number): Belop => ({ currency: "NOK", value: ore });
const sti = (ref: string) => `/epayment/v1/payments/${encodeURIComponent(ref)}`;

// A payment the buyer approves in the app, after which Vipps sends them to `returnUrl`.
export const opprettBetaling = (p: { ref: string; belopOre: number; returnUrl: string; beskrivelse: string }) =>
  kall<{ redirectUrl: string; reference: string }>("POST", "/epayment/v1/payments", {
    nokkel: p.ref,
    body: { amount: nok(p.belopOre), paymentMethod: { type: "WALLET" }, profile: { scope: PROFIL }, reference: p.ref, returnUrl: p.returnUrl, userFlow: "WEB_REDIRECT", paymentDescription: p.beskrivelse },
  });

export const hentBetaling = (ref: string) => kall<Betaling>("GET", sti(ref));
export const hendelser = (ref: string) => kall<unknown[]>("GET", `${sti(ref)}/events`);
export const capture = (ref: string, belopOre: number) => kall<Betaling>("POST", `${sti(ref)}/capture`, { nokkel: `${ref}-capture`, body: { modificationAmount: nok(belopOre) } });
export const kanseller = (ref: string) => kall<Betaling>("POST", `${sti(ref)}/cancel`, { nokkel: `${ref}-cancel`, body: {} });
export const refunder = (ref: string, belopOre: number) => kall<Betaling>("POST", `${sti(ref)}/refund`, { nokkel: `${ref}-refund`, body: { modificationAmount: nok(belopOre) } });
