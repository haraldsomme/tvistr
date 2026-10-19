// The receipt to the buyer after a Vipps payment: the link to the case (the only way back to it), the
// next steps and what was bought. Sent once per order with Resend (resend.com, EU region); the address
// is the one the buyer shared in Vipps and is not stored beyond the form. Never the letter itself: the
// buyer sends that.
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { ordre, sak } from "@/db/schema";
import { tall } from "@/lib/app/format";
import { FIRMA } from "@/lib/firma";

export type Kvittering = { ref: string; sakId: string; belopOre: number; betalt: Date; bil: string; reg: string };

const url = (sakId: string) => `${(process.env.TVISTR_URL || "https://tvistr.no").replace(/\/$/, "")}/sak/${sakId}`;
const dato = (d: Date) => d.toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Oslo" });
const kr = (ore: number) => `kr ${tall(Math.round(ore / 100))}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const STEG = ["Sjekk opplysningene om deg (fylt inn fra Vipps) og legg inn forhandleren.", "Se vedtaket brevet viser til.", "Kopier brevet og send det til forhandleren."];

export function byggKvittering(k: Kvittering): { emne: string; html: string; tekst: string } {
  const lenke = url(k.sakId);
  const vare = `Reklamasjonsbrev for bil – ${k.bil} (${k.reg})`;
  const selger = `${FIRMA.navn}, org.nr. ${FIRMA.orgnr}, ${FIRMA.adresse}`;
  const angrerett = "Du ba om at brevet ble åpnet med en gang, og angreretten gikk da tapt (angrerettloven § 22 bokstav n).";
  const mva = `${FIRMA.navn} er ikke registrert i merverdiavgiftsregisteret.`;
  const tekst = [
    "Takk for handelen!",
    "",
    `Betalingen er bekreftet, og brevet for ${k.bil} (${k.reg}) er klart til å fylles ut.`,
    "",
    `Saken din: ${lenke}`,
    "Ta vare på denne e-posten. Lenken er tilgangen til saken, så ikke del den med andre.",
    "",
    "Neste steg:",
    ...STEG.map((s, i) => `${i + 1}. ${s}`),
    "",
    "Kvittering",
    `Selger: ${selger}`,
    `Dato: ${dato(k.betalt)}`,
    `Ordrenummer: ${k.ref}`,
    `${vare}: ${kr(k.belopOre)}`,
    `Totalt: ${kr(k.belopOre)}, betalt med Vipps`,
    mva,
    angrerett,
    "",
    `Spørsmål? Svar på denne e-posten eller skriv til ${FIRMA.epost}.`,
  ].join("\n");

  const p = (t: string, stil = "") => `<p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#455063;${stil}">${t}</p>`;
  const rad = (a: string, b: string, stil = "") => `<tr><td style="padding:6px 0;color:#455063;${stil}">${a}</td><td style="padding:6px 0;text-align:right;color:#10141A;${stil}">${b}</td></tr>`;
  const html = `<!doctype html><html lang="nb"><body style="margin:0;background:#F5F6F8;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px">
<div style="background:#FFFFFF;border-radius:16px;padding:28px">
<div style="font-size:22px;font-weight:800;color:#10141A;margin-bottom:20px">tvistr</div>
<h1 style="margin:0 0 12px;font-size:24px;color:#10141A">Takk for handelen!</h1>
${p(`Betalingen er bekreftet, og brevet for ${esc(k.bil)} (${esc(k.reg)}) er klart til å fylles ut.`)}
<p style="margin:22px 0"><a href="${lenke}" style="display:inline-block;background:#2B5BF0;color:#FFFFFF;text-decoration:none;font-weight:600;padding:13px 22px;border-radius:12px">Åpne saken din</a></p>
${p(`Eller kopier lenken: <a href="${lenke}" style="color:#2B5BF0;word-break:break-all">${lenke}</a>`)}
${p("Ta vare på denne e-posten. Lenken er tilgangen til saken, så ikke del den med andre.")}
<h2 style="margin:24px 0 8px;font-size:16px;color:#10141A">Neste steg</h2>
<ol style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.55;color:#455063">${STEG.map((s) => `<li>${s}</li>`).join("")}</ol>
<h2 style="margin:24px 0 8px;font-size:16px;color:#10141A">Kvittering</h2>
<table style="width:100%;border-collapse:collapse;font-size:14px">
${rad("Selger", esc(selger))}
${rad("Dato", dato(k.betalt))}
${rad("Ordrenummer", k.ref)}
${rad(esc(vare), kr(k.belopOre), "border-top:1px solid #E2E6EC")}
${rad("<b>Totalt, betalt med Vipps</b>", `<b>${kr(k.belopOre)}</b>`, "border-top:1px solid #E2E6EC")}
</table>
${p(mva, "margin-top:14px;font-size:13px")}
${p(angrerett, "font-size:13px")}
${p(`Spørsmål? Svar på denne e-posten eller skriv til <a href="mailto:${FIRMA.epost}" style="color:#2B5BF0">${FIRMA.epost}</a>.`, "font-size:13px")}
</div></div></body></html>`;
  return { emne: "Kvittering og lenke til saken din – Tvistr", html, tekst };
}

// While Vipps runs against its test environment, the test user's address is not a real one:
// EPOST_TEST_TIL sends every receipt to the developer instead. It has no effect against production.
export function mottaker(epost: string | undefined): string | undefined {
  const test = (process.env.VIPPS_BASE_URL || "https://apitest.vipps.no").includes("apitest");
  return (test && process.env.EPOST_TEST_TIL) || epost;
}

// Sends the receipt for a paid order, once: the order is claimed (kvittering_sendt) before sending and
// released again if the sending fails, so the cron can try later. Without an address or a key nothing
// is sent.
export async function sendKvittering(ref: string, delt: string | undefined): Promise<"sendt" | "hoppet" | "feilet"> {
  const epost = mottaker(delt);
  const nokkel = process.env.RESEND_API_KEY;
  if (!epost || !nokkel) {
    console.info("kvittering ikke sendt", JSON.stringify({ ref, epost: !!epost, satt_opp: !!nokkel }));
    return "hoppet";
  }
  const [o] = await db
    .update(ordre)
    .set({ kvitteringSendt: new Date() })
    .where(and(eq(ordre.id, ref), eq(ordre.status, "betalt"), isNull(ordre.kvitteringSendt)))
    .returning({ sakId: ordre.sakId, belopOre: ordre.belopOre, betalt: ordre.betalt });
  if (!o) return "hoppet";
  try {
    const [s] = await db.select({ skjema: sak.skjema }).from(sak).where(eq(sak.id, o.sakId)).limit(1);
    const bil = [s?.skjema.c_make, s?.skjema.c_model].filter(Boolean).join(" ") || "bilen";
    const { emne, html, tekst } = byggKvittering({ ref, sakId: o.sakId, belopOre: o.belopOre, betalt: o.betalt ?? new Date(), bil, reg: s?.skjema.c_reg ?? "" });
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${nokkel}`, "Content-Type": "application/json", "Idempotency-Key": `kvittering-${ref}` },
      body: JSON.stringify({ from: process.env.EPOST_FRA || "Tvistr <kvittering@tvistr.no>", to: [epost], reply_to: FIRMA.epost, subject: emne, html, text: tekst }),
    });
    if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 500)}`);
    console.info("kvittering sendt", JSON.stringify({ ref }));
    return "sendt";
  } catch (e) {
    console.error("kvitteringen feilet", ref, e);
    await db.update(ordre).set({ kvitteringSendt: null }).where(eq(ordre.id, ref)).catch(() => {});
    return "feilet";
  }
}
