import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MaalVisning } from "@/app/maal-visning";
import { tall } from "@/lib/brev/format";
import { PRIS } from "@/lib/pris";
import { antallVedtak } from "@/lib/vurdering/antall";
import { Bunn } from "./deler/bunn";
import { Pil, Pluss } from "./deler/ikoner";
import { HeroBrev } from "./hero-brev";
import { LandingTopp } from "./landing-topp";

// The landing page. The number of decisions is read from the database when the site is built.
export const dynamic = "force-static";

const MONO = "var(--f-mono)";
const BLA = "#1F3A5F";
const MORK = "#16294A";
const SEKSJON = "clamp(64px, 8vw, 112px)";

// The points beside the example letter; the number of each is the marker on the sheet (hero-brev.tsx).
const PUNKTER = [
  "Dine opplysninger og datoene. Fristene regnes ut fra dem.",
  "Feilen, slik du har beskrevet den.",
  "Paragrafene slik loven gjaldt da du kjøpte bilen.",
  "Et vedtak der kjøperen vant en lignende sak, og hvorfor din sak står like sterkt.",
  "Kravet ditt med hjemmel, og hva forhandleren må gjøre.",
  "Svarfrist, og hva som skjer hvis forhandleren sier nei.",
]

const kicker: CSSProperties = { fontSize: 14, fontWeight: 600, color: BLA };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(32px, 3.8vw, 46px)", lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.035em", color: "#111515", textWrap: "balance" };
const ingress: CSSProperties = { margin: 0, fontSize: 18, lineHeight: 1.6, color: "#465150", textWrap: "pretty" };
const kolonne: CSSProperties = { display: "flex", flexDirection: "column", gap: 16 };
const kortSkygge = "0 0 0 1px rgba(17,21,21,.05), 0 40px 80px -48px rgba(31,58,95,.45)";
const tekstBlokk: CSSProperties = { fontFamily: MONO, fontSize: 13 };

function Overskrift({ merke, tittel, children, farge }: { merke: string; tittel: string; children?: ReactNode; farge?: "lys" }) {
  return (
    <div style={kolonne}>
      <span style={{ ...kicker, color: farge ? "#B9C7DB" : BLA }}>{merke}</span>
      <h2 style={{ ...h2, color: farge ? "#FFFFFF" : "#111515" }}>{tittel}</h2>
      {children && <p style={{ ...ingress, color: farge ? "#D5DEEA" : "#465150" }}>{children}</p>}
    </div>
  );
}

function Steg({ n, tittel, children }: { n: number; tittel: string; children: ReactNode }) {
  return (
    <div style={{ padding: "30px 28px 32px", borderRadius: 24, background: "#F4F5F6", display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ width: 44, height: 44, borderRadius: "50%", background: BLA, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 17, fontWeight: 600 }}>{n}</span>
      <h3 style={{ margin: "10px 0 0", fontSize: 21, fontWeight: 600, letterSpacing: "-0.02em", color: "#111515" }}>{tittel}</h3>
      <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#465150", textWrap: "pretty" }}>{children}</p>
    </div>
  );
}

function Rettighet({ tall: t, tittel, tekst, lov }: { tall: string; tittel: string; tekst: string; lov: string }) {
  return (
    <div style={{ padding: "30px 28px", borderRadius: 24, background: MORK, display: "flex", flexDirection: "column", gap: 14 }}>
      <span style={{ fontSize: 52, lineHeight: 1, fontWeight: 600, letterSpacing: "-0.04em", color: "#FFFFFF" }}>{t}</span>
      <h3 style={{ margin: "8px 0 0", fontSize: 19, lineHeight: 1.35, fontWeight: 600, letterSpacing: "-0.015em", color: "#FFFFFF" }}>{tittel}</h3>
      <p style={{ margin: 0, flex: 1, fontSize: 15.5, lineHeight: 1.6, color: "#D5DEEA", textWrap: "pretty" }}>{tekst}</p>
      <span style={{ ...tekstBlokk, color: "#B9C7DB" }}>{lov}</span>
    </div>
  );
}

