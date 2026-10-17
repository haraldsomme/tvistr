import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MaalVisning } from "@/app/maal-visning";
import { tall } from "@/lib/brev/format";
import { GRATIS, PRIS } from "@/lib/pris";
import { ALLE } from "@/lib/vurdering/statistikk";
import { Bunn } from "./deler/bunn";
import { Hake, Pil } from "./deler/ikoner";
import { Ordmerke } from "./deler/ordmerke";
import { TilBrevet } from "./til-brevet";

// The landing page (the artifact's home view). The number of decisions is read from the database when
// the site is built.
export const dynamic = "force-static";

// Without a database at build time the page is built without the number, not stopped.
async function antallVedtak(): Promise<number | null> {
  try {
    const { lesStatistikk } = await import("@/lib/vurdering/statistikk-db");
    return (await lesStatistikk()).get(ALLE)?.antallSaker ?? null;
  } catch (e) {
    console.error("antall vedtak ble ikke lest", e);
    return null;
  }
}

const MONO = "var(--f-mono)";
const BLA = "#2B5BF0";
const kicker: CSSProperties = { fontFamily: MONO, fontSize: 12.5, color: BLA };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.035em", fontWeight: 600 };
const ingress: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.6, color: "#455063" };
const kort: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: 28, border: "1px solid transparent", borderRadius: 20, background: "#FFFFFF", boxShadow: "var(--sh-1)" };
const hvit: CSSProperties = { background: "#FFFFFF", borderTop: "1px solid #E2E6EC", borderBottom: "1px solid #E2E6EC" };
const lovtag: CSSProperties = { alignSelf: "flex-start", marginTop: 4, fontFamily: MONO, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "#E8EEFE", color: BLA };
const brevH: CSSProperties = { fontWeight: 700, margin: "18px 0 6px" };
const merket: CSSProperties = { background: "#E8EEFE", color: BLA, padding: "0 4px", borderRadius: 3 };
const radGrid: CSSProperties = { display: "grid", gridTemplateColumns: "minmax(64px, .55fr) minmax(0, 1fr) minmax(0, 1fr)", gap: 12 };

const Gronn = ({ s = 15, farge = "#1E7A4C" }: { s?: number; farge?: string }) => (
  <span style={{ color: farge, display: "inline-flex", flex: "none" }}>
    <Hake s={s} w={2.4} />
  </span>
);

function Steg({ n, tittel, children }: { n: number; tittel: string; children: ReactNode }) {
  return (
    <div style={kort}>
      <span style={{ width: 34, height: 34, borderRadius: "50%", background: BLA, color: "#FFFFFF", display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 13 }}>{n}</span>
      <h3 style={{ margin: "4px 0 0", fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em" }}>{tittel}</h3>
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: "#455063" }}>{children}</p>
    </div>
  );
}

function Sammenligning({ felt, din, sak }: { felt: string; din: string; sak: string }) {
  return (
    <div style={{ ...radGrid, padding: "13px 0", borderTop: "1px solid #E2E6EC", fontSize: 13.5, lineHeight: 1.45, alignItems: "start" }}>
      <span style={{ color: "#5B6576" }}>{felt}</span>
      <span>{din}</span>
      <span style={{ display: "flex", gap: 8, justifyContent: "space-between" }}>
        <span>{sak}</span>
        <span aria-label="Likt" style={{ color: "#1E7A4C" }}>
          <Hake s={13} />
        </span>
      </span>
    </div>
  );
}

function Rettighet({ tall: t, tittel, tekst, lov }: { tall: string; tittel: string; tekst: string; lov: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "28px 28px 8px 0" }}>
      <div style={{ fontSize: 60, lineHeight: 1, letterSpacing: "-0.05em", fontWeight: 600, color: BLA }}>{t}</div>
      <div style={{ fontSize: 16, fontWeight: 600 }}>{tittel}</div>
      <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#455063" }}>{tekst}</p>
      <span style={lovtag}>{lov}</span>
    </div>
  );
}

function Krav({ navn, tekst, par }: { navn: string; tekst: string; par: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "16px 18px", border: "1px solid #E2E6EC", borderRadius: 14 }}>
      <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        <span style={{ fontWeight: 600, fontSize: 15 }}>{navn}</span>
        <span style={{ fontSize: 13, color: "#5B6576" }}>{tekst}</span>
      </span>
      <span style={{ fontFamily: MONO, fontSize: 11, color: BLA }}>{par}</span>
    </div>
  );
}

