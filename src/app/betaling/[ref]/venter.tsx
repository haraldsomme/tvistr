"use client";

// Waits for Vipps' answer: asks the server every other second for a minute, then lets the buyer ask
// again. The owner's paid case is remembered in this browser (tvistr-sak), and the confirmation shows the receipt,
// the link to the case and the next steps; the buyer goes on to the letter from there. Anyone else sees
// only that the order is paid, with «Logg inn med Vipps» (sjekkBetaling).
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Hake, Kopier, Pil } from "@/app/deler/ikoner";
import { tall } from "@/lib/app/format";
import { skriv } from "@/lib/app/lagring";
import { inneHint } from "@/lib/innlogging/navn";
import { maal } from "@/lib/maling";
import { type Bekreftelse, sjekkBetaling } from "./actions";

const HVER_MS = 2_000;
const FORSOK = 30;

type Visning = "venter" | "lenge" | "avbrutt" | "ukjent";

const TEKST: Record<Visning, { tittel: string; tekst: string }> = {
  venter: { tittel: "Venter på Vipps …", tekst: "Vi sjekker betalingen. Brevet åpnes straks den er bekreftet." },
  lenge: { tittel: "Vi venter fortsatt på Vipps", tekst: "Har du godkjent betalingen i appen, kommer bekreftelsen snart. Sjekk igjen om litt." },
  avbrutt: { tittel: "Betalingen ble ikke gjennomført", tekst: "Den ble avbrutt eller gikk ut på tid. Du er ikke belastet. Svarene dine er lagret, så du kan prøve igjen." },
  ukjent: { tittel: "Fant ikke betalingen", tekst: "Lenken er ikke riktig, eller kjøpet er slettet." },
};

const STEG = ["Sjekk opplysningene om deg og legg inn forhandleren.", "Se vedtaket brevet viser til.", "Kopier brevet og send det til forhandleren."];

const tekstfarge = "#455063";

export function Venter({ referanse, n }: { referanse: string; n: string | null }) {
  const [visning, settVisning] = useState<Visning>("venter");
  const [bekreftelse, settBekreftelse] = useState<Bekreftelse | null>(null);
  const [runde, settRunde] = useState(0);

  const prov = useCallback(() => {
    settVisning("venter");
    settRunde((r) => r + 1);
  }, []);

  useEffect(() => {
    let stopp = false;
    let t: ReturnType<typeof setTimeout>;
    async function sjekk(i: number, igjen = false) {
      const r = await sjekkBetaling(referanse, n).catch(() => ({ status: "venter" }) as const);
      if (stopp) return;
      if (r.status === "betalt") {
        // Of two polls with the secret at once (two tabs, React's double effect in development), the one
        // that did not log in may be answered before the winner's cookie is here: ask once more.
        if (n && !r.bekreftelse.innlogget && !igjen) {
          t = setTimeout(() => sjekk(i, true), HVER_MS);
          return;
        }
        maal("betaling_fullfort");
        if (r.bekreftelse.innlogget) skriv("tvistr-sak", r.bekreftelse.sak);
        // The secret has done its job; keep it out of the address bar, history and copied links.
        if (n) window.history.replaceState(null, "", window.location.pathname);
        settBekreftelse(r.bekreftelse);
      } else if (r.status !== "venter") settVisning(r.status);
      else if (i + 1 >= FORSOK) settVisning("lenge");
      else t = setTimeout(() => sjekk(i + 1), HVER_MS);
    }
    sjekk(0);
    return () => {
      stopp = true;
      clearTimeout(t);
    };
  }, [referanse, n, runde]);

  if (bekreftelse) return <Takk b={bekreftelse} referanse={referanse} medN={!!n} />;

  const { tittel, tekst } = TEKST[visning];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "64px 0", display: "flex", flexDirection: "column", gap: 16 }} aria-live="polite">
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>{tittel}</h1>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: tekstfarge }}>{tekst}</p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {visning === "lenge" && (
          <button type="button" className="btn pri" onClick={prov}>
            Sjekk igjen
          </button>
        )}
        {visning === "avbrutt" && (
          <Link href="/sak" className="btn pri" style={{ textDecoration: "none" }}>
            Prøv igjen
          </Link>
        )}
        {visning === "ukjent" && (
          <Link href="/sak" className="btn" style={{ textDecoration: "none" }}>
            Til saksvurderingen
          </Link>
        )}
      </div>
    </div>
  );
}