function Krav({ navn, tekst, par, siste }: { navn: string; tekst: string; par: string; siste?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: siste ? undefined : "1px solid #E3E7E5" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 3 }}>
        <span style={{ fontSize: 17, fontWeight: 600, color: "#111515" }}>{navn}</span>
        <span style={{ fontSize: 15, color: "#465150" }}>{tekst}</span>
      </div>
      <span style={{ ...tekstBlokk, padding: "5px 10px", borderRadius: 8, background: "#EBEFF5", color: BLA }}>{par}</span>
    </div>
  );
}

function Trinn({ n, tittel, children, ramme, siste }: { n: number; tittel: string; children: ReactNode; ramme?: boolean; siste?: boolean }) {
  return (
    <li style={{ display: "grid", gridTemplateColumns: "44px minmax(0, 1fr)", columnGap: 20 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <span
          style={{
            width: 44, height: 44, flex: "none", boxSizing: "border-box", borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 16, fontWeight: 600,
            ...(ramme ? { border: `2px solid ${BLA}`, background: "#FFFFFF", color: BLA } : { background: BLA, color: "#FFFFFF" }),
          }}
        >
          {n}
        </span>
        {!siste && <span aria-hidden="true" style={{ width: 2, flex: 1, background: "#D3DAE4" }} />}
      </div>
      <div style={{ padding: `9px 0 ${siste ? 0 : 32}px`, display: "flex", flexDirection: "column", gap: 6 }}>
        <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em", color: "#111515" }}>{tittel}</span>
        <span style={{ fontSize: 16, lineHeight: 1.6, color: "#465150", textWrap: "pretty" }}>{children}</span>
      </div>
    </li>
  );
}

// The questions open one at a time (a shared `name` makes the browser close the others), without script.
function Sporsmal({ q, apen, children }: { q: string; apen?: boolean; children: ReactNode }) {
  return (
    <details name="sporsmal" open={apen} style={{ borderBottom: "1px solid #E3E7E5" }}>
      <summary style={{ minHeight: 68, padding: "18px 0", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 20, fontSize: 17.5, fontWeight: 600, letterSpacing: "-0.01em", color: "#111515" }}>
        <span>{q}</span>
        <span className="lp-pm" aria-hidden="true">
          <Pluss s={14} w={2.6} />
        </span>
      </summary>
      <p style={{ margin: 0, padding: "0 52px 24px 0", fontSize: 16, lineHeight: 1.65, color: "#465150", textWrap: "pretty" }}>{children}</p>
    </details>
  );
}

const Sjekk = ({ storrelse, hvit }: { storrelse: number; hvit?: boolean }) => (
  <Link
    href="/sak?start"
    className={hvit ? "lp-hvit" : "lp-pri"}
    style={{
      height: storrelse, padding: hvit ? "0 28px" : "0 26px", borderRadius: 14, display: "flex", alignItems: "center", gap: 10, fontSize: hvit ? 17 : 16.5, fontWeight: hvit ? 600 : 500, textDecoration: "none", whiteSpace: "nowrap",
      ...(hvit ? { marginTop: 10 } : { boxShadow: "0 12px 28px -14px rgba(31,58,95,.7)" }),
    }}
  >
    Sjekk saken din gratis
    <Pil />
  </Link>
);

export default async function Home() {
  const n = await antallVedtak();
  return (
    <div className="home lp" style={{ minHeight: "100vh", background: "#F4F5F6", display: "flex", flexDirection: "column" }}>
      <MaalVisning hendelse="landing" />
      <LandingTopp />

      <main id="top" style={{ flex: 1 }}>
        <section className="lp-in lp-hero" style={{ paddingTop: "clamp(40px, 7vw, 88px)", paddingBottom: "clamp(56px, 8vw, 104px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <h1 style={{ margin: 0, fontSize: "clamp(26px, 2.7vw, 36px)", lineHeight: 1.1, fontWeight: 600, letterSpacing: "-0.035em", color: "#111515", textWrap: "balance" }}>Kjøpt bruktbil med feil eller mangler?</h1>
            <p style={{ margin: 0, maxWidth: 520, fontSize: "clamp(17px, 1.5vw, 19px)", lineHeight: 1.6, color: "#465150", textWrap: "pretty" }}>
              Sjekk gratis om du har en sak. Har du det, får du et ferdig reklamasjonsbrev som dette, fylt ut fra svarene dine.
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 14 }}>
              {PUNKTER.map((t, i) => (
                <li key={t} style={{ display: "flex", alignItems: "flex-start", gap: 14, fontSize: 16.5, lineHeight: 1.45, color: "#111515" }}>
                  <span style={{ flex: "none", width: 24, height: 24, marginTop: 1, borderRadius: "50%", background: BLA, color: "#FFFFFF", display: "grid", placeItems: "center", fontSize: 13, fontWeight: 600 }}>{i + 1}</span>
                  <span style={{ textWrap: "pretty" }}>{t}</span>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12, paddingTop: 8 }}>
              <Sjekk storrelse={56} />
              <span style={{ fontSize: 14.5, color: "#465150" }}>Brevet koster kr {tall(PRIS)}. Du betaler først etter vurderingen.</span>
            </div>
          </div>
          <HeroBrev />
        </section>

        <section id="slik" style={{ background: "#FFFFFF", borderTop: "1px solid #E3E6E8", borderBottom: "1px solid #E3E6E8" }}>
          <div className="lp-in" style={{ paddingTop: SEKSJON, paddingBottom: SEKSJON, display: "flex", flexDirection: "column", gap: 48 }}>
            <div style={{ maxWidth: 720 }}>
              <Overskrift merke="Slik fungerer det" tittel="Fra spørsmål til ferdig brev">
                Saksvurderingen er gratis. Du betaler bare hvis du vil ha brevet, og da er svarene dine allerede fylt inn.
              </Overskrift>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 16 }}>
              <Steg n={1} tittel="Sjekk saken gratis">
                Svar på noen korte spørsmål om bilen, feilen og kjøpet. Det tar rundt to minutter.
              </Steg>
              <Steg n={2} tittel="Se vurderingen">
                Du får vite om saken ser sterk ut, hvilke frister som gjelder, og vunnede saker som ligner din.
              </Steg>
              <Steg n={3} tittel="Skriv og send brevet">
                Lås opp brevet og få et brev som viser til en vunnet sak og argumenterer for at du bør få samme resultat.
              </Steg>
            </div>
          </div>
        </section>

        <section id="saker" className="lp-in" style={{ paddingTop: SEKSJON, paddingBottom: SEKSJON, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "clamp(40px, 6vw, 80px)", alignItems: "center" }}>
          <Overskrift merke="Vunnede saker" tittel="Brevet viser til en sak som ligner din, og som kjøperen vant">
            Vedtakene fra Forbrukerklageutvalget er offentlige. Vi sammenligner saken din med {n !== null ? `${tall(n)} vedtak` : "vedtakene"} og bruker den som ligner mest, med saksnummer og lenke.
          </Overskrift>
          <div style={{ padding: "clamp(24px, 3vw, 34px)", borderRadius: 28, background: "#FFFFFF", boxShadow: kortSkygge, display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
                <span style={{ fontSize: 19, fontWeight: 600, letterSpacing: "-0.015em", color: "#111515" }}>Sak 52074 · Peugeot 308 2014</span>
                <span style={{ fontSize: 14.5, color: "#465150" }}>Vedtak 24. november 2025 · brukt, solgt «som den er»</span>
              </div>
              <span style={{ flex: "none", padding: "6px 12px", borderRadius: 999, background: "#E4F3EA", fontSize: 13.5, fontWeight: 600, color: "#155C39" }}>Heving</span>
            </div>
            <div style={{ height: 1, background: "#E3E7E5" }} />
            <p style={{ margin: 0, fontFamily: "var(--f-doc)", fontSize: "clamp(19px, 1.8vw, 22px)", lineHeight: 1.55, color: "#111515", textWrap: "pretty" }}>
              Motoren brukte nesten én liter olje per 1 000 km. Kjøpet ble hevet, og forhandleren måtte betale tilbake 84&nbsp;539&nbsp;kr.
            </p>
            <a className="lp-lenke" href="https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-52074.pdf" target="_blank" rel="noopener" style={{ alignSelf: "flex-start", height: 46, padding: "0 18px", boxSizing: "border-box", borderRadius: 12, display: "flex", alignItems: "center", gap: 8, fontSize: 15, fontWeight: 500, textDecoration: "none" }}>
              Les vedtaket
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 17L17 7M9 7h8v8" />
              </svg>
            </a>
          </div>
        </section>

        <section id="rettigheter" style={{ background: BLA, color: "#FFFFFF" }}>
          <div className="lp-in" style={{ paddingTop: SEKSJON, paddingBottom: SEKSJON, display: "flex", flexDirection: "column", gap: 48 }}>
            <div style={{ maxWidth: 760 }}>
              <Overskrift farge="lys" merke="Dine rettigheter" tittel="Loven står sterkere på din side enn mange forhandlere gir inntrykk av">
                Kjøper du bil som privatperson fra en forhandler, gjelder forbrukerkjøpsloven. Den kan ikke avtales bort til din ugunst.
              </Overskrift>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 300px), 1fr))", gap: 16 }}>
              <Rettighet tall="2 år" tittel="Forhandleren har som hovedregel bevisbyrden" tekst="En feil som viser seg innen to år etter levering, regnes som hovedregel for å ha vært der fra start. For kjøp før 2024 gjelder seks måneder." lov="forbrkjl. § 18" />
              <Rettighet tall="5 år" tittel="Reklamasjonsfrist for bil" tekst="En bil er ment å vare vesentlig lenger enn to år, så du kan reklamere i opptil fem år etter overtakelsen, så lenge du sier fra innen rimelig tid etter at du oppdaget feilen." lov="forbrkjl. § 27" />
              <Rettighet tall="2 mnd" tittel="Alltid i tide" tekst="Sier du fra innen to måneder etter at du oppdaget feilen, regnes reklamasjonen alltid som rettidig, så lenge det er innen fem år etter overtakelsen." lov="forbrkjl. § 27" />
            </div>
            <div style={{ padding: "clamp(24px, 3.4vw, 40px)", borderRadius: 28, background: "#FFFFFF", color: "#111515", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: "clamp(24px, 4vw, 56px)", alignItems: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ margin: 0, fontSize: 26, fontWeight: 600, letterSpacing: "-0.025em", color: "#111515" }}>Dette kan du kreve</h3>
                <p style={{ margin: 0, fontSize: 16, lineHeight: 1.6, color: "#465150", textWrap: "pretty" }}>Forhandleren har normalt rett til å rette feilen først. Prisavslag og heving blir aktuelt når det ikke skjer, ikke lykkes eller ikke er mulig. I tillegg kan du kreve dekket utgifter feilen har påført deg.</p>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <Krav navn="Retting" tekst="Gratis reparasjon" par="§ 29" />
                <Krav navn="Prisavslag" tekst="Penger tilbake, du beholder bilen" par="§ 31" />
                <Krav siste navn="Heving" tekst="Kjøpet går tilbake" par="§ 32" />
              </div>
            </div>
          </div>
        </section>

        <section id="avslag" className="lp-in" style={{ paddingTop: SEKSJON, paddingBottom: SEKSJON, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 420px), 1fr))", gap: "clamp(40px, 6vw, 80px)", alignItems: "start" }}>
          <Overskrift merke="Hvis forhandleren sier nei" tittel="Et avslag er ikke slutten på saken">
            Brevet sier tydelig hva neste steg blir, så forhandleren vet hva som skjer hvis de sier nei.
          </Overskrift>
          <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column" }}>
            <Trinn n={1} tittel="Skriftlig reklamasjon">
              Du sender brevet med svarfrist, normalt 14 dager.
            </Trinn>
            <Trinn n={2} ramme tittel="Mekling hos Forbrukertilsynet">
              Forbrukertilsynet tar kontakt med forhandleren og prøver å finne en løsning.
            </Trinn>
            <Trinn n={3} ramme siste tittel="Forbrukerklageutvalget">
              Fører ikke meklingen frem, kan saken avgjøres her. Vedtaket har samme virkning som en dom hvis det ikke bringes inn for tingretten innen én måned.
            </Trinn>
          </ol>
        </section>

        <section id="sporsmal" style={{ background: "#FFFFFF", borderTop: "1px solid #E3E6E8" }}>
          <div className="lp-in" style={{ paddingTop: SEKSJON, paddingBottom: SEKSJON, display: "flex", flexWrap: "wrap", gap: "clamp(32px, 6vw, 80px)", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 300px", ...kolonne }}>
              <span style={kicker}>Spørsmål</span>
              <h2 style={h2}>Før du begynner</h2>
            </div>
            <div className="lp-faq" style={{ flex: "2 1 min(100%, 560px)", minWidth: 0, display: "flex", flexDirection: "column", borderTop: "1px solid #E3E7E5" }}>
              <Sporsmal apen q="Hva koster det?">
                Saksvurderingen er gratis. Brevet koster kr {tall(PRIS)} som engangsbeløp, og du betaler først etter at du har sett vurderingen.
              </Sporsmal>
              <Sporsmal q="Hvor kommer de vunnede sakene fra?">
                Fra vedtak i Forbrukerklageutvalget og forløperen Forbrukertvistutvalget, som Forbrukertilsynet publiserer. Brevet oppgir saksnummer og lenke, så forhandleren kan lese vedtaket selv. Hver sak vurderes konkret, så en lignende sak er et sterkt argument, men ingen garanti for samme utfall.
              </Sporsmal>
              <Sporsmal q="Gjelder dette også bruktbil?">
                Ja, Tvistr er laget for bruktbil kjøpt fra forhandler, og da gjelder forbrukerkjøpsloven. Står det «som den er» i kontrakten, kan forhandleren likevel ha ansvar. For kjøp fra 2024 er et generelt forbehold ikke nok, og for eldre kjøp har bilen en mangel hvis den er i dårligere stand enn du hadde grunn til å forvente.
              </Sporsmal>
              <Sporsmal q="Jeg kjøpte bilen av en privatperson. Kan jeg bruke dette?">Brevet er laget for kjøp fra forhandler. Ved kjøp mellom privatpersoner gjelder kjøpsloven, og reglene er strengere for deg som kjøper. Forbrukerrådet kan gi råd om slike saker.</Sporsmal>
              <Sporsmal q="Må forhandleren få reparere først?">Som hovedregel ja. Du kan likevel sette prisavslag eller heving som subsidiært krav, slik at det gjelder hvis rettingen ikke skjer innen rimelig tid eller ikke lykkes.</Sporsmal>
              <Sporsmal q="Hva skjer med opplysningene jeg fyller inn?">
                Den gratis sjekken lagres bare i nettleseren din. Når du kjøper brevet, lagrer vi saken hos oss, slik at du kan åpne den igjen når du logger inn med Vipps-kontoen du betalte med. Brevene dine ligger på Min side. Vedlegg lastes ikke opp. Bare filnavnene brukes i vedleggslisten.
              </Sporsmal>
              <Sporsmal q="Er dette juridisk rådgivning?">Nei. Tvistr er en mal som bygger på forbrukerkjøpsloven. Er saken stor eller uvanlig, bør du snakke med Forbrukerrådet eller en advokat.</Sporsmal>
            </div>
          </div>
        </section>

        <section style={{ padding: "0 clamp(12px, 2vw, 24px) clamp(12px, 2vw, 24px)", background: "#FFFFFF" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "clamp(56px, 7vw, 96px) clamp(24px, 5vw, 64px)", borderRadius: 32, background: BLA, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, textAlign: "center" }}>
            <h2 style={{ margin: 0, fontSize: "clamp(34px, 4.4vw, 54px)", lineHeight: 1.06, fontWeight: 600, letterSpacing: "-0.04em", color: "#FFFFFF" }}>Sjekk saken din i dag</h2>
            <p style={{ margin: 0, maxWidth: 520, fontSize: 18, lineHeight: 1.6, color: "#D5DEEA", textWrap: "pretty" }}>Jo før du sier fra, jo sterkere står du. Saksvurderingen tar rundt to minutter og er gratis.</p>
            <Sjekk storrelse={58} hvit />
          </div>
        </section>
      </main>

      <Bunn />
    </div>
  );
}