function Trinn({ n, tittel, tekst, forste, siste }: { n: number; tittel: string; tekst: string; forste?: boolean; siste?: boolean }) {
  return (
    <li style={{ display: "flex", gap: 20, paddingBottom: siste ? 0 : 28, position: "relative" }}>
      <span style={{ flex: "none", width: 34, height: 34, borderRadius: "50%", background: forste ? BLA : "#E8EEFE", color: forste ? "#FFFFFF" : BLA, display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 12.5, zIndex: 1 }}>{n}</span>
      {!siste && <span aria-hidden="true" style={{ position: "absolute", left: 16, top: 34, bottom: 0, width: 2, background: "#E2E6EC" }} />}
      <span style={{ display: "flex", flexDirection: "column", gap: 4, paddingTop: 5 }}>
        <span style={{ fontWeight: 600, fontSize: 16 }}>{tittel}</span>
        <span style={{ fontSize: 14.5, lineHeight: 1.6, color: "#455063" }}>{tekst}</span>
      </span>
    </li>
  );
}

function Sporsmal({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details style={{ borderBottom: "1px solid #E2E6EC" }}>
      <summary style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, padding: "22px 0", fontSize: 17, fontWeight: 550 }}>
        {q}
        <svg className="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLA} strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </summary>
      <p style={{ margin: "0 0 22px", fontSize: 15, lineHeight: 1.65, color: "#455063", maxWidth: "64ch" }}>{children}</p>
    </details>
  );
}

const SjekkKnapp = ({ stor, hvitKnapp }: { stor?: boolean; hvitKnapp?: boolean }) => (
  <Link
    href="/sak?start"
    className={hvitKnapp ? undefined : "btn-pri"}
    style={{
      border: 0, display: "inline-flex", alignItems: "center", gap: 10, height: hvitKnapp ? 56 : 54, padding: hvitKnapp ? "0 26px" : "0 24px", borderRadius: 14,
      background: hvitKnapp ? "#FFFFFF" : BLA, color: hvitKnapp ? BLA : "#FFFFFF", fontSize: 16, fontWeight: hvitKnapp ? 600 : 550, textDecoration: "none", whiteSpace: "nowrap",
      boxShadow: stor ? "0 10px 24px -12px rgba(43,91,240,.7)" : undefined,
    }}
  >
    Sjekk saken din gratis
    <Pil />
  </Link>
);

