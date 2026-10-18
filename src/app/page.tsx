import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { MaalVisning } from "@/app/maal-visning";
import { tall } from "@/lib/brev/format";
import { GRATIS, PRIS } from "@/lib/pris";
import { antallVedtak } from "@/lib/vurdering/antall";
import { Bunn } from "./deler/bunn";
import { FANER } from "./eksempelbrev";
import { Hake, Pil } from "./deler/ikoner";
import { HeroBrev } from "./hero-brev";
import { Ordmerke } from "./deler/ordmerke";
import { TilBrevet } from "./til-brevet";

// The landing page (the artifact's home view). The number of decisions is read from the database when
// the site is built.
export const dynamic = "force-static";

const MONO = "var(--f-mono)";
const BLA = "#2B5BF0";
const kicker: CSSProperties = { fontFamily: MONO, fontSize: 12.5, color: BLA };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(30px, 3.6vw, 44px)", lineHeight: 1.08, letterSpacing: "-0.035em", fontWeight: 600 };
const ingress: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.6, color: "#455063" };
const kort: CSSProperties = { display: "flex", flexDirection: "column", gap: 14, padding: 28, border: "1px solid transparent", borderRadius: 20, background: "#FFFFFF", boxShadow: "var(--sh-1)" };
const hvit: CSSProperties = { background: "#FFFFFF", borderTop: "1px solid #E2E6EC", borderBottom: "1px solid #E2E6EC" };
const lovtag: CSSProperties = { alignSelf: "flex-start", marginTop: 4, fontFamily: MONO, fontSize: 11, padding: "3px 9px", borderRadius: 999, background: "#E8EEFE", color: BLA };

const Gronn =({ s = 15, farge = "#1E7A4C" }: { s?: number; farge?: string }) => (
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

        <div style={{ flex: "1 1 420px", minWidth: 0, maxWidth: 540 }}>
          <HeroBrev faner={FANER} />
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
          <h2 style={h2}>Brevet viser til en sak som ligner din, og som kjøperen vant</h2>
          <p style={{ ...ingress, maxWidth: "54ch" }}>
            Vedtakene fra Forbrukerklageutvalget er offentlige. Vi sammenligner saken din med {n !== null ? `${tall(n)} vedtak` : "vedtakene"} og bruker den som ligner mest, med saksnummer og lenke.
          </p>
        </div>
        <div style={{ flex: "1 1 420px", minWidth: 0, background: "#FFFFFF", border: "1px solid transparent", borderRadius: 22, padding: 26, boxShadow: "var(--sh-1)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 600 }}>Sak 52074 · Peugeot 308 2014</div>
              <div style={{ fontSize: 13.5, color: "#5B6576", marginTop: 2 }}>Vedtak 24. november 2025 · brukt, solgt «som den er»</div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 999, background: "#E4F3EA", color: "#1E7A4C" }}>Heving</span>
          </div>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.55, color: "#455063" }}>Motoren brukte nesten én liter olje per 1 000 km. Kjøpet ble hevet, og forhandleren måtte betale tilbake 84&nbsp;539&nbsp;kr.</p>
          <a href="https://vedtak-api.forbrukertilsynet.no/api/pdf/FKU-2025-52074.pdf" target="_blank" rel="noopener" style={{ fontSize: 14, fontWeight: 550, color: BLA }}>
            Les vedtaket
          </a>
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