const kort = { background: "#FFFFFF", border: "1px solid #E2E6EC", borderRadius: 16, padding: "18px 20px" } as const;
const etikett = { fontSize: 12, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", color: "#7A8597", margin: "0 0 10px" } as const;

function Takk({ b, referanse, medN }: { b: Bekreftelse; referanse: string; medN: boolean }) {
  // Shown only after the server's answer, so always in the browser.
  const lenke = `${window.location.origin}/sak/${b.sakId}`;
  const [kopiert, settKopiert] = useState(false);
  // The case itself only for its owner; anyone else sees that the order is paid.
  const eier = b.innlogget ? b : null;
  // The losing one of two racing polls can report false although the winner set the cookie, so the
  // readable hint cookie counts too, but only when this page came with the secret: a hint from an
  // earlier login (perhaps another account) says nothing about this payment.
  const inne = b.innlogget || (medN && inneHint());
  const kopier = () =>
    navigator.clipboard?.writeText(lenke).then(
      () => settKopiert(true),
      () => {},
    );
  const dato = new Date(b.betalt).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" });

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "48px 0 64px", display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <span style={{ width: 44, height: 44, borderRadius: 22, background: "#E3F4EA", color: "#1E7A4C", display: "grid", placeItems: "center" }} aria-hidden="true">
          <Hake s={20} />
        </span>
        <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em" }}>Takk for handelen!</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: tekstfarge }}>
          {eier ? `Betalingen er bekreftet, og brevet for ${eier.bil || "bilen"} (${eier.reg}) er klart til å fylles ut.` : "Betalingen er bekreftet, og brevet er klart til å fylles ut."}
        </p>
      </div>

      <section style={kort} aria-label="Lenken til saken">
        <p style={etikett}>Lenken til saken din</p>
        <p style={{ margin: "0 0 12px", fontSize: 15, lineHeight: 1.55, color: tekstfarge }}>
          {eier?.sendtTil ? (
            <>
              Vi har sendt lenken og kvitteringen til <b style={{ color: "#10141A" }}>{eier.sendtTil}</b>, så du alltid finner saken igjen.
            </>
          ) : (
            "Du finner saken igjen på Min side."
          )}{" "}
          {inne ? (
            "Du er logget inn. Neste gang logger du inn med Vipps."
          ) : (
            <>
              Logg inn med Vipps for å åpne saken.{" "}
              <a className="btn" href={`/logg-inn?til=${encodeURIComponent(`/sak/${b.sakId}`)}`}>
                Logg inn med Vipps
              </a>
            </>
          )}
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <code style={{ flex: "1 1 240px", minWidth: 0, overflowWrap: "anywhere", fontSize: 13, background: "#F5F6F8", borderRadius: 10, padding: "10px 12px" }}>{lenke}</code>
          <button type="button" className="btn" onClick={kopier}>
            <Kopier />
            {kopiert ? "Kopiert" : "Kopier"}
          </button>
        </div>
      </section>

      <section style={kort} aria-label="Neste steg">
        <p style={etikett}>Neste steg</p>
        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 15, lineHeight: 1.7, color: tekstfarge }}>
          {STEG.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
      </section>

      <section style={kort} aria-label="Kvittering">
        <p style={etikett}>Kvittering</p>
        <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "1fr auto", rowGap: 8, columnGap: 16, fontSize: 14, color: tekstfarge }}>
          <dt>{eier ? `Reklamasjonsbrev for bil, ${eier.bil} (${eier.reg})` : "Reklamasjonsbrev for bil"}</dt>
          <dd style={{ margin: 0, color: "#10141A" }}>kr {tall(b.belopOre / 100)}</dd>
          <dt>Betalt</dt>
          <dd style={{ margin: 0 }}>{b.belopOre ? `${dato} med Vipps` : dato}</dd>
          <dt>Ordrenummer</dt>
          <dd style={{ margin: 0, fontFamily: "var(--font-geist-mono)" }}>{referanse}</dd>
        </dl>
      </section>

      <div>
        <Link href={`/sak/${b.sakId}`} className="btn pri xl" style={{ textDecoration: "none" }}>
          Fortsett til brevet
          <Pil />
        </Link>
        <p style={{ margin: "12px 0 0", fontSize: 14 }}>
          <Link href="/min-side" style={{ color: "#2B5BF0" }}>
            Alle brevene dine finner du på Min side
          </Link>
        </p>
      </div>
    </div>
  );
}
