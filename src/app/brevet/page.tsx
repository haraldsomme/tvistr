import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { tall } from "@/lib/brev/format";
import { antallVedtak } from "@/lib/vurdering/antall";
import { Bunn } from "../deler/bunn";
import { Pil } from "../deler/ikoner";
import { Topp } from "../deler/topp";

// What the letter contains, in words. Every claim here must hold for the code (see docs/app.md): the
// ranking in src/lib/matching, the quote check in src/lib/avgjorende, the letter in src/lib/app/brev.ts.
export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Dette får du i brevet – Tvistr",
  description: "Hva reklamasjonsbrevet fra Tvistr inneholder: et ekte vedtak som ligner din sak, loven og fristene som gjelder deg, og kravet ditt.",
};

const BLA = "#1F3A5F";
const kicker: CSSProperties = { fontFamily: "var(--f-mono)", fontSize: 12.5, color: BLA };
const h2: CSSProperties = { margin: 0, fontSize: "clamp(26px, 3vw, 36px)", lineHeight: 1.1, letterSpacing: "-0.03em", fontWeight: 600 };
const tekst: CSSProperties = { margin: 0, fontSize: 16, lineHeight: 1.65, color: "#465150", maxWidth: "62ch" };

function Del({ kort, tittel, children }: { kort: string; tittel: string; children: ReactNode }) {
  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 14, paddingTop: 48, borderTop: "1px solid #CDD5D2" }}>
      <div style={kicker}>{kort}</div>
      <h2 style={h2}>{tittel}</h2>
      {children}
    </section>
  );
}

const DELER: [string, string][] = [
  ["Deg og forhandleren, dato og emne", "Satt opp som et formelt brev, med reklamasjonen i første avsnitt."],
  ["Mangelen", "Hva som er galt, når du oppdaget det, hva verkstedet fant og hva selgeren sa eller lovet før kjøpet."],
  ["Rettslig grunnlag", "Paragrafene som gjelder for din sak, etter loven slik den var da du kjøpte bilen."],
  ["Praksis fra Forbrukerklageutvalget", "Henvisning til et vedtak som ligner saken din, med ordrett sitat."],
  ["Krav", "Hovedkravet og et reservekrav, med hjemmel."],
  ["Utgifter og lånebil", "Utgifter feilen har påført deg, og ønske om lånebil mens bilen repareres."],
  ["Svarfrist og neste steg", "Fristen forhandleren har, og at du ellers tar saken til mekling hos Forbrukertilsynet og videre til Forbrukerklageutvalget."],
  ["Vedlegg", "Liste over dokumentene du legger ved, som kontrakt, verkstedrapport og bilder."],
];

export default async function Brevet() {
  const n = await antallVedtak();
  return (
    <div className="home" style={{ minHeight: "100vh", background: "#F4F5F6" }}>
      <Topp />
      <main className="wrap" style={{ maxWidth: 820, paddingTop: 72, paddingBottom: 96, display: "flex", flexDirection: "column", gap: 48 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={kicker}>Dette får du</div>
          <h1 style={{ margin: 0, fontSize: "clamp(34px, 4.6vw, 52px)", lineHeight: 1.05, letterSpacing: "-0.04em", fontWeight: 600 }}>Et reklamasjonsbrev bygget på loven og på saker kjøpere har vunnet</h1>
          <p style={{ ...tekst, fontSize: 18 }}>
            Brevet bygger på forbrukerkjøpsloven slik den gjaldt da du kjøpte bilen, og på vedtak fra Forbrukerklageutvalget der kjøpere fikk medhold mot forhandlere. Svarene dine fra sjekken fylles inn.
          </p>
        </div>

        <Del kort="01" tittel="Et ekte vedtak som ligner din sak">
          <p style={tekst}>
            Vi sammenligner saken din med {n !== null ? `${tall(n)} vedtak` : "vedtakene"} fra Forbrukerklageutvalget og forløperen Forbrukertvistutvalget, og velger blant dem der kjøperen fikk medhold. Sammenligningen ser på:
          </p>
          <ul style={{ ...tekst, paddingLeft: 20 }}>
            <li>feilen: samme del av bilen og samme slags svikt</li>
            <li>når feilen viste seg etter overtakelsen</li>
            <li>bilens alder og kjørelengde</li>
            <li>om bilen ble solgt «som den er»</li>
          </ul>
          <p style={tekst}>
            Brevet oppgir saksnummer og dato, og siterer utvalgets egne ord. Hvert sitat er kontrollert mot vedtaksteksten. Står saken din like sterkt som vedtaket på de punktene vi kan sammenligne, sier brevet det. Ellers påstår det ikke mer enn at vedtaket gjelder samme feil eller samme rettslige spørsmål. I brevet kan du bytte til et annet av opptil ti vedtak som ligner.
          </p>
        </Del>

        <Del kort="02" tittel="Loven og fristene som gjelder for deg">
          <p style={tekst}>
            For kjøp fra 2024 formodes en feil som viser seg innen to år etter levering å ha vært der fra start, og forhandleren må bevise noe annet. For kjøp før 2024 er perioden seks måneder, og paragrafene i brevet følger samme skille.
          </p>
          <p style={tekst}>
            Fristene regnes ut fra datoene du oppgir. Brevet sier at du har reklamert i tide bare når det er innen to måneder etter at du oppdaget feilen, og innen fem år etter overtakelsen. Mangler vi datoer, sier brevet ingenting om fristen.
          </p>
        </Del>

        <Del kort="03" tittel="Brevet, del for del">
          <div style={{ display: "flex", flexDirection: "column" }}>
            {DELER.map(([t, b]) => (
              <div key={t} style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px", padding: "16px 0", borderTop: "1px solid #E3E6E8" }}>
                <div style={{ flex: "1 1 230px", fontWeight: 600, fontSize: 15.5 }}>{t}</div>
                <div style={{ flex: "2 1 340px", fontSize: 15, lineHeight: 1.55, color: "#465150" }}>{b}</div>
              </div>
            ))}
          </div>
        </Del>

        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 24, padding: "clamp(28px, 4vw, 44px)", borderRadius: 24, background: BLA, color: "#FFFFFF" }}>
          <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: "clamp(24px, 3vw, 32px)", letterSpacing: "-0.03em", fontWeight: 600 }}>Sjekk saken din først</h2>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "#D5DEEA" }}>Sjekken er gratis, tar rundt to minutter og krever ingen registrering.</p>
          </div>
          <Link href="/sak?start" style={{ display: "inline-flex", alignItems: "center", gap: 10, height: 54, padding: "0 24px", borderRadius: 14, background: "#FFFFFF", color: BLA, fontSize: 16, fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" }}>
            Sjekk saken din gratis
            <Pil />
          </Link>
        </div>
      </main>
      <Bunn />
    </div>
  );
}