export default async function Home() {
  const n = await antallVedtak();
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F5F6F8" }}>
      <MaalVisning hendelse="landing" />
      <header style={{ position: "sticky", top: "env(safe-area-inset-top, 0px)", zIndex: 10, background: "rgba(245,246,248,.86)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderBottom: "1px solid #E2E6EC" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, height: 68 }}>
          <a href="#top" style={{ display: "flex", alignItems: "center", gap: 11, textDecoration: "none", color: "#10141A" }}>
            <Ordmerke size={30} />
          </a>
          <nav className="navlinks" aria-label="Hovedmeny" style={{ display: "flex", gap: 32, fontSize: 14, fontWeight: 500 }}>
            <a href="#slik">Slik fungerer det</a>
            <a href="#saker">Vunnede saker</a>
            <a href="#rettigheter">Dine rettigheter</a>
            <a href="#avslag">Hvis de sier nei</a>
            <a href="#sporsmal">Spørsmål</a>
          </nav>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <TilBrevet />
            <Link href="/sak?start" className="btn-pri" style={{ border: 0, display: "inline-flex", alignItems: "center", gap: 8, height: 42, padding: "0 18px", borderRadius: 12, background: BLA, color: "#FFFFFF", fontSize: 14, fontWeight: 550, textDecoration: "none", whiteSpace: "nowrap" }}>
              Sjekk saken din
            </Link>
          </div>
        </div>
      </header>

      <section id="top" className="wrap" style={{ paddingTop: 80, paddingBottom: 96, display: "flex", flexWrap: "wrap", gap: 64, alignItems: "center" }}>
        <div style={{ flex: "1 1 460px", minWidth: 0, display: "flex", flexDirection: "column", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: MONO, fontSize: 12.5, color: BLA }}>
            <span>Forbrukerkjøpsloven</span>
            <span style={{ height: 1, width: 48, background: "#CBD3DD" }} />
          </div>
          <h1 style={{ margin: 0, fontSize: "clamp(38px, 5.4vw, 64px)", lineHeight: 1.02, letterSpacing: "-0.042em", fontWeight: 600 }}>Feil på bilen du kjøpte? Reklamer med loven og praksis på din side.</h1>
          <p style={{ margin: 0, fontSize: 18, lineHeight: 1.6, color: "#455063", maxWidth: "52ch" }}>
            Sjekk gratis om du har en sak. Har du det, kan du få et reklamasjonsbrev med lovhenvisninger tilpasset saken din og et vedtak der kjøperen vant en lignende sak.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginTop: 4 }}>
            <SjekkKnapp stor />
            <a className="btn-sec" href="#slik" style={{ display: "inline-flex", alignItems: "center", height: 54, padding: "0 22px", borderRadius: 14, border: "1px solid #CBD3DD", background: "#FFFFFF", color: "#455063", fontSize: 16, fontWeight: 550, textDecoration: "none" }}>
              Slik fungerer det
            </a>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 22px", fontSize: 13.5, color: "#5B6576" }}>
            {["Gratis saksvurdering", "Ingen registrering", "Sjekken lagres bare i nettleseren din"].map((t) => (
              <span key={t} style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <Gronn />
                {t}
              </span>
            ))}
          </div>
        </div>

        <div className="hero-visual" style={{ flex: "1 1 440px", minWidth: 0, position: "relative", padding: "28px 0 0" }}>
          <div className="hero-bg" aria-hidden="true" style={{ position: "absolute", inset: "0 -20px 0 40px", borderRadius: 28, background: "#ECEFF3" }} />
          <div className="letter-pad" style={{ position: "relative", marginLeft: 28, background: "#FFFFFF", borderRadius: 6, boxShadow: "0 0 0 1px rgba(16,20,26,.04), 0 2px 4px rgba(16,20,26,.04), 0 40px 70px -34px rgba(16,20,26,.35)", padding: 40, fontFamily: "var(--f-doc)", fontSize: 14, lineHeight: 1.62, color: "#1A1E24" }}>
            <div>Oslo, 16. oktober 2026</div>
            <div style={{ fontWeight: 700, margin: "18px 0 12px" }}>Reklamasjon på mangel ved Volkswagen ID.4, reg.nr. EL 48213</div>
            <p style={{ margin: "0 0 12px" }}>Bilen har en mangel, og jeg reklamerer med dette etter forbrukerkjøpsloven § 27.</p>
            <div style={brevH}>Rettslig grunnlag</div>
            <p style={{ margin: "0 0 12px" }}>
              Feilen viste seg tre måneder etter overtakelsen. Etter <span style={merket}>§ 18 annet ledd</span> formodes den å ha eksistert ved leveringen.
            </p>
            <div style={brevH}>Krav</div>
            <p style={{ margin: 0 }}>Jeg krever at mangelen rettes, jf. § 29, uten kostnad for meg og innen rimelig tid.</p>
            <div style={brevH}>Praksis fra Forbrukerklageutvalget</div>
            <p style={{ margin: 0 }}>
              I <span style={merket}>sak 104368</span> sviktet drivlinjen på en brukt elbil etter ni måneder, og Forbrukerklageutvalget hevet kjøpet.
            </p>
          </div>
          <div className="float-plate" aria-hidden="true" style={{ position: "absolute", top: 4, right: -8, display: "flex", height: 46, border: "2px solid #1B1B1B", borderRadius: 7, background: "#FFFFFF", overflow: "hidden", boxShadow: "0 14px 28px -14px rgba(16,20,26,.45)", transform: "rotate(3deg)" }}>
            <div style={{ width: 26, background: "#1E4AA6", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 4, paddingBottom: 5 }}>
              <svg width="14" height="10" viewBox="0 0 22 16">
                <rect width="22" height="16" fill="#BA0C2F" />
                <path d="M0 8h22M8 0v16" stroke="#FFFFFF" strokeWidth="4" />
                <path d="M0 8h22M8 0v16" stroke="#00205B" strokeWidth="2" />
              </svg>
              <span style={{ color: "#FFFFFF", fontSize: 10, fontWeight: 700, lineHeight: 1 }}>N</span>
            </div>
            <div style={{ padding: "0 14px", display: "flex", alignItems: "center", fontFamily: "var(--f-plate)", fontWeight: 600, fontSize: 27, letterSpacing: "0.07em", color: "#111111" }}>EL 48213</div>
          </div>
        </div>
      </section>

      <section id="slik" style={hvit}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 52 }}>
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
            <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={kicker}>Slik fungerer det</div>
              <h2 style={h2}>Fra spørsmål til ferdig brev</h2>
            </div>
            <p style={{ ...ingress, maxWidth: 420, fontSize: 15.5 }}>
              {GRATIS ? "Saksvurderingen og brevet er gratis i en prøveperiode. Svarene dine fylles inn i brevet." : "Saksvurderingen er gratis. Du betaler bare hvis du vil ha brevet, og da er svarene dine allerede fylt inn."}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            <Steg n={1} tittel="Sjekk saken gratis">
              Svar på noen korte spørsmål om bilen, feilen og kjøpet. Det tar rundt to minutter.
            </Steg>
            <Steg n={2} tittel="Se vurderingen">
              Du får vite om saken ser sterk ut, hvilke frister som gjelder, og vunnede saker som ligner din.
            </Steg>
            <Steg n={3} tittel="Skriv og send brevet">
              {GRATIS ? "Åpne brevet" : "Lås opp brevet"} og få et brev som viser til en vunnet sak og argumenterer for at du bør få samme resultat.
            </Steg>
          </div>
        </div>
      </section>

      <section id="saker" className="wrap" style={{ paddingTop: 104, paddingBottom: 104, display: "flex", flexWrap: "wrap", gap: 56, alignItems: "center" }}>
        <div style={{ flex: "1 1 400px", minWidth: 0, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={kicker}>Vunnede saker</div>
          <h2 style={h2}>Brevet viser til en sak som ligner din, og som forbrukeren vant</h2>
          <p style={{ ...ingress, maxWidth: "54ch" }}>
            Forbrukerklageutvalget avgjør tvister mellom forbrukere og bilforhandlere, og vedtakene er offentlige. Vi sammenligner saken din med vunnede bilsaker og bruker den som ligner mest, med saksnummer og lenke til vedtaket.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, fontSize: 15, lineHeight: 1.5, color: "#455063" }}>
            {["Bare ekte vedtak der forbrukeren fikk medhold mot en profesjonell selger", "Sammenlignet på feiltype, bilens alder og kjørelengde, tidspunkt og forbehold i kontrakten", "Brevet siterer utvalget og viser hvor din sak står like sterkt"].map((t) => (
              <span key={t} style={{ display: "flex", gap: 12 }}>
                <span style={{ marginTop: 3, display: "inline-flex" }}>
                  <Gronn s={16} farge={BLA} />
                </span>
                {t}
              </span>
            ))}
          </div>
          {n !== null && <div style={{ fontFamily: MONO, fontSize: 12.5, color: "#5B6576", marginTop: 4 }}>Søker i {tall(n)} vedtak fra Forbrukerklageutvalget og Forbrukertvistutvalget</div>}
        </div>
        <div style={{ flex: "1 1 460px", minWidth: 0, position: "relative", background: "#FFFFFF", border: "1px solid transparent", borderRadius: 22, padding: "26px 26px 22px", boxShadow: "var(--sh-1)" }}>
          <span style={{ position: "absolute", top: -11, right: 22, fontFamily: MONO, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "#10141A", color: "#FFFFFF" }}>Eksempel</span>
          <div style={{ ...radGrid, paddingBottom: 12, fontSize: 12, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", color: "#5B6576" }}>
            <span />
            <span>Din sak</span>
            <span style={{ color: BLA }}>Sak 52074</span>
          </div>
          <Sammenligning felt="Selger" din="Bilforhandler" sak="Bilforhandler" />
          <Sammenligning felt="Bil" din="Brukt, fra 2015" sak="Brukt Peugeot 308 fra 2014" />
          <Sammenligning felt="Feil" din="Motoren bruker mye olje" sak="Nesten 1 liter olje per 1 000 km" />
          <Sammenligning felt="Kontrakt" din="«Som den er»" sak="«Som den står»" />
          <Sammenligning felt="Oppdaget" din="Etter tre uker" sak="Etter to uker" />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 14, flexWrap: "wrap", marginTop: 4, padding: "16px 18px", borderRadius: 14, background: "#E4F3EA" }}>
            <span style={{ fontSize: 14, lineHeight: 1.5, color: "#10141A" }}>
              <b style={{ fontWeight: 600 }}>Forbrukeren vant.</b> Kjøpet ble hevet, og forhandleren betalte tilbake 84&nbsp;539&nbsp;kr.
            </span>
            <a href="https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-52074.pdf" target="_blank" rel="noopener" style={{ fontSize: 13, fontWeight: 550, whiteSpace: "nowrap", color: BLA }}>
              Les vedtaket
            </a>
          </div>
        </div>
      </section>

      <section id="rettigheter" className="wrap" style={{ paddingTop: 104, paddingBottom: 104, display: "flex", flexDirection: "column", gap: 52 }}>
        <div style={{ maxWidth: 680, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={kicker}>Dine rettigheter</div>
          <h2 style={h2}>Loven står sterkere på din side enn mange forhandlere gir inntrykk av</h2>
          <p style={ingress}>Kjøper du bil som privatperson fra en forhandler, gjelder forbrukerkjøpsloven. Den kan ikke avtales bort til din ugunst.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 0, borderTop: "1px solid #CBD3DD" }}>
          <Rettighet tall="2 år" tittel="Forhandleren har som hovedregel bevisbyrden" tekst="En feil som viser seg innen to år etter levering, regnes som hovedregel for å ha vært der fra start. For kjøp før 2024 gjelder seks måneder." lov="forbrkjl. § 18" />
          <Rettighet tall="5 år" tittel="Reklamasjonsfrist for bil" tekst="En bil er ment å vare vesentlig lenger enn to år, så du kan reklamere i opptil fem år etter overtakelsen, så lenge du sier fra innen rimelig tid etter at du oppdaget feilen." lov="forbrkjl. § 27" />
          <Rettighet tall="2 mnd" tittel="Alltid i tide" tekst="Sier du fra innen to måneder etter at du oppdaget feilen, regnes reklamasjonen alltid som rettidig, så lenge det er innen fem år etter overtakelsen." lov="forbrkjl. § 27" />
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 32, padding: 36, borderRadius: 24, background: "#FFFFFF", border: "1px solid transparent", boxShadow: "var(--sh-1)" }}>
          <div style={{ flex: "1 1 260px", minWidth: 0, display: "flex", flexDirection: "column", gap: 10 }}>
            <h3 style={{ margin: 0, fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em" }}>Dette kan du kreve</h3>
            <p style={{ ...ingress, fontSize: 15 }}>Forhandleren har normalt rett til å rette feilen først. Prisavslag og heving blir aktuelt når det ikke skjer, ikke lykkes eller ikke er mulig. I tillegg kan du kreve dekket utgifter feilen har påført deg.</p>
          </div>
          <div style={{ flex: "2 1 480px", minWidth: 0, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <Krav navn="Retting" tekst="Gratis reparasjon" par="§ 29" />
            <Krav navn="Omlevering" tekst="En tilsvarende bil" par="§ 29" />
            <Krav navn="Prisavslag" tekst="Penger tilbake, du beholder bilen" par="§ 31" />
            <Krav navn="Heving" tekst="Kjøpet går tilbake" par="§ 32" />
          </div>
        </div>
      </section>

      <section id="avslag" style={hvit}>
        <div className="wrap" style={{ paddingTop: 96, paddingBottom: 96, display: "flex", flexWrap: "wrap", gap: 56, alignItems: "flex-start" }}>
          <div style={{ flex: "1 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={kicker}>Hvis forhandleren sier nei</div>
            <h2 style={h2}>Et avslag er ikke slutten på saken</h2>
            <p style={ingress}>Brevet sier tydelig hva neste steg blir, så forhandleren vet hva som skjer hvis de sier nei.</p>
          </div>
          <ol style={{ flex: "1.3 1 460px", minWidth: 0, margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 0 }}>
            <Trinn n={1} forste tittel="Skriftlig reklamasjon" tekst="Du sender brevet med svarfrist, normalt 14 dager." />
            <Trinn n={2} tittel="Mekling hos Forbrukertilsynet" tekst="Forbrukertilsynet tar kontakt med forhandleren og prøver å finne en løsning." />
            <Trinn n={3} siste tittel="Forbrukerklageutvalget" tekst="Fører ikke meklingen frem, kan saken avgjøres her. Vedtaket har samme virkning som en dom hvis det ikke bringes inn for tingretten innen én måned." />
          </ol>
        </div>
      </section>

      <section id="sporsmal" className="wrap faq" style={{ paddingTop: 104, paddingBottom: 104, display: "flex", flexWrap: "wrap", gap: 56 }}>
        <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={kicker}>Spørsmål</div>
          <h2 style={h2}>Før du begynner</h2>
        </div>
        <div style={{ flex: "2 1 560px", minWidth: 0, display: "flex", flexDirection: "column", borderTop: "1px solid #CBD3DD" }}>
          <Sporsmal q="Hva koster det?">{GRATIS ? "Saksvurderingen og brevet er gratis i en prøveperiode." : `Saksvurderingen er gratis. Brevet koster kr ${tall(PRIS)} som engangsbeløp, og du betaler først etter at du har sett vurderingen.`}</Sporsmal>
          <Sporsmal q="Hvor kommer de vunnede sakene fra?">
            Fra vedtak i Forbrukerklageutvalget og forløperen Forbrukertvistutvalget, som Forbrukertilsynet publiserer. Brevet oppgir saksnummer og lenke, så forhandleren kan lese vedtaket selv. Hver sak vurderes konkret, så en lignende sak er et sterkt argument, men ingen garanti for samme utfall.
          </Sporsmal>
          <Sporsmal q="Gjelder dette også bruktbil?">
            Ja, Tvistr er laget for bruktbil kjøpt fra forhandler, og da gjelder forbrukerkjøpsloven. Står det «som den er» i kontrakten, kan forhandleren likevel ha ansvar. For kjøp fra 2024 er et generelt forbehold ikke nok, og for eldre kjøp har bilen en mangel hvis den er i dårligere stand enn du hadde grunn til å forvente.
          </Sporsmal>
          <Sporsmal q="Jeg kjøpte bilen av en privatperson. Kan jeg bruke dette?">Brevet er laget for kjøp fra forhandler. Ved kjøp mellom privatpersoner gjelder kjøpsloven, og reglene er strengere for deg som kjøper. Forbrukerrådet kan gi råd om slike saker.</Sporsmal>
          <Sporsmal q="Må forhandleren få reparere først?">Som hovedregel ja. Du kan likevel sette prisavslag eller heving som subsidiært krav, slik at det gjelder hvis rettingen ikke skjer innen rimelig tid eller ikke lykkes.</Sporsmal>
          <Sporsmal q="Hva skjer med opplysningene jeg fyller inn?">Den gratis sjekken lagres bare i nettleseren din. Når du {GRATIS ? "åpner" : "kjøper"} brevet, lagrer vi saken hos oss, slik at du kan åpne den igjen med lenken du får. Alle som har lenken, kan åpne saken, så ikke del den med andre. Vedlegg lastes ikke opp. Bare filnavnene brukes i vedleggslisten.</Sporsmal>
          <Sporsmal q="Er dette juridisk rådgivning?">Nei. Tvistr er en mal som bygger på forbrukerkjøpsloven. Er saken stor eller uvanlig, bør du snakke med Forbrukerrådet eller en advokat.</Sporsmal>
        </div>
      </section>

      <section className="wrap" style={{ paddingBottom: 96 }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 32, padding: "clamp(36px, 5vw, 64px)", borderRadius: 28, background: BLA, color: "#FFFFFF" }}>
          <div style={{ flex: "1 1 420px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(28px, 3.4vw, 42px)", lineHeight: 1.1, letterSpacing: "-0.035em", fontWeight: 600 }}>Sjekk saken din i dag</h2>
            <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#D5E1F1", maxWidth: "50ch" }}>Jo før du sier fra, jo sterkere står du. Saksvurderingen tar rundt to minutter og er gratis.</p>
          </div>
          <SjekkKnapp hvitKnapp />
        </div>
      </section>

      <Bunn />
    </div>
  );
}
